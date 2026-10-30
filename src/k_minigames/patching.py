"""Edits as find/replace blocks: the model gives only what changes, the app applies it to the game's text.

A game that works is never rewritten by the model in this mode, so what the edit does not mention cannot be broken."""
from dataclasses import dataclass

_START, _MIDDLE, _END = "<<<<<<< BUL", "=======", ">>>>>>> DEĞİŞTİR"


@dataclass(frozen=True)
class Patch:
    find: str
    replace: str


def parse_patches(text: str) -> list[Patch]:
    """The complete blocks in the answer; text around them is ignored. A block that is cut off (the answer ends or a
    new block starts before it ended) makes the whole answer untrusted: no patches, so the edit is not half applied."""
    patches: list[Patch] = []
    find: list[str] | None = None
    replace: list[str] | None = None
    for line in (text or "").splitlines():
        mark = line.strip()
        if mark == _START:
            if find is not None:
                return []
            find, replace = [], None
        elif mark == _MIDDLE and find is not None and replace is None:
            replace = []
        elif mark == _END and find is not None and replace is not None:
            patches.append(Patch("\n".join(find), "\n".join(replace)))
            find = replace = None
        elif replace is not None:
            replace.append(line)
        elif find is not None:
            find.append(line)
    return [] if find is not None else patches


def apply_patches(html: str, patches: list[Patch]) -> str | None:
    """The game with every patch applied in order, or None when there is nothing to apply or a `find` text is not in
    the game exactly once (all or nothing: a half-applied edit is worse than none)."""
    if not patches:
        return None
    for patch in patches:
        if not patch.find or html.count(patch.find) != 1:
            return None
        html = html.replace(patch.find, patch.replace, 1)
    return html
