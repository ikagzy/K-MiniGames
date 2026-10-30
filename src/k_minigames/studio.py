"""The game-making pipeline: generate, try in the browser, fix what is broken, keep the best version.

`on_status(state, text)` tells the UI what is going on; state is "generating", "testing" or "fixing"."""
from collections.abc import Callable
from dataclasses import dataclass, replace

from k_minigames import checker, kgamelib, kits, library, testlist
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
    # a probe warning (the mouse did nothing) is shown to the user but is no reason to rewrite the game
    texts = [p.as_text() for p in report.problems if not (p.kind.startswith("probe_") and p.severity == "warning")]
    texts += list(report.js_errors)
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
                on_status: OnStatus, cancel: Callable[[], bool] | None = None, *, memory: str = "", modules=(),
                fixer: Callable[[str, list[str]], str] | None = None) -> tuple[str, CheckReport, int]:
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
            if fixer is not None:   # a spec game: the fix is a new spec, the page is made from it
                current = fixer(current, _fix_texts(report, previous))
            else:
                fixed = generator.fix(current, _fix_texts(report, previous), cancel=cancel, memory=memory,
                                      **({"modules": modules} if modules else {}))
                current = _with_scripts(fixed.html, modules)
        except GenerationError:
            break
        previous = report.items
    html_best, report_best, score_best = best
    if score_best > 0:
        items_final = [replace(i, status=UNVERIFIED, note="otomatik düzeltilemedi") if i.status == FAILED else i
                       for i in report_best.items]
        report_best = replace(report_best, items=items_final)
    return html_best, report_best, attempts


def _with_scripts(html: str, modules) -> str:
    """With library modules the app (not the model) puts the <script> tags in."""
    return kgamelib.ensure_scripts(html, list(modules)) if modules else html


def _with_new_tests(generator, html: str, items: list[TestItem], cancel, memory: str, modules=()) -> list[TestItem]:
    """Ask the model for test code for the items that have none; if it fails they stay without code."""
    texts = [i.text for i in items if i.code is None]
    if not texts:
        return items
    try:
        codes = generator.write_tests(html, texts, cancel=cancel, memory=memory,
                                      **({"modules": modules} if modules else {}))
    except GenerationError:
        return items
    return testlist.with_code(items, texts, codes)


def remember_exchange(generator, game: Game, user_text: str, note: str, previous: str) -> None:
    """Rewrite the game's memory (the bear's memory) after one request. It never raises: a summary that cannot be
    made falls back to a one-line note (see memory.update)."""
    # `previous` is what the flow read when it started; the update re-reads the file under a lock instead, so two
    # overlapping updates cannot drop each other's exchange
    memory_notes.remember(memory_notes.game_path(game), getattr(generator, "client", None),
                          getattr(generator, "model", ""), user_text, note)


def _outcome_note(outcome: Outcome) -> str:
    counts = testlist.summary(outcome.report.items)
    facts = (f"{counts[PASSED]} madde geçti, {counts[UNVERIFIED]} doğrulanamadı, {counts[FAILED]} kaldı; "
             f"{outcome.attempts} otomatik düzeltme.")
    return ("Düzenleme çalışmadı, oyunun önceki hâli korundu. " if outcome.rejected else "Oyun kaydedildi. ") + facts


def _kit_items(kit: str) -> list[TestItem]:
    """The kit's own checks as a test list: hand-written tests with the code attached."""
    pairs = kits.checks(kit)
    texts = [text for text, _ in pairs]
    return testlist.with_code(testlist.merge_checklist([], texts), texts, [code for _, code in pairs])


def _spec_flow(generator, game: Game, kit: str, modules, make_spec, items, server, open_url, on_status, cancel, memory):
    """Make or change a game from a spec: `make_spec()` asks the model for the first spec; a failed try asks for a new
    spec (never for new code). Returns the page, the report, the attempts and the spec that belongs to the page."""
    kgamelib.install(game, modules)
    on_status("generating", "Oyun üretiliyor…")
    spec = make_spec()
    by_page = {}
    page = kits.compile_page(spec)
    by_page[page] = spec

    def fixer(html: str, problems: list[str]) -> str:
        new = generator.fix_spec(by_page.get(html, spec), problems, kit, cancel=cancel, memory=memory)
        fixed_page = kits.compile_page(new)
        by_page[fixed_page] = new
        return fixed_page

    html, report, attempts = repair_loop(generator, game, page, items, server, open_url, on_status, cancel,
                                         memory=memory, modules=modules, fixer=fixer)
    return html, report, attempts, by_page.get(html, spec)


