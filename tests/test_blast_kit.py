from k_minigames import kits, specrules, kgamelib
from k_minigames.advisor_rules import KITS


def test_the_blast_kit_is_known_to_the_library_the_schema_and_the_guide():
    assert "blast" in kgamelib.MODULES
    schema = kits.schema("blast")
    assert schema and schema["properties"]["kit"]["enum"] == ["blast"] and schema["properties"]["features"]["items"]["enum"] == ["hint", "undo", "bomb"]
    assert "blast" in schema["properties"]["music"]["enum"]
    assert "blok" in kits.system_prompt("blast").lower() and len(kits.checks("blast")) >= 4


def test_words_set_the_blast_game_but_only_the_clear_ones():
    out = specrules.apply_blast({"kit": "blast"}, "Neon temalı block blast, büyük tahta, 5000 puan hedef, geri alma ve ipucu ve bomba olsun, zor")
    assert out["theme"] == "neon" and out["size"] == "large" and out["goal"] == 5000 and out["features"] == ["hint", "undo", "bomb"]
    assert specrules.apply_blast({"kit": "blast", "theme": "candy"}, "gece ve neon")["theme"] == "candy"   # two themes leave the model's choice
    assert specrules.apply_blast({"kit": "blast"}, "küçük tahta")["size"] == "small"


def test_a_blast_spec_is_repaired_and_filled_in():
    spec = kits.repair_spec({"kit": "blast", "theme": "moon", "size": "huge", "goal": 9999999, "features": ["undo", "x"]}, "blast")
    assert spec.get("goal", 0) <= 100000 and "x" not in spec.get("features", []) and spec.get("size", "medium") in ("small", "medium", "large")


def test_the_advisor_hears_a_block_blast_game_and_keeps_the_other_block_games_apart():
    assert [k for k, rx in KITS if rx.search("block blast yapalım")][0] == "blast"
    assert [k for k, rx in KITS if rx.search("blok patlatma oyunu")][0] == "blast"
    assert [k for k, rx in KITS if rx.search("minecraft gibi blok oyunu")][0] == "sandbox"
    assert [k for k, rx in KITS if rx.search("tetris")][0] == "puzzle"
