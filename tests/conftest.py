"""Safety net: no test may touch the real settings folders or the network."""
import gc
import urllib.request
from urllib.error import URLError

import pytest

from k_minigames import i18n


@pytest.fixture(autouse=True)
def isolate_settings(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "_local"))
    monkeypatch.setenv("APPDATA", str(tmp_path / "_roaming"))
    i18n.set_language("tr")
    yield
    i18n.set_language("tr")


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Tests that exercise downloads or the Ollama API pass their own fake opener."""
    def refuse(*args, **kwargs):
        raise URLError("no network in tests")

    monkeypatch.setattr(urllib.request, "urlopen", refuse)


@pytest.fixture(autouse=True)
def collect_tk_garbage():
    """Free the Tk pictures of windows a test closed here, on the main thread.

    Left to chance, Python frees them on whatever thread happens to run the garbage collector (for example the
    report server's). A Tk call from another thread waits for the main thread, which is busy waiting for that very
    server: the test then hangs until its timeout."""
    yield
    gc.collect()
