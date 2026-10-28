"""The app's font: “Determination” (the pixel font of the dialogue boxes in Undertale-like games).

The .ttf lives in assets/fonts next to its attribution (LICENSE.txt); `ATTRIBUTION` is shown in the window. The font
is made available to this process only (nothing is installed on the computer). If it is missing the app falls back to
a system font, so a broken install never stops the app."""
import ctypes
import tkinter as tk
from pathlib import Path
from tkinter import font as tkfont

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
FALLBACK = "Segoe UI"
ATTRIBUTION = "Font: “Determination” by anonymous-1438277 (fontstruct.com/fontstructions/show/2368299)"
_FAMILY = "Determination"
_FR_PRIVATE = 0x10   # AddFontResourceEx: usable by this process only, gone when it ends

# pixel sizes (Tk: a negative size is in pixels, which keeps a pixel font sharp)
LABEL, MESSAGE, INPUT, BUTTON, LIST, SMALL = 22, 24, 22, 18, 20, 15

_loaded = False
_count = 0


def load() -> int:
    """Make every .ttf in FONT_DIR usable for this process. Returns how many were added (0 when there are none)."""
    global _loaded, _count
    if _loaded:
        return _count
    _count = 0
    for path in sorted(FONT_DIR.glob("*.ttf")) if FONT_DIR.is_dir() else []:
        try:
            if ctypes.windll.gdi32.AddFontResourceExW(str(path), _FR_PRIVATE, 0):
                _count += 1
        except (AttributeError, OSError):
            pass
    _loaded = True
    return _count


def family(root: tk.Misc) -> str:
    """The font's family name if Tk can see it, else a system font."""
    load()
    return _FAMILY if _FAMILY in tkfont.families(root) else FALLBACK


def font(root: tk.Misc, size: int) -> tuple[str, int]:
    """A Tk font tuple at `size` pixels."""
    return family(root), -size
