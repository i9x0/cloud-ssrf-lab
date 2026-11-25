"""Small supporting services, selected with the first CLI argument:

  website       public partner website (legitimate traffic)       203.0.113.20  cdn.example.net
  internal-api  private HR API inside the VPC (SSRF target)       10.0.1.20     internal-api.vpc.local
  evil          attacker-controlled server with an open redirect  203.0.113.66  attacker.evil
"""
import sys

from flask import Flask, Response, redirect, request

app = Flask(__name__)
ROLE = sys.argv[1] if len(sys.argv) > 1 else "website"

if ROLE == "website":
    @app.get("/")
    def home():
        return Response("<html><body><h1>PUBLIC-CONTENT</h1><p>Partner CDN home page.</p></body></html>",
                        mimetype="text/html")

    @app.get("/products/<int:n>")
    def product(n: int):
        return Response(f"<html><body><h2>PUBLIC-CONTENT product {n}</h2><p>Spec sheet.</p></body></html>",
                        mimetype="text/html")

    @app.get("/images/logo.svg")
    def logo():
        return Response('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><title>PUBLIC-CONTENT</title>'
                        '<circle cx="20" cy="20" r="18" fill="#38bdf8"/></svg>', mimetype="image/svg+xml")

    @app.get("/api/status.json")
    def status():
        return {"service": "PUBLIC-CONTENT", "status": "ok"}

    @app.get("/old-page")
    def old_page():
        return redirect("/new-page", code=301)

    @app.get("/new-page")
    def new_page():
        return Response("<html><body>PUBLIC-CONTENT moved page</body></html>", mimetype="text/html")

elif ROLE == "internal-api":
    @app.get("/")
    @app.get("/<path:p>")
    def hr(p: str = ""):
        return Response("INTERNAL-HR-API v2 (VPC only)\nendpoints: /employees /payroll\n"
                        "records: 412 employees (synthetic)\n", mimetype="text/plain")

elif ROLE == "evil":
    @app.get("/")
    def index():
        return Response("attacker-controlled server\n", mimetype="text/plain")

    @app.get("/redirect")
    def bounce():
        # Open redirect used to smuggle an internal address past naive URL filters.
        return redirect(request.args.get("to", "/"), code=int(request.args.get("code", 302)))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, threaded=True)
