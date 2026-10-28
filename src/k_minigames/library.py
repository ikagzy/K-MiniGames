"""The games folder: one folder per game, with the game, its versions, its textures and its launcher.

    <games>/<name>/oyun.html  baslat.bat  assets/  surumler/oyun-001.html  game.json  testler.json  hafiza.md

Every write goes through a temporary file and `os.replace`, so a crash never leaves a half written game."""
import json
import os
import re
import shutil
import struct
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
LAUNCHER = b'@echo off\r\nstart "" "%~dp0oyun.html"\r\n'
MAX_NAME = 60
_BAD_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
_VERSION = re.compile(r"oyun-(\d+)\.html$")
_PNG = b"\x89PNG\r\n\x1a\n"


@dataclass(frozen=True)
class Game:
    name: str
    folder: Path

    @property
    def html_path(self) -> Path:
        return self.folder / "oyun.html"

    @property
    def launcher_path(self) -> Path:
        return self.folder / "baslat.bat"

    @property
    def assets_dir(self) -> Path:
        return self.folder / "assets"

    @property
    def versions_dir(self) -> Path:
        return self.folder / "surumler"

    @property
    def tests_path(self) -> Path:
        return self.folder / "testler.json"


@dataclass(frozen=True)
class Texture:
    file: str
    description: str
    width: int
    height: int

    @property
    def url(self) -> str:
        return "assets/" + urllib.parse.quote(self.file)


def _write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def safe_folder_name(name: str) -> str:
    """A folder name Windows accepts: no forbidden characters, no reserved device name, never empty or too long."""
    cleaned = _BAD_CHARS.sub("", name or "").strip(" .")
    cleaned = cleaned[:MAX_NAME].rstrip(" .")
    if not cleaned:
        return "Oyun"
    if cleaned.split(".")[0].strip().upper() in _RESERVED:
        cleaned = "_" + cleaned
    return cleaned


def can_write(games_dir: Path, min_free_mb: int = 50) -> bool:
    """The folder exists, can be written to and has room for a game."""
    if not games_dir.is_dir():
        return False
    try:
        if shutil.disk_usage(games_dir).free < min_free_mb * 1024 * 1024:
            return False
        probe = games_dir / ".kmg-write-test"
        probe.write_bytes(b"x")
        probe.unlink()
        return True
    except OSError:
        return False


def create_game(games_dir: Path, name: str) -> Game:
    base = safe_folder_name(name)
    number = 1
    while True:
        folder = games_dir / (base if number == 1 else f"{base} ({number})")
        try:
            folder.mkdir()
            return Game(folder.name, folder)
        except FileExistsError:
            number += 1


def list_games(games_dir: Path) -> list[Game]:
    if not games_dir.is_dir():
        return []
    folders = sorted((p for p in games_dir.iterdir() if p.is_dir() and (p / "oyun.html").is_file()),
                     key=lambda p: p.name.casefold())
    return [Game(p.name, p) for p in folders]


def write_launcher(game: Game) -> None:
    _write_bytes(game.launcher_path, LAUNCHER)


def versions(game: Game) -> list[int]:
    if not game.versions_dir.is_dir():
        return []
    found = (_VERSION.match(p.name) for p in game.versions_dir.iterdir())
    return sorted(int(m.group(1)) for m in found if m)


def save_version(game: Game, html: str) -> int:
    """Write `html` as the current game. The previous one is copied to surumler/ first.
    Returns how many old versions are archived."""
    game.folder.mkdir(parents=True, exist_ok=True)
    if game.html_path.is_file():
        game.versions_dir.mkdir(exist_ok=True)
        number = max(versions(game), default=0) + 1
        shutil.copy2(game.html_path, game.versions_dir / f"oyun-{number:03d}.html")
    _write_bytes(game.html_path, html.encode("utf-8"))
    write_launcher(game)
    return len(versions(game))


def restore_version(game: Game, number: int) -> bool:
    """Make an old version the current one. The current one is archived first, so nothing is lost."""
    old = game.versions_dir / f"oyun-{number:03d}.html"
    if not old.is_file():
        return False
    save_version(game, old.read_text(encoding="utf-8"))
    return True


def _meta(game: Game) -> dict:
    try:
        data = json.loads((game.folder / "game.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _png_size(path: Path) -> tuple[int, int]:
    try:
        head = path.read_bytes()[:24]
    except OSError:
        return 0, 0
    if len(head) < 24 or not head.startswith(_PNG):
        return 0, 0
    return struct.unpack(">II", head[16:24])


def add_texture(game: Game, src: Path, description: str) -> Texture:
    """Copy an image into assets/. Raises ValueError for anything that is not a picture."""
    ext = src.suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        raise ValueError(f"resim değil: {src.name}")
    game.assets_dir.mkdir(parents=True, exist_ok=True)
    name, number = src.name, 1
    while (game.assets_dir / name).exists():
        number += 1
        name = f"{src.stem}-{number}{src.suffix}"
    target = game.assets_dir / name
    shutil.copy2(src, target)
    width, height = _png_size(target)
    texture = Texture(name, description, width, height)
    meta = _meta(game)
    meta["textures"] = [*meta.get("textures", []), {
        "file": name, "description": description, "width": width, "height": height}]
    _write_bytes(game.folder / "game.json", json.dumps(meta, ensure_ascii=False, indent=2).encode("utf-8"))
    return texture


def textures(game: Game) -> list[Texture]:
    found = []
    for item in _meta(game).get("textures", []):
        if isinstance(item, dict) and (game.assets_dir / str(item.get("file", ""))).is_file():
            found.append(Texture(item["file"], str(item.get("description", "")),
                                 int(item.get("width", 0)), int(item.get("height", 0))))
    return found
