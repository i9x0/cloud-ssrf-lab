"""Runs the full experiment: 5 defence configurations x (23 SSRF payloads + kill chain + 100 legit requests).

Usage (from this folder, Docker Desktop running):  python run_experiment.py
Results: results/raw/C*.json, then results/summary.* and results/figures/*.png
"""
import os
import subprocess
import sys

CONFIGS = [
    ("C0", "Baseline (no defences)",      "optional", "off", "overprivileged"),
    ("C1", "D1: IMDSv2 enforced",         "required", "off", "overprivileged"),
    ("C2", "D2: SSRF input guard",        "optional", "on",  "overprivileged"),
    ("C3", "D3: Least-privilege role",    "optional", "off", "leastprivilege"),
    ("C4", "D1+D2+D3: Defence in depth",  "required", "on",  "leastprivilege"),
]


def sh(cmd, env):
    print("$", " ".join(cmd), flush=True)
    r = subprocess.run(cmd, env=env)
    if r.returncode:
        sys.exit(f"command failed: {cmd}")


def main():
    only = set(sys.argv[1:])
    for cid, name, imds, guard, iam in CONFIGS:
        if only and cid not in only:
            continue
        print(f"\n===== {cid}: {name} =====", flush=True)
        env = dict(os.environ, IMDS_MODE=imds, SSRF_GUARD=guard, IAM_POLICY=iam)
        sh(["docker", "compose", "up", "-d"], env)
        sh(["docker", "compose", "run", "--rm", "seed", "python", "seed.py", "--wait"], env)
        sh(["docker", "compose", "run", "--rm", "attacker", "python", "evaluate.py", "--config", cid,
            "--name", name, "--imds", imds, "--guard", guard, "--iam", iam], env)
    sh(["docker", "compose", "run", "--rm", "attacker", "python", "make_assets.py"], dict(os.environ))
    # leave the lab in the vulnerable baseline state for demos
    sh(["docker", "compose", "up", "-d"], dict(os.environ, IMDS_MODE="optional", SSRF_GUARD="off", IAM_POLICY="overprivileged"))


if __name__ == "__main__":
    main()
