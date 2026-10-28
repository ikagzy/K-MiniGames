"""Thin client for Ollama's local HTTP API (standard library only).

Every network failure is turned into an `OllamaError` (or `False` for `pull`), so a closed Ollama never crashes
the app: the caller shows a message instead."""
import http.client
import json
import urllib.request
from collections.abc import Callable, Iterator

DEFAULT_BASE = "http://127.0.0.1:11434"
NUM_CTX = 8192  # Ollama's default context is too short for a whole game's HTML plus the prompt


class OllamaError(Exception):
    pass


_NET_ERRORS = (OSError, http.client.HTTPException)


class OllamaClient:
    def __init__(self, base: str = DEFAULT_BASE, opener: Callable | None = None):
        self._base = base.rstrip("/")
        self._opener = opener or urllib.request.urlopen

    def _open(self, path: str, payload: dict | None = None, timeout: float | None = 600):
        request = urllib.request.Request(
            self._base + path,
            data=None if payload is None else json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="GET" if payload is None else "POST",
        )
        return self._opener(request, timeout=timeout)

    def is_running(self) -> bool:
        try:
            with self._open("/", timeout=2):
                return True
        except (*_NET_ERRORS, ValueError):
            return False

    def models(self) -> list[str]:
        try:
            with self._open("/api/tags", timeout=5) as response:
                data = json.loads(response.read())
        except (*_NET_ERRORS, ValueError) as exc:
            raise OllamaError(f"Ollama'ya ulaşılamadı: {exc}") from exc
        return [m["name"] for m in data.get("models", []) if isinstance(m, dict) and "name" in m]

    def _events(self, response, cancel: Callable[[], bool] | None) -> Iterator[dict]:
        try:
            for raw in response:
                if cancel and cancel():
                    raise OllamaError("cancelled")
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    event = json.loads(raw)
                except ValueError as exc:
                    raise OllamaError(f"Ollama'dan anlaşılmaz satır geldi: {exc}") from exc
                if isinstance(event, dict) and "error" in event:
                    raise OllamaError(str(event["error"]))
                if isinstance(event, dict):
                    yield event
        except _NET_ERRORS as exc:
            raise OllamaError(f"Ollama ile bağlantı koptu: {exc}") from exc

    def chat(self, model: str, messages: list[dict], on_token: Callable[[str], None] | None = None,
             cancel: Callable[[], bool] | None = None) -> str:
        payload = {"model": model, "messages": messages, "stream": True, "options": {"num_ctx": NUM_CTX}}
        try:
            response = self._open("/api/chat", payload)
        except _NET_ERRORS as exc:
            raise OllamaError(f"Ollama'ya ulaşılamadı: {exc}") from exc
        parts: list[str] = []
        done = False
        with response:
            for event in self._events(response, cancel):
                piece = (event.get("message") or {}).get("content") or ""
                if piece:
                    parts.append(piece)
                    if on_token:
                        on_token(piece)
                if event.get("done"):
                    done = True
                    break
        if not done:
            raise OllamaError("Ollama'nın cevabı yarıda kesildi")
        text = "".join(parts)
        if not text.strip():
            raise OllamaError("Ollama boş cevap verdi")
        return text

    def pull(self, model: str, on_progress: Callable[[str, int, int], None],
             cancel: Callable[[], bool] | None = None) -> bool:
        try:
            response = self._open("/api/pull", {"model": model, "stream": True})
        except _NET_ERRORS:
            return False
        try:
            with response:
                for event in self._events(response, cancel):
                    status = str(event.get("status", ""))
                    on_progress(status, int(event.get("completed") or 0), int(event.get("total") or 0))
                    if status == "success":
                        return True
        except OllamaError:
            return False
        return False