def create_game_flow(generator, game: Game, description: str, textures: list[Texture], server,
                     open_url: Callable[[str], object], on_status: OnStatus,
                     cancel: Callable[[], bool] | None = None, *, memory: str = "",
                     background: Callable | None = None) -> Outcome:
    """`memory` overrides the game's memory file (tests); `background(generator, game, text, note, previous)`, when
    given, does the memory update instead of the flow doing it inline (the screen runs it on its own thread)."""
    previous = memory_notes.load(memory_notes.game_path(game))
    memory = memory or previous
    notify = background or remember_exchange
    modules = library.modules(game)
    kit = kgamelib.kit_of(modules) if modules else None
    if kit:
        try:
            html, report, attempts, spec = _spec_flow(
                generator, game, kit, modules, lambda: generator.create_spec(description, kit, cancel=cancel, memory=memory),
                _kit_items(kit), server, open_url, on_status, cancel, memory)
        except GenerationError as exc:
            notify(generator, game, description, f"Oyun üretilemedi: {exc}", previous)
            raise
        testlist.save(game, report.items)
        library.save_version(game, html)
        library.set_spec(game, spec)
        outcome = Outcome(html, report, attempts, saved=True, rejected=False)
        notify(generator, game, description, _outcome_note(outcome), previous)
        return outcome
    if modules:
        kgamelib.install(game, modules)
    on_status("generating", "Oyun üretiliyor…")
    try:
        generated = generator.create(description, textures, cancel=cancel, memory=memory,
                                     **({"modules": modules} if modules else {}))
    except GenerationError as exc:
        notify(generator, game, description, f"Oyun üretilemedi: {exc}", previous)
        raise
    page = _with_scripts(generated.html, modules)
    items = testlist.merge_checklist([], generated.checklist)
    items = _with_new_tests(generator, page, items, cancel, memory, modules)
    html, report, attempts = repair_loop(generator, game, page, items, server, open_url, on_status,
                                         cancel, memory=memory, modules=modules)
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
    modules = library.modules(game)
    kit, saved_spec = (kgamelib.kit_of(modules) if modules else None), library.spec(game)
    if kit and saved_spec:
        try:
            html, report, attempts, spec = _spec_flow(
                generator, game, kit, modules, lambda: generator.edit_spec(saved_spec, request, kit, cancel=cancel, memory=memory),
                items or _kit_items(kit), server, open_url, on_status, cancel, memory)
        except GenerationError as exc:
            notify(generator, game, request, f"Düzenleme üretilemedi: {exc}", previous)
            raise
        if _hard_problems(report) or report.js_errors or not report.finished:
            outcome = Outcome(current, report, attempts, saved=False, rejected=True)
        else:
            testlist.save(game, report.items)
            library.save_version(game, html)
            library.set_spec(game, spec)
            outcome = Outcome(html, report, attempts, saved=True, rejected=False)
        notify(generator, game, request, _outcome_note(outcome), previous)
        return outcome
    if modules:
        kgamelib.install(game, modules)   # the newest copy of the library files
    on_status("generating", "Değişiklik yapılıyor…")
    try:
        generated = generator.edit(current, request, textures, [i.text for i in items], testlist.load_resolved(game),
                                   cancel=cancel, memory=memory, **({"modules": modules} if modules else {}))
    except GenerationError as exc:
        notify(generator, game, request, f"Düzenleme üretilemedi: {exc}", previous)
        raise
    page = _with_scripts(generated.html, modules)
    items = testlist.merge_checklist(items, generated.checklist)
    items = _with_new_tests(generator, page, items, cancel, memory, modules)
    html, report, attempts = repair_loop(generator, game, page, items, server, open_url, on_status,
                                         cancel, memory=memory, modules=modules)
    if _hard_problems(report) or report.js_errors or not report.finished:
        # an edit that could not be tried (page hung or never answered) is treated like a broken one
        outcome = Outcome(current, report, attempts, saved=False, rejected=True)
    else:
        testlist.save(game, report.items)
        library.save_version(game, html)
        outcome = Outcome(html, report, attempts, saved=True, rejected=False)
    notify(generator, game, request, _outcome_note(outcome), previous)
    return outcome
