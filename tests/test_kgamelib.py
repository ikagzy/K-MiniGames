import pytest

from k_minigames import kgamelib, library


@pytest.fixture
def game(tmp_path):
    games = tmp_path / "Oyunlar"
    games.mkdir()
    return library.create_game(games, "Uzay")


def test_normalize_drops_unknown_adds_dependencies_and_puts_core_first():
    assert kgamelib.normalize(["Sports", "xyz", "sports"]) == ["core", "ai", "sports"]
    assert kgamelib.normalize([]) == ["core"]
    assert kgamelib.normalize(["AI"]) == ["core", "ai"]
    assert kgamelib.normalize(None) == ["core"]
    assert kgamelib.normalize([5, "core"]) == ["core"]


def test_install_copies_the_files_into_the_game_folder_and_is_repeatable(game):
    names = kgamelib.install(game, ["core", "ai"])
    assert names == ["kgame.js", "kgame.ai.js"]
    assert (game.folder / "kgame.js").is_file() and (game.folder / "kgame.ai.js").is_file()
    assert not (game.folder / "kgame.sports.js").exists()
    (game.folder / "kgame.js").write_text("eski", encoding="utf-8")
    kgamelib.install(game, ["core", "ai"])   # again: the older copy is replaced, nothing breaks
    assert (game.folder / "kgame.js").read_text(encoding="utf-8") != "eski"


def test_every_registered_file_and_guide_exists():
    for module in kgamelib.MODULES.values():
        for name in module.files:
            assert (kgamelib.LIB_DIR / name).is_file(), name
        assert (kgamelib.LIB_DIR / module.guide).is_file(), module.guide
    assert kgamelib.all_files() == {"kgame.js", "kgame.ai.js", "kgame.sports.js"}


PAGE = "<!doctype html><html><head><title>x</title></head><body><canvas></canvas><script>const g = K.game();</script></body></html>"


def test_ensure_scripts_adds_the_tags_once_in_order_before_the_first_script():
    out = kgamelib.ensure_scripts(PAGE, ["core", "ai"])
    assert out.count('<script src="kgame.js"></script>') == 1 and out.count('<script src="kgame.ai.js"></script>') == 1
    assert out.index("kgame.js") < out.index("kgame.ai.js") < out.index("const g = K.game()")
    assert kgamelib.ensure_scripts(out, ["core", "ai"]) == out   # a second time changes nothing


def test_ensure_scripts_repairs_what_the_model_wrote_itself():
    wrong = PAGE.replace("<script>", '<script src="kgame.ai.js"></script>\n<script src="kgame.js"></script>\n'
                         '<script src="kgame.js"></script><script>', 1)
    out = kgamelib.ensure_scripts(wrong, ["core", "ai"])
    assert out.count("kgame.js") == 1 and out.count("kgame.ai.js") == 1
    assert out.index("kgame.js") < out.index("kgame.ai.js") < out.index("const g = K.game()")


def test_ensure_scripts_without_a_script_or_head_still_adds_the_tags():
    out = kgamelib.ensure_scripts("<html><body><canvas></canvas></body></html>", ["core"])
    assert '<script src="kgame.js"></script>' in out
    out = kgamelib.ensure_scripts("<canvas></canvas>", ["core"])
    assert out.startswith('<script src="kgame.js"></script>')


def test_guides_joins_the_selected_modules_guides():
    text = kgamelib.guides(["core"])
    assert "kgame.js" in text and "kgame.ai.js" not in text
    both = kgamelib.guides(["core", "ai"])
    assert both.index("kgame.js") < both.index("kgame.ai.js")
