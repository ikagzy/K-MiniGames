import json

import pytest

from k_minigames import kgamelib, kits, library


@pytest.fixture
def game(tmp_path):
    games = tmp_path / "Oyunlar"
    games.mkdir()
    return library.create_game(games, "Kagzy")


def test_the_platformer_is_a_kit_and_ordinary_modules_are_not():
    assert kgamelib.kit_of(["core", "platformer"]) == "platformer"
    assert kgamelib.kit_of(["core", "ai", "sports"]) is None
    assert kgamelib.kit_of(None) is None
    assert kgamelib.kit_of(["PLATFORMER"]) == "platformer"


def test_compile_page_makes_a_small_html_with_the_libraries_and_the_spec():
    spec = {"kit": "platformer", "theme": "night", "levels": [["P.F", "###"]]}
    page = kits.compile_page(spec)
    assert page.startswith("<!doctype html>") and "<canvas></canvas>" in page
    assert page.count('<script src="kgame.platformer.js">') == 1
    assert page.index("kgame.js") < page.index("kgame.platformer.js") < page.index("K.kit.run(")
    inline = page[page.index("K.kit.run(") + len("K.kit.run("):page.rindex(");")]
    assert json.loads(inline) == spec   # the spec is plain JSON inside the call
    assert "</script>" not in inline


def test_a_spec_with_script_closing_text_cannot_break_out_of_the_page():
    spec = {"kit": "platformer", "title": "</script><script>alert(1)</script>"}
    page = kits.compile_page(spec)
    assert page.count("</script>") == len(kgamelib.install_files(["core", "platformer"])) + 1   # the library tags and one inline block: the spec closed none
    assert "alert(1)</script>" not in page and '<' + chr(92) + '/script>' in page


def test_parse_spec_reads_fenced_or_bare_json_and_fills_in_the_kit():
    assert kits.parse_spec('```json\n{"theme": "cave"}\n```', "platformer") == {"kit": "platformer", "theme": "cave"}
    assert kits.parse_spec('Tamam: {"kit": "platformer", "levels": [["P.F", "###"]]} bitti', "platformer")["levels"] == [["P.F", "###"]]
    assert kits.parse_spec('{"kit": "baska", "theme": "sky"}', "platformer")["kit"] == "platformer"   # the chosen kit wins
    for bad in ("", "hiçbir şey", "[1, 2]", '{"theme": '):
        with pytest.raises(kits.SpecError):
            kits.parse_spec(bad, "platformer")


def test_the_schema_keeps_the_answer_in_shape_and_lists_the_menus():
    schema = kits.schema("platformer")
    assert schema["type"] == "object"
    assert "sky" in schema["properties"]["theme"]["enum"]
    assert "doubleJump" in schema["properties"]["features"]["items"]["enum"]
    assert schema["properties"]["levels"]["items"]["items"]["type"] == "string"
    assert kits.schema("yok") is None


def test_every_kit_has_checks_that_are_real_code_and_a_prompt_with_its_guide():
    checks = kits.checks("platformer")
    assert len(checks) >= 4
    for text, code in checks:
        assert text and "return" in code
    prompt = kits.system_prompt("platformer")
    assert "ÖZET" in prompt and "K.kit.run" in prompt and "JSON" in prompt


def test_the_spec_of_a_game_is_remembered_and_a_broken_file_means_none(game):
    assert library.spec(game) is None and library.kit(game) is None
    library.set_modules(game, ["platformer"])
    library.set_spec(game, {"kit": "platformer", "theme": "sky"})
    assert library.spec(game) == {"kit": "platformer", "theme": "sky"}
    assert library.kit(game) == "platformer"
    (game.folder / "game.json").write_text("{bozuk", encoding="utf-8")
    assert library.spec(game) is None and library.kit(game) is None
