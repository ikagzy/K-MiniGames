"""A game's test list and its memory of fixed errors, both kept in the game folder's testler.json.

The model writes the checklist and a small test for each item; the list is kept so every later edit runs the old
tests again and a regression is noticed."""
import json
import os
import re
from dataclasses import asdict, dataclass, replace

from k_minigames.library import Game

_TEST_CRASH = re.compile(r"^(?:TypeError|ReferenceError|SyntaxError|RangeError)")

PENDING, PASSED, FAILED, UNVERIFIED = "pending", "passed", "failed", "unverified"
RESOLVED_LIMIT = 20


@dataclass(frozen=True)
class TestItem:
    __test__ = False  # not a pytest test class

    id: str
    text: str
    code: str | None
    status: str = PENDING
    note: str = ""


def _read(game: Game) -> dict:
    try:
        data = json.loads(game.tests_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _write(game: Game, data: dict) -> None:
    game.tests_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = game.tests_path.with_name(game.tests_path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, game.tests_path)


def load(game: Game) -> list[TestItem]:
    items = []
    for raw in _read(game).get("items", []):
        if isinstance(raw, dict) and "id" in raw and "text" in raw:
            items.append(TestItem(str(raw["id"]), str(raw["text"]), raw.get("code"),
                                  str(raw.get("status", PENDING)), str(raw.get("note", ""))))
    return items


def save(game: Game, items: list[TestItem]) -> None:
    data = _read(game)
    data["items"] = [asdict(i) for i in items]
    _write(game, data)


def merge_checklist(items: list[TestItem], checklist: list[str]) -> list[TestItem]:
    """The old items, plus one new pending item for every checklist text not already there."""
    merged = list(items)
    known = {i.text for i in merged}
    numbers = [int(i.id[1:]) for i in merged if i.id[:1] == "t" and i.id[1:].isdigit()]
    next_number = max(numbers, default=0) + 1
    for text in checklist:
        if text not in known:
            merged.append(TestItem(f"t{next_number}", text, None))
            known.add(text)
            next_number += 1
    return merged


def with_code(items: list[TestItem], texts: list[str], codes: list[str | None]) -> list[TestItem]:
    """Attach the model's test code to the items whose text it was written for (None leaves the item alone)."""
    by_text = {text: code for text, code in zip(texts, codes) if code}
    return [replace(i, code=by_text[i.text]) if i.text in by_text else i for i in items]


def apply_results(items: list[TestItem], events: list[dict]) -> list[TestItem]:
    results = {e.get("id"): e for e in events if e.get("type") == "test"}
    out = []
    for item in items:
        result = results.get(item.id)
        if result is not None:
            if result.get("vacuous"):
                item = replace(item, status=UNVERIFIED, note="boş durumda da geçti (anlamsız test)")
            elif result.get("passed"):
                item = replace(item, status=PASSED, note="")
            else:
                error = str(result.get("error") or "")
                if _TEST_CRASH.match(error):   # the test's own code broke (a function it made up): that says nothing about the game
                    item = replace(item, status=UNVERIFIED, note=f"test kodu çalışmadı (oyunun hatası olmayabilir): {error[:120]}")
                else:
                    item = replace(item, status=FAILED, note=error or "test geçmedi")
        elif item.code is None:
            item = replace(item, status=UNVERIFIED, note="test yazılamadı")
        out.append(item)
    return out


def summary(items: list[TestItem]) -> dict[str, int]:
    counts = {PASSED: 0, FAILED: 0, UNVERIFIED: 0, PENDING: 0}
    for item in items:
        counts[item.status] = counts.get(item.status, 0) + 1
    return counts


def load_resolved(game: Game) -> list[str]:
    raw = _read(game).get("resolved", [])
    return [str(x) for x in raw] if isinstance(raw, list) else []


def add_resolved(game: Game, texts: list[str], limit: int = RESOLVED_LIMIT) -> None:
    """Remember errors that were fixed (no repeats, newest `limit` kept), so the model is told not to bring them back."""
    resolved = load_resolved(game)
    for text in texts:
        if text and text not in resolved:
            resolved.append(text)
    data = _read(game)
    data["resolved"] = resolved[-limit:]
    _write(game, data)
