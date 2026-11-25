"""Emulated cloud Instance Metadata Service (modelled on AWS EC2 IMDS).

Listens on the link-local address 169.254.169.254, exactly like the real service.
IMDS_MODE=optional  -> IMDSv1 + IMDSv2 (plain GET requests work: the AWS default before 2024)
IMDS_MODE=required  -> IMDSv2 only (a session token obtained with PUT is mandatory)
Every request is logged to /logs/imds.jsonl.
"""
import datetime as dt
import json
import os
import secrets
import time

from flask import Flask, Response, request

app = Flask(__name__)
MODE = os.environ.get("IMDS_MODE", "optional")
ROLE = os.environ.get("ROLE_NAME", "webapp-role")
ROLE_KEY = os.environ["ROLE_KEY"]
ROLE_SECRET = os.environ["ROLE_SECRET"]
LOG = "/logs/imds.jsonl"
TOKENS: dict[str, float] = {}

META = {
    "ami-id": "ami-0c55b159cbfafe1f0",
    "hostname": "ip-10-0-1-10.ec2.internal",
    "instance-id": "i-0a1b2c3d4e5f67890",
    "instance-type": "t3.micro",
    "local-ipv4": "10.0.1.10",
    "public-ipv4": "203.0.113.10",
    "placement/region": "us-east-1",
    "placement/availability-zone": "us-east-1a",
}


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(decision: str, version: str) -> None:
    entry = {"time": now(), "src": request.remote_addr, "method": request.method,
             "path": request.path, "version": version, "decision": decision,
             "mode": MODE, "ua": request.headers.get("User-Agent", "")}
    with open(LOG, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")


@app.route("/latest/api/token", methods=["PUT"])
def token():
    # Real IMDS refuses token requests that went through a proxy (X-Forwarded-For present).
    if request.headers.get("X-Forwarded-For"):
        log("denied-forwarded", "v2")
        return Response("", 403)
    try:
        ttl = int(request.headers.get("X-aws-ec2-metadata-token-ttl-seconds", ""))
    except ValueError:
        ttl = 0
    if not 1 <= ttl <= 21600:
        log("denied-bad-ttl", "v2")
        return Response("", 400)
    tok = secrets.token_urlsafe(40)
    TOKENS[tok] = time.time() + ttl
    log("token-issued", "v2")
    return Response(tok, 200, mimetype="text/plain")


def authorize():
    tok = request.headers.get("X-aws-ec2-metadata-token")
    if tok is not None:
        return TOKENS.get(tok, 0) > time.time(), "v2"
    if MODE == "required":
        return False, "v1"
    return True, "v1"


@app.route("/latest/meta-data/", methods=["GET"])
@app.route("/latest/meta-data/<path:path>", methods=["GET"])
def meta(path: str = ""):
    ok, version = authorize()
    if not ok:
        log("denied-401", version)
        return Response("", 401)
    path = path.rstrip("/")
    body = None
    if path == "":
        body = "\n".join(sorted({k.split("/")[0] + ("/" if "/" in k else "") for k in META} | {"iam/"}))
    elif path in META:
        body = META[path]
    elif path == "placement":
        body = "availability-zone\nregion"
    elif path == "iam":
        body = "info\nsecurity-credentials/"
    elif path == "iam/info":
        body = json.dumps({"Code": "Success", "LastUpdated": now(),
                           "InstanceProfileArn": f"arn:aws:iam::111122223333:instance-profile/{ROLE}",
                           "InstanceProfileId": "AIPAEXAMPLE1234567890"}, indent=2)
    elif path == "iam/security-credentials":
        body = ROLE
    elif path == f"iam/security-credentials/{ROLE}":
        exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=6)
        body = json.dumps({
            "Code": "Success", "LastUpdated": now(), "Type": "AWS-HMAC",
            "AccessKeyId": ROLE_KEY, "SecretAccessKey": ROLE_SECRET,
            "Token": "", "Expiration": exp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }, indent=2)
    if body is None:
        log("not-found", version)
        return Response("", 404)
    log("served", version)
    return Response(body, 200, mimetype="text/plain")


@app.route("/")
@app.route("/latest/")
def root():
    return Response("meta-data\n", 200, mimetype="text/plain")


if __name__ == "__main__":
    print(f"IMDS emulator starting, mode={MODE}")
    app.run(host="0.0.0.0", port=80, threaded=True)
