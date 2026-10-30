import pytest

from k_minigames import checker, library
from k_minigames.harness import MARK
from k_minigames.testlist import FAILED, PASSED, PENDING, UNVERIFIED, TestItem

PAGE = "<html><head></head><body><script>window.__game = {};</script></body></html>"


class FakeServer:
    """Stands in for ReportServer: replays canned events when the page is 'opened'."""
    def __init__(self, events=(), done=True):
        self.canned, self.done = list(events), done
        self.pages, self.cleared, self._events, self.timeouts = [], 0, [], []

    def clear_events(self):
        self.cleared += 1
        self._events = []

    def report_url(self):
        return "http://127.0.0.1:1/report/tok"

    def page_url(self):
        return "http://127.0.0.1:1/play/tok/oyun.html"

    def set_page(self, html):
        self.pages.append(html)

    def open(self):
        self._events = list(self.canned) + ([{"type": "done"}] if self.done else [])

    def events(self):
        return list(self._events)

    def wait_for(self, kind, timeout_s):
        self.timeouts.append(timeout_s)
        return next((e for e in self._events if e.get("type") == kind), None)


@pytest.fixture
def game(tmp_path):
    games = tmp_path / "Oyunlar"
    games.mkdir()
    return library.create_game(games, "Uzay")


def run(game, html, items, server, timeout_s=1):
    opened = []

    def open_url(url):
        opened.append(url)
        server.open()

    report = checker.run_once(game, html, items, server, open_url=open_url, timeout_s=timeout_s)
    return report, opened


def test_the_page_is_instrumented_with_the_tests_and_opened_through_the_server(game):
    server = FakeServer()
    items = [TestItem("t1", "açılıyor", "return true;"), TestItem("t2", "kodsuz", None)]
    report, opened = run(game, PAGE, items, server)
    assert opened == ["http://127.0.0.1:1/play/tok/oyun.html"]
    assert MARK in server.pages[0] and "return true;" in server.pages[0] and "kodsuz" not in server.pages[0]
    assert server.cleared == 1 and report.finished is True


def test_static_problems_are_collected_and_existing_textures_are_known(game, tmp_path):
    (game.assets_dir).mkdir()
    (game.assets_dir / "zemin.png").write_bytes(b"x")
    html = PAGE.replace("</body>", '<img src="assets/zemin.png"><img src="assets/yok.png"></body>')
    report, _ = run(game, html, [], FakeServer())
    assert [(p.kind, p.detail) for p in report.problems] == [("missing_asset", "yok.png")]


def test_browser_errors_become_readable_messages_without_repeats(game):
    events = [
        {"type": "error", "message": "Uncaught ReferenceError: x is not defined", "line": 12},
        {"type": "error", "message": "Uncaught ReferenceError: x is not defined", "line": 12},
        {"type": "asset_error", "url": "http://127.0.0.1:1/play/tok/assets/a.png"},
        {"type": "console_error", "message": "oyun bozuk"},
    ]
    report, _ = run(game, PAGE, [], FakeServer(events))
    assert report.js_errors == [
        "JavaScript hatası: Uncaught ReferenceError: x is not defined (satır 12)",
        "Dosya yüklenemedi: assets/a.png",
    ]
    assert report.console_errors == ["Konsol hatası: oyun bozuk"]     # reported, but it does not make the game "broken"


def test_test_results_set_the_item_statuses(game):
    items = [TestItem("t1", "a", "c"), TestItem("t2", "b", "c"), TestItem("t3", "c", "c"), TestItem("t4", "d", None)]
    events = [
        {"type": "test", "id": "t1", "passed": True, "vacuous": False, "error": ""},
        {"type": "test", "id": "t2", "passed": False, "vacuous": False, "error": ""},
        {"type": "test", "id": "t3", "passed": True, "vacuous": True, "error": ""},
    ]
    report, _ = run(game, PAGE, items, FakeServer(events))
    assert [i.status for i in report.items] == [PASSED, FAILED, UNVERIFIED, UNVERIFIED]


def test_a_timeout_leaves_the_untested_items_unverified_and_the_run_unfinished(game):
    items = [TestItem("t1", "a", "c", status=PENDING), TestItem("t2", "b", "c", status=PASSED)]
    events = [{"type": "test", "id": "t1", "passed": True, "vacuous": False, "error": ""}]
    report, _ = run(game, PAGE, items, FakeServer(events, done=False))
    assert report.finished is False
    assert report.items[0].status == PASSED
    assert report.items[1].status == UNVERIFIED and "zaman aşımı" in report.items[1].note


# --- review: more tests need more time ---------------------------------------------------------------------------

def test_the_time_allowed_grows_with_the_number_of_tests(game):
    server = FakeServer()
    items = [TestItem(f"t{i}", "a", "return true;") for i in range(3)] + [TestItem("t9", "kodsuz", None)]
    run(game, PAGE, items, server, timeout_s=20)
    assert server.timeouts == [20 + checker.PROBE_SECONDS + 4 * 3]


# --- probes: checks that need no test written by the model ---------------------------------------------------------

def test_probe_findings_become_problems_and_the_blank_screen_is_an_error(game):
    server = FakeServer([{"type": "probe", "name": "blank"}, {"type": "probe", "name": "keys"},
                         {"type": "probe", "name": "state", "paths": ["game.ball.x"]}])
    report, _ = run(game, PAGE, [], server)
    kinds = {p.kind: p.severity for p in report.problems}
    assert kinds["probe_blank"] == "error" and kinds["probe_state"] == "error" and kinds["probe_keys"] == "warning"
    assert "game.ball.x" in next(p for p in report.problems if p.kind == "probe_state").as_text()
    assert report.js_errors == []   # probes are not browser errors


def test_a_passed_item_about_the_keys_is_not_trusted_when_no_key_did_anything(game):
    server = FakeServer([{"type": "probe", "name": "keys"}, {"type": "test", "id": "t1", "passed": True},
                         {"type": "test", "id": "t2", "passed": True}])
    items = [TestItem("t1", "Oyuncu WASD ile hareket eder", "return true;"),
             TestItem("t2", "Skor gösterilir", "return true;")]
    report, _ = run(game, PAGE, items, server)
    assert report.items[0].status == UNVERIFIED and "tuş" in report.items[0].note
    assert report.items[1].status == PASSED   # about something else: left alone


def test_a_mouse_item_is_not_trusted_when_the_mouse_did_nothing(game):
    server = FakeServer([{"type": "probe", "name": "mouse"}, {"type": "test", "id": "t1", "passed": True}])
    report, _ = run(game, PAGE, [TestItem("t1", "Mouse tıklamasıyla topa vurur", "return true;")], server)
    assert report.items[0].status == UNVERIFIED and "tıklama" in report.items[0].note


def test_an_error_shows_the_line_of_the_games_own_source_even_though_the_monitor_moved_the_lines(game):
    page = "<html><head></head><body><script>\nvar a = 1;\nbroken(game);\n</script></body></html>"
    server = FakeServer()
    # the monitor script is put right after <head>, so the browser's line numbers are bigger by its length
    shift = checker.harness.inject(page, server.report_url(), []).count("\n") - page.count("\n")
    server.canned = [{"type": "error", "message": "Uncaught ReferenceError: game is not defined", "line": 3 + shift}]
    report, _ = run(game, page, [], server)
    assert report.js_errors == ["JavaScript hatası: Uncaught ReferenceError: game is not defined (satır 3: broken(game);)"]
