"""Builds report tables and figures from /results/raw/C*.json."""
import csv
import glob
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from matplotlib.patches import Patch

OUT = "/results"
FIG = f"{OUT}/figures"
os.makedirs(FIG, exist_ok=True)

INK, INK2, GRID, SURF = "#0b0b0b", "#52514e", "#e4e3df", "#ffffff"
OUTCOMES = [  # (key, label, color, cell text)
    ("success", "Attack succeeded", "#d03b3b", "HIT"),
    ("denied-imdsv2", "Denied by IMDSv2 (401)", "#1baf7a", "401"),
    ("blocked-by-guard", "Blocked by SSRF guard", "#2a78d6", "BLK"),
    ("other", "No data / fetch error", "#b5b4ae", "-"),
]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": GRID,
                     "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
                     "axes.titlesize": 10, "axes.titleweight": "bold", "figure.dpi": 200})

runs = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(f"{OUT}/raw/C*.json"))]
SHORT = {"C0": "Baseline", "C1": "IMDSv2", "C2": "SSRF guard", "C3": "Least priv.", "C4": "All three"}
cfg_labels = [f"{r['config']}  {SHORT[r['config']]}" for r in runs]


def okey(o):
    return o if o in ("success", "denied-imdsv2", "blocked-by-guard") else "other"


# ---------- summary table ----------
rows = []
for r in runs:
    ps, ch, lg = r["payload_success"], r["chain"], r["legit"]
    bc = ps["by_category"]
    rows.append({
        "Config": r["config"], "Defences": r["name"],
        "SSRF success (all)": f"{ps['success']}/{ps['total']}",
        "Metadata": f"{bc['metadata'][0]}/{bc['metadata'][1]}",
        "Internal VPC": f"{bc['internal-vpc'][0]}/{bc['internal-vpc'][1]}",
        "Localhost": f"{bc['localhost'][0]}/{bc['localhost'][1]}",
        "Creds stolen": "Yes" if ch["credentials_stolen"] else "No",
        "Customer data read": ch["read_customer_data"] or "n/a (no creds)",
        "Records exfiltrated": ch["records_exfiltrated"],
        "Legit OK": f"{lg['ok']}/{lg['requests']}",
        "False-positive rate": f"{100 * (lg['requests'] - lg['ok']) / lg['requests']:.1f}%",
        "App S3 upload OK": f"{lg['s3_save_ok']}/{lg['s3_save_total']}",
        "Median latency ms": lg["latency_ms"]["median"] if lg["latency_ms"] else "",
        "P95 latency ms": lg["latency_ms"]["p95"] if lg["latency_ms"] else "",
        "Exfil alerts": r["detection"]["alerts"],
    })
