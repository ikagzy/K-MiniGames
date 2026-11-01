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


def _quiet(name: str, needs: tuple[str, ...], summary: str) -> None:
    """A building block of the kits: it loads with them, but its guide is only shown when it is chosen on its own."""
    MODULES[name] = Module(name, (f"kgame.{name}.js",), f"{name}.guide.md", needs, summary, quiet=True)


_quiet("sprites", ("core",), "kodla çizilen piksel sanat karakter, düşman, eşya, karo")
_quiet("animation", ("core", "sprites"), "kare animasyonu ve durum makinesi")
_quiet("themes", ("core",), "hazır dünyalar: gökyüzü, mağara, kale, gece, su altı, uzay, orman")
_quiet("levels", ("core",), "ASCII seviye yazımı, bitirilebilirlik doğrulaması, çoklu seviye")
_quiet("hud", ("core",), "skor, can, süre arayüzü, başlık ve oyun bitti ekranları")
_quiet("audio2", ("core",), "chiptune müzik ve oyun sesleri")
_quiet("items", ("core", "sprites", "animation"), "altın, soru bloğu, tuğla, mantar, yıldız")
_quiet("enemies", ("core", "sprites", "animation"), "yürüyen, uçan, borudan çıkan düşman; ezme")
_quiet("kits", ("core",), "oyun kiti kayıt sistemi (oyunu özet olarak yazma)")
MODULES["platformer"] = Module(
    "platformer", ("kgame.platformer.js",), "platformer.guide.md",
    ("core", "sprites", "animation", "themes", "levels", "hud", "audio2", "items", "enemies", "kits"),
    "platform oyunu KİTİ (klasik platform türü): seviye, zıplama, düşman ezme, altın, bayrak, kamera, ses hazır; model yalnızca özet yazar")
MODULES["shooter"] = Module(
    "shooter", ("kgame.shooter.js",), "shooter.guide.md", ("core", "sprites", "hud", "audio2", "kits"),
    "nişancı oyunu KİTİ (dikey kayan uzay nişancısı): gemi, düşman dalgaları, patron, güçlendirme, ses hazır; model yalnızca özet yazar")
MODULES["sandbox"] = Module(
    "sandbox", ("kgame.voxeldata.js", "kgame.voxelmobs.js", "kgame.voxel.js"), "sandbox.guide.md", ("core", "audio2", "kits"),
    "küp dünya kiti (madencilik ve inşaat, eski Minecraft tadında küçük blok dünyası): arazi, mağara, maden, ağaç, kırma ve koyma hazır; model yalnızca özet yazar")
MODULES["fps"] = Module(
    "fps", ("kgame.fps.js",), "fps.guide.md", ("core", "hud", "audio2", "kits"),
    "birinci şahıs nişancı (FPS) KİTİ: odalar ve koridorlar, düşmanlar, silahlar, mermi, anahtar ve kilitli kapı, patron, arena kipi hazır; model yalnızca özet yazar")
MODULES["race"] = Module(
    "race", ("kgame.race.js",), "race.guide.md", ("core", "audio2", "kits"),
    "araba yarışı KİTİ (yukarıdan görünümlü 2 boyutlu piksel yarış): tohumdan pist, rakipler, turlar, sıralama, nitro hazır; model yalnızca özet yazar")
MODULES["football"] = Module(
    "football", ("kgame.football.js",), "football.guide.md", ("core", "audio2", "kits"),
    "futbol KİTİ (yukarıdan görünümlü 2 boyutlu piksel maç): iki takım, kaleci, yapay zekâ, pas, şut, gol, altın gol hazır; model yalnızca özet yazar")
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


def kit_of(modules) -> str | None:
    """The game kit among the modules (a module with a `<name>.schema.json`), or None for an ordinary game."""
    for name in normalize(modules):
        if (LIB_DIR / f"{name}.schema.json").is_file():
            return name
    return None


def all_files() -> set[str]:
    return {name for module in MODULES.values() for name in module.files}


def _files(modules: list[str]) -> list[str]:
    return [name for module in normalize(modules) for name in MODULES[module].files]


def install_files(modules: list[str]) -> list[str]:
    """The library files these modules (and what they need) load, in loading order."""
    return _files(modules)


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
