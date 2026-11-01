from k_minigames import kits, specrules, kgamelib
from k_minigames.advisor_rules import KITS


def test_the_race_kit_is_known_to_the_library_the_schema_and_the_guide():
    assert "race" in kgamelib.MODULES
    schema = kits.schema("race")
    assert schema and schema["properties"]["kit"]["enum"] == ["race"] and "race" in schema["properties"]["music"]["enum"]
    assert "race" in kits.system_prompt("race") or "yarış" in kits.system_prompt("race")
    assert kits.checks("race") and all("game.state" in code or "game.p" in code for _, code in kits.checks("race"))


def test_words_set_the_race_but_only_the_clear_ones():
    out = specrules.apply_race({"kit": "race"}, "Çölde 4 tur, 3 rakipli, mavi araba ile nitro olsun, kolay")
    assert out["theme"] == "desert" and out["laps"] == 4 and out["rivals"] == 3 and out["color"] == "blue" and out["features"] == ["nitro"]
    assert specrules.apply_race({"kit": "race", "theme": "forest"}, "gece ve şehir")["theme"] == "forest"   # two themes leave the model's choice
    assert specrules.apply_race({"kit": "race"}, "uzun pist, kas araba")["length"] == "large"


def test_a_race_spec_is_repaired_and_filled_in():
    spec = kits.repair_spec({"kit": "race", "theme": "moon", "laps": 40, "rivals": 0, "features": ["nitro", "x"]}, "race")
    assert spec["theme"] != "moon" or "theme" not in spec
    assert spec.get("laps", 9) <= 9 and spec.get("rivals", 1) >= 1 and "x" not in spec.get("features", [])


def test_the_advisor_hears_a_racing_game():
    names = [k for k, rx in KITS if rx.search("araba yarışı yapalım")]
    assert names[0] == "race"
    assert [k for k, rx in KITS if rx.search("pompalı ile fps")][0] == "fps"
