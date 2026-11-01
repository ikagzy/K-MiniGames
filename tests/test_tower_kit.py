from k_minigames import kits, specrules, kgamelib
from k_minigames.advisor_rules import KITS


def test_the_tower_kit_is_known_to_the_library_the_schema_and_the_guide():
    assert "tower" in kgamelib.MODULES
    schema = kits.schema("tower")
    assert schema and schema["properties"]["kit"]["enum"] == ["tower"] and schema["properties"]["towers"]["items"]["enum"] == ["arrow", "cannon", "frost", "sniper"]
    assert "tower" in schema["properties"]["music"]["enum"]
    assert "kule" in kits.system_prompt("tower").lower() and len(kits.checks("tower")) >= 4


def test_words_set_the_tower_game_but_only_the_clear_ones():
    out = specrules.apply_tower({"kit": "tower"}, "Çölde 12 dalgalı kule savunması, top ve buz kulesi, zırhlı ve sürü düşmanlar, patron olsun, dondurma ve hızlandırma, zor")
    assert out["theme"] == "desert" and out["waves"] == 12 and out["towers"] == ["cannon", "frost"] and out["enemies"] == ["tank", "swarm"] and out["boss"] is True and out["features"] == ["speed", "freeze"]
    assert specrules.apply_tower({"kit": "tower", "theme": "grass"}, "gece ve çöl")["theme"] == "grass"   # two themes leave the model's choice
    assert specrules.apply_tower({"kit": "tower", "towers": ["arrow"]}, "keskin nişancı kulesi de olsun")["towers"] == ["arrow", "sniper"]


def test_a_tower_spec_is_repaired_and_filled_in():
    spec = kits.repair_spec({"kit": "tower", "theme": "moon", "waves": 400, "towers": ["arrow", "laser"], "enemies": ["soldier", "dragon"], "features": ["speed", "x"]}, "tower")
    assert spec.get("waves", 30) <= 30 and "laser" not in spec.get("towers", []) and "dragon" not in spec.get("enemies", []) and "x" not in spec.get("features", [])


def test_the_advisor_hears_a_tower_game_and_keeps_the_others_apart():
    assert [k for k, rx in KITS if rx.search("kule savunması yapalım")][0] == "tower"
    assert [k for k, rx in KITS if rx.search("kaleyi koruyalım")][0] == "tower"
    assert [k for k, rx in KITS if rx.search("zindan macerası")][0] == "adventure"
    assert [k for k, rx in KITS if rx.search("araba yarışı")][0] == "race"
