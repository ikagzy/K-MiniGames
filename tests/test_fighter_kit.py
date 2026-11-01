from k_minigames import kits, specrules, kgamelib
from k_minigames.advisor_rules import KITS


def test_the_fighter_kit_is_known_to_the_library_the_schema_and_the_guide():
    assert "fighter" in kgamelib.MODULES
    schema = kits.schema("fighter")
    assert schema and schema["properties"]["kit"]["enum"] == ["fighter"] and schema["properties"]["hero"]["enum"] == ["brawler", "ninja", "sumo"]
    assert "fighter" in schema["properties"]["music"]["enum"]
    assert "dövüş" in kits.system_prompt("fighter").lower() and len(kits.checks("fighter")) >= 5


def test_words_set_the_fight_but_only_the_clear_ones():
    out = specrules.apply_fighter({"kit": "fighter"}, "Sokakta ninja ile sumo dövüşsün, 3 tur, 45 saniye, ateş topu ve iki kişilik, öfke olsun, zor")
    assert out["theme"] == "street" and out["hero"] == "ninja" and out["rival"] == "sumo" and out["rounds"] == 3 and out["time"] == 45 and out["features"] == ["special", "versus", "rage"]
    assert specrules.apply_fighter({"kit": "fighter", "theme": "dojo"}, "sokak ve tapınak")["theme"] == "dojo"   # two themes leave the model's choice
    assert specrules.apply_fighter({"kit": "fighter"}, "tapınakta ninja olarak oynayayım, rakip sumo olsun")["rival"] == "sumo"


def test_a_fighter_spec_is_repaired_and_filled_in():
    spec = kits.repair_spec({"kit": "fighter", "hero": "dragon", "rounds": 40, "time": 5, "features": ["special", "x"]}, "fighter")
    assert spec.get("hero", "brawler") in ("brawler", "ninja", "sumo") and spec.get("rounds", 5) <= 5 and spec.get("time", 20) >= 20 and "x" not in spec.get("features", [])


def test_the_advisor_hears_a_fighting_game_and_keeps_the_others_apart():
    assert [k for k, rx in KITS if rx.search("dövüş oyunu yapalım")][0] == "fighter"
    assert [k for k, rx in KITS if rx.search("ninja oyunu")][0] == "fighter"
    assert [k for k, rx in KITS if rx.search("zindan macerası")][0] == "adventure"
    assert [k for k, rx in KITS if rx.search("kule savunması")][0] == "tower"
