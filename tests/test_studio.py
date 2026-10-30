import re
from dataclasses import replace

import pytest

from k_minigames import checker, library, studio, testlist
from k_minigames.checker import CheckReport
from k_minigames.generator import GenerationError, Generated
from k_minigames.testlist import FAILED, PASSED, UNVERIFIED, TestItem

CLEAN = "<html>temiz</html>"


def fake_run_once(game, html, items, server, open_url=None, timeout_s=20):
    """Reads the 'bugs' out of the html text: every BUGn is one browser error, FAILTEST fails every test."""
    errors = [f"hata:{b}" for b in re.findall(r"BUG\d", html)]
    status = FAILED if "FAILTEST" in html else PASSED
    updated = [replace(i, status=status, note="") if i.code is not None
               else replace(i, status=UNVERIFIED, note="test yazılamadı") for i in items]
    console = ["Konsol hatası: bilgi"] if "CONSOLE" in html else []
    return CheckReport([], updated, errors, "HANG" not in html, console)


class FakeGenerator:
    client, model = object(), "m"

    def __init__(self, create=None, fixes=(), edit=None, codes=None, tests_error=False):
        self._create, self._fixes, self._edit = create, list(fixes), edit
        self._codes, self._tests_error = codes, tests_error
        self.fix_calls, self.edit_calls, self.kwargs = [], [], []

    def create(self, description, textures, on_token=None, cancel=None, *, memory=""):
        self.kwargs.append(("create", memory))
        return self._create

    def write_tests(self, html, checklist, cancel=None, *, memory=""):
        if self._tests_error:
            raise GenerationError("model cevap vermedi")
        return self._codes(checklist) if self._codes else [f"return '{t}';" for t in checklist]

    def fix(self, html, problems, on_token=None, cancel=None, *, memory=""):
        self.fix_calls.append((html, list(problems)))
        step = self._fixes.pop(0) if self._fixes else GenerationError("fix bitti")
        if isinstance(step, Exception):
            raise step
        return Generated(step, [])

    def edit(self, html, request, textures, checklist, resolved=(), on_token=None, cancel=None, *, memory=""):
        self.edit_calls.append({"html": html, "request": request, "resolved": list(resolved), "memory": memory})
        return self._edit


@pytest.fixture(autouse=True)
def fake_checker(monkeypatch):
    monkeypatch.setattr(checker, "run_once", fake_run_once)


@pytest.fixture
def game(tmp_path):
    games = tmp_path / "Oyunlar"
    games.mkdir()
    return library.create_game(games, "Uzay")


def flow(fn, gen, game, *args, statuses=None, cancel=None, **kw):
    sink = statuses if statuses is not None else []
    return fn(gen, game, *args, server=object(), open_url=lambda url: None,
              on_status=lambda state, text: sink.append((state, text)), cancel=cancel, **kw)


# --- repair loop -----------------------------------------------------------------------------

def test_a_clean_game_needs_no_fix(game):
    gen = FakeGenerator()
    html, report, attempts = studio.repair_loop(gen, game, CLEAN, [], object(), lambda u: None, lambda s, t: None)
    assert (html, attempts, gen.fix_calls) == (CLEAN, 0, [])


def test_a_game_that_stays_broken_gets_exactly_three_fix_attempts(game):
    gen = FakeGenerator(fixes=["BUG1", "BUG1", "BUG1", "BUG1"])
    _, report, attempts = studio.repair_loop(gen, game, "BUG1", [], object(), lambda u: None, lambda s, t: None)
    assert attempts == 3 == studio.MAX_ATTEMPTS and len(gen.fix_calls) == 3
    assert report.js_errors == ["hata:BUG1"]


def test_the_best_version_is_returned_not_the_last_one(game):
    gen = FakeGenerator(fixes=["BUG1", "BUG1 BUG2 BUG3", "BUG1 BUG2"])
    html, _, _ = studio.repair_loop(gen, game, "BUG1 BUG2", [], object(), lambda u: None, lambda s, t: None)
    assert html == "BUG1"


def test_a_generation_error_ends_the_loop_and_keeps_the_best_version(game):
    gen = FakeGenerator(fixes=["BUG1", GenerationError("kesildi")])
    html, _, attempts = studio.repair_loop(gen, game, "BUG1 BUG2", [], object(), lambda u: None, lambda s, t: None)
    assert html == "BUG1" and len(gen.fix_calls) == 2 and attempts == 2


