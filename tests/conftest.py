"""Safety net: no test may touch the real settings folders or the network."""
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
