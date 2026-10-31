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
    assert schema["properties"]["generate"]["items"]["properties"]["difficulty"]["maximum"] == 5
    assert "levels" not in schema["properties"]   # a small model cannot draw a level: it describes one with numbers
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


def test_the_schema_bounds_every_list_and_string_so_a_model_cannot_ramble_forever():
    schema = kits.schema("platformer")
    props = schema["properties"]
    assert 1 <= props["generate"]["maxItems"] <= 6
    assert schema["required"] == ["kit", "generate"]
    for name in ("qblocks", "features"):
        assert props[name]["maxItems"] <= 10
    assert props["title"]["maxLength"] <= 60 and props["world"]["maxLength"] <= 10


def test_repair_spec_keeps_what_the_schema_allows_and_picks_every_seed_itself():
    spec = {"kit": "x", "theme": "lava", "features": ["ice", "ice", "spring"], "hero": {"lives": 99, "jump": "high", "extra": 1},
            "campaign": {"count": 40, "seed": 5}, "musicStyle": {"mood": "calm", "seed": 9999},
            "generate": [{"width": 5000, "pits": 3, "seed": 7}], "bogus": True}
    out = kits.repair_spec(spec, "platformer")
    assert out["kit"] == "platformer" and "bogus" not in out and out["theme"] != "lava"   # an unknown theme is replaced by a drawn one
    assert out["features"] == ["ice", "spring"]
    assert out["hero"]["lives"] <= 9 and "extra" not in out["hero"] and "jump" not in out["hero"]
    assert out["campaign"]["count"] == 20 and out["generate"][0]["width"] == 160 and out["generate"][0]["pits"] == 3
    seeds = [out["generate"][0]["seed"], out["campaign"]["seed"], out["musicStyle"]["seed"]]
    assert all(0 <= x <= 9999 for x in seeds) and seeds != [7, 5, 9999]


def test_repair_spec_gives_a_spec_without_levels_one_default_level():
    out = kits.repair_spec({"kit": "platformer", "theme": "sky"}, "platformer")
    assert len(out["generate"]) == 1 and 0 <= out["generate"][0]["seed"] <= 9999


def test_what_the_spec_leaves_open_is_drawn_and_what_it_says_is_kept():
    seen = set()
    for _ in range(40):
        out = kits.repair_spec({"kit": "platformer", "generate": [{"enemies": 0, "width": 40}]}, "platformer")
        level = out["generate"][0]
        assert level["enemies"] == 0 and level["width"] == 40, "what the model wrote stays"
        assert out["theme"] and out["musicStyle"]["mood"] and 0 <= level["style"] <= 4 and 1 <= level["coins"] <= 4
        seen.add((out["theme"], level["pits"], level["style"]))
    assert len(seen) > 8, "the open parts vary from game to game"
    sky = kits.repair_spec({"kit": "platformer", "theme": "sky", "music": "boss"}, "platformer")
    assert sky["theme"] == "sky" and "musicStyle" not in sky, "a named theme and tune are kept"


def test_an_edit_keeps_the_seeds_of_the_levels_the_campaign_and_the_music():
    before = {"generate": [{"seed": 11}, {"seed": 22}], "campaign": {"count": 6, "seed": 33}, "musicStyle": {"mood": "calm", "seed": 44}}
    after = kits.repair_spec({"kit": "platformer", "title": "Yeni", "generate": [{}, {}], "campaign": {"count": 6}, "musicStyle": {"mood": "calm"}}, "platformer")
    out = kits.keep_seeds(before, after)
    assert [lv["seed"] for lv in out["generate"]] == [11, 22] and out["campaign"]["seed"] == 33 and out["musicStyle"]["seed"] == 44


def test_the_shooter_is_a_kit_with_a_schema_a_guide_checks_and_its_own_variety():
    assert kgamelib.kit_of(["core", "shooter"]) == "shooter"
    assert kits.schema("shooter")["properties"]["features"]["items"]["enum"] == ["shield", "bomb", "spread", "rapid"]
    assert len(kits.checks("shooter")) == 5
    prompt = kits.system_prompt("shooter")
    assert "nişancı" in prompt and "Seviyeyi (levels)" not in prompt, "no platformer sentences in the shooter's prompt"
    assert "Seviyeyi (levels)" in kits.system_prompt("platformer")
    page = kits.compile_page({"kit": "shooter", "theme": "space"})
    assert page.index("kgame.js") < page.index("kgame.shooter.js") < page.index("K.kit.run(")
    seen = set()
    for _ in range(40):
        out = kits.repair_spec({"kit": "shooter", "enemies": ["drifter", "ejderha"], "ship": {"lives": 99}}, "shooter")
        assert "generate" not in out and out["enemies"] == ["drifter"] and out["ship"]["lives"] == 9
        assert 3 <= out["waves"]["count"] <= 20 and 0 <= out["waves"]["seed"] <= 9999 and out["theme"]
        seen.add((out["theme"], out["waves"]["count"], out["difficulty"]))
    assert len(seen) > 6
    kept = kits.keep_seeds({"waves": {"count": 8, "seed": 77}}, kits.repair_spec({"kit": "shooter", "waves": {"count": 8}}, "shooter"))
    assert kept["waves"]["seed"] == 77


def test_the_sandbox_is_a_kit_with_a_schema_a_guide_checks_and_its_own_variety():
    assert kgamelib.kit_of(["core", "sandbox"]) == "sandbox"
    assert kits.schema("sandbox")["properties"]["biome"]["enum"] == ["forest", "plains", "desert", "snow"]
    assert len(kits.checks("sandbox")) == 5
    assert "küp dünya" in kits.system_prompt("sandbox") and "Seviyeyi (levels)" not in kits.system_prompt("sandbox")
    page = kits.compile_page({"kit": "sandbox", "biome": "desert"})
    assert page.index("kgame.js") < page.index("kgame.voxel.js") < page.index("K.kit.run(")
    seen = set()
    for _ in range(40):
        out = kits.repair_spec({"kit": "sandbox", "caves": 9, "size": "dev"}, "sandbox")
        assert "generate" not in out and out["caves"] == 3 and out["size"] in ("small", "medium", "large")
        assert 0 <= out["world"]["seed"] <= 9999 and out["biome"] in ("forest", "plains", "desert", "snow")
        seen.add((out["biome"], out["size"], out["ores"]))
    assert len(seen) > 6
    kept = kits.keep_seeds({"world": {"seed": 77}}, kits.repair_spec({"kit": "sandbox", "title": "Yeni"}, "sandbox"))
    assert kept["world"]["seed"] == 77
