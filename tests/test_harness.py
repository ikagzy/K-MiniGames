import json
import re

from k_minigames.harness import MARK, TestSpec, inject

URL = "http://127.0.0.1:5000/report/abc"
TESTS = [TestSpec("t1", "return game.score === 0;"), TestSpec("t2", "return true;")]
PAGE = "<!doctype html><html><head><title>x</title></head><body><script>window.__game = {score: 0};</script></body></html>"


def test_the_monitor_script_is_added_once_inside_the_head():
    out = inject(PAGE, URL, TESTS)
    assert out.count(MARK) == 1
    assert out.index(MARK) < out.index("<title>")
    assert URL in out


def test_injecting_twice_does_not_add_a_second_monitor():
    once = inject(PAGE, URL, TESTS)
    assert inject(once, URL, TESTS) == once


def test_a_page_without_a_head_still_gets_the_monitor():
    out = inject("<html><body>oyun</body></html>", URL, TESTS)
    assert out.count(MARK) == 1 and "oyun" in out
    bare = inject("<canvas></canvas>", URL, TESTS)
    assert bare.count(MARK) == 1 and "<canvas></canvas>" in bare


def test_test_code_with_a_closing_script_tag_cannot_break_out_of_the_script():
    tests = [TestSpec("t1", "return '</script><b>x</b>' !== '';")]
    out = inject(PAGE, URL, tests)
    assert out.count("</script>") == PAGE.count("</script>") + 1


def test_the_tests_are_embedded_as_data_with_their_ids_and_code():
    out = inject(PAGE, URL, TESTS)
    match = re.search(r"var TESTS = (\[.*?\]);\n", out, re.S)
    embedded = json.loads(match.group(1).replace("<\\/", "</"))
    assert embedded == [{"id": "t1", "code": "return game.score === 0;"}, {"id": "t2", "code": "return true;"}]


def test_the_monitor_reports_errors_runs_each_test_against_an_empty_state_first_and_says_done():
    out = inject(PAGE, URL, TESTS)
    for needle in ("addEventListener('error'", "unhandledrejection", "console.error", "asset_error",
                   "vacuous", "type: 'done'", "Oyun deneniyor, sekmeyi kapatma", "Test bitti, kapatabilirsin"):
        assert needle in out
