from k_minigames import kits, specrules, kgamelib
from k_minigames.advisor_rules import KITS


def test_the_football_kit_is_known_to_the_library_the_schema_and_the_guide():
    assert "football" in kgamelib.MODULES
    schema = kits.schema("football")
    assert schema and schema["properties"]["kit"]["enum"] == ["football"] and "teamSize" in schema["properties"]
    assert "futbol" in kits.system_prompt("football").lower()
    assert len(kits.checks("football")) >= 4


def test_words_set_the_match_but_only_the_clear_ones():
    out = specrules.apply_football({"kit": "football"}, "Gece 5 kişilik takımlarla, 3 dakika futbol maçı, kaleci olmasın, güçlü şut")
    assert out["theme"] == "night" and out["teamSize"] == 5 and out["duration"] == 180 and out["keeper"] is False and out["features"] == ["powershot"]
    assert specrules.apply_football({"kit": "football"}, "sokakta 4 vs 4 maç")["teamSize"] == 4
    assert specrules.apply_football({"kit": "football", "theme": "grass"}, "gece sokak")["theme"] == "grass"   # two themes leave the model's choice


def test_a_football_spec_is_repaired_and_filled_in():
    spec = kits.repair_spec({"kit": "football", "teamSize": 40, "duration": 5, "home": "pink", "features": ["powershot", "x"]}, "football")
    assert spec.get("teamSize", 8) <= 8 and spec.get("duration", 30) >= 30 and spec.get("home") != "pink" and "x" not in spec.get("features", [])


def test_the_advisor_hears_a_football_game_and_an_adventure_is_a_different_kit():
    assert [k for k, rx in KITS if rx.search("futbol maçı yapalım")][0] == "football"
    assert [k for k, rx in KITS if rx.search("macera oyunu")][0] == "adventure"
    assert [k for k, rx in KITS if rx.search("araba yarışı")][0] == "race"
