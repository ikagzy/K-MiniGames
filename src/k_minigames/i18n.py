"""Turkish and English for K-MiniGames. The source text is Turkish; `t()` swaps known phrases for English when the
interface language is English. Phrases are replaced longest first, so a long sentence wins over the words in it.
The language is chosen in K-Series' settings (%APPDATA%/K-Series/settings.json); K-MiniGames follows it."""
import json
import locale
import os
import re
from pathlib import Path

LANGUAGES = (("tr", "Türkçe"), ("en", "English"))

_PAIRS = {
    "Oyun klasörü": "Games folder",
}


def _alt(key: str) -> str:
    return re.escape(key)


_PATTERN = re.compile("|".join(_alt(k) for k in sorted(_PAIRS, key=len, reverse=True)))

_lang = "tr"


def system_default() -> str:
    try:
        code = locale.getlocale()[0] or ""
    except (ValueError, AttributeError):
        code = ""
    return "tr" if code.lower().startswith(("tr", "turkish")) else "en"


def settings_path() -> Path:
    return Path(os.environ.get("APPDATA") or Path.home()) / "K-Series" / "settings.json"


def saved_language() -> str:
    """The language K-Series saved, else the system's."""
    try:
        code = json.loads(settings_path().read_text(encoding="utf-8")).get("language")
    except (OSError, ValueError, AttributeError):
        code = None
    return code if code in dict(LANGUAGES) else system_default()


def set_language(code: str) -> None:
    global _lang
    _lang = code if code in dict(LANGUAGES) else "tr"


def follow() -> bool:
    """Pick up a language change made in K-Series. True when the language changed."""
    before = _lang
    set_language(saved_language())
    return _lang != before


def current() -> str:
    return _lang


def t(text: str) -> str:
    """The text in the interface language (unknown text is returned as it is)."""
    if _lang == "tr" or not text:
        return text
    return _PATTERN.sub(lambda m: _PAIRS[m.group(0)], text)
