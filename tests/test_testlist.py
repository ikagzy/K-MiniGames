import json

import pytest

from k_minigames import library, testlist
from k_minigames.testlist import FAILED, PASSED, PENDING, UNVERIFIED, TestItem


@pytest.fixture
def game(tmp_path):
    games = tmp_path / "Oyunlar"
    games.mkdir()
    return library.create_game(games, "Uzay")


def item(id, text="madde", code="return true;", status=PENDING, note=""):
    return TestItem(id, text, code, status, note)


def test_items_round_trip_through_testler_json_with_turkish_text(game):
    items = [item("t1", "oyun açılıyor", status=PASSED), item("t2", "çarpışınca can azalıyor", code=None, note="yazılamadı")]
    testlist.save(game, items)
    assert testlist.load(game) == items
    assert "çarpışınca" in game.tests_path.read_text(encoding="utf-8")


def test_loading_a_missing_or_broken_file_gives_an_empty_list(game):
    assert testlist.load(game) == []
    game.tests_path.write_text("{bozuk", encoding="utf-8")
    assert testlist.load(game) == []


def test_merge_keeps_old_items_and_their_status_and_does_not_repeat_a_text():
    old = [item("t1", "oyun açılıyor", status=PASSED)]
    merged = testlist.merge_checklist(old, ["oyun açılıyor", "skor artıyor", "can azalıyor"])
    assert [(i.id, i.text, i.status) for i in merged] == [
        ("t1", "oyun açılıyor", PASSED), ("t2", "skor artıyor", PENDING), ("t3", "can azalıyor", PENDING)]
    assert old == [item("t1", "oyun açılıyor", status=PASSED)]


def test_merge_numbers_continue_after_the_highest_existing_id():
    merged = testlist.merge_checklist([item("t7", "a")], ["b"])
    assert merged[-1].id == "t8"


def test_with_code_fills_only_the_matching_items_that_got_code():
    items = [item("t1", "a", code=None), item("t2", "b", code=None), item("t3", "c", code="eski")]
    out = testlist.with_code(items, ["a", "b", "c"], ["return 1;", None, "yeni"])
    assert [i.code for i in out] == ["return 1;", None, "yeni"]


def test_results_map_to_statuses():
    items = [item("t1"), item("t2"), item("t3"), item("t4"), item("t5", code=None)]
    events = [
        {"type": "test", "id": "t1", "passed": True, "vacuous": False, "error": ""},
        {"type": "test", "id": "t2", "passed": True, "vacuous": True, "error": ""},
        {"type": "test", "id": "t3", "passed": False, "vacuous": False, "error": ""},
        {"type": "test", "id": "t4", "passed": False, "vacuous": False, "error": "TypeError: x"},
        {"type": "error", "message": "ilgisiz"},
    ]
    out = {i.id: i for i in testlist.apply_results(items, events)}
    assert out["t1"].status == PASSED
    assert out["t2"].status == UNVERIFIED and "boş" in out["t2"].note
    assert out["t3"].status == FAILED
    assert out["t4"].status == FAILED and "TypeError: x" in out["t4"].note
    assert out["t5"].status == UNVERIFIED and "yazılamadı" in out["t5"].note


def test_an_item_without_a_result_keeps_its_status():
    out = testlist.apply_results([item("t1", status=PASSED)], [])
    assert out[0].status == PASSED


def test_summary_counts_each_status():
    items = [item("a", status=PASSED), item("b", status=PASSED), item("c", status=FAILED), item("d", status=UNVERIFIED)]
    assert testlist.summary(items) == {PASSED: 2, FAILED: 1, UNVERIFIED: 1, PENDING: 0}


def test_resolved_errors_are_kept_without_repeats_and_only_the_newest_twenty(game):
    assert testlist.load_resolved(game) == []
    testlist.add_resolved(game, ["resim yüklenemedi", "resim yüklenemedi", "x tanımsız"])
    assert testlist.load_resolved(game) == ["resim yüklenemedi", "x tanımsız"]
    testlist.add_resolved(game, [f"hata {i}" for i in range(25)])
    resolved = testlist.load_resolved(game)
    assert len(resolved) == 20 and resolved[-1] == "hata 24" and "resim yüklenemedi" not in resolved


def test_saving_the_items_does_not_erase_the_resolved_errors(game):
    testlist.add_resolved(game, ["eski hata"])
    testlist.save(game, [item("t1")])
    assert testlist.load_resolved(game) == ["eski hata"]
    testlist.add_resolved(game, ["yeni hata"])
    assert testlist.load(game) == [item("t1")]
    assert json.loads(game.tests_path.read_text(encoding="utf-8"))["resolved"] == ["eski hata", "yeni hata"]
