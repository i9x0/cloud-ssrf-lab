"""Quantitative evaluation of one defence configuration.

Usage: python evaluate.py --config C0 --name "Baseline" --imds optional --guard off --iam overprivileged
Writes /results/raw/<config>.json
"""
import argparse
import csv
import io
import json
import os
import statistics
import time

from botocore.exceptions import ClientError

from common import mask, parse_creds, s3_with, ssrf, wait_ready
from payloads import LEGIT, PAYLOADS

ALERTS = "/results/logs/alerts.jsonl"
LEGIT_REPEATS = 10


def count_lines(path):
    if not os.path.exists(path):
        return 0
    with open(path, encoding="utf-8") as fh:
        return sum(1 for _ in fh)


def classify(res, marker):
    if res.get("blocked"):
        return "blocked-by-guard"
    if "error" in res:
        return "fetch-error"
    if res.get("status") == 401:
        return "denied-imdsv2"
    if marker in (res.get("content") or ""):
        return "success"
    return f"no-data-http-{res.get('status')}"


def main():
    ap = argparse.ArgumentParser()
    for a in ("config", "name", "imds", "guard", "iam"):
        ap.add_argument(f"--{a}", required=True)
    args = ap.parse_args()
    wait_ready()
    alerts_before = count_lines(ALERTS)
    out = {"config": args.config, "name": args.name,
           "settings": {"imds": args.imds, "guard": args.guard, "iam": args.iam}}

    # 1) SSRF payload suite
    results, stolen = [], None
    for pid, cat, tech, url, marker in PAYLOADS:
        res = ssrf(url)
        outcome = classify(res, marker)
        results.append({"id": pid, "category": cat, "technique": tech, "url": url, "outcome": outcome,
                        "reason": res.get("reason") or res.get("error") or res.get("status")})
        if outcome == "success" and cat == "metadata" and stolen is None:
            stolen = parse_creds(res.get("content"))
    out["payloads"] = results
    succ = [r for r in results if r["outcome"] == "success"]
    out["payload_success"] = {"total": len(results), "success": len(succ),
                              "by_category": {c: [sum(1 for r in results if r["category"] == c and r["outcome"] == "success"),
                                                  sum(1 for r in results if r["category"] == c)]
                                              for c in ("metadata", "internal-vpc", "localhost")}}

    # 2) Kill chain with the stolen credentials (from the attacker's IP)
    chain = {"ssrf_reached_metadata": any(r["category"] == "metadata" and r["outcome"] == "success" for r in results),
             "credentials_stolen": stolen is not None, "stolen_key": mask(stolen["AccessKeyId"]) if stolen else None,
             "list_buckets": None, "read_customer_data": None, "records_exfiltrated": 0}
    if stolen:
        s3 = s3_with(stolen)
        try:
            chain["list_buckets"] = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
        except ClientError as e:
            chain["list_buckets"] = "denied:" + e.response["Error"]["Code"]
        try:
            body = s3.get_object(Bucket="customer-data", Key="exports/customers.csv")["Body"].read().decode()
            chain["records_exfiltrated"] = len(list(csv.DictReader(io.StringIO(body))))
            chain["read_customer_data"] = "allowed"
        except ClientError as e:
            chain["read_customer_data"] = "denied:" + e.response["Error"]["Code"]
    out["chain"] = chain

    # 3) Legitimate traffic: availability (false positives) and latency overhead
    legit, lat = [], []
    for _ in range(LEGIT_REPEATS):
        for gid, url, marker in LEGIT:
            res = ssrf(url)
            ok = res.get("status") == 200 and marker in (res.get("content") or "")
            legit.append({"id": gid, "ok": ok, "outcome": classify(res, marker)})
            if ok:
                lat.append(res["elapsed_ms"])
    saves = [ssrf("http://cdn.example.net/products/%d" % i, save=True) for i in range(5)]
    out["legit"] = {
        "requests": len(legit), "ok": sum(1 for l in legit if l["ok"]),
        "false_positive_ids": sorted({l["id"] for l in legit if not l["ok"]}),
        "latency_ms": {"mean": round(statistics.mean(lat), 2), "median": round(statistics.median(lat), 2),
                       "p95": round(sorted(lat)[int(0.95 * len(lat)) - 1], 2), "samples": lat} if lat else None,
        "s3_save_ok": sum(1 for s in saves if "saved_key" in s), "s3_save_total": len(saves),
        "s3_save_errors": sorted({s.get("save_error", "")[:80] for s in saves if "save_error" in s}),
    }

    # 4) Detection
    time.sleep(3)
    new_alerts = []
    if os.path.exists(ALERTS):
        with open(ALERTS, encoding="utf-8") as fh:
            new_alerts = [json.loads(l) for l in fh.readlines()[alerts_before:]]
    out["detection"] = {"alerts": len(new_alerts), "sample": new_alerts[:3]}

    os.makedirs("/results/raw", exist_ok=True)
    with open(f"/results/raw/{args.config}.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
    ps = out["payload_success"]
    print(f"[{args.config}] {args.name}: payloads {ps['success']}/{ps['total']} "
          f"{ps['by_category']} | creds stolen={chain['credentials_stolen']} "
          f"records={chain['records_exfiltrated']} | legit {out['legit']['ok']}/{out['legit']['requests']} "
          f"S3 save {out['legit']['s3_save_ok']}/5 | alerts={len(new_alerts)}")


if __name__ == "__main__":
    main()
