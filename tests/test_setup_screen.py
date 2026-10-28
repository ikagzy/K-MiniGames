import threading
import time
import tkinter as tk
import types

import pytest

from k_minigames import catalog
from k_minigames.ollama_client import InstalledModel
from k_minigames.startup import CANCEL_MESSAGE, SetupButtons
from k_minigames.ui.services import Services
from k_minigames.ui.setup_screen import SetupScreen
from k_minigames.ui.stage import Stage
from k_minigames.ui.worker import Worker

HAVE = InstalledModel("llama3.1:8b", 4.58, "llama")
SMALL = InstalledModel("tiny:1b", 0.6, "llama")


@pytest.fixture
def env():
    try:
        root = tk.Tk()
    except tk.TclError:
        pytest.skip("no display for Tk")
    root.withdraw()
    answers, asked, infos = [], [], []

    def confirm(title, message):
        asked.append((title, message))
        return answers.pop(0) if answers else False

    services = Services(root=root, stage=Stage(root), client=object(), worker=Worker(root.after),
                        navigate=lambda name: None, confirm=confirm,
                        info=lambda title, message: infos.append((title, message)), choose_folder=lambda: "")
    screen = SetupScreen(services)
    yield screen, answers, asked, infos
    root.destroy()


def test_the_buttons_follow_what_is_missing(env):
    screen, *_ = env
    screen.show()
    screen.apply_buttons(SetupButtons("download", "disabled"), ollama_size="1.2 GB", advisor_gb=3.4, has_alternative=False)
    assert "indir" in screen.ollama_button["text"] and "1.2 GB" in screen.ollama_button["text"]
    assert str(screen.ollama_button["state"]) == "normal" and str(screen.advisor_button["state"]) == "disabled"
    screen.apply_buttons(SetupButtons("start", "disabled"), ollama_size=None, advisor_gb=3.4, has_alternative=False)
    assert "başlat" in screen.ollama_button["text"]
    screen.apply_buttons(SetupButtons("done", "download"), ollama_size=None, advisor_gb=3.4, has_alternative=False)
    assert str(screen.ollama_button["state"]) == "disabled" and "3.4 GB" in screen.advisor_button["text"]
    screen.apply_buttons(SetupButtons("done", "download"), ollama_size=None, advisor_gb=3.4, has_alternative=True)
    assert "seç" in screen.advisor_button["text"]
    screen.apply_buttons(SetupButtons("done", "done"), ollama_size=None, advisor_gb=3.4, has_alternative=False)
    assert "✓" in screen.advisor_button["text"] and str(screen.advisor_button["state"]) == "disabled"


def test_the_continue_button_needs_everything_ready(env):
    screen, *_ = env
    screen.show()
    screen.apply_ready(False)
    assert str(screen.continue_button["state"]) == "disabled"
    screen.apply_ready(True)
    assert str(screen.continue_button["state"]) == "normal"


def test_an_installed_model_that_is_enough_is_offered_first_and_a_yes_uses_it(env):
    screen, answers, asked, infos = env
    answers.extend([True])
    choice = screen.advisor_choice([HAVE, SMALL], ram_gb=32, vram_gb=None)
    assert choice.kind == "use_installed" and choice.model == "llama3.1:8b"
    assert len(asked) == 1 and "llama3.1:8b" in asked[0][1] and infos == []


def test_a_no_to_the_installed_model_leads_to_the_download_question_with_its_size(env):
    screen, answers, asked, infos = env
    answers.extend([False, True])
    choice = screen.advisor_choice([HAVE], ram_gb=32, vram_gb=None)
    assert choice.kind == "install_new" and choice.model == catalog.advisor().id
    assert len(asked) == 2 and f"{catalog.advisor().size_gb:.1f} GB" in asked[1][1]


def test_two_noes_show_the_cancel_message_and_choose_nothing(env):
    screen, answers, asked, infos = env
    answers.extend([False, False])
    assert screen.advisor_choice([HAVE], ram_gb=32, vram_gb=None) is None
    assert infos == [("İptal edildi", CANCEL_MESSAGE)]


def test_without_an_installed_model_only_the_download_is_asked(env):
    screen, answers, asked, infos = env
    answers.extend([True])
    choice = screen.advisor_choice([SMALL], ram_gb=32, vram_gb=None)
    assert choice.kind == "install_new" and len(asked) == 1


# --- review: nothing slow on the interface thread, nothing after hide() ---------------------------------------------

def test_the_setup_probe_measures_the_graphics_card_off_the_interface_thread(env, monkeypatch):
    from k_minigames.ui import setup_screen

    screen, answers, asked, infos = env
    threads = []
    monkeypatch.setattr(setup_screen.hardware, "vram_gb", lambda: (threads.append(threading.current_thread().name), None)[1])
    screen.s.client = types.SimpleNamespace(is_running=lambda: True, installed=lambda: [])
    screen.show()
    end = time.monotonic() + 5
    while not threads and time.monotonic() < end:
        screen.s.root.update()
        time.sleep(0.005)
    assert threads and threads[0] != threading.main_thread().name


def test_a_probe_that_finishes_after_hide_does_nothing(env):
    screen, answers, asked, infos = env
    problems = []
    screen.s.root.report_callback_exception = lambda *args: problems.append(args)
    screen.s.client = types.SimpleNamespace(is_running=lambda: (time.sleep(0.2), True)[1], installed=lambda: [])
    screen.show()
    screen.hide()
    end = time.monotonic() + 1.0
    while time.monotonic() < end:
        screen.s.root.update()
        time.sleep(0.005)
    assert problems == []
