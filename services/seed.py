"""Creates the buckets and uploads the synthetic data using the storage ADMIN credentials."""
import os
import time

import boto3
from botocore.config import Config

s3 = boto3.client("s3", endpoint_url=os.environ.get("S3_ENDPOINT", "http://s3.cloud.local:9000"),
                  region_name="us-east-1", aws_access_key_id=os.environ["ADMIN_KEY"],
                  aws_secret_access_key=os.environ["ADMIN_SECRET"],
                  config=Config(s3={"addressing_style": "path"}, retries={"max_attempts": 1}))

import sys

for attempt in range(90):
    try:
        existing = {b["Name"] for b in s3.list_buckets().get("Buckets", [])}
        if "--wait" in sys.argv:  # readiness probe used between experiment runs: a real write must succeed
            s3.put_object(Bucket="app-uploads", Key="healthcheck/probe.txt", Body=b"ok")
            print("storage ready (write probe ok)")
            sys.exit(0)
        break
    except Exception as exc:
        print(f"waiting for storage ({type(exc).__name__})")
        time.sleep(2)
else:
    raise SystemExit("storage did not become ready")

for bucket in ("customer-data", "app-uploads"):
    if bucket not in existing:
        s3.create_bucket(Bucket=bucket)
        print(f"created bucket {bucket}")
s3.upload_file("/seed/customers.csv", "customer-data", "exports/customers.csv")
s3.upload_file("/seed/README-SYNTHETIC.txt", "customer-data", "README-SYNTHETIC.txt")
print("uploaded customer-data/exports/customers.csv and README-SYNTHETIC.txt")
for bucket in ("customer-data", "app-uploads"):
    keys = [o["Key"] for o in s3.list_objects_v2(Bucket=bucket).get("Contents", [])]
    print(f"{bucket}: {len(keys)} objects")
