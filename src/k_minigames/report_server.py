"""A tiny local web server for trying a game.

It serves the instrumented game page and its textures, and collects the reports the page sends back (errors, test
results). It listens only on 127.0.0.1, on a random port, and every address contains a one-time token."""
import json
import mimetypes
import re
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from k_minigames import kgamelib

MAX_BODY = 64 * 1024
_DRAIN_LIMIT = 1024 * 1024
_PLAY = re.compile(r"^/play/([^/]+)/(.*)$")
_REPORT = re.compile(r"^/report/([^/]+)(?:/(\d+))?$")


class _Handler(BaseHTTPRequestHandler):
    server_version = "KMiniGames"

    def log_message(self, *args):  # quiet
        pass

    @property
    def owner(self) -> "ReportServer":
        return self.server.owner

    def _send(self, status: int, body: bytes = b"", content_type: str | None = None) -> None:
        self.send_response(status)
        if content_type:
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _token_ok(self, token: str) -> bool:
        return secrets.compare_digest(unquote(token).encode("utf-8"), self.owner.token.encode("utf-8"))

    def do_GET(self):
        match = _PLAY.match(urlsplit(self.path).path)
        if not match:
            return self._send(404)
        if not self._token_ok(match.group(1)):
            return self._send(403)
        rest = match.group(2)
        if rest == "oyun.html":
            return self._send(200, self.owner.page().encode("utf-8"), "text/html; charset=utf-8")
        if rest.startswith("assets/"):
            return self._asset(unquote(rest[len("assets/"):]))
        if rest in kgamelib.all_files():   # the game library's scripts, copied into the game's folder
            return self._library_script(rest)
        self._send(404)

    def _library_script(self, name: str) -> None:
        game_dir = self.owner.game_dir
        if game_dir is None:
            return self._send(404)
        try:
            target = (game_dir / name).resolve()
            if target.parent != game_dir.resolve() or not target.is_file():
                return self._send(404)
            data = target.read_bytes()
        except (OSError, ValueError):
            return self._send(404)
        self._send(200, data, "application/javascript; charset=utf-8")

    def _asset(self, name: str) -> None:
        game_dir = self.owner.game_dir
        if game_dir is None:
            return self._send(404)
        try:
            assets = (game_dir / "assets").resolve()
            target = (assets / name).resolve()
            if not target.is_relative_to(assets) or not target.is_file():
                return self._send(404)
            data = target.read_bytes()
        except (OSError, ValueError):
            return self._send(404)
        self._send(200, data, mimetypes.guess_type(target.name)[0] or "application/octet-stream")

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        too_big = length > MAX_BODY
        remaining = min(length, _DRAIN_LIMIT if too_big else length)
        body = b""
        while remaining > 0:  # always read what the client sent, so it gets our answer instead of a reset
            chunk = self.rfile.read(min(remaining, 65536))
            if not chunk:
                break
            remaining -= len(chunk)
            if not too_big:
                body += chunk
        match = _REPORT.match(urlsplit(self.path).path)
        if not match:
            return self._send(404)
        if not self._token_ok(match.group(1)):
            return self._send(403)
        run = match.group(2)
        if run is not None and int(run) != self.owner.run:
            return self._send(204)   # a tab of an earlier run: its reports are not wanted any more
        if too_big:
            return self._send(413)
        try:
            event = json.loads(body.decode("utf-8"))
        except ValueError:
            return self._send(400)
        if not isinstance(event, dict):
            return self._send(400)
        self.owner.add_event(event)
        self._send(204)


class ReportServer:
    def __init__(self, game_dir: Path | None = None):
        self.game_dir = game_dir
        self.token = secrets.token_urlsafe(16)
        self._page = ""
        self._events: list[dict] = []
        self._run = 0
        self._cond = threading.Condition()
        self._httpd: ThreadingHTTPServer | None = None

    def start(self) -> None:
        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self._httpd.owner = self
        threading.Thread(target=self._httpd.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True).start()

    def stop(self) -> None:
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None

    @property
    def host(self) -> str:
        return self._httpd.server_address[0]

    @property
    def port(self) -> int:
        return self._httpd.server_address[1]

    def page_url(self) -> str:
        return f"http://{self.host}:{self.port}/play/{self.token}/oyun.html"

    @property
    def run(self) -> int:
        return self._run

    def report_url(self) -> str:
        """Where the page of the current run sends its reports (the run number is part of the address)."""
        return f"http://{self.host}:{self.port}/report/{self.token}/{self._run}"

    def clear_events(self) -> None:
        """Forget the events of an earlier run (a second run must not see the first run's `done`)."""
        with self._cond:
            self._events.clear()
            self._run += 1   # tabs of the run before can no longer report

    def set_page(self, html: str) -> None:
        with self._cond:
            self._page = html

    def page(self) -> str:
        with self._cond:
            return self._page

    def add_event(self, event: dict) -> None:
        with self._cond:
            self._events.append(event)
            self._cond.notify_all()

    def events(self) -> list[dict]:
        with self._cond:
            return list(self._events)

    def wait_for(self, kind: str, timeout_s: float) -> dict | None:
        """The first event of this kind (it stays in `events()`), waiting up to `timeout_s` seconds."""
        def find():
            return next((e for e in self._events if e.get("type") == kind), None)

        with self._cond:
            self._cond.wait_for(lambda: find() is not None, timeout_s)
            return find()
