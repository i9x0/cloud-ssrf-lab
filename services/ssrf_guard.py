"""Application-level SSRF defence (Defence D2).

Controls, following the OWASP SSRF Prevention Cheat Sheet:
  1. Only http/https schemes and ports 80/443.
  2. No user-info (user@host) in URLs.
  3. Resolve the host name and reject ANY resolved address that is loopback, private (RFC 1918),
     link-local (169.254.0.0/16, the metadata range), CGNAT, multicast or reserved.
     Because the check is done on the resolved address, alternative encodings
     (decimal, hex, octal, IPv4-mapped IPv6, DNS aliases) are all caught.
  4. Redirects are followed manually and every hop is re-validated.
  5. The HTTP connection is pinned to the validated IP (prevents DNS-rebinding between check and use).
"""
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

import requests

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443}
MAX_REDIRECTS = 3
BLOCKED_NETWORKS = [ipaddress.ip_network(n) for n in (
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
    "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16", "198.18.0.0/15",
    "224.0.0.0/4", "240.0.0.0/4",
    "::/128", "::1/128", "fc00::/7", "fe80::/10", "ff00::/8",
)]


class SSRFBlocked(Exception):
    pass


def _check_ip(raw: str):
    ip = ipaddress.ip_address(raw.split("%")[0])
    if ip.version == 6 and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    for net in BLOCKED_NETWORKS:
        if ip in net:
            raise SSRFBlocked(f"destination {ip} is inside blocked range {net}")
    return str(ip)


def validate(url: str):
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise SSRFBlocked(f"scheme '{scheme}' not allowed")
    if parts.username is not None or parts.password is not None:
        raise SSRFBlocked("credentials (user@host) in URL not allowed")
    host = parts.hostname
    if not host:
        raise SSRFBlocked("missing host")
    try:
        port = parts.port or (443 if scheme == "https" else 80)
    except ValueError:
        raise SSRFBlocked("invalid port")
    if port not in ALLOWED_PORTS:
        raise SSRFBlocked(f"port {port} not allowed")
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise SSRFBlocked(f"host '{host}' does not resolve")
    addresses = sorted({_check_ip(info[4][0]) for info in infos})
    return parts, scheme, port, addresses[0]


def guarded_get(url: str, timeout: float = 4.0) -> requests.Response:
    for _ in range(MAX_REDIRECTS + 1):
        parts, scheme, port, ip = validate(url)
        if scheme == "http":
            netloc = f"[{ip}]" if ":" in ip else ip
            if parts.port:
                netloc += f":{port}"
            pinned = parts._replace(scheme="http", netloc=netloc).geturl()
            resp = requests.get(pinned, headers={"Host": parts.netloc}, timeout=timeout, allow_redirects=False)
        else:
            resp = requests.get(url, timeout=timeout, allow_redirects=False)
        if resp.is_redirect:
            url = urljoin(url, resp.headers["Location"])
            continue
        return resp
    raise SSRFBlocked("too many redirects")
