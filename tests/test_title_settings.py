import tkinter as tk

import pytest

from k_minigames import memory
from k_minigames.ui.services import Services
from k_minigames.ui.settings_screen import SettingsScreen
from k_minigames.ui.stage import Stage
from k_minigames.ui import title_screen
from k_minigames.ui.title_screen import TitleScreen
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


def test_start_only_appears_when_ollama_and_the_model_are_ready(env, monkeypatch):
    services, went, *_ = env
    monkeypatch.setattr(title_screen, "ready_to_play", lambda client: False)
    screen = TitleScreen(services)
    screen.show()
    assert [action for _, action in screen.items] == ["settings", "exit"]
    screen._probed(True)
    assert [action for _, action in screen.items] == ["start", "settings", "exit"]
    screen._probed(False)
    assert [action for _, action in screen.items] == ["settings", "exit"]
    screen.hide()
    screen._probed(True)   # a probe that finishes after the screen was left changes nothing
    assert len(screen.items) == 2


def test_the_menu_moves_with_arrows_and_chooses(env, monkeypatch):
    services, went, *_ = env
    monkeypatch.setattr(title_screen, "ready_to_play", lambda client: False)
    screen = TitleScreen(services)
    screen.show()
    screen._probed(True)
    screen.choose(screen.index)
    screen.move(1)
    screen.choose(screen.index)
    assert went == ["start", "settings"]
    screen.move(-1)
    screen.move(-1)
    assert screen.index == 2   # wraps round
    screen.hide()


def test_ready_to_play_needs_a_running_ollama_and_the_advisor_model(monkeypatch):
    class Client:
        def __init__(self, models):
            self._models = models

        def models(self):
            return self._models

    monkeypatch.setattr(title_screen.installer, "ensure_running", lambda client: True)
    monkeypatch.setattr(title_screen, "advisor_id", lambda: "don:1b")
    assert title_screen.ready_to_play(Client(["don:1b"])) is True
    assert title_screen.ready_to_play(Client(["other"])) is False
    monkeypatch.setattr(title_screen.installer, "ensure_running", lambda client: False)
    assert title_screen.ready_to_play(Client(["don:1b"])) is False


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


def test_the_characters_tell_their_names_and_the_room_fades_in(env):
    from k_minigames import i18n
    from k_minigames.ui import advisor_screen, library_screen, setup_screen, studio_screen
    for text, name in ((setup_screen.INTRO, "Don"), (advisor_screen.GREETING, "Don"), (library_screen.INTRO, "Bob"),
                       (library_screen.EMPTY, "Bob"), (studio_screen.ASK_NAME, "Bob")):
        assert f"Ben {name}" in text
    i18n.set_language("en")
    assert i18n.t(advisor_screen.GREETING) == "I'm Don, your advisor! What kind of game do you want to make?"
    assert i18n.t(studio_screen.ASK_NAME).startswith("I'm Bob!")
    services, *_ = env
    stage, ticks = services.stage, []
    stage.fade_in(lambda ms, fn: ticks.append(fn) or "job")
    assert stage.find_withtag("fade")
    while ticks:
        ticks.pop(0)()
    assert not stage.find_withtag("fade") and not stage._fade_hidden


def test_start_opens_don_when_there_are_no_games_and_bob_when_there_are(tmp_path, monkeypatch):
    from k_minigames import library, settings
    from k_minigames.ui import app
    monkeypatch.setattr(app.installer, "ensure_running", lambda client: True)
    monkeypatch.setattr(app, "startup_state", lambda client, advisor, game_model: "library")
    assert app.next_screen(object()) == "setup"   # no folder yet
    folder = tmp_path / "oyunlar"
    folder.mkdir()
    settings.set_games_dir(folder)
    assert app.next_screen(object()) == "advisor"
    library.create_game(folder, "Uzay").html_path.write_text("<html></html>", encoding="utf-8")
    assert app.next_screen(object()) == "library"
