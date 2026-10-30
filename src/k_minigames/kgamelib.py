"""The game library: JavaScript files (assets/lib) that the model's game builds on, so it writes only the rules.

Each module is a file plus a short guide that is shown to the model. The files are copied into the game's folder (the
game opens them with relative paths, so the folder can be moved); the app adds the <script> tags itself."""
import re
import shutil
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from k_minigames.library import Game

LIB_DIR = Path(__file__).resolve().parent / "assets" / "lib"
LIB_VERSION = "1"


@dataclass(frozen=True)
class Module:
    name: str
    files: tuple[str, ...]
    guide: str
    needs: tuple[str, ...] = ()
    summary: str = ""      # one line for the advisor: what the module is for
    quiet: bool = False    # loaded only as a dependency: its guide is not shown unless the module was chosen itself


MODULES: dict[str, Module] = {
    "core": Module("core", ("kgame.js",), "core.guide.md", (), "her oyun (döngü, fizik, girdi, çarpışma, sahne, ses)"),
    "ai": Module("ai", ("kgame.ai.js",), "ai.guide.md", ("core",),
                 "düşman ve bot davranışı: kovalama, devriye, rakip, yol bulma"),
    "sports": Module("sports", ("kgame.sports.js",), "sports.guide.md", ("core", "ai"),
                     "voleybol, futbol, basketbol, pong"),
}
_ORDER = list(MODULES)   # dependency order: a module comes after what it needs
_TAG = re.compile(r"[ \t]*<script\b[^>]*\bsrc\s*=\s*[\"']?(?:\./)?kgame[\w.\-]*\.js[\"']?[^>]*>\s*</script>[ \t]*\r?\n?", re.I)
_FIRST_SCRIPT = re.compile(r"<script\b", re.I)
_COMMENT = re.compile(r"<!--.*?-->", re.S)


def normalize(names: Iterable[str] | None) -> list[str]:
    """The module names the library knows, with what they need, in dependency order; `core` is always there."""
    wanted: set[str] = {"core"}
    for name in names or []:
        key = name.strip().lower() if isinstance(name, str) else ""
        if key in MODULES:
            wanted.add(key)
    changed = True
    while changed:   # add what the chosen modules need
        changed = False
        for name in list(wanted):
            for need in MODULES[name].needs:
                if need not in wanted:
                    wanted.add(need)
                    changed = True
    return [name for name in _ORDER if name in wanted]


def all_files() -> set[str]:
    return {name for module in MODULES.values() for name in module.files}


def _files(modules: list[str]) -> list[str]:
    return [name for module in normalize(modules) for name in MODULES[module].files]


def install(game: Game, modules: list[str]) -> list[str]:
    """Copy the files of the modules into the game's folder (an older copy is replaced)."""
    names = _files(modules)
    for name in names:
        shutil.copyfile(LIB_DIR / name, game.folder / name)
    return names


def guides(modules: list[str]) -> str:
    """The guides the model is shown: of the chosen modules and of what they need, except quiet dependencies (parts
    a kit builds on, which the kit's own guide already covers)."""
    chosen = {m.strip().lower() for m in modules if isinstance(m, str)} | {"core"}
    shown = [m for m in normalize(modules) if not MODULES[m].quiet or m in chosen]
    return "\n\n".join((LIB_DIR / MODULES[m].guide).read_text(encoding="utf-8").strip() for m in shown)


def ensure_scripts(html: str, modules: list[str]) -> str:
    """The library's <script> tags exactly once, in order, before the game's own first script. Tags the model wrote
    itself (in any order, or twice) are replaced."""
    tags = "".join(f'<script src="{name}"></script>\n' for name in _files(modules))
    html = _TAG.sub("", html)
    comments = [m.span() for m in _COMMENT.finditer(html)]

    def outside(match) -> bool:   # a word inside an HTML comment is not a place to put the tags
        return not any(a <= match.start() < b for a, b in comments)

    first = next((m for m in _FIRST_SCRIPT.finditer(html) if outside(m)), None)
    if first:
        return html[:first.start()] + tags + html[first.start():]
    for pattern in (r"</head>", r"<body[^>]*>"):
        match = next((m for m in re.finditer(pattern, html, re.I) if outside(m)), None)
        if match:
            at = match.start() if pattern == "</head>" else match.end()
            return html[:at] + tags + html[at:]
    return tags + html
