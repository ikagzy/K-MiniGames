"""The app's own memory: a short summary of the chat, put at the very top of every request to the model.

Small local models forget the start of a long chat, so the app keeps the gist itself and shows it first each time.
There are two memories: the advisor's (`danisman_hafiza.md` in the app's folder) and each game's (`hafiza.md` in the
game folder, which is the bellhop bear's memory while that game is made). After every exchange the model rewrites the
summary; if it cannot, the request is added as one short line so nothing is lost."""
import os
import threading
from pathlib import Path

from k_minigames import settings

MAX_CHARS = 1500
TITLE = "HAFIZA (bunu unutma):"
FALLBACK_LINE_CHARS = 200
_TOO_LONG = 1.5   # a summary longer than this many times the limit is not trusted

_SUMMARISER = (
    "Sen kısa bir not tutucusun. Aşağıda eski bir not ve yeni bir konuşma var. Yeni notu yaz: en fazla "
    f"{MAX_CHARS - 300} karakter, Türkçe, madde madde. Şunlar olsun: oyunun amacı (ilk satır), kullanıcının istekleri, "
    "alınan kararlar, bilinen sorunlar. Eski notun önemli kısımlarını koru. Yalnızca notun kendisini yaz."
)


def block(memory: str) -> str:
    """The text that goes at the very start of the first (system) message; empty when there is no memory."""
    memory = (memory or "").strip()
    return f"{TITLE}\n{memory}" if memory else ""


def advisor_path() -> Path:
    return settings.app_dir() / "danisman_hafiza.md"


def game_path(game) -> Path:
    return game.folder / "hafiza.md"


def load(path: Path) -> str:
    try:
        # a file saved by hand in an old code page must not break every build: odd bytes become "\ufffd"
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def save(path: Path, text: str) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)
        return True
    except OSError:
        return False


def _fit(text: str) -> str:
    """At most MAX_CHARS: the first line (the aim) stays, the oldest lines after it go first."""
    if len(text) <= MAX_CHARS:
        return text
    first, *rest = text.split("\n")
    while rest and len("\n".join([first, *rest])) > MAX_CHARS:
        rest.pop(0)
    return "\n".join([first, *rest])[:MAX_CHARS]


def _fallback(previous: str, user_text: str) -> str:
    line = "- " + " ".join(user_text.split())[:FALLBACK_LINE_CHARS]
    base = previous.strip()
    return _fit(f"{base}\n{line}" if base else line)


def update(client, model: str, previous: str, user_text: str, reply_text: str, cancel=None) -> str:
    """The new memory after one exchange. Never raises and never loses the old memory."""
    if model.startswith("k-ai"):   # our small models only know their own jobs: they copy their last answer into the notes (and can take minutes), so the notes are the user's own words
        return _fallback(previous, user_text)
    messages = [
        {"role": "system", "content": _SUMMARISER},
        {"role": "user", "content": f"Eski not:\n{previous.strip() or '(boş)'}\n\nKullanıcı:\n{user_text}\n\n"
                                    f"Cevap:\n{reply_text}"},
    ]
    try:
        answer = (client.chat(model, messages, cancel=cancel, max_tokens=MAX_CHARS // 2) or "").strip()   # a rambling model is cut off
    except Exception:  # any failure of the summariser: the app must go on with the old memory
        return _fallback(previous, user_text)
    if not answer or len(answer) > MAX_CHARS * _TOO_LONG:
        return _fallback(previous, user_text)
    return _fit(answer)


_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _lock_for(path: Path) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(str(path), threading.Lock())


def remember(path: Path, client, model: str, user_text: str, reply_text: str, cancel=None) -> str:
    """Read the memory file, rewrite it after one exchange and save it, all under one lock per file, so two updates
    that overlap (the summary takes a while) never drop each other's exchange. Returns the new memory."""
    with _lock_for(path):
        updated = update(client, model, load(path), user_text, reply_text, cancel)
        save(path, updated)
        return updated
