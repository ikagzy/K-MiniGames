import tkinter as tk

import pytest

from k_minigames import memory
from k_minigames.ui.services import Services
from k_minigames.ui.settings_screen import SettingsScreen
from k_minigames.ui.stage import Stage
from k_minigames.ui.title_screen import ITEMS, TitleScreen
from k_minigames.ui.worker import Worker


@pytest.fixture
def env():
    try:
        root = tk.Tk()
    except tk.TclError:
        pytest.skip("no display for Tk")
    root.withdraw()
    went, answers, infos = [], [], []
    services = Services(root=root, stage=Stage(root), client=object(), worker=Worker(root.after),
                        navigate=went.append, confirm=lambda t, m: answers.pop(0) if answers else False,
                        info=lambda t, m: infos.append(t), choose_folder=lambda: "")
    yield services, went, answers, infos
    root.destroy()


def test_the_menu_moves_with_arrows_and_chooses(env):
    services, went, *_ = env
    screen = TitleScreen(services)
    screen.show()
    screen.move(1)
    screen.choose(screen.index)
    screen.move(-1)
    screen.choose(screen.index)
    assert went == ["settings", "start"]
    screen.move(-1)
    assert screen.index == len(ITEMS) - 1   # wraps round
    screen.hide()


def test_settings_has_back_and_both_install_buttons(env):
    services, went, *_ = env
    screen = SettingsScreen(services)
    screen.show()
    assert "Geri" in screen.continue_button["text"] and str(screen.continue_button["state"]) == "disabled"
    screen.apply_ready(False)
    assert str(screen.continue_button["state"]) == "normal"   # back is always possible
    screen._on_continue()
    assert went == ["title"]
    from k_minigames.startup import SetupButtons
    screen.apply_buttons(SetupButtons("download", "download"), "1.2 GB", 3.4, False)
    assert "indir" in screen.ollama_button["text"] and "indir" in screen.advisor_button["text"]
    screen.hide()


def test_forgetting_the_memory_asks_first(env):
    services, _, answers, infos = env
    memory.save(memory.advisor_path(), "bir şeyler")
    screen = SettingsScreen(services)
    screen.show()
    screen._on_reset()
    assert memory.load(memory.advisor_path()) == "bir şeyler" and not infos
    answers.append(True)
    screen._on_reset()
    assert memory.load(memory.advisor_path()) == "" and infos
    screen.hide()
