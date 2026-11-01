from k_minigames import kits, specrules, kgamelib
from k_minigames.advisor_rules import KITS


def test_the_puzzle_kit_is_known_to_the_library_the_schema_and_the_guide():
    assert "puzzle" in kgamelib.MODULES
    schema = kits.schema("puzzle")
    assert schema and schema["properties"]["kit"]["enum"] == ["puzzle"] and schema["properties"]["mode"]["enum"] == ["blocks", "match", "memory"]
    assert "puzzle" in schema["properties"]["music"]["enum"]
    assert "bulmaca" in kits.system_prompt("puzzle").lower() and len(kits.checks("puzzle")) >= 3


def test_words_set_the_puzzle_but_only_the_clear_ones():
    out = specrules.apply_puzzle({"kit": "puzzle"}, "Neon temalı tetris, gölge ve parça saklama olsun, 3000 puan hedef, büyük")
    assert out["mode"] == "blocks" and out["theme"] == "neon" and out["goal"] == 3000 and out["features"] == ["ghost", "hold"] and out["size"] == "large"
    assert specrules.apply_puzzle({"kit": "puzzle"}, "şeker temalı üçlü eşleştirme, ipucu olsun, zor")["features"] == ["hint"]
    assert specrules.apply_puzzle({"kit": "puzzle"}, "hafıza kartları oyunu")["mode"] == "memory"
    assert specrules.apply_puzzle({"kit": "puzzle", "mode": "match"}, "tetris ve hafıza")["mode"] == "match"   # two modes leave the model's choice


def test_a_puzzle_spec_is_repaired_and_filled_in():
    spec = kits.repair_spec({"kit": "puzzle", "mode": "chess", "difficulty": 40, "goal": 9999999, "features": ["ghost", "x"]}, "puzzle")
    assert spec.get("mode", "blocks") in ("blocks", "match", "memory") and spec.get("difficulty", 5) <= 5 and spec.get("goal", 0) <= 50000 and "x" not in spec.get("features", [])


def test_the_advisor_hears_a_puzzle_game_and_not_other_words():
    assert [k for k, rx in KITS if rx.search("tetris yapalım")][0] == "puzzle"
    assert [k for k, rx in KITS if rx.search("kart eşleştirme oyunu")][0] == "puzzle"
    assert not [k for k, rx in KITS if rx.search("karakter yaratalım")]
    assert [k for k, rx in KITS if rx.search("araba yarışı")][0] == "race"
