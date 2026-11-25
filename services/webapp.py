"""LinkPeek: a cloud-hosted "URL preview" web application (the victim).

Users paste a URL; the server fetches it and shows a preview, optionally saving a copy to the
S3 bucket `app-uploads` using the instance-role credentials obtained from the metadata service.
This server-side fetch is the Server-Side Request Forgery (SSRF) entry point.

SSRF_GUARD=off -> vulnerable: fetches any URL and follows redirects (Capital One-style)
SSRF_GUARD=on  -> hardened with ssrf_guard.guarded_get (Defence D2)
"""
import datetime as dt
import html
import json
import os
import time
import uuid

import boto3
import requests
from botocore.config import Config
from flask import Flask, Response, jsonify, request

from ssrf_guard import SSRFBlocked, guarded_get

app = Flask(__name__)
GUARD = os.environ.get("SSRF_GUARD", "off") == "on"
IMDS = "http://169.254.169.254"
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "http://s3.cloud.local:9000")
LOG = "/logs/webapp.jsonl"
_creds_cache: dict = {"t": 0, "c": None}


def log(entry: dict) -> None:
    entry = {"time": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
             "client": request.remote_addr, "guard": GUARD, **entry}
    with open(LOG, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")


def role_credentials() -> dict:
    """Legitimate use of the instance role. Uses IMDSv2 (token) and falls back to IMDSv1."""
    if _creds_cache["c"] and time.time() - _creds_cache["t"] < 60:
        return _creds_cache["c"]
    headers = {}
    try:
        r = requests.put(f"{IMDS}/latest/api/token",
                         headers={"X-aws-ec2-metadata-token-ttl-seconds": "300"}, timeout=2)
        if r.ok:
            headers["X-aws-ec2-metadata-token"] = r.text
    except requests.RequestException:
        pass
    role = requests.get(f"{IMDS}/latest/meta-data/iam/security-credentials/", headers=headers, timeout=2).text.strip()
    creds = requests.get(f"{IMDS}/latest/meta-data/iam/security-credentials/{role}", headers=headers, timeout=2).json()
    _creds_cache.update(t=time.time(), c=creds)
    return creds


def save_to_s3(url: str, body: str) -> str:
    c = role_credentials()
    s3 = boto3.client("s3", endpoint_url=S3_ENDPOINT, region_name="us-east-1",
                      aws_access_key_id=c["AccessKeyId"], aws_secret_access_key=c["SecretAccessKey"],
                      aws_session_token=c.get("Token") or None,
                      config=Config(s3={"addressing_style": "path"}, retries={"max_attempts": 1},
                                    connect_timeout=5, read_timeout=5))
    key = f"previews/{uuid.uuid4().hex}.txt"
    s3.put_object(Bucket="app-uploads", Key=key, Body=f"source: {url}\n\n{body}".encode())
    return key


def do_fetch(url: str, save: bool) -> tuple[dict, int]:
    t0 = time.perf_counter()
    result = {"url": url, "guard": GUARD}
    try:
        resp = guarded_get(url) if GUARD else requests.get(url, timeout=4, allow_redirects=True)
        body = resp.text[:4000]
        result.update(status=resp.status_code, content=body)
        code = 200
        if save and resp.ok:
            try:
                result["saved_key"] = save_to_s3(url, body)
            except Exception as exc:  # report, do not crash
                result["save_error"] = type(exc).__name__ + ": " + str(exc)[:200]
    except SSRFBlocked as exc:
        result.update(blocked=True, reason=str(exc))
        code = 403
    except requests.RequestException as exc:
        result.update(error=type(exc).__name__)
        code = 502
    result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    log({"url": url, "http": code, "status": result.get("status"),
         "blocked": result.get("blocked", False), "reason": result.get("reason")})
    return result, code


@app.get("/api/fetch")
def api_fetch():
    result, code = do_fetch(request.args.get("url", ""), request.args.get("save") == "1")
    return jsonify(result), code


PAGE = """<!doctype html><html><head><meta charset="utf-8"><title>LinkPeek</title>
<style>
body{{font-family:Segoe UI,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0}}
header{{background:#1e293b;padding:16px 28px;border-bottom:3px solid {accent}}}
header h1{{margin:0;font-size:22px}} header span{{color:#94a3b8;font-size:13px}}
main{{max-width:900px;margin:28px auto;padding:0 20px}}
form{{display:flex;gap:8px}} input{{flex:1;padding:10px;border-radius:6px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-size:15px}}
button{{padding:10px 18px;border:0;border-radius:6px;background:{accent};color:#0f172a;font-weight:600;cursor:pointer}}
.badge{{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background:{accent};color:#0f172a}}
pre{{background:#020617;border:1px solid #334155;border-radius:6px;padding:14px;white-space:pre-wrap;word-break:break-all;max-height:420px;overflow:auto}}
.meta{{color:#94a3b8;font-size:13px;margin:10px 0}}
.blocked{{color:#fca5a5;font-weight:600}}
</style></head><body>
<header><h1>LinkPeek &mdash; URL preview service</h1>
<span>instance i-0a1b2c3d4e5f67890 &middot; us-east-1 &middot; SSRF guard: <b>{guard}</b></span></header>
<main><form method="get" action="/"><input name="url" value="{url}" placeholder="https://example.com/page">
<button type="submit">Preview</button></form>{result}</main></body></html>"""


@app.get("/")
def index():
    url = request.args.get("url", "")
    block = ""
    if url:
        res, _ = do_fetch(url, False)
        if res.get("blocked"):
            block = f'<p class="meta blocked">Request blocked by SSRF guard: {html.escape(res["reason"])}</p>'
        elif "error" in res:
            block = f'<p class="meta blocked">Fetch failed: {html.escape(res["error"])}</p>'
        else:
            block = (f'<p class="meta"><span class="badge">HTTP {res["status"]}</span> fetched in '
                     f'{res["elapsed_ms"]} ms</p><pre>{html.escape(res["content"])}</pre>')
    accent = "#4ade80" if GUARD else "#f59e0b"
    return Response(PAGE.format(accent=accent, guard="ON" if GUARD else "OFF",
                                url=html.escape(url), result=block), mimetype="text/html")


@app.get("/admin/debug")
def admin_debug():
    # Internal-only endpoint: answers only requests that originate from the server itself.
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return Response("forbidden\n", 403)
    return Response("WEBAPP-DEBUG\nenv=production\ndb_host=10.0.1.30\nfeature_flags=preview,save\n"
                    "secret_key=<redacted for the lab>\n", mimetype="text/plain")


@app.get("/health")
def health():
    return jsonify(ok=True, guard=GUARD)


if __name__ == "__main__":
    print(f"LinkPeek starting, SSRF guard={'on' if GUARD else 'off'}")
    app.run(host="0.0.0.0", port=80, threaded=True)
