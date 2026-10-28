"""The game-making pipeline: generate, try in the browser, fix what is broken, keep the best version.

`on_status(state, text)` tells the UI what is going on; state is "generating", "testing" or "fixing"."""
from collections.abc import Callable
from dataclasses import dataclass, replace

from k_minigames import checker, library, testlist
from k_minigames import memory as memory_notes
from k_minigames.checker import CheckReport
from k_minigames.generator import GenerationError
from k_minigames.library import Game, Texture
from k_minigames.testlist import FAILED, PASSED, UNVERIFIED, TestItem

MAX_ATTEMPTS = 3
OnStatus = Callable[[str, str], None]


@dataclass(frozen=True)
class Outcome:
    html: str
    report: CheckReport
    attempts: int     # how many times the model was asked to fix the game
    saved: bool
    rejected: bool    # an edit that did not work: the earlier game was kept


def _hard_problems(report: CheckReport):
    return [p for p in report.problems if p.severity == "error"]


def _score(report: CheckReport) -> int:
    """Errors the user would see: warnings do not count."""
    return len(_hard_problems(report)) + len(report.js_errors) + sum(1 for i in report.items if i.status == FAILED)


def _technical(report: CheckReport) -> list[str]:
    return [p.as_text() for p in _hard_problems(report)] + list(report.js_errors)


def _fix_texts(report: CheckReport, previous: list[TestItem]) -> list[str]:
    texts = [p.as_text() for p in report.problems] + list(report.js_errors)
    before = {i.id: i for i in previous}
    for item in report.items:
        if item.status != FAILED:
            continue
        if before.get(item.id) is not None and before[item.id].status == PASSED:
            texts.append(f"Daha önce geçen madde bozuldu: {item.text}")
        else:
            texts.append(f"Test geçmedi: {item.text}" + (f" ({item.note})" if item.note else ""))
    return texts


def repair_loop(generator, game: Game, html: str, items: list[TestItem], server, open_url: Callable[[str], object],
                on_status: OnStatus, cancel: Callable[[], bool] | None = None, *, memory: str = "",
                ) -> tuple[str, CheckReport, int]:
    """Try the game; while something is broken ask the model to fix it (at most MAX_ATTEMPTS times).
    Returns the version with the fewest problems, not necessarily the last one."""
    current, previous = html, items
    best: tuple[str, CheckReport, int] | None = None
    attempts, sent = 0, []
    while True:
        on_status("testing", "Oyun deneniyor, sekmeyi kapatma")
        report = checker.run_once(game, current, previous, server, open_url)
        now = _technical(report)
        solved = [t for t in sent if t not in now]
        if solved:
            testlist.add_resolved(game, solved)
        score = _score(report)
        if best is None or score < best[2]:
            best = (current, report, score)
        if score == 0 or attempts >= MAX_ATTEMPTS or (cancel and cancel()):
            break
        attempts += 1
        on_status("fixing", f"Hata buldum, düzeltiyorum ({attempts}/{MAX_ATTEMPTS})")
        sent = now
        try:
            fixed = generator.fix(current, _fix_texts(report, previous), cancel=cancel, memory=memory)
        except GenerationError:
            break
        current, previous = fixed.html, report.items
    html_best, report_best, score_best = best
    if score_best > 0:
        items_final = [replace(i, status=UNVERIFIED, note="otomatik düzeltilemedi") if i.status == FAILED else i
                       for i in report_best.items]
        report_best = replace(report_best, items=items_final)
    return html_best, report_best, attempts


def _with_new_tests(generator, html: str, items: list[TestItem], cancel, memory: str) -> list[TestItem]:
    """Ask the model for test code for the items that have none; if it fails they stay without code."""
    texts = [i.text for i in items if i.code is None]
    if not texts:
        return items
    try:
        codes = generator.write_tests(html, texts, cancel=cancel, memory=memory)
    except GenerationError:
        return items
    return testlist.with_code(items, texts, codes)


def remember_exchange(generator, game: Game, user_text: str, note: str, previous: str) -> None:
    """Rewrite the game's memory (the bear's memory) after one request. It never raises: a summary that cannot be
    made falls back to a one-line note (see memory.update)."""
    updated = memory_notes.update(getattr(generator, "client", None), getattr(generator, "model", ""),
                                  previous, user_text, note)
    memory_notes.save(memory_notes.game_path(game), updated)


def _outcome_note(outcome: Outcome) -> str:
    counts = testlist.summary(outcome.report.items)
    facts = (f"{counts[PASSED]} madde geçti, {counts[UNVERIFIED]} doğrulanamadı, {counts[FAILED]} kaldı; "
             f"{outcome.attempts} otomatik düzeltme.")
    return ("Düzenleme çalışmadı, oyunun önceki hâli korundu. " if outcome.rejected else "Oyun kaydedildi. ") + facts


def create_game_flow(generator, game: Game, description: str, textures: list[Texture], server,
                     open_url: Callable[[str], object], on_status: OnStatus,
                     cancel: Callable[[], bool] | None = None, *, memory: str = "",
                     background: Callable | None = None) -> Outcome:
    """`memory` overrides the game's memory file (tests); `background(generator, game, text, note, previous)`, when
    given, does the memory update instead of the flow doing it inline (the screen runs it on its own thread)."""
    previous = memory_notes.load(memory_notes.game_path(game))
    memory = memory or previous
    notify = background or remember_exchange
    on_status("generating", "Oyun üretiliyor…")
    try:
        generated = generator.create(description, textures, cancel=cancel, memory=memory)
    except GenerationError as exc:
        notify(generator, game, description, f"Oyun üretilemedi: {exc}", previous)
        raise
    items = testlist.merge_checklist([], generated.checklist)
    items = _with_new_tests(generator, generated.html, items, cancel, memory)
    html, report, attempts = repair_loop(generator, game, generated.html, items, server, open_url, on_status,
                                         cancel, memory=memory)
    testlist.save(game, report.items)
    library.save_version(game, html)
    outcome = Outcome(html, report, attempts, saved=True, rejected=False)
    notify(generator, game, description, _outcome_note(outcome), previous)
    return outcome


def edit_game_flow(generator, game: Game, request: str, textures: list[Texture], server,
                   open_url: Callable[[str], object], on_status: OnStatus,
                   cancel: Callable[[], bool] | None = None, *, memory: str = "",
                   background: Callable | None = None) -> Outcome:
    """Change an existing game. The new version replaces the old one only if it runs without errors;
    otherwise the working game is left exactly as it was."""
    previous = memory_notes.load(memory_notes.game_path(game))
    memory = memory or previous
    notify = background or remember_exchange
    current = game.html_path.read_text(encoding="utf-8")
    items = testlist.load(game)
    on_status("generating", "Değişiklik yapılıyor…")
    try:
        generated = generator.edit(current, request, textures, [i.text for i in items], testlist.load_resolved(game),
                                   cancel=cancel, memory=memory)
    except GenerationError as exc:
        notify(generator, game, request, f"Düzenleme üretilemedi: {exc}", previous)
        raise
    items = testlist.merge_checklist(items, generated.checklist)
    items = _with_new_tests(generator, generated.html, items, cancel, memory)
    html, report, attempts = repair_loop(generator, game, generated.html, items, server, open_url, on_status,
                                         cancel, memory=memory)
    if _hard_problems(report) or report.js_errors:
        outcome = Outcome(current, report, attempts, saved=False, rejected=True)
    else:
        testlist.save(game, report.items)
        library.save_version(game, html)
        outcome = Outcome(html, report, attempts, saved=True, rejected=False)
    notify(generator, game, request, _outcome_note(outcome), previous)
    return outcome
