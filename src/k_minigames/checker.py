"""Tries a game once: static scan, then the real browser with the monitor script and the tests."""
import re
import webbrowser
from collections.abc import Callable
from dataclasses import dataclass, replace

from k_minigames import harness, htmlscan, testlist
from k_minigames.htmlscan import Problem
from k_minigames.library import Game
from k_minigames.testlist import TestItem

PER_TEST_SECONDS = 4
_ASSET_URL = re.compile(r"/assets/(.*)$")


@dataclass
class CheckReport:
    problems: list[Problem]    # found by reading the HTML
    items: list[TestItem]      # the test list with fresh statuses
    js_errors: list[str]       # what the browser reported while the game ran
    finished: bool             # False when the page never said `done` (timeout)


def _describe(event: dict) -> str | None:
    kind = event.get("type")
    if kind == "error":
        line = f" (satır {event['line']})" if event.get("line") else ""
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
    server.set_page(harness.inject(html, server.report_url(), specs))
    open_url(server.page_url())
    done = server.wait_for("done", timeout_s + PER_TEST_SECONDS * len(specs))   # every test runs twice, up to 8 s
    events = server.events()
    js_errors: list[str] = []
    for event in events:
        text = _describe(event)
        if text and text not in js_errors:
            js_errors.append(text)
    answered = {e.get("id") for e in events if e.get("type") == "test"}
    updated = []
    for item in testlist.apply_results(items, events):
        if item.code is not None and item.id not in answered:
            item = replace(item, status=testlist.UNVERIFIED,
                           note="zaman aşımı" if done is None else "sonuç gelmedi")
        updated.append(item)
    return CheckReport(problems, updated, js_errors, done is not None)
