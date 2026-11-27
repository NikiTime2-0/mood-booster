"""Serve Mood Booster with private live administration using Python and SQLite."""

import base64
import binascii
import hmac
import json
import mimetypes
import os
from pathlib import Path
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
DB = Path(os.environ.get("MOOD_DATABASE", ROOT / "server" / "mood.sqlite3"))
PASSWORD = os.environ.get("MOOD_ADMIN_PASSWORD", "")
ASSETS = {"index.html", "app.js", "texte.js", "style.css", "doll.js", "doll.css",
          "penguin.png", "apple-touch-icon.png", "knit-firetruck.png", "knit-police.png", "knit-bee.png"}


def initialize():
    with sqlite3.connect(DB) as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, time TEXT DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT);
        """)


def valid_content(data):
    if not isinstance(data, dict) or set(data) != {"zitate", "banner"}:
        return False
    quotes, banners = data["zitate"], data["banner"]
    if not isinstance(quotes, list) or not 1 <= len(quotes) <= 300:
        return False
    if not isinstance(banners, list) or not 1 <= len(banners) <= 100:
        return False
    if not all(isinstance(q, str) and 0 < len(q.strip()) <= 500 for q in quotes):
        return False
    for banner in banners:
        if not isinstance(banner, dict) or set(banner) != {"ab", "icon", "text"}:
            return False
        hour, icon, text = banner["ab"], banner["icon"], banner["text"]
        if type(hour) is not int or not 0 <= hour <= 23:
            return False
        if not isinstance(icon, str) or len(icon) > 12:
            return False
        if not isinstance(text, str) or not 0 < len(text.strip()) <= 500:
            return False
    return any(banner["ab"] == 0 for banner in banners)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        # Keep only event times in our application records.
        pass

    def send(self, status, body=b"", kind="text/plain; charset=utf-8", headers=()):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for key, value in headers:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        try:
            method, encoded = self.headers.get("Authorization", "").split(" ", 1)
            credentials = base64.b64decode(encoded, validate=True)
            expected = ("admin:" + PASSWORD).encode()
            if method.lower() == "basic" and hmac.compare_digest(credentials, expected):
                return True
        except (ValueError, binascii.Error):
            pass
        self.send(401, headers=[("WWW-Authenticate", 'Basic realm="Mood Booster", charset="UTF-8"')])
        return False

    def send_json(self, data):
        self.send(200, json.dumps(data).encode(), "application/json")

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in {"/admin", "/admin.js", "/api/visits"}:
            if not self.authorized():
                return
            if path == "/api/visits":
                with sqlite3.connect(DB) as db:
                    rows = db.execute("SELECT time FROM visits WHERE time >= datetime('now','-7 days') ORDER BY id DESC LIMIT 100").fetchall()
                self.send_json([value.replace(" ", "T") + "Z" for (value,) in rows])
                return
            name = "admin.html" if path == "/admin" else "admin.js"
            self.send(200, (ROOT / "server" / name).read_bytes(), mimetypes.guess_type(name)[0])
            return
        if path == "/api/content":
            with sqlite3.connect(DB) as db:
                row = db.execute("SELECT body FROM content WHERE id=1").fetchone()
            self.send(200, row[0].encode() if row else b"null", "application/json")
            return
        name = path[1:] if path != "/" else "index.html"
        if name not in ASSETS:
            self.send(404)
            return
        if name == "index.html":
            with sqlite3.connect(DB) as db:
                db.execute("DELETE FROM visits WHERE time < datetime('now','-7 days')")
                db.execute("INSERT INTO visits DEFAULT VALUES")
        self.send(200, (ROOT / name).read_bytes(), mimetypes.guess_type(name)[0])

    def do_POST(self):
        if self.path != "/api/content":
            self.send(404)
            return
        if not self.authorized():
            return
        if self.headers.get("Content-Type") != "application/json":
            self.send(415)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 256_000:
                self.send(413)
                return
            data = json.loads(self.rfile.read(size))
        except (ValueError, RecursionError):
            self.send(400)
            return
        if not valid_content(data):
            self.send(400, "Bitte Texte und Uhrzeiten prüfen. Ein Banner ab 00:00 ist erforderlich.".encode())
            return
        with sqlite3.connect(DB) as db:
            db.execute("INSERT INTO content VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
                       (json.dumps(data, ensure_ascii=False),))
        self.send_json({"saved": True})


if __name__ == "__main__":
    if len(PASSWORD) < 16:
        raise SystemExit("MOOD_ADMIN_PASSWORD muss mindestens 16 Zeichen haben.")
    initialize()
    host = os.environ.get("MOOD_BIND", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()
