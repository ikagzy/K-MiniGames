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
    assert kgamelib.all_files() == {name for m in kgamelib.MODULES.values() for name in m.files}
    assert {"kgame.js", "kgame.ai.js", "kgame.sports.js"} <= kgamelib.all_files()


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


def test_a_script_word_inside_an_html_comment_is_not_the_place_for_the_tags():
    page = ("<!doctype html><html><head><!-- Kütüphane <script> etiketlerini uygulama ekler --></head>"
            "<body><canvas></canvas><script>const g = K.game();</script></body></html>")
    out = kgamelib.ensure_scripts(page, ["core"])
    assert out.index('<script src="kgame.js">') > out.index("-->")
    assert out.index('<script src="kgame.js">') < out.index("const g = K.game()")


def test_other_spellings_of_the_library_tags_are_replaced_not_doubled():
    page = ("<html><head><script src='./kgame.js'></script><script src=kgame.ai.js></script></head>"
            "<body><script>const g = K.game();</script></body></html>")
    out = kgamelib.ensure_scripts(page, ["core", "ai"])
    assert out.count("kgame.js") == 1 and out.count("kgame.ai.js") == 1


def test_every_module_has_a_summary_for_dons_prompt_and_the_prompt_lists_them_all():
    from k_minigames import advisor
    for module in kgamelib.MODULES.values():
        assert module.summary.strip(), module.name
        assert module.name in advisor.module_prompt()
    assert advisor.module_prompt().count("\n") < 80   # one line per module keeps the prompt small


def test_a_quiet_dependency_loads_its_file_but_its_guide_is_not_shown(monkeypatch):
    quiet = kgamelib.Module("quietmod", ("kgame.quiet.js",), "core.guide.md", ("core",), "x", quiet=True)
    loud = kgamelib.Module("loudmod", ("kgame.loud.js",), "ai.guide.md", ("core", "quietmod"), "y")
    monkeypatch.setitem(kgamelib.MODULES, "quietmod", quiet)
    monkeypatch.setitem(kgamelib.MODULES, "loudmod", loud)
    monkeypatch.setattr(kgamelib, "_ORDER", ["core", "ai", "sports", "quietmod", "loudmod"])
    assert kgamelib.normalize(["loudmod"]) == ["core", "quietmod", "loudmod"]
    text = kgamelib.guides(["loudmod"])
    assert "kgame.ai.js" in text and text.count("# kgame.js") == 1   # core and loudmod's own guide, not the quiet one twice
    explicit = kgamelib.guides(["quietmod", "loudmod"])
    assert explicit.count("# kgame.js") == 2   # chosen on purpose: its guide is shown
