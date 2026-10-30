"""Thin client for Ollama's local HTTP API (standard library only).

Every network failure is turned into an `OllamaError` (or `False` for `pull`), so a closed Ollama never crashes
the app: the caller shows a message instead."""
import http.client
import json
import urllib.error
import urllib.request
from collections.abc import Callable, Iterator
from dataclasses import dataclass

DEFAULT_BASE = "http://127.0.0.1:11434"
NUM_CTX = 8192  # Ollama's default context is too short for a whole game's HTML plus the prompt


class OllamaError(Exception):
    pass


class OllamaServerError(OllamaError):
    """Ollama was reached and answered with an error (for example when a model does not fit in memory)."""


def _explain(exc: Exception) -> OllamaError:
    if isinstance(exc, urllib.error.HTTPError):
        try:
            detail = json.loads(exc.read().decode("utf-8", "replace")).get("error")
        except Exception:
            detail = None
        return OllamaServerError(f"Ollama hata verdi (HTTP {exc.code}): {detail or exc.reason}")
    return OllamaError(f"Ollama'ya ulaşılamadı: {exc}")


@dataclass(frozen=True)
class InstalledModel:
    name: str
    size_gb: float   # the model file's size, a rough sign of how capable it is
    family: str      # e.g. "llama", "qwen", "nomic-bert" (embedding models cannot chat)


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

    def _tags(self) -> list[dict]:
        try:
            with self._open("/api/tags", timeout=5) as response:
                data = json.loads(response.read())
        except (*_NET_ERRORS, ValueError) as exc:
            raise OllamaError(f"Ollama'ya ulaşılamadı: {exc}") from exc
        return [m for m in data.get("models", []) if isinstance(m, dict) and "name" in m]

    def models(self) -> list[str]:
        return [m["name"] for m in self._tags()]

    def installed(self) -> list[InstalledModel]:
        return [InstalledModel(m["name"], float(m.get("size") or 0) / 1024 ** 3,
                               str((m.get("details") or {}).get("family") or ""))
                for m in self._tags()]

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
             cancel: Callable[[], bool] | None = None, *, schema: dict | None = None,
             keep_alive: str | None = None, max_tokens: int | None = None) -> str:
        """`schema` asks for an answer in that JSON shape; `keep_alive` ("2m") is how long the model stays in memory."""
        payload = {"model": model, "messages": messages, "stream": True, "options": {"num_ctx": NUM_CTX}}
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens   # a cap: a model that rambles stops here
        if schema is not None:
            payload["format"] = schema
        if keep_alive:
            payload["keep_alive"] = keep_alive
        try:
            response = self._open("/api/chat", payload)
        except _NET_ERRORS as exc:
            raise _explain(exc) from exc
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
