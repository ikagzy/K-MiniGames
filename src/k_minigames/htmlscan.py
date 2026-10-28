"""Static checks of a generated game, before it is even opened in a browser."""
import re
import urllib.parse
from dataclasses import dataclass

_ASSET = re.compile(r"assets/([^\"'`<>?#\n]+)")
_URL = re.compile(r"https?://[^\s\"'`<>)]+")
_NAMESPACE_HOSTS = ("http://www.w3.org/", "https://www.w3.org/")


def _is_known(raw: str, have: set[str]) -> bool:
    """The text after "assets/" starts with the name of a file that exists (names may hold spaces or brackets)."""
    low, decoded = raw.casefold(), urllib.parse.unquote(raw).casefold()
    return any(low.startswith(name) or decoded.startswith(name) for name in have)


def _name_from(raw: str) -> str:
    """A missing file's name: up to the quote that ended the match, or up to an unmatched ")" (css url(...))."""
    depth = 0
    for i, char in enumerate(raw):
        if char == "(":
            depth += 1
        elif char == ")":
            if depth == 0:
                return raw[:i].strip()
            depth -= 1
    return raw.strip()


@dataclass(frozen=True)
class Problem:
    kind: str       # "missing_asset" | "external_url" | "no_game_state"
    detail: str
    severity: str   # "error" | "warning"
    hint: str = ""  # extra help for the model, e.g. which texture files do exist

    def as_text(self) -> str:
        """The problem as a sentence for the model."""
        if self.kind == "missing_asset":
            return f"assets/{self.detail} dosyası yok; yalnızca doku listesindeki dosyaları kullan. {self.hint}".strip()
        if self.kind == "external_url":
            return f"Dış ağ adresi kullanılmış: {self.detail}. Kaldır; oyun tamamen yerel çalışmalı."
        if self.kind == "no_game_state":
            return "window.__game nesnesi tanımlı değil; skor, konum gibi oyun durumunu window.__game içinde tut."
        return f"{self.kind}: {self.detail}"


def scan(html: str, asset_files: list[str]) -> list[Problem]:
    """Missing textures and no state object are errors; an external address is only a warning."""
    have = {name.casefold() for name in asset_files}
    problems: list[Problem] = []
    seen: set[str] = set()
    for match in _ASSET.finditer(html):
        raw = match.group(1)
        if _is_known(raw, have):
            continue
        name = urllib.parse.unquote(_name_from(raw))
        key = name.casefold()
        if key not in seen:
            seen.add(key)
            hint = "Var olan dokular: " + (", ".join(asset_files) if asset_files else "yok") + "."
            problems.append(Problem("missing_asset", name, "error", hint))
    urls: set[str] = set()
    for match in _URL.finditer(html):
        url = match.group(0)
        if url.startswith(_NAMESPACE_HOSTS) or url in urls:
            continue
        urls.add(url)
        problems.append(Problem("external_url", url, "warning"))
    if "window.__game" not in html:
        problems.append(Problem("no_game_state", "", "error"))
    return problems
