# Cloud SSRF Lab — Capital One 2019 scenario

A local, isolated reproduction of the attack chain behind the 2019 Capital One breach on AWS:
**Server-Side Request Forgery (SSRF) → cloud Instance Metadata Service → stolen IAM role credentials → S3 data exfiltration**,
and an evaluation of four cloud defences against it.

## Architecture

| Component | Address | Role |
|---|---|---|
| `webapp` (LinkPeek) | 203.0.113.10 / 10.0.1.10 / 169.254.169.10 | Vulnerable URL-preview app (victim "EC2 instance"), UI at http://localhost:8080 |
| `imds` | **169.254.169.254** | Emulated AWS Instance Metadata Service (IMDSv1/IMDSv2) |
| `seaweedfs` + `s3-gateway` (nginx) | s3.cloud.local:9000 | S3-compatible object storage; the gateway logs every API call (CloudTrail role) |
| `internal-api` | 10.0.1.20 | Private VPC service (second SSRF target) |
| `website` | 203.0.113.20 | Legitimate public site (used to measure false positives) |
| `evil` | 203.0.113.66 | Attacker server with an open redirect |
| `attacker` | 203.0.113.100 | Attacker machine: runs the attack and the evaluation, holds no lab secrets |
| `detector` | — | GuardDuty-style detector for stolen-credential use |

Networks: `internet` 203.0.113.0/24 (TEST-NET-3), `vpc` 10.0.1.0/24, `imds-link` 169.254.169.0/24, `storage-backend` 10.0.9.0/24.

## Defences

| ID | Defence | Enable (ON) | Disable (OFF) |
|---|---|---|---|
| D1 | IMDSv2 enforced (session token required) | `IMDS_MODE=required` | `IMDS_MODE=optional` |
| D2 | Application SSRF guard (scheme/port allow-list, resolve-then-block private ranges, re-validate redirects, IP pinning) | `SSRF_GUARD=on` | `SSRF_GUARD=off` |
| D3 | Least-privilege instance role (only `Write:app-uploads`) | `IAM_POLICY=leastprivilege` | `IAM_POLICY=overprivileged` |
| D4 | Credential-exfiltration detector | always on | — |

The "OFF" value of each switch is also its default, so a plain `docker compose up -d` starts the fully vulnerable baseline (all defences disabled).

## Run it (Windows PowerShell, Docker Desktop running)

```powershell
python setup.py                    # once: random lab keys + 1,000 synthetic customer records
docker compose up -d               # start the lab (vulnerable baseline)
docker compose run --rm seed       # once: create buckets and upload data
docker compose run --rm attacker python attack_chain.py   # live attack demo
python run_experiment.py           # full evaluation C0..C4 -> results/
python capture_screenshots.py      # report screenshots -> results/screenshots/
docker compose down                # stop (add -v to wipe storage)
```

## Enable / disable the defences

Each defence is a Docker Compose environment variable. Set it, then re-apply with
`docker compose up -d` (Compose recreates only the affected containers). On Windows PowerShell:

**Enable a single defence**

```powershell
$env:IMDS_MODE="required";          docker compose up -d   # D1 ON
$env:SSRF_GUARD="on";               docker compose up -d   # D2 ON
$env:IAM_POLICY="leastprivilege";   docker compose up -d   # D3 ON
```

**Disable a single defence** (turn it off again)

```powershell
$env:IMDS_MODE="optional";          docker compose up -d   # D1 OFF
$env:SSRF_GUARD="off";              docker compose up -d   # D2 OFF
$env:IAM_POLICY="overprivileged";   docker compose up -d   # D3 OFF
```

**Enable ALL defences (hardened — defence in depth)**

```powershell
$env:IMDS_MODE="required"; $env:SSRF_GUARD="on"; $env:IAM_POLICY="leastprivilege"; docker compose up -d
```

**Disable ALL defences (reset to the vulnerable baseline)**

```powershell
$env:IMDS_MODE="optional"; $env:SSRF_GUARD="off"; $env:IAM_POLICY="overprivileged"; docker compose up -d
```

> Tip: these variables persist only in the current PowerShell window. Close it (or run
> `Remove-Item Env:IMDS_MODE,Env:SSRF_GUARD,Env:IAM_POLICY`) and the next `docker compose up -d`
> is back to the vulnerable baseline, since OFF is each switch's default.

On Linux/macOS (bash) the same toggles are inline, e.g. `SSRF_GUARD=on docker compose up -d`.

## Run it on a real cloud (optional)

To host the whole lab on a free Oracle Cloud (OCI) ARM VM, see **[DEPLOY-oracle.md](DEPLOY-oracle.md)**.
The lab is intentionally vulnerable, so keep it private and reach it only over an SSH tunnel.

## Results (run of 2026-11-20)

| Config | Defences | SSRF payloads succeeded | Credentials stolen | Records exfiltrated | Legit requests OK | Median latency |
|---|---|---|---|---|---|---|
| C0 | none | 23/23 | Yes | 1000 | 100/100 | 2.38 ms |
| C1 | IMDSv2 | 9/23 (metadata 0/14) | No | 0 | 100/100 | 2.39 ms |
| C2 | SSRF guard | 0/23 | No | 0 | 100/100 | 2.38 ms |
| C3 | Least privilege | 23/23 | Yes | 0 (AccessDenied) | 100/100 | 2.34 ms |
| C4 | D1+D2+D3 | 0/23 | No | 0 | 100/100 | 2.49 ms |

The detector raised alerts in every configuration where stolen credentials were used (C0, C3).
Full data: `results/summary.csv`, `results/payload_matrix.csv`, `results/raw/*.json`, figures in `results/figures/`.

## Safety

Everything runs inside isolated Docker networks on one machine. All customer data is randomly generated.
Lab keys are random, live only in `.env` (never committed or shown), and are masked in all output.
