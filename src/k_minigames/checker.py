"""Tries a game once: static scan, then the real browser with the monitor script and the tests."""
import re
import webbrowser
from collections.abc import Callable
from dataclasses import dataclass, field, replace

from k_minigames import harness, htmlscan, testlist
from k_minigames.htmlscan import Problem
from k_minigames.library import Game
from k_minigames.testlist import TestItem

PER_TEST_SECONDS = 4
PROBE_SECONDS = 8   # the probes press every key and click a few times
_KEY_WORDS = re.compile(r"tuş|klavye|wasd|\boklar?\b|zıpl|boşluk|hareket", re.I)
_MOUSE_WORDS = re.compile(r"tıkl|fare|mouse|\bvur", re.I)
_ASSET_URL = re.compile(r"/assets/(.*)$")


@dataclass
class CheckReport:
    problems: list[Problem]    # found by reading the HTML
    items: list[TestItem]      # the test list with fresh statuses
    js_errors: list[str]       # what the browser reported while the game ran
    finished: bool             # False when the page never said `done` (timeout)
    console_errors: list[str] = field(default_factory=list)   # console.error messages: a warning only


def _source_line(html_lines: list[str], line: int, injected_at: int, shift: int) -> str:
    """The line of the game's own source an error points at. The browser counts the lines of the page with the monitor
    script in it, so the lines after the script are moved back by the script's length."""
    if line > injected_at + shift:
        line -= shift
    elif line > injected_at:
        return ""   # inside the monitor script itself
    return html_lines[line - 1].strip()[:100] if 0 < line <= len(html_lines) else ""


def _probe_problem(event: dict) -> Problem | None:
    """A finding of the probes in the page (harness.runProbes) as a problem the model can be asked to fix."""
    name, paths = event.get("name"), ", ".join(str(p) for p in event.get("paths") or [])
    if name == "blank":
        return Problem("probe_blank", "Ekran boş görünüyor: canvas'a hiçbir şey çizilmemiş (tek renk). "
                       "Oyunun ilk karede sahneyi çizdiğinden emin ol.", "error")
    if name == "state":
        return Problem("probe_state", f"Oyun durumu bozuk: {paths} sayı değil (NaN ya da sonsuz). Bölme ve "
                       "tanımsız değerleri kontrol et.", "error")
    if name == "keys":
        return Problem("probe_keys", "Klavye dinleniyor ama W A S D, ok tuşları ve boşluk hiçbir şeyi değiştirmedi.",
                       "warning")
    if name == "mouse":
        return Problem("probe_mouse", "Fare dinleniyor ama tıklama ve fare hareketi hiçbir şeyi değiştirmedi.",
                       "warning")
    if name == "growth":
        return Problem("probe_growth", f"Şu listeler durmadan büyüyor: {paths}. Eski nesneleri sil.", "warning")
    return None


def _describe(event: dict, html_lines: list[str] = (), injected_at: int = 0, shift: int = 0) -> str | None:
    kind = event.get("type")
    if kind == "error":
        line = f" (satır {event['line']})" if event.get("line") else ""
        code = _source_line(list(html_lines), event["line"], injected_at, shift) if event.get("line") else ""
        if code:
            line = f" (satır {event['line'] - shift if event['line'] > injected_at + shift else event['line']}: {code})"
        return f"JavaScript hatası: {event.get('message', '')}{line}"
    if kind == "asset_error":
        url = str(event.get("url", ""))
        match = _ASSET_URL.search(url)
        return f"Dosya yüklenemedi: assets/{match.group(1)}" if match else f"Dosya yüklenemedi: {url}"
    if kind == "console_error":
        return f"Konsol hatası: {event.get('message', '')}"
    return None


def run_once(game: Game, html: str, items: list[TestItem], server, open_url: Callable[[str], object] = webbrowser.open,
             timeout_s: float = 20) -> CheckReport:
    assets = sorted(p.name for p in game.assets_dir.iterdir()) if game.assets_dir.is_dir() else []
    problems = htmlscan.scan(html, assets)
    specs = [harness.TestSpec(i.id, i.code) for i in items if i.code]
    server.clear_events()
    page = harness.inject(html, server.report_url(), specs)
    server.set_page(page)
    html_lines = html.splitlines()
    shift = page.count("\n") - html.count("\n")
    injected_at = page.count("\n", 0, max(page.find(harness.MARK), 0)) + 1
    open_url(server.page_url())
    done = server.wait_for("done", timeout_s + PROBE_SECONDS + PER_TEST_SECONDS * len(specs))   # every test runs twice
    events = server.events()
    js_errors: list[str] = []
    console_errors: list[str] = []
    for event in events:
        if event.get("type") == "probe":
            found = _probe_problem(event)
            if found is not None and found not in problems:
                problems.append(found)
            continue
        text = _describe(event, html_lines, injected_at, shift)
        bucket = console_errors if event.get("type") == "console_error" else js_errors
        if text and text not in bucket:
            bucket.append(text)
    answered = {e.get("id") for e in events if e.get("type") == "test"}
    updated = []
    for item in testlist.apply_results(items, events):
        if item.code is not None and item.id not in answered:
            item = replace(item, status=testlist.UNVERIFIED,
                           note="zaman aşımı" if done is None else "sonuç gelmedi")
        updated.append(_cross_checked(item, problems))
    return CheckReport(problems, updated, js_errors, done is not None, console_errors)


def _cross_checked(item: TestItem, problems: list[Problem]) -> TestItem:
    """A test that passed but whose subject the probes found dead (the keys, the mouse) cannot be trusted."""
    if item.status != testlist.PASSED:
        return item
    kinds = {p.kind for p in problems}
    if "probe_keys" in kinds and _KEY_WORDS.search(item.text):
        return replace(item, status=testlist.UNVERIFIED, note="yoklama: hiçbir tuş oyunu değiştirmedi")
    if "probe_mouse" in kinds and _MOUSE_WORDS.search(item.text):
        return replace(item, status=testlist.UNVERIFIED, note="yoklama: tıklama oyunu değiştirmedi")
    return item
