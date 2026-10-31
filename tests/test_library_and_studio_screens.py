import threading
import time
import tkinter as tk
import types
from pathlib import Path

import pytest

from k_minigames import library, settings
from k_minigames.checker import CheckReport
from k_minigames.generator import GenerationError
from k_minigames.studio import Outcome
from k_minigames.testlist import PASSED, TestItem
from k_minigames.ui.library_screen import LibraryScreen
from k_minigames.ui.services import Services
from k_minigames.ui.studio_screen import StudioScreen
from k_minigames.ui.stage import Stage
from k_minigames.ui.worker import Worker


class FakeClient:
    def __init__(self, running=True):
        self.running = running

    def is_running(self):
        return self.running


@pytest.fixture
def env(tmp_path):
    try:
        root = tk.Tk()
    except tk.TclError:
        pytest.skip("no display for Tk")
    root.withdraw()
    games = tmp_path / "Oyunlar"
    games.mkdir()
    settings.set_games_dir(games)
    settings.put("game_model", "qwen2.5-coder:7b")
    log = {"went": [], "opened": [], "infos": [], "asked": [], "files": [], "texts": []}
    services = Services(
        root=root, stage=Stage(root), client=FakeClient(), worker=Worker(root.after),
        navigate=log["went"].append, confirm=lambda t, m: True, info=lambda t, m: log["infos"].append((t, m)),
        choose_folder=lambda: "", choose_files=lambda: log["files"], ask_text=lambda t, p: (log["asked"].append(p), log["texts"].pop(0) if log["texts"] else None)[1],
        open_path=log["opened"].append)

    def pump(until, seconds=5.0):
        end = time.monotonic() + seconds
        while not until() and time.monotonic() < end:
            root.update()
            time.sleep(0.005)
        return until()

    def texts():
        st = services.stage
        return [st.itemcget(i, "text") for i in st.find_all() if st.type(i) == "text"]

    yield services, games, log, pump, texts
    root.destroy()


def clean_outcome(passed=2, attempts=0, saved=True, rejected=False):
    items = [TestItem(f"t{i}", "madde", "c", PASSED) for i in range(passed)]
    return Outcome("<html></html>", CheckReport([], items, [], True), attempts, saved, rejected)


def make_game(games, name="Uzay"):
    game = library.create_game(games, name)
    library.save_version(game, "<html>v1</html>")
    return game


# --- library --------------------------------------------------------------------------------------

def test_the_library_lists_the_games_and_play_opens_the_launcher(env):
    services, games, log, pump, texts = env
    first = make_game(games, "Uzay")
    make_game(games, "Bulmaca")
    screen = LibraryScreen(services)
    screen.show()
    assert list(screen.listbox.get(0, "end")) == ["Bulmaca", "Uzay"]
    screen.listbox.selection_set(1)
    screen.play()
    assert log["opened"] == [first.launcher_path]


def test_new_game_starts_with_don_and_edit_goes_to_bob_with_the_right_session(env):
    services, games, log, pump, texts = env
    game = make_game(games, "Uzay")
    screen = LibraryScreen(services)
    screen.show()
    screen.new_game()
    assert log["went"] == ["advisor"]
    screen.listbox.selection_set(0)
    screen.edit()
    assert log["went"] == ["advisor", "studio"] and services.session == {"mode": "edit", "game": game}


def test_without_a_selection_play_and_edit_do_nothing(env):
    services, games, log, pump, texts = env
    make_game(games)
    screen = LibraryScreen(services)
    screen.show()
    screen.play()
    screen.edit()
    assert log["opened"] == [] and log["went"] == []


def test_an_empty_library_invites_the_first_game(env):
    services, games, log, pump, texts = env
    screen = LibraryScreen(services)
    screen.show()
    assert any("ilkini yapalım" in t for t in texts())


# --- studio -----------------------------------------------------------------------------------------

class FakeFlows:
    def __init__(self, outcome=None, error=None):
        self.outcome, self.error, self.calls = outcome or clean_outcome(), error, []

    def create(self, generator, game, description, textures, server, open_url, on_status, cancel=None, *, memory="",
               background=None):
        self.calls.append(("create", game.name, description, [t.file for t in textures]))
        on_status("generating", "Oyun üretiliyor…")
        if self.error:
            raise self.error
        return self.outcome

    def edit(self, generator, game, request, textures, server, open_url, on_status, cancel=None, *, memory="",
             background=None):
        self.calls.append(("edit", game.name, request))
        return self.outcome


