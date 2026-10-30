"""Installing Ollama: find it, download its setup, run it, start its server.

Nothing here runs by itself: the UI calls these only after the user clicked and confirmed the address and size."""
import http.client
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from collections.abc import Callable
from pathlib import Path

OLLAMA_URL = "https://ollama.com/download/OllamaSetup.exe"
CHUNK = 64 * 1024
_NET_ERRORS = (OSError, http.client.HTTPException, ValueError)


class _Cancelled(Exception):
    pass


def ollama_exe() -> Path | None:
    local = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    exe = local / "Programs" / "Ollama" / "ollama.exe"
    if exe.is_file():
        return exe
    found = shutil.which("ollama")
    return Path(found) if found else None


def download_size(url: str = OLLAMA_URL, opener: Callable | None = None) -> int | None:
    """The size the server announces (a HEAD request), or None when it cannot be told."""
    opener = opener or urllib.request.urlopen
    try:
        with opener(urllib.request.Request(url, method="HEAD"), timeout=10) as response:
            return int(response.headers.get("Content-Length"))
    except (*_NET_ERRORS, TypeError):
        return None


def _remove(path: Path) -> None:
    try:
        path.unlink()
    except OSError:
        pass


def download(url: str, dest: Path, on_progress: Callable[[int, int | None], None],
             cancel: Callable[[], bool] | None = None, opener: Callable | None = None) -> bool:
    """Download to `dest`. A cancelled, broken or incomplete download leaves no file behind (not even `.part`)."""
    opener = opener or urllib.request.urlopen
    part = dest.with_name(dest.name + ".part")
    try:
        with opener(urllib.request.Request(url), timeout=30) as response:
            try:
                total = int(response.headers.get("Content-Length")) or None
            except (TypeError, ValueError):
                total = None
            done = 0
            with open(part, "wb") as out:
                while True:
                    if cancel and cancel():
                        raise _Cancelled
                    chunk = response.read(CHUNK)
                    if not chunk:
                        break
                    out.write(chunk)
                    done += len(chunk)
                    on_progress(done, total)
        if total is not None and done != total:
            raise OSError("indirme eksik kaldı")
        os.replace(part, dest)
        return True
    except (_Cancelled, *_NET_ERRORS):
        _remove(part)
        return False


def run_setup(setup: Path, popen: Callable = subprocess.Popen) -> bool:
    """Start Ollama's own setup program; the user clicks through it."""
    if not setup.is_file():
        return False
    try:
        popen([str(setup)])
        return True
    except OSError:
        return False


def start_server(exe: Path, popen: Callable = subprocess.Popen) -> bool:
    """`ollama serve` in the background, with no console window.

    Not DETACHED_PROCESS: Windows then ignores CREATE_NO_WINDOW, and every helper program Ollama starts (GPU checks,
    model runners) opens a console window of its own that flashes up again and again. With a hidden console they
    inherit it instead. The new process group keeps the server alive after this app closes."""
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    try:
        popen([str(exe), "serve"], creationflags=flags, close_fds=True,
              stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except OSError:
        return False


def wait_until_running(client, timeout_s: float = 60, sleep: Callable[[float], None] = time.sleep,
                       clock: Callable[[], float] = time.monotonic) -> bool:
    deadline = clock() + timeout_s
    while True:
        if client.is_running():
            return True
        if clock() >= deadline:
            return False
        sleep(1.0)


_download, _run_setup, _start_server, _wait, _ollama_exe = download, run_setup, start_server, wait_until_running, ollama_exe


def ensure_running(client, *, exe: Callable[[], Path | None] | None = None, start: Callable | None = None,
                   wait: Callable | None = None, timeout_s: float = 20) -> bool:
    """Ollama answers, starting an installed Ollama if it is not running yet."""
    if client.is_running():
        return True
    found = (exe or _ollama_exe)()
    if found is None or not (start or _start_server)(found):
        return False
    return (wait or _wait)(client, timeout_s=timeout_s)


def install_ollama(client, on_progress: Callable[[int, int | None], None], cancel: Callable[[], bool] | None = None, *,
                   download: Callable | None = None, run: Callable | None = None, wait: Callable | None = None,
                   exe: Callable[[], Path | None] | None = None, start: Callable | None = None,
                   folder: Path | None = None) -> str:
    """Download Ollama's setup, run it (the user clicks through it) and wait for the server.
    Returns "ok", "download_failed", "setup_failed" or "not_running"."""
    setup = (folder or Path(tempfile.gettempdir())) / "OllamaSetup.exe"
    if not (download or _download)(OLLAMA_URL, setup, on_progress, cancel):
        return "download_failed"
    if not (run or _run_setup)(setup):
        return "setup_failed"
    waiter = wait or _wait
    if waiter(client, 300):
        return "ok"
    found = (exe or _ollama_exe)()
    if found is not None and (start or _start_server)(found) and waiter(client, 30):
        return "ok"
    return "not_running"
