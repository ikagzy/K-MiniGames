from k_minigames import kits, specrules, kgamelib
from k_minigames.advisor_rules import KITS


def test_the_adventure_kit_is_known_to_the_library_the_schema_and_the_guide():
    assert "adventure" in kgamelib.MODULES
    schema = kits.schema("adventure")
    assert schema and schema["properties"]["kit"]["enum"] == ["adventure"] and schema["properties"]["hero"]["enum"] == ["knight", "ranger", "mage"]
    assert "adventure" in schema["properties"]["music"]["enum"]
    assert "zindan" in kits.system_prompt("adventure").lower() and len(kits.checks("adventure")) >= 4


def test_words_set_the_adventure_but_only_the_clear_ones():
    out = specrules.apply_adventure({"kit": "adventure"}, "Kalede geçen, okçu kahramanlı, iskelet ve hayalet düşmanlı, 4 katlı, patronsuz, atılma olsun, zor")
    assert out["theme"] == "castle" and out["hero"] == "ranger" and out["enemies"] == ["skeleton", "ghost"] and out["levels"] == 4 and out["boss"] is False and out["features"] == ["dash"]
    assert specrules.apply_adventure({"kit": "adventure", "theme": "dungeon"}, "orman ve kale")["theme"] == "dungeon"   # two themes leave the model's choice
    assert specrules.apply_adventure({"kit": "adventure", "enemies": ["slime"]}, "yarasa da olsun")["enemies"] == ["slime", "bat"]


def test_an_adventure_spec_is_repaired_and_filled_in():
    spec = kits.repair_spec({"kit": "adventure", "hero": "dragon", "levels": 40, "enemies": ["slime", "orc"], "features": ["dash", "x"]}, "adventure")
    assert spec.get("hero", "knight") in ("knight", "ranger", "mage") and spec.get("levels", 6) <= 6 and "orc" not in spec.get("enemies", []) and "x" not in spec.get("features", [])


def test_the_advisor_hears_an_adventure_game_and_not_other_games():
    assert [k for k, rx in KITS if rx.search("zindan macerası yapalım")][0] == "adventure"
    assert [k for k, rx in KITS if rx.search("canavar avlayan rpg")][0] == "adventure"
    assert [k for k, rx in KITS if rx.search("araba yarışı")][0] == "race"
    assert [k for k, rx in KITS if rx.search("minecraft gibi")][0] == "sandbox"
