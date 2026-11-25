"""Captures report screenshots from the running lab (host side, stdlib only).

For each defence configuration it re-deploys the lab, runs real commands, renders their real
terminal output (with colours) into a terminal-style page and screenshots it with headless Edge.
The LinkPeek web UI is screenshotted directly from http://localhost:8080.
Output: results/screenshots/*.png
"""
import html
import os
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "results" / "screenshots"
TMP = ROOT / "results" / "screenshots" / "_html"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ANSI = {"91": "#ff6b6b", "92": "#69db7c", "93": "#ffd43b", "96": "#66d9e8", "1": None, "0": None}
CONFIGS = {
    "C0": dict(IMDS_MODE="optional", SSRF_GUARD="off", IAM_POLICY="overprivileged"),
    "C1": dict(IMDS_MODE="required", SSRF_GUARD="off", IAM_POLICY="overprivileged"),
    "C2": dict(IMDS_MODE="optional", SSRF_GUARD="on", IAM_POLICY="overprivileged"),
    "C3": dict(IMDS_MODE="optional", SSRF_GUARD="off", IAM_POLICY="leastprivilege"),
}


def deploy(cfg):
    env = dict(os.environ, **CONFIGS[cfg])
    subprocess.run(["docker", "compose", "up", "-d"], env=env, capture_output=True, check=True)
    subprocess.run(["docker", "compose", "run", "--rm", "seed", "python", "seed.py", "--wait"],
                   env=env, capture_output=True, check=True)
    time.sleep(1)
    return env


def run(cmd, env):
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    lines = [l for l in (r.stdout + r.stderr).splitlines()
             if not re.match(r"\s*Container .* (Creat|Start|Running)", l)]
    return "\n".join(lines).strip()


def ansi_to_html(text):
    out, open_spans = [], 0
    for part in re.split(r"(\x1b\[[0-9;]*m)", text):
        m = re.match(r"\x1b\[([0-9;]*)m", part)
        if not m:
            out.append(html.escape(part))
            continue
        code = m.group(1)
        if code in ("0", ""):
            out.append("</span>" * open_spans)
            open_spans = 0
        elif code == "1":
            out.append('<span style="font-weight:bold">')
            open_spans += 1
        elif ANSI.get(code):
            out.append(f'<span style="color:{ANSI[code]}">')
            open_spans += 1
    out.append("</span>" * open_spans)
    return "".join(out)


def terminal_shot(name, title, command, output, width=1100):
    TMP.mkdir(parents=True, exist_ok=True)
    lines = output.count("\n") + 4
    height = 70 + lines * 19
    page = f"""<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:0;background:#1e1e1e;font-family:Consolas,'Cascadia Mono',monospace;font-size:14px;color:#d4d4d4}}
.bar{{background:#323233;color:#ccc;padding:8px 14px;font-family:Segoe UI,Arial;font-size:13px}}
.bar b{{color:#fff}} pre{{margin:0;padding:12px 16px;white-space:pre-wrap;line-height:19px}}
.cmd{{color:#9cdcfe}}</style></head><body><div class="bar"><b>{html.escape(title)}</b></div>
<pre><span class="cmd">PS C:\\...\\cloud-ssrf-lab&gt; {html.escape(command)}</span>
{ansi_to_html(output)}</pre></body></html>"""
    f = TMP / f"{name}.html"
    f.write_text(page, encoding="utf-8")
    shoot(f.as_uri(), SHOTS / f"{name}.png", width, height)


