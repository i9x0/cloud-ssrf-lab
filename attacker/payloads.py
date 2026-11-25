"""SSRF payload suite and legitimate-traffic suite used by evaluate.py.

Each payload: (id, target category, technique, url, success marker in the fetched content)
"""
CREDS = "/latest/meta-data/iam/security-credentials/webapp-role"
R = "http://attacker.evil/redirect?to="

PAYLOADS = [
    # --- Target 1: cloud instance metadata service (credential theft) ---
    ("M01", "metadata", "Direct link-local IP", f"http://169.254.169.254{CREDS}", "AccessKeyId"),
    ("M02", "metadata", "DNS alias (instance-data)", f"http://instance-data.ec2.internal{CREDS}", "AccessKeyId"),
    ("M03", "metadata", "Decimal IP encoding", f"http://2852039166{CREDS}", "AccessKeyId"),
    ("M04", "metadata", "Hexadecimal IP encoding", f"http://0xa9fea9fe{CREDS}", "AccessKeyId"),
    ("M05", "metadata", "Octal IP encoding", f"http://0251.0376.0251.0376{CREDS}", "AccessKeyId"),
    ("M06", "metadata", "Short-form IP (169.254.43518)", f"http://169.254.43518{CREDS}", "AccessKeyId"),
    ("M07", "metadata", "IPv4-mapped IPv6", f"http://[::ffff:169.254.169.254]{CREDS}", "AccessKeyId"),
    ("M08", "metadata", "Explicit port :80", f"http://169.254.169.254:80{CREDS}", "AccessKeyId"),
    ("M09", "metadata", "User-info prefix (trusted@)", f"http://cdn.example.net@169.254.169.254{CREDS}", "AccessKeyId"),
    ("M10", "metadata", "Upper-case scheme", f"HTTP://169.254.169.254{CREDS}", "AccessKeyId"),
    ("M11", "metadata", "Open redirect 302", f"{R}http://169.254.169.254{CREDS}", "AccessKeyId"),
    ("M12", "metadata", "Open redirect 307 + decimal IP", f"{R}http://2852039166{CREDS}&code=307", "AccessKeyId"),
    ("M13", "metadata", "Metadata index listing", "http://169.254.169.254/latest/meta-data/", "instance-id"),
    ("M14", "metadata", "Instance identity (hostname)", "http://169.254.169.254/latest/meta-data/hostname", "ec2.internal"),
    # --- Target 2: private service inside the VPC ---
    ("V01", "internal-vpc", "Direct private IP", "http://10.0.1.20/", "INTERNAL-HR-API"),
    ("V02", "internal-vpc", "Internal DNS name", "http://internal-api.vpc.local/employees", "INTERNAL-HR-API"),
    ("V03", "internal-vpc", "Decimal IP encoding", "http://167772436/", "INTERNAL-HR-API"),
    ("V04", "internal-vpc", "Open redirect 302", f"{R}http://10.0.1.20/payroll", "INTERNAL-HR-API"),
    # --- Target 3: the server's own loopback admin endpoint ---
    ("L01", "localhost", "127.0.0.1", "http://127.0.0.1/admin/debug", "WEBAPP-DEBUG"),
    ("L02", "localhost", "localhost name", "http://localhost/admin/debug", "WEBAPP-DEBUG"),
    ("L03", "localhost", "0.0.0.0", "http://0.0.0.0/admin/debug", "WEBAPP-DEBUG"),
    ("L04", "localhost", "Short-form 127.1", "http://127.1/admin/debug", "WEBAPP-DEBUG"),
    ("L05", "localhost", "Open redirect 302", f"{R}http://127.0.0.1/admin/debug", "WEBAPP-DEBUG"),
]

# Legitimate requests a normal user makes: these must keep working after hardening.
LEGIT = [
    ("G01", "http://cdn.example.net/", "PUBLIC-CONTENT"),
    ("G02", "http://cdn.example.net/products/7", "PUBLIC-CONTENT"),
    ("G03", "http://cdn.example.net/products/42", "PUBLIC-CONTENT"),
    ("G04", "http://cdn.example.net/images/logo.svg", "PUBLIC-CONTENT"),
    ("G05", "http://cdn.example.net/api/status.json", "PUBLIC-CONTENT"),
    ("G06", "http://cdn.example.net/old-page", "PUBLIC-CONTENT"),   # legitimate redirect
    ("G07", "http://203.0.113.20/products/3", "PUBLIC-CONTENT"),   # public IP literal
    ("G08", "http://cdn.example.net:80/new-page", "PUBLIC-CONTENT"),
    ("G09", "http://attacker.evil/", "attacker-controlled"),        # any public site is allowed
    ("G10", "http://cdn.example.net/products/99", "PUBLIC-CONTENT"),
]