def test_cancel_stops_the_loop_before_any_fix(game):
    gen = FakeGenerator(fixes=[CLEAN])
    html, _, attempts = studio.repair_loop(gen, game, "BUG1", [], object(), lambda u: None, lambda s, t: None,
                                           cancel=lambda: True)
    assert gen.fix_calls == [] and attempts == 0


def test_the_loop_reports_testing_and_fixing_states(game):
    seen = []
    gen = FakeGenerator(fixes=[CLEAN])
    studio.repair_loop(gen, game, "BUG1", [], object(), lambda u: None, lambda s, t: seen.append((s, t)))
    assert seen[0] == ("testing", "Oyun deneniyor, sekmeyi kapatma")
    assert ("fixing", "Hata buldum, düzeltiyorum (1/3)") in seen


def test_a_test_that_used_to_pass_and_now_fails_is_called_out_to_the_model(game):
    items = [TestItem("t1", "skor artıyor", "c", status=PASSED)]
    gen = FakeGenerator(fixes=[CLEAN])
    studio.repair_loop(gen, game, "FAILTEST", items, object(), lambda u: None, lambda s, t: None)
    assert "Daha önce geçen madde bozuldu: skor artıyor" in gen.fix_calls[0][1]


def test_an_error_that_a_fix_removes_is_remembered_but_one_that_stays_is_not(game):
    gen = FakeGenerator(fixes=["BUG2"])   # BUG1 is fixed, BUG2 stays; the next fix call fails
    studio.repair_loop(gen, game, "BUG1 BUG2", [], object(), lambda u: None, lambda s, t: None)
    assert testlist.load_resolved(game) == ["hata:BUG1"]


def test_tests_that_still_fail_after_the_last_attempt_become_unverified(game):
    items = [TestItem("t1", "skor artıyor", "c")]
    gen = FakeGenerator(fixes=["FAILTEST", "FAILTEST", "FAILTEST"])
    _, report, _ = studio.repair_loop(gen, game, "FAILTEST", items, object(), lambda u: None, lambda s, t: None)
    assert report.items[0].status == UNVERIFIED and "otomatik düzeltilemedi" in report.items[0].note


# --- create ----------------------------------------------------------------------------------

def test_create_saves_the_game_the_tests_and_the_version(game):
    gen = FakeGenerator(create=Generated(CLEAN, ["oyun açılıyor", "skor artıyor"]))
    out = flow(studio.create_game_flow, gen, game, "uzay oyunu", [], memory="Amaç: uzay")
    assert out.saved and not out.rejected and out.attempts == 0
    assert game.html_path.read_text(encoding="utf-8") == CLEAN
    items = testlist.load(game)
    assert [i.text for i in items] == ["oyun açılıyor", "skor artıyor"] and all(i.code for i in items)
    assert all(i.status == PASSED for i in items)
    assert gen.kwargs[0] == ("create", "Amaç: uzay")


def test_create_goes_on_when_the_test_writer_fails(game):
    gen = FakeGenerator(create=Generated(CLEAN, ["oyun açılıyor"]), tests_error=True)
    out = flow(studio.create_game_flow, gen, game, "x", [])
    assert out.saved
    item = testlist.load(game)[0]
    assert item.status == UNVERIFIED and "yazılamadı" in item.note


def test_create_that_cannot_generate_raises_and_saves_nothing(game):
    class Broken(FakeGenerator):
        def create(self, *a, **k):
            raise GenerationError("boş cevap")

    with pytest.raises(GenerationError):
        flow(studio.create_game_flow, Broken(), game, "x", [])
    assert not game.html_path.exists()


def test_create_reports_generating_then_testing(game):
    seen = []
    flow(studio.create_game_flow, FakeGenerator(create=Generated(CLEAN, [])), game, "x", [], statuses=seen)
    assert [s for s, _ in seen][:2] == ["generating", "testing"]


# --- edit (Review Focus 2) -------------------------------------------------------------------

def make_game_with_v1(game):
    library.save_version(game, "<html>v1</html>")
    testlist.save(game, [TestItem("t1", "oyun açılıyor", "c", status=PASSED)])
    testlist.add_resolved(game, ["eski hata"])