def studio(services, flows):
    return StudioScreen(services, flows=flows, typing_ms=1, generator_factory=lambda: object(),
                        server_factory=lambda game: _NullServer(), open_url=lambda url: None)


class _NullServer:
    def start(self):
        pass

    def stop(self):
        pass


def answer(services, pump, text):
    assert pump(lambda: services.stage.entry is not None)
    services.stage.entry.insert(0, text)
    services.stage.submit()


def test_creating_a_game_asks_the_name_then_the_description_then_builds_it(env):
    services, games, log, pump, texts = env
    services.session = {"mode": "create"}
    flows = FakeFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Zıplayan Kare")
    answer(services, pump, "tek tuşla zıplayan kare, engellerden kaçsın")
    assert pump(lambda: flows.calls != [] and "2 madde geçti" in texts())
    assert flows.calls[0] == ("create", "Zıplayan Kare", "tek tuşla zıplayan kare, engellerden kaçsın", [])
    assert (games / "Zıplayan Kare").is_dir()


def test_textures_added_before_the_description_are_given_to_the_flow(env, tmp_path):
    services, games, log, pump, texts = env
    image = tmp_path / "zemin.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 20)
    log["files"].append(str(image))
    log["texts"].append("zemin karosu")
    services.session = {"mode": "create"}
    flows = FakeFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Uzay")
    screen.add_textures()
    answer(services, pump, "uzay gemisi oyunu")
    assert pump(lambda: flows.calls != [])
    assert flows.calls[0][3] == ["zemin.png"]


def test_editing_asks_what_to_change_and_runs_the_edit_flow(env):
    services, games, log, pump, texts = env
    game = make_game(games)
    services.session = {"mode": "edit", "game": game}
    flows = FakeFlows(clean_outcome(passed=1, attempts=1))
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "topu hızlandır")
    assert pump(lambda: flows.calls != [] and any("1 kez otomatik düzelttim" in x for x in texts()))
    assert flows.calls[0] == ("edit", "Uzay", "topu hızlandır")


def test_a_generation_error_is_told_and_the_user_can_go_back(env):
    services, games, log, pump, texts = env
    services.session = {"mode": "create"}
    flows = FakeFlows(error=GenerationError("Ollama'nın cevabı yarıda kesildi"))
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Uzay")
    answer(services, pump, "uzay oyunu")
    assert pump(lambda: any("yarıda kesildi" in t for t in texts()))
    assert screen.actions_visible() and (games / "Uzay" / "oyun.html").exists() is False


def test_when_ollama_is_not_running_nothing_is_started(env):
    services, games, log, pump, texts = env
    services.client = FakeClient(running=False)
    services.session = {"mode": "create"}
    flows = FakeFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Uzay")
    answer(services, pump, "uzay oyunu")
    assert pump(lambda: any("Ollama" in t and "çalışmıyor" in t for t in texts()))
    assert flows.calls == []


def test_without_a_chosen_game_model_the_studio_sends_the_user_to_the_advisor(env):
    services, games, log, pump, texts = env
    settings.put("game_model", "")
    services.session = {"mode": "create"}
    screen = studio(services, FakeFlows())
    screen.show()
    assert pump(lambda: log["went"] == ["advisor"])


def test_going_back_to_an_older_version_asks_which_one(env):
    services, games, log, pump, texts = env
    game = make_game(games)
    library.save_version(game, "<html>v2</html>")
    services.session = {"mode": "edit", "game": game}
    log["texts"].append("1")
    screen = studio(services, FakeFlows())
    screen.show()
    screen.go_back_a_version()
    assert "1" in log["asked"][0] and game.html_path.read_text(encoding="utf-8") == "<html>v1</html>"
    assert library.versions(game) == [1, 2]


# --- review: leaving the studio, and the writable check in edit mode --------------------------------------------

class BlockingFlows(FakeFlows):
    """A build that keeps going until it is cancelled."""
    def __init__(self):
        super().__init__()
        self.started, self.token = threading.Event(), None

    def create(self, generator, game, description, textures, server, open_url, on_status, cancel=None, *, memory="",
               background=None):
        self.token = cancel
        self.started.set()
        end = time.monotonic() + 5
        while not cancel() and time.monotonic() < end:
            time.sleep(0.01)
        return self.outcome


def test_leaving_the_studio_during_a_build_cancels_it_and_draws_nothing_afterwards(env):
    services, games, log, pump, texts = env
    services.session = {"mode": "create"}
    flows = BlockingFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Uzay")
    answer(services, pump, "uzay oyunu")
    assert pump(flows.started.is_set)
    screen.hide()
    assert pump(lambda: flows.token() is True)
    pump(lambda: False, 0.6)
    assert screen.actions_visible() is False and not any("madde" in x for x in texts())


