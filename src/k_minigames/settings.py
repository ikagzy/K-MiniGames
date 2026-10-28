"""K-MiniGames' own small settings file (%LOCALAPPDATA%/K-MiniGames/settings.json).

K-Series reads `exe_path` from here to find the app, the way it finds the other K products."""
import json
import os
from pathlib import Path


def app_dir() -> Path:
    return Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "K-MiniGames"


def _file() -> Path:
    return app_dir() / "settings.json"


def load() -> dict:
    try:
        data = json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def save(data: dict) -> bool:
    target = _file()
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, target)
        return True
    except OSError:
        return False


def get(key: str, default=None):
    return load().get(key, default)


def put(key: str, value) -> bool:
    data = load()
    data[key] = value
    return save(data)


def games_dir() -> Path | None:
    """The folder the user chose for games, if it still exists."""
    value = get("games_dir")
    if not isinstance(value, str) or not value:
        return None
    path = Path(value)
    return path if path.is_dir() else None


def set_games_dir(path: Path) -> bool:
    return put("games_dir", str(path))


def register_exe(exe: Path) -> bool:
    return put("exe_path", str(exe))