def shoot(url, out, width, height):
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    f"--screenshot={out}", f"--window-size={width},{height}", url],
                   capture_output=True, timeout=60)
    print("  saved", out.relative_to(ROOT))


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    attack = ["docker", "compose", "run", "--rm", "attacker", "python", "attack_chain.py"]

    print("C0 baseline")
    env = deploy("C0")
    terminal_shot("01_lab_running", "Lab deployment: all cloud components running (docker compose ps)",
                  "docker compose ps", run(["docker", "compose", "ps", "--format",
                                            "table {{.Service}}\t{{.Image}}\t{{.Status}}"], env), 1100)
    shoot("http://localhost:8080/?url=" + quote("http://cdn.example.net/products/7"),
          SHOTS / "02_webapp_normal_use.png", 1100, 520)
    shoot("http://localhost:8080/?url=" + quote("http://169.254.169.254/latest/meta-data/"),
          SHOTS / "03_webapp_ssrf_metadata.png", 1100, 560)
    shoot("http://localhost:8080/?url=" + quote("http://169.254.169.254/latest/meta-data/iam/security-credentials/"),
          SHOTS / "04_webapp_ssrf_role_name.png", 1100, 420)
    terminal_shot("05_attack_chain_C0", "C0 Baseline: full attack chain (SSRF -> metadata -> credentials -> S3 exfiltration)",
                  "docker compose run --rm attacker python attack_chain.py", run(attack, env))
    alerts = run(["docker", "compose", "logs", "detector", "--no-log-prefix", "--tail", "4"], env)
    terminal_shot("06_detector_alerts", "D4 Detector: GuardDuty-style credential exfiltration findings",
                  "docker compose logs detector --tail 4",
                  re.sub(r'(, )"', r',\n  "', alerts).replace("ALERT {", "ALERT {\n  "), 1100)

    print("C1 IMDSv2")
    env = deploy("C1")
    terminal_shot("07_attack_chain_C1_imdsv2", "C1 IMDSv2 enforced: metadata service refuses token-less requests",
                  "docker compose run --rm attacker python attack_chain.py", run(attack, env))
    imds_log = run(["powershell", "-NoProfile", "-Command",
                    "Get-Content results\\logs\\imds.jsonl -Tail 3"], env)
    terminal_shot("08_imds_log_C1", "IMDS access log: GET without token denied (401)",
                  "Get-Content results\\logs\\imds.jsonl -Tail 3", imds_log, 1300)

    print("C2 SSRF guard")
    env = deploy("C2")
    shoot("http://localhost:8080/?url=" + quote("http://2852039166/latest/meta-data/iam/security-credentials/webapp-role"),
          SHOTS / "09_webapp_guard_blocks_decimal_ip.png", 1100, 330)
    shoot("http://localhost:8080/?url=" + quote("http://attacker.evil/redirect?to=http://169.254.169.254/latest/meta-data/"),
          SHOTS / "10_webapp_guard_blocks_redirect.png", 1100, 330)
    terminal_shot("11_attack_chain_C2_guard", "C2 SSRF guard: request blocked before it leaves the server",
                  "docker compose run --rm attacker python attack_chain.py", run(attack, env))

    print("C3 least privilege")
    env = deploy("C3")
    terminal_shot("12_attack_chain_C3_leastpriv", "C3 Least privilege: credentials stolen but useless for customer data",
                  "docker compose run --rm attacker python attack_chain.py", run(attack, env))

    print("evaluation summary")
    summary = (ROOT / "results" / "summary.md").read_text(encoding="utf-8")
    cols = ["Config", "SSRF success (all)", "Creds stolen", "Records exfiltrated", "Legit OK",
            "False-positive rate", "Median latency ms", "Exfil alerts"]
    lines = [l.strip().strip("|").split("|") for l in summary.splitlines() if re.match(r"\| C\d ", l)]
    head = [h.strip() for h in summary.splitlines()[0].strip().strip("|").split("|")]
    table = "  ".join(f"{c:<20}" for c in cols) + "\n"
    for l in lines:
        row = dict(zip(head, [x.strip() for x in l]))
        table += "  ".join(f"{row[c]:<20}" for c in cols) + "\n"
    terminal_shot("13_evaluation_summary", "Automated evaluation: 5 configurations x 23 payloads + 100 legitimate requests",
                  "python run_experiment.py   (summary)", table, 1700)

    deploy("C0")  # leave the lab in the vulnerable demo state
    print("done")


if __name__ == "__main__":
    main()