def test_a_good_edit_replaces_the_game_archives_the_old_one_and_keeps_old_tests(game):
    make_game_with_v1(game)
    gen = FakeGenerator(edit=Generated(CLEAN, ["top hızlı"]))
    out = flow(studio.edit_game_flow, gen, game, "topu hızlandır", [], memory="Amaç: kare")
    assert out.saved and not out.rejected
    assert game.html_path.read_text(encoding="utf-8") == CLEAN
    assert (game.versions_dir / "oyun-001.html").read_text(encoding="utf-8") == "<html>v1</html>"
    assert [i.text for i in testlist.load(game)] == ["oyun açılıyor", "top hızlı"]
    call = gen.edit_calls[0]
    assert call["html"] == "<html>v1</html>" and call["request"] == "topu hızlandır"
    assert call["resolved"] == ["eski hata"] and call["memory"] == "Amaç: kare"


def test_a_broken_edit_is_rejected_and_the_working_game_is_untouched(game):
    make_game_with_v1(game)
    before = game.html_path.read_bytes()
    tests_before = game.tests_path.read_bytes()
    gen = FakeGenerator(edit=Generated("BUG1", []), fixes=["BUG1", "BUG1", "BUG1"])
    out = flow(studio.edit_game_flow, gen, game, "bozan istek", [])
    assert out.rejected and not out.saved
    assert game.html_path.read_bytes() == before
    assert library.versions(game) == []
    assert out.html == "<html>v1</html>"
    assert game.tests_path.read_bytes() == tests_before


# --- the game's own memory (the bellhop bear's memory) ----------------------------------------------------

from k_minigames import memory  # noqa: E402


class ChatStub:
    def __init__(self, *answers):
        self.answers, self.calls = list(answers), []

    def chat(self, model, messages, on_token=None, cancel=None):
        self.calls.append("\n".join(m["content"] for m in messages))
        return self.answers.pop(0)


def with_client(gen, client):
    gen.client = client
    return gen


def test_after_creating_a_game_its_memory_holds_the_models_summary(game):
    chat = ChatStub("Amaç: zıplayan kare\n- skor görünsün")
    gen = with_client(FakeGenerator(create=Generated(CLEAN, ["a"])), chat)
    flow(studio.create_game_flow, gen, game, "zıplayan kare yap", [])
    assert memory.load(memory.game_path(game)) == "Amaç: zıplayan kare\n- skor görünsün"
    assert "zıplayan kare yap" in chat.calls[0] and "Oyun kaydedildi" in chat.calls[0]


def test_the_next_edit_is_given_that_memory_even_after_a_restart(game):
    flow(studio.create_game_flow, with_client(FakeGenerator(create=Generated(CLEAN, ["a"])),
                                              ChatStub("Amaç: zıplayan kare")), game, "zıplayan kare yap", [])
    same_game = library.Game(game.name, game.folder)          # the app was closed and opened again
    second = with_client(FakeGenerator(edit=Generated(CLEAN, [])), ChatStub("Amaç: zıplayan kare\n- hızlı"))
    flow(studio.edit_game_flow, second, same_game, "topu hızlandır", [])
    assert second.edit_calls[0]["memory"] == "Amaç: zıplayan kare"
    assert memory.load(memory.game_path(game)) == "Amaç: zıplayan kare\n- hızlı"


def test_a_generation_error_is_still_written_down_and_still_raised(game):
    chat = ChatStub("Amaç: x\n- üretilemedi")

    class Broken(FakeGenerator):
        def create(self, *a, **k):
            raise GenerationError("boş cevap")

    gen = with_client(Broken(), chat)
    with pytest.raises(GenerationError):
        flow(studio.create_game_flow, gen, game, "uzay oyunu", [])
    assert "üretilemedi" in chat.calls[0] and "boş cevap" in chat.calls[0] and "uzay oyunu" in chat.calls[0]
    assert memory.load(memory.game_path(game)) == "Amaç: x\n- üretilemedi"


def test_a_rejected_edit_is_remembered_too(game):
    make_game_with_v1(game)
    chat = ChatStub("Amaç: kare\n- bozan istek denendi")
    gen = with_client(FakeGenerator(edit=Generated("BUG1", []), fixes=["BUG1", "BUG1", "BUG1"]), chat)
    out = flow(studio.edit_game_flow, gen, game, "bozan istek", [])
    assert out.rejected and "çalışmadı" in chat.calls[0]
    assert memory.load(memory.game_path(game)) == "Amaç: kare\n- bozan istek denendi"


