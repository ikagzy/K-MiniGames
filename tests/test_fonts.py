import tkinter as tk

import pytest

from k_minigames.ui import fonts


@pytest.fixture
def root():
    try:
        window = tk.Tk()
    except tk.TclError:
        pytest.skip("no display for Tk")
    window.withdraw()
    yield window
    window.destroy()


def test_the_font_file_and_its_attribution_ship_together():
    assert (fonts.FONT_DIR / "determination.ttf").is_file()
    notice = (fonts.FONT_DIR / "LICENSE.txt").read_text(encoding="utf-8")
    assert 'The FontStruction “Determination”' in notice
    assert "https://fontstruct.com/fontstructions/show/2368299" in notice and "anonymous-1438277" in notice


def test_the_font_is_loaded_for_the_app_and_found_by_name(root):
    assert fonts.load() >= 1
    assert fonts.family(root) == "Determination"


def test_when_the_font_cannot_be_found_the_app_falls_back_to_a_system_font(root, monkeypatch):
    monkeypatch.setattr(fonts, "FONT_DIR", fonts.FONT_DIR / "yok")
    monkeypatch.setattr(fonts, "_loaded", False)
    monkeypatch.setattr(fonts, "_FAMILY", "Olmayan Yazı Tipi")
    assert fonts.family(root) == fonts.FALLBACK


def test_font_returns_a_family_and_a_pixel_size_in_tk_form(root):
    family, size = fonts.font(root, 20)
    assert family == "Determination" and size == -20


def test_the_attribution_line_names_the_font_its_author_and_the_page():
    line = fonts.ATTRIBUTION
    assert "Determination" in line and "anonymous-1438277" in line and "fontstruct.com" in line
