import json
import shutil
import struct
from collections import namedtuple

import pytest

from k_minigames import library


def png(width: int, height: int) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + ihdr + b"\x00\x00\x00\x00"


@pytest.fixture
def games(tmp_path):
    folder = tmp_path / "Oyunlar"
    folder.mkdir()
    return folder


# --- names (Review Focus 1) -------------------------------------------------------------------

@pytest.mark.parametrize("raw, expected", [
    ("CON", "_CON"), ("nul", "_nul"), ("COM1", "_COM1"),
    ("a/b:c", "abc"), ('x<y>"z"|?*', "xyz"),
    ("", "Oyun"), ("...", "Oyun"), ("  ", "Oyun"),
    ("Çöl Koşusu", "Çöl Koşusu"),
    ("Ad. ", "Ad"),
])
def test_safe_folder_name(raw, expected):
    assert library.safe_folder_name(raw) == expected


def test_a_very_long_name_is_cut_to_sixty_characters():
    assert len(library.safe_folder_name("a" * 100)) == 60


def test_the_same_name_twice_gives_two_folders(games):
    first = library.create_game(games, "Uzay")
    second = library.create_game(games, "Uzay")
    assert first.folder.name == "Uzay" and second.folder.name == "Uzay (2)"
    assert first.folder.is_dir() and second.folder.is_dir()


def test_a_dangerous_name_stays_inside_the_games_folder(games):
    game = library.create_game(games, "..\\..\\Windows")
    assert game.folder.parent == games


# --- listing, versions, launcher --------------------------------------------------------------

def test_list_games_skips_folders_without_a_game_and_sorts_by_name(games):
    b = library.create_game(games, "b oyun")
    a = library.create_game(games, "A oyun")
    library.create_game(games, "boş klasör")
    library.save_version(a, "<html>a</html>")
    library.save_version(b, "<html>b</html>")
    assert [g.name for g in library.list_games(games)] == ["A oyun", "b oyun"]


def test_first_save_writes_the_game_and_the_launcher(games):
    game = library.create_game(games, "Uzay")
    assert library.save_version(game, "<html>bir</html>") == 0
    assert game.html_path.read_text(encoding="utf-8") == "<html>bir</html>"
    assert game.launcher_path.read_bytes() == b'@echo off\r\nstart "" "%~dp0oyun.html"\r\n'
    assert library.versions(game) == []


def test_saving_again_archives_the_previous_version(games):
    game = library.create_game(games, "Uzay")
    library.save_version(game, "<html>bir</html>")
    assert library.save_version(game, "<html>iki</html>") == 1
    assert (game.versions_dir / "oyun-001.html").read_text(encoding="utf-8") == "<html>bir</html>"
    assert game.html_path.read_text(encoding="utf-8") == "<html>iki</html>"
    assert library.versions(game) == [1]


def test_restore_brings_back_an_old_version_and_loses_nothing(games):
    game = library.create_game(games, "Uzay")
    library.save_version(game, "<html>bir</html>")
    library.save_version(game, "<html>iki</html>")
    assert library.restore_version(game, 1) is True
    assert game.html_path.read_text(encoding="utf-8") == "<html>bir</html>"
    assert library.versions(game) == [1, 2]
    assert (game.versions_dir / "oyun-002.html").read_text(encoding="utf-8") == "<html>iki</html>"


def test_restoring_a_missing_version_is_false(games):
    game = library.create_game(games, "Uzay")
    library.save_version(game, "<html>bir</html>")
    assert library.restore_version(game, 7) is False
    assert game.html_path.read_text(encoding="utf-8") == "<html>bir</html>"


# --- textures ---------------------------------------------------------------------------------

def test_add_texture_copies_the_file_and_remembers_its_description_and_size(games, tmp_path):
    game = library.create_game(games, "Uzay")
    src = tmp_path / "zemin.png"
    src.write_bytes(png(64, 32))
    tex = library.add_texture(game, src, "zemin karosu")
    assert (tex.file, tex.description, tex.width, tex.height) == ("zemin.png", "zemin karosu", 64, 32)
    assert (game.assets_dir / "zemin.png").read_bytes() == src.read_bytes()
    assert library.textures(game) == [tex]


def test_the_same_file_name_twice_gets_a_second_name(games, tmp_path):
    game = library.create_game(games, "Uzay")
    src = tmp_path / "zemin.png"
    src.write_bytes(png(8, 8))
    library.add_texture(game, src, "bir")
    second = library.add_texture(game, src, "iki")
    assert second.file == "zemin-2.png"
    assert [t.file for t in library.textures(game)] == ["zemin.png", "zemin-2.png"]


def test_a_texture_url_is_percent_encoded(games, tmp_path):
    game = library.create_game(games, "Uzay")
    src = tmp_path / "zemin bir.png"
    src.write_bytes(png(8, 8))
    assert library.add_texture(game, src, "x").url == "assets/zemin%20bir.png"


def test_a_file_that_is_not_an_image_is_refused_and_nothing_is_copied(games, tmp_path):
    game = library.create_game(games, "Uzay")
    src = tmp_path / "notlar.txt"
    src.write_text("merhaba", encoding="utf-8")
    with pytest.raises(ValueError):
        library.add_texture(game, src, "x")
    assert not game.assets_dir.exists() or list(game.assets_dir.iterdir()) == []
    assert library.textures(game) == []


def test_other_image_types_are_accepted_with_unknown_size(games, tmp_path):
    game = library.create_game(games, "Uzay")
    src = tmp_path / "foto.jpg"
    src.write_bytes(b"\xff\xd8\xff")
    tex = library.add_texture(game, src, "x")
    assert (tex.width, tex.height) == (0, 0)


def test_a_texture_whose_file_was_deleted_is_not_listed(games, tmp_path):
    game = library.create_game(games, "Uzay")
    src = tmp_path / "zemin.png"
    src.write_bytes(png(8, 8))
    library.add_texture(game, src, "x")
    (game.assets_dir / "zemin.png").unlink()
    assert library.textures(game) == []


def test_game_json_keeps_other_keys_when_textures_change(games, tmp_path):
    game = library.create_game(games, "Uzay")
    (game.folder / "game.json").write_text(json.dumps({"not": "bende kalsın"}), encoding="utf-8")
    src = tmp_path / "zemin.png"
    src.write_bytes(png(8, 8))
    library.add_texture(game, src, "x")
    assert json.loads((game.folder / "game.json").read_text(encoding="utf-8"))["not"] == "bende kalsın"


# --- can_write ----------------------------------------------------------------------------------

def test_can_write_is_true_for_a_normal_folder(games):
    assert library.can_write(games) is True
    assert list(games.iterdir()) == []


def test_can_write_is_false_for_a_missing_folder_or_a_file(games, tmp_path):
    assert library.can_write(tmp_path / "yok") is False
    afile = tmp_path / "dosya"
    afile.write_bytes(b"")
    assert library.can_write(afile) is False


def test_can_write_is_false_when_the_disk_is_nearly_full(games, monkeypatch):
    usage = namedtuple("usage", "total used free")
    monkeypatch.setattr(shutil, "disk_usage", lambda p: usage(100, 99, 1024))
    assert library.can_write(games, min_free_mb=50) is False