def test_a_client_that_cannot_summarise_never_stops_the_flow_and_the_request_is_kept_as_a_line(game):
    out = flow(studio.create_game_flow, FakeGenerator(create=Generated(CLEAN, [])), game, "uzay oyunu", [])
    assert out.saved
    assert memory.load(memory.game_path(game)) == "- uzay oyunu"


def test_the_background_hook_receives_the_exchange_instead_of_updating_inline(game):
    seen = []
    gen = FakeGenerator(create=Generated(CLEAN, []))
    studio.create_game_flow(gen, game, "uzay oyunu", [], server=object(), open_url=lambda u: None,
                            on_status=lambda s, t: None, background=lambda *args: seen.append(args))
    assert memory.load(memory.game_path(game)) == ""            # nothing was written inline
    assert seen[0][0] is gen and seen[0][1] == game and seen[0][2] == "uzay oyunu" and "Oyun kaydedildi" in seen[0][3]
    assert seen[0][4] == ""


# --- review: a try whose page never reports back ------------------------------------------------------------

def test_an_edit_whose_page_never_reports_back_is_rejected_and_the_working_game_is_untouched(game):
    make_game_with_v1(game)
    before = game.html_path.read_bytes()
    out = flow(studio.edit_game_flow, FakeGenerator(edit=Generated("HANG", [])), game, "döngü ekle", [])
    assert out.rejected and not out.saved
    assert game.html_path.read_bytes() == before and library.versions(game) == []


def test_a_new_game_whose_page_never_reports_back_is_saved_but_the_report_says_it_did_not_finish(game):
    out = flow(studio.create_game_flow, FakeGenerator(create=Generated("HANG", [])), game, "x", [])
    assert out.saved and out.report.finished is False


def test_an_edit_whose_game_only_writes_to_the_console_is_accepted(game):
    make_game_with_v1(game)
    out = flow(studio.edit_game_flow, FakeGenerator(edit=Generated("<html>CONSOLE</html>", [])), game, "x", [])
    assert out.saved and not out.rejected


class LibGenerator(FakeGenerator):
    """Like the fake generator, but it takes the library modules and records them."""
    def create(self, description, textures, on_token=None, cancel=None, *, memory="", modules=()):
        self.kwargs.append(("create", memory, tuple(modules)))
        return self._create

    def fix(self, html, problems, on_token=None, cancel=None, *, memory="", modules=()):
        self.kwargs.append(("fix", tuple(modules)))
        return super().fix(html, problems, memory=memory)

    def edit(self, html, request, textures, checklist, resolved=(), on_token=None, cancel=None, *, memory="",
             modules=()):
        self.kwargs.append(("edit", tuple(modules)))
        return super().edit(html, request, textures, checklist, resolved, memory=memory)


def test_a_game_with_library_modules_gets_the_files_and_the_script_tags(game):
    library.set_modules(game, ["core", "ai"])
    page = "<!doctype html><html><head></head><body><script>const g = K.game();</script></html>"
    gen = LibGenerator(create=Generated(page, ["çalışır"]))
    outcome = flow(studio.create_game_flow, gen, game, "tarif", [], memory="")
    assert (game.folder / "kgame.js").is_file() and (game.folder / "kgame.ai.js").is_file()
    assert outcome.html.count('<script src="kgame.js"></script>') == 1
    assert outcome.html.index("kgame.js") < outcome.html.index("const g = K.game()")
    assert ("create", "", ("core", "ai")) in gen.kwargs
    assert game.html_path.read_text(encoding="utf-8") == outcome.html


def test_a_fix_gets_the_modules_too(game):
    library.set_modules(game, ["core"])
    page = "<html><head></head><body><script>BUG1</script></body></html>"
    gen = LibGenerator(create=Generated(page, []), fixes=["<html><head></head><body><script>ok</script></body></html>"])
    flow(studio.create_game_flow, gen, game, "tarif", [], memory="")
    assert ("fix", ("core",)) in gen.kwargs


def test_a_game_without_modules_goes_the_old_way_and_copies_nothing(game):
    gen = FakeGenerator(create=Generated(CLEAN, ["çalışır"]))
    outcome = flow(studio.create_game_flow, gen, game, "tarif", [], memory="")
    assert not (game.folder / "kgame.js").exists()
    assert "kgame" not in outcome.html