with open(f"{OUT}/summary.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
with open(f"{OUT}/summary.md", "w", encoding="utf-8") as fh:
    keys = list(rows[0].keys())
    fh.write("| " + " | ".join(keys) + " |\n|" + "---|" * len(keys) + "\n")
    for row in rows:
        fh.write("| " + " | ".join(str(row[k]) for k in keys) + " |\n")

# per-payload matrix (CSV)
pids = [p["id"] for p in runs[0]["payloads"]]
with open(f"{OUT}/payload_matrix.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["id", "target", "technique"] + [r["config"] for r in runs])
    for i, pid in enumerate(pids):
        p0 = runs[0]["payloads"][i]
        w.writerow([pid, p0["category"], p0["technique"]] + [r["payloads"][i]["outcome"] for r in runs])

# ---------- Fig 1: stacked outcome bars ----------
fig, ax = plt.subplots(figsize=(7.2, 3.0))
y = range(len(runs))
left = [0] * len(runs)
for key, label, color, _ in OUTCOMES:
    vals = [sum(1 for p in r["payloads"] if okey(p["outcome"]) == key) for r in runs]
    ax.barh(list(y), vals, left=left, color=color, edgecolor=SURF, linewidth=1.5, height=0.62, label=label)
    for yi, (l, v) in enumerate(zip(left, vals)):
        if v >= 2:
            ax.text(l + v / 2, yi, str(v), ha="center", va="center", color="white", fontsize=8, fontweight="bold")
    left = [a + b for a, b in zip(left, vals)]
ax.set_yticks(list(y), cfg_labels)
ax.invert_yaxis()
ax.set_xlim(0, len(pids))
ax.set_xlabel("SSRF payloads (n = %d)" % len(pids))
ax.set_title("Outcome of the 23 SSRF payloads under each defence configuration", loc="left")
ax.grid(axis="x", color=GRID, linewidth=0.6)
ax.set_axisbelow(True)
for s in ("top", "right"):
    ax.spines[s].set_visible(False)
ax.legend(ncol=2, loc="upper center", bbox_to_anchor=(0.4, -0.22), frameon=False, fontsize=8)
fig.tight_layout()
fig.savefig(f"{FIG}/fig_payload_outcomes.png", facecolor=SURF)
plt.close(fig)

# ---------- Fig 2: payload x config heatmap ----------
idx = {k: i for i, (k, *_r) in enumerate(OUTCOMES)}
mat = [[idx[okey(r["payloads"][i]["outcome"])] for r in runs] for i in range(len(pids))]
fig, ax = plt.subplots(figsize=(7.2, 7.4))
ax.imshow(mat, cmap=ListedColormap([o[2] for o in OUTCOMES]), vmin=-0.5, vmax=len(OUTCOMES) - 0.5, aspect="auto")
for i in range(len(pids)):
    for j in range(len(runs)):
        ax.text(j, i, OUTCOMES[mat[i][j]][3], ha="center", va="center", color="white", fontsize=7, fontweight="bold")
ax.set_xticks(range(len(runs)), [r["config"] + "\n" + SHORT[r["config"]] for r in runs], fontsize=8)
ax.xaxis.tick_top()
p0 = runs[0]["payloads"]
ax.set_yticks(range(len(pids)), [f"{p['id']}  {p['technique']}" for p in p0], fontsize=7.5)
ax.set_xticks([x - 0.5 for x in range(1, len(runs))], minor=True)
ax.set_yticks([x - 0.5 for x in range(1, len(pids))], minor=True)
ax.grid(which="minor", color=SURF, linewidth=2)
ax.tick_params(which="both", length=0)
for s in ax.spines.values():
    s.set_visible(False)
for b in (13.5, 17.5):
    ax.axhline(b, color=INK, linewidth=1.2)
ax.legend(handles=[Patch(color=c, label=f"{t}  {l}") for _, l, c, t in OUTCOMES], ncol=2,
          loc="upper center", bbox_to_anchor=(0.4, -0.01), frameon=False, fontsize=8)
fig.tight_layout()
fig.savefig(f"{FIG}/fig_payload_matrix.png", facecolor=SURF)
plt.close(fig)

# ---------- Fig 3: kill-chain progression ----------
stages = ["SSRF reaches\nmetadata", "Credentials\nstolen", "Buckets\nlisted", "Customer data\nread"]
grid = []
for r in runs:
    ch = r["chain"]
    lb = ch["list_buckets"]
    grid.append([ch["ssrf_reached_metadata"], ch["credentials_stolen"],
                 isinstance(lb, list) and "customer-data" in lb, ch["read_customer_data"] == "allowed"])
fig, ax = plt.subplots(figsize=(7.2, 2.9))
ax.imshow([[1 if v else 0 for v in row] for row in grid], cmap=ListedColormap(["#e4e3df", "#d03b3b"]),
          vmin=0, vmax=1, aspect="auto")
for i, row in enumerate(grid):
    for j, v in enumerate(row):
        ax.text(j, i, "REACHED" if v else "stopped", ha="center", va="center",
                color="white" if v else INK2, fontsize=7.5, fontweight="bold" if v else "normal")
ax.set_xticks(range(len(stages)), stages, fontsize=8)
ax.xaxis.tick_top()
ax.set_yticks(range(len(runs)), [f"{r['config']}  {r['name'].split(': ')[-1]}  ({r['chain']['records_exfiltrated']} records)"
                                 for r in runs], fontsize=8)
ax.set_xticks([x - 0.5 for x in range(1, len(stages))], minor=True)
ax.set_yticks([x - 0.5 for x in range(1, len(runs))], minor=True)
ax.grid(which="minor", color=SURF, linewidth=2.5)
ax.tick_params(which="both", length=0)
for s in ax.spines.values():
    s.set_visible(False)
fig.tight_layout()
fig.savefig(f"{FIG}/fig_kill_chain.png", facecolor=SURF)
plt.close(fig)

# ---------- Fig 4: latency of legitimate requests ----------
fig, ax = plt.subplots(figsize=(7.2, 3.6))
data = [r["legit"]["latency_ms"]["samples"] for r in runs]
bp = ax.boxplot(data, vert=False, widths=0.5, patch_artist=True, showfliers=False,
                medianprops={"color": INK, "linewidth": 1.5})
for b in bp["boxes"]:
    b.set(facecolor="#9ec5f4", edgecolor="#2a78d6", linewidth=1)
for k in ("whiskers", "caps"):
    for line in bp[k]:
        line.set(color="#2a78d6", linewidth=1)
ax.set_yticks(range(1, len(runs) + 1),
              [f"{r['config']}  {SHORT[r['config']]}\nmedian {r['legit']['latency_ms']['median']} ms" for r in runs],
              fontsize=7.5)
ax.invert_yaxis()
ax.set_xlabel("Server-side fetch time of legitimate requests (ms, n = 100 per configuration, outliers hidden)")
ax.set_title("Performance overhead of the defences", loc="left")
ax.grid(axis="x", color=GRID, linewidth=0.6)
ax.set_axisbelow(True)
for s in ("top", "right"):
    ax.spines[s].set_visible(False)
fig.tight_layout()
fig.savefig(f"{FIG}/fig_latency.png", facecolor=SURF)
plt.close(fig)

print(open(f"{OUT}/summary.md", encoding="utf-8").read())
print("figures:", sorted(os.listdir(FIG)))