def test_the_toolbar_does_nothing_while_a_build_is_running(env, tmp_path):
    services, games, log, pump, texts = env
    image = tmp_path / "zemin.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 20)
    log["files"].append(str(image))
    services.session = {"mode": "create"}
    flows = BlockingFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Uzay")
    answer(services, pump, "uzay oyunu")
    assert pump(flows.started.is_set)
    screen.add_textures()
    assert library.textures(library.Game("Uzay", games / "Uzay")) == []
    screen.hide()


def test_editing_checks_the_games_folder_first(env, monkeypatch):
    services, games, log, pump, texts = env
    game = make_game(games)
    services.session = {"mode": "edit", "game": game}
    monkeypatch.setattr(library, "can_write", lambda folder, min_free_mb=50: False)
    flows = FakeFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "topu hızlandır")
    assert pump(lambda: any("yazılamıyor" in x for x in texts()))
    assert flows.calls == []


def test_asking_whether_ollama_runs_happens_off_the_interface_thread(env):
    services, games, log, pump, texts = env
    threads = []
    services.client = types.SimpleNamespace(is_running=lambda: (threads.append(threading.current_thread().name), True)[1])
    services.session = {"mode": "create"}
    flows = FakeFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Uzay")
    answer(services, pump, "uzay oyunu")
    assert pump(lambda: flows.calls != [])
    assert threads and threads[0] != threading.main_thread().name


def test_bob_uses_what_don_learned_instead_of_asking_everything_again(env):
    from k_minigames import memory
    services, games, log, pump, texts = env
    memory.save(memory.advisor_path(), "Amaç: GTA benzeri oyun\n- klavye ve fare")
    services.session = {"mode": "create"}
    flows = FakeFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Şehir")
    assert pump(lambda: any("GTA benzeri" in x for x in texts()))
    answer(services, pump, "evet")
    assert pump(lambda: flows.calls != [])
    assert flows.calls[0][2] == "Amaç: GTA benzeri oyun\n- klavye ve fare"


def test_what_the_user_adds_goes_after_dons_notes(env):
    from k_minigames import memory
    services, games, log, pump, texts = env
    memory.save(memory.advisor_path(), "Amaç: yarış oyunu")
    services.session = {"mode": "create"}
    flows = FakeFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Pist")
    answer(services, pump, "ama arabalar kırmızı olsun")
    assert pump(lambda: flows.calls != [])
    assert flows.calls[0][2] == "Amaç: yarış oyunu\nama arabalar kırmızı olsun"


def test_playing_a_library_game_refreshes_its_copy_of_the_library_files(env):
    from k_minigames import kgamelib
    services, games, log, pump, texts = env
    game = make_game(games, "Küp")
    library.set_modules(game, ["sandbox"])
    stale = game.folder / "kgame.voxel.js"
    stale.write_text("old copy", encoding="utf-8")
    screen = LibraryScreen(services)
    screen.show()
    screen.listbox.selection_set(0)
    screen.play()
    assert stale.read_text(encoding="utf-8") == (kgamelib.LIB_DIR / "kgame.voxel.js").read_text(encoding="utf-8")
    assert log["opened"] == [game.launcher_path]


def test_when_bob_has_made_the_game_dons_memory_is_cleared_but_an_edit_does_not_touch_it(env):
    from k_minigames import memory
    services, games, log, pump, texts = env
    memory.save(memory.advisor_path(), "Amaç: orman oyunu\n- ormanda geçsin")
    services.session = {"mode": "create"}
    flows = FakeFlows()
    screen = studio(services, flows)
    screen.show()
    answer(services, pump, "Orman")
    answer(services, pump, "ormanda geçen bir oyun")
    assert pump(lambda: flows.calls != [] and "2 madde geçti" in texts())
    assert pump(lambda: not memory.advisor_path().exists()), "the notes are forgotten once the game is built"
    assert memory.load(memory.advisor_path()) == ""
    # a game that was not saved (rejected) keeps the notes: the user may try again
    memory.save(memory.advisor_path(), "Amaç: yarış oyunu")
    services.session = {"mode": "create"}
    flows2 = FakeFlows()
    flows2.outcome = clean_outcome(saved=False, rejected=True)
    screen2 = studio(services, flows2)
    screen2.show()
    answer(services, pump, "Yarış")
    answer(services, pump, "arabalı yarış oyunu")
    assert pump(lambda: flows2.calls != [])
    assert memory.load(memory.advisor_path()).startswith("Amaç: yarış")
