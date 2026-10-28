from k_minigames.checker import CheckReport
from k_minigames.htmlscan import Problem
from k_minigames.testlist import FAILED, PASSED, UNVERIFIED, TestItem
from k_minigames.ui.studio_screen import summary_lines


def report(passed=0, unverified=0, failed=0, problems=()):
    items = ([TestItem(f"p{i}", "a", "c", PASSED) for i in range(passed)]
             + [TestItem(f"u{i}", "b", "c", UNVERIFIED) for i in range(unverified)]
             + [TestItem(f"f{i}", "c", "c", FAILED) for i in range(failed)])
    return CheckReport(list(problems), items, [], True)


def test_everything_passed():
    assert summary_lines(report(passed=3), 0, False) == ["3 madde geçti"]


def test_a_mixed_result_with_automatic_fixes_lists_each_count():
    assert summary_lines(report(passed=4, unverified=1), 2, False) == [
        "4 madde geçti", "1 madde doğrulanamadı", "2 kez otomatik düzelttim"]


def test_failed_items_are_listed_only_when_there_are_some():
    assert "2 madde kaldı" in summary_lines(report(passed=1, failed=2), 0, False)
    assert not any("kaldı" in line for line in summary_lines(report(passed=1), 0, False))


def test_a_rejected_edit_says_the_earlier_version_was_kept():
    assert summary_lines(report(), 3, True) == [
        "3 kez otomatik düzelttim", "Bu düzenleme çalışmadı; oyunun önceki hâli korundu."]


def test_an_external_address_is_a_visible_warning():
    problem = Problem("external_url", "https://cdn.example.com/x.js", "warning")
    assert summary_lines(report(passed=1, problems=[problem]), 0, False) == [
        "1 madde geçti", "Dikkat: oyun bir dış ağ adresi kullanıyor (https://cdn.example.com/x.js)"]


def test_a_game_without_any_test_gives_no_lines():
    assert summary_lines(report(), 0, False) == []
