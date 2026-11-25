# Deploying the lab on Oracle Cloud (OCI Always Free)

This guide runs the **entire lab** on a free Oracle Cloud virtual machine. It is optional —
the lab is designed to run locally, and a local run is enough for the assignment. Use Oracle
only if you want to demonstrate it on a real cloud VM.

> ### ⚠️ Read this first — safety
> This lab is **deliberately vulnerable** (it contains a real SSRF flaw). **Never expose it to
> the public Internet.** Keep port 8080 closed and reach the app only through an **SSH tunnel**
> (Step 6). If you open it publicly, an attacker could use its SSRF against the **real** Oracle
> instance-metadata service and steal your VM's credentials. When you finish, **delete the VM**.

---

## 0. What you need

- A free Oracle Cloud account: https://www.oracle.com/cloud/free/ (no charge on the Always Free tier).
- An SSH key pair on your computer. On Windows PowerShell:
  ```powershell
  ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\oci -N '""'
  ```
  This creates `oci` (private) and `oci.pub` (public) in `C:\Users\<you>\.ssh\`.

---

## 1. Create an Always Free ARM virtual machine

1. In the OCI console: **Menu → Compute → Instances → Create instance**.
2. **Image and shape → Edit:**
   - **Image:** Canonical **Ubuntu 22.04**.
   - **Shape:** **Ampere → VM.Standard.A1.Flex**, set **2 OCPUs / 12 GB** memory
     (Always Free allows up to 4 OCPU / 24 GB — 2/12 is plenty for this lab).
     > If you see *"Out of host capacity"*, try a different Availability Domain or try again later;
     > free Ampere capacity comes and goes.
3. **Add SSH keys → Paste public keys:** paste the contents of `oci.pub`.
4. Leave networking at the defaults (a VCN with a public subnet is created for you).
5. Click **Create**. When it is **Running**, copy the **Public IP address**.

Only port 22 (SSH) is open by default — that is all this lab needs. Do **not** add an ingress
rule for 8080.

---

## 2. Connect to the VM

From your computer (replace `<PUBLIC_IP>`):

```powershell
ssh -i $env:USERPROFILE\.ssh\oci ubuntu@<PUBLIC_IP>
```

The default username on Ubuntu images is `ubuntu`.

---

## 3. Install Docker, Git and Python (run on the VM)

```bash
sudo apt-get update
curl -fsSL https://get.docker.com | sudo sh      # Docker Engine + Compose plugin (works on ARM)
sudo usermod -aG docker ubuntu                    # run docker without sudo
sudo apt-get install -y git python3
exit                                              # log out so the docker group takes effect
```

Reconnect (`ssh -i ... ubuntu@<PUBLIC_IP>`), then verify:

```bash
docker version
docker compose version
```

---

## 4. Get the project and start the lab (on the VM)

```bash
git clone https://github.com/i9x0/cloud-ssrf-lab.git
cd cloud-ssrf-lab
python3 setup.py                     # random lab keys + 1,000 synthetic records
docker compose up -d                 # start the 8 services (vulnerable baseline)
docker compose run --rm seed         # create buckets and upload the data
docker compose ps                    # all services should be "Up"
```

All images (`python:3.12-slim`, `nginx:1.27-alpine`, `chrislusf/seaweedfs`) are multi-architecture,
so they run natively on the Ampere ARM CPU.

---

## 5. Run the attack and the evaluation (on the VM)

```bash
docker compose run --rm attacker python attack_chain.py   # live attack demo (terminal)
python3 run_experiment.py                                 # full evaluation C0..C4 -> results/
```

> `capture_screenshots.py` is Windows-only (it uses Edge) — skip it on the VM. Charts and raw
> results (`results/figures`, `results/raw`, `results/summary.csv`) are still generated.

---

## 6. Open the web app safely — SSH tunnel

The app listens on the VM's localhost only. Forward it to your own computer through SSH; do **not**
open the port on the Internet. In a **new** PowerShell window on your computer:

```powershell
ssh -i $env:USERPROFILE\.ssh\oci -L 8080:localhost:8080 ubuntu@<PUBLIC_IP>
```

Leave that window open, then browse on your own machine to:

```
http://localhost:8080
```

You now see LinkPeek running on the Oracle VM. Try the demo URLs from `DEMO-amthila.md`.

---

## 7. Toggle defences (on the VM)

Same switches as the README, but inline (bash):

```bash
SSRF_GUARD=on docker compose up -d                                   # enable D2
IMDS_MODE=required SSRF_GUARD=on IAM_POLICY=leastprivilege docker compose up -d   # all defences
docker compose up -d                                                 # back to vulnerable baseline
```

---

## 8. Clean up

```bash
docker compose down -v        # stop the lab and wipe its storage
```

Then, to avoid using any quota, **terminate the instance** in the OCI console:
**Instances → (your instance) → More actions → Terminate** (tick "delete the boot volume").

---

## Mapping to the report

Running on OCI turns the project's *simulated* cloud into a *real* cloud VM, which strengthens the
"System Architecture and Methodology" section: the same Docker topology, the same four defences,
now hosted on Oracle Cloud Infrastructure instead of a laptop. The emulated metadata service still
stands in for the provider's metadata endpoint, so the attack and the measurements are unchanged.
