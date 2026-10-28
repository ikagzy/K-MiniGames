import threading
import time
import tkinter as tk
import types

import pytest

from k_minigames import settings
from k_minigames.advisor import AdvisorReply
from k_minigames.startup import CANCEL_MESSAGE
from k_minigames.ui.advisor_flow import AdvisorFlow
from k_minigames.ui.advisor_screen import GREETING, AdvisorScreen
from k_minigames.ui.services import Services
from k_minigames.ui.stage import Stage
from k_minigames.ui.worker import Worker


class FakeAdvisor:
    def __init__(self, *replies):
        self.replies = list(replies)

    def ask(self, history, user_text, memory="", on_token=None, cancel=None):
        return self.replies.pop(0)


class FakeClient:
    def __init__(self, pull_ok=True):
        self.pull_ok, self.pulled = pull_ok, []

    def pull(self, model, on_progress, cancel=None):
        self.pulled.append(model)
        on_progress("downloading", 1, 2)
        return self.pull_ok


@pytest.fixture
def env():
    try:
        root = tk.Tk()
    except tk.TclError:
        pytest.skip("no display for Tk")
    root.withdraw()
    state = {"answers": [], "asked": [], "went": []}

    def confirm(title, message):
        state["asked"].append((title, message))
        return state["answers"].pop(0) if state["answers"] else False

    services = Services(root=root, stage=Stage(root), client=object(), worker=Worker(root.after),
                        navigate=state["went"].append, confirm=confirm, info=lambda t, m: None,
                        choose_folder=lambda: "")

    def pump(until, seconds=5.0):
        deadline = time.monotonic() + seconds
        while not until() and time.monotonic() < deadline:
            root.update()
            time.sleep(0.005)
        return until()

    def texts():
        stage = services.stage
        return [stage.itemcget(i, "text") for i in stage.find_all() if stage.type(i) == "text"]

    yield services, state, pump, texts
    root.destroy()


def screen_for(services, advisor, client=None):
    client = client or FakeClient()
    flow = AdvisorFlow(advisor, client, ram_gb=32, vram_gb=None, installed=lambda: [])
    return AdvisorScreen(services, flow=flow, typing_ms=1, finish_ms=1), client


def test_the_advisor_greets_and_then_waits_for_the_user_to_type(env):
    services, state, pump, texts = env
    screen, _ = screen_for(services, FakeAdvisor())
    screen.show()
    assert pump(lambda: services.stage.entry is not None)
    assert GREETING in texts() and "DON" in texts()


def test_a_message_is_shown_as_SEN_and_the_answer_comes_back_as_DON(env):
    services, state, pump, texts = env
    screen, _ = screen_for(services, FakeAdvisor(AdvisorReply("Hangi türde bir oyun?", None)))
    screen.show()
    assert pump(lambda: services.stage.entry is not None)
    services.stage.entry.insert(0, "uzay oyunu istiyorum")
    services.stage.submit()
    assert pump(lambda: "SEN" in texts() and "uzay oyunu istiyorum" in texts())
    assert pump(lambda: "Hangi türde bir oyun?" in texts() and services.stage.entry is not None)
    assert "DON" in texts() and "SEN" not in texts()


def test_a_proposal_that_is_accepted_downloads_the_model_and_hands_over_to_bob(env):
    services, state, pump, texts = env
    state["answers"].append(True)
    advisor = FakeAdvisor(AdvisorReply("Şunu öneririm.", "qwen2.5-coder:7b"))
    screen, client = screen_for(services, advisor)
    screen.show()
    assert pump(lambda: services.stage.entry is not None)
    services.stage.entry.insert(0, "hazırım")
    services.stage.submit()
    assert pump(lambda: state["went"] == ["studio"])
    assert client.pulled == ["qwen2.5-coder:7b"] and settings.get("game_model") == "qwen2.5-coder:7b"
    assert "qwen2.5-coder:7b" in state["asked"][0][1] and "4.7 GB" in state["asked"][0][1]


def test_refusing_the_download_shows_the_cancel_message_and_lets_the_user_talk_again(env):
    services, state, pump, texts = env
    advisor = FakeAdvisor(AdvisorReply("Şunu öneririm.", "qwen2.5-coder:7b"))
    screen, client = screen_for(services, advisor)
    screen.show()
    assert pump(lambda: services.stage.entry is not None)
    services.stage.entry.insert(0, "hazırım")
    services.stage.submit()
    assert pump(lambda: CANCEL_MESSAGE in texts() and services.stage.entry is not None)
    assert client.pulled == [] and settings.get("game_model") is None and state["went"] == []


def test_a_failed_download_is_told_and_nothing_is_remembered(env):
    services, state, pump, texts = env
    state["answers"].append(True)
    advisor = FakeAdvisor(AdvisorReply("Şunu öneririm.", "qwen2.5-coder:7b"))
    screen, _ = screen_for(services, advisor, FakeClient(pull_ok=False))
    screen.show()
    assert pump(lambda: services.stage.entry is not None)
    services.stage.entry.insert(0, "hazırım")
    services.stage.submit()
    assert pump(lambda: any("indirilemedi" in t for t in texts()) and services.stage.entry is not None)
    assert settings.get("game_model") is None and state["went"] == []


def test_an_error_from_the_advisor_is_said_politely_and_the_user_can_try_again(env):
    from k_minigames.ollama_client import OllamaError

    class Broken:
        def ask(self, *a, **k):
            raise OllamaError("bağlantı koptu")

    services, state, pump, texts = env
    screen, _ = screen_for(services, Broken())
    screen.show()
    assert pump(lambda: services.stage.entry is not None)
    services.stage.entry.insert(0, "selam")
    services.stage.submit()
    assert pump(lambda: any("ulaşamadım" in t for t in texts()) and services.stage.entry is not None)


# --- review: cancelling the download, and nothing slow on the interface thread ---------------------------------------

class WaitingClient(FakeClient):
    """A download that only stops when it is cancelled."""
    def pull(self, model, on_progress, cancel=None):
        self.pulled.append(model)
        end = time.monotonic() + 5
        while not cancel() and time.monotonic() < end:
            time.sleep(0.01)
        return False


def test_the_game_model_download_can_be_cancelled(env):
    services, state, pump, texts = env
    state["answers"].append(True)
    screen, client = screen_for(services, FakeAdvisor(AdvisorReply("Şunu öneririm.", "qwen2.5-coder:7b")),
                                WaitingClient())
    screen.show()
    assert pump(lambda: services.stage.entry is not None)
    services.stage.entry.insert(0, "hazırım")
    services.stage.submit()
    assert pump(lambda: screen.cancel_button_visible())
    screen.cancel_install()
    assert pump(lambda: "İndirme iptal edildi." in texts() and services.stage.entry is not None)
    assert settings.get("game_model") is None and state["went"] == [] and not screen.cancel_button_visible()


def test_the_graphics_card_is_measured_off_the_interface_thread(env, monkeypatch):
    from k_minigames.ui import advisor_screen

    services, state, pump, texts = env
    threads = []
    monkeypatch.setattr(advisor_screen.hardware, "vram_gb", lambda: (threads.append(threading.current_thread().name), 8.0)[1])
    services.client = types.SimpleNamespace(installed=lambda: [], is_running=lambda: True)
    screen = AdvisorScreen(services, typing_ms=1)
    screen.show()
    assert pump(lambda: bool(threads))
    assert threads[0] != threading.main_thread().name
    assert pump(lambda: screen._flow.vram_gb == 8.0)
