"""Credential-exfiltration detector (Defence D4, detective control).

Modelled on the AWS GuardDuty finding
  UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS
It tails the S3 gateway access log (our CloudTrail equivalent). Instance-role credentials are
only ever expected to be used by the instance itself (203.0.113.10). Any API call signed with the
role's access key from a different source address raises a HIGH-severity finding.
"""
import datetime as dt
import json
import os
import time

ACCESS_LOG = "/logs/s3-access.jsonl"
ALERTS = "/logs/alerts.jsonl"
ROLE_KEY = os.environ["ROLE_KEY"]
WEBAPP_IP = os.environ.get("WEBAPP_IP", "203.0.113.10")


def mask(key: str) -> str:
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


def follow(path: str):
    while not os.path.exists(path):
        time.sleep(0.5)
    with open(path, encoding="utf-8") as fh:
        fh.seek(0, os.SEEK_END)
        while True:
            line = fh.readline()
            if not line:
                time.sleep(0.3)
                continue
            yield line


def main() -> None:
    print(f"detector watching {ACCESS_LOG}; trusted source for role key = {WEBAPP_IP}", flush=True)
    for line in follow(ACCESS_LOG):
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("akid") == ROLE_KEY and ev.get("remote_addr") != WEBAPP_IP:
            alert = {
                "time": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "finding": "UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration",
                "severity": "HIGH",
                "access_key": mask(ROLE_KEY),
                "expected_source": WEBAPP_IP,
                "actual_source": ev.get("remote_addr"),
                "api_call": f'{ev.get("method")} {ev.get("uri")}',
                "http_status": ev.get("status"),
            }
            with open(ALERTS, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(alert) + "\n")
            print("ALERT", json.dumps(alert), flush=True)


if __name__ == "__main__":
    main()
