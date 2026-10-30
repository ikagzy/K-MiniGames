import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "train"))

import specdata  # noqa: E402

from k_minigames import kits  # noqa: E402

INT_BOUNDS = {"width": (24, 160), "difficulty": (1, 5), "seed": (0, 9999), "pits": (0, 5), "enemies": (0, 5), "blocks": (0, 5),
              "pipes": (0, 5), "coins": (0, 5), "flyers": (0, 5), "spikes": (0, 5)}


@pytest.fixture(scope="module")
def data():
    return specdata.build_examples(n_train=240, n_eval=60, seed=7)


def test_the_dataset_is_the_same_every_time_for_the_same_seed():
    a = specdata.build_examples(n_train=30, n_eval=10, seed=3)
    b = specdata.build_examples(n_train=30, n_eval=10, seed=3)
    assert a == b
    c = specdata.build_examples(n_train=30, n_eval=10, seed=4)
    assert a != c


def test_every_target_spec_is_inside_the_schema(data):
    train, held = data
    schema = kits.schema("platformer")
    themes = schema["properties"]["theme"]["enum"]
    for example in train + held:
        spec = example["spec"]
        assert spec["kit"] == "platformer" and 1 <= len(spec["generate"]) <= 4
        if "theme" in spec:
            assert spec["theme"] in themes
        for level in spec["generate"]:
            for key, value in level.items():
                lo, hi = INT_BOUNDS[key]
                assert isinstance(value, int) and lo <= value <= hi, (key, value)
        hero = spec.get("hero", {})
        assert set(hero) <= {"speed", "jump", "lives"}
        assert set(spec.get("features", [])) <= {"doubleJump"}
        json.dumps(spec)   # it must be plain JSON


def test_the_messages_are_exactly_what_the_app_sends(data):
    train, _ = data
    create = next(e for e in train if e["kind"] == "create")
    system, user, answer = create["messages"]
    assert system == {"role": "system", "content": kits.system_prompt("platformer")}
    assert user["content"].startswith("Oyun tarifi:\n") and user["content"].endswith("Özeti (tek JSON nesnesi) ver.")
    assert answer["role"] == "assistant" and json.loads(answer["content"]) == create["spec"]
    edit = next(e for e in train if e["kind"] == "edit")
    assert edit["messages"][1]["content"].startswith("Oyunun şimdiki özeti:")
    assert "Kullanıcının isteği:" in edit["messages"][1]["content"]


def test_what_a_prompt_asks_for_is_what_the_answer_contains(data):
    train, held = data
    for example in train + held:
        if example["kind"] != "create":
            continue   # an edit says "more" or "easier": a change, not a value
        text = specdata.prompt_text(example).lower()
        spec = example["spec"]
        for field in example["mentioned"]:
            assert specdata.mentions(text, field, spec), (field, text, spec)
        assert ("doublejump" in json.dumps(spec).lower()) == bool(specdata.mentions(text, "features", spec) and "features" in example["mentioned"])


def test_a_prompt_that_asks_for_little_gets_a_small_answer_with_defaults_left_out(data):
    train, _ = data
    smallest = min((e for e in train if e["kind"] == "create"), key=lambda e: len(e["mentioned"]))
    assert len(smallest["mentioned"]) <= 2
    level = smallest["spec"]["generate"][0]
    assert set(level) <= {"seed", "width", "difficulty", "enemies", "coins", "pits", "pipes", "blocks", "flyers", "spikes"}
    assert "hero" not in smallest["spec"] or "hero" in smallest["mentioned"]


def test_the_held_out_set_uses_theme_and_difficulty_pairs_the_training_never_saw(data):
    train, held = data
    seen = {(e["spec"].get("theme"), e["spec"]["generate"][0].get("difficulty")) for e in train if e["kind"] == "create"}
    new = [(e["spec"].get("theme"), e["spec"]["generate"][0].get("difficulty")) for e in held if e["kind"] == "create"]
    combos = [c for c in new if c[0] is not None and c[1] is not None]
    assert combos and all(c not in seen for c in combos)


def test_all_the_themes_and_features_appear_in_training(data):
    train, _ = data
    themes = {e["spec"].get("theme") for e in train}
    assert set(kits.schema("platformer")["properties"]["theme"]["enum"]) <= themes
    assert any("doubleJump" in e["spec"].get("features", []) for e in train)
    assert any(len(e["spec"]["generate"]) > 1 for e in train)
    assert any(e["lang"] == "en" for e in train) and any(e["lang"] == "tr" for e in train)


def test_edit_examples_change_what_the_request_says_and_keep_the_rest(data):
    train, _ = data
    edits = [e for e in train if e["kind"] == "edit"]
    assert len(edits) > 10
    for e in edits:
        old, new = e["before"], e["spec"]
        assert old != new, e["request"]
        assert new["kit"] == "platformer"
        changed = specdata.changed_fields(old, new)
        assert changed and changed <= set(e["mentioned"]), (changed, e["request"])


def test_the_hand_written_prompts_are_realistic_and_their_expectations_are_valid():
    assert len(specdata.HAND_EVAL) >= 20
    themes = set(kits.schema("platformer")["properties"]["theme"]["enum"])
    for item in specdata.HAND_EVAL:
        assert len(item["prompt"]) > 15
        expect = item["expect"]
        assert expect.get("theme", "sky") in themes
        assert set(expect) <= {"theme", "features", "levels", "difficulty", "lives", "enemies", "coins", "pits", "pipes", "blocks",
                               "flyers", "spikes", "width_class", "music"}


def test_scoring_rewards_the_right_choices_and_gives_nothing_for_unusable_answers(data):
    train, _ = data
    example = next(e for e in train if e["kind"] == "create" and len(e["mentioned"]) >= 3)
    perfect = specdata.score(example["spec"], example["spec"], example["mentioned"])
    assert perfect["valid"] and perfect["accuracy"] == 1.0
    wrong = json.loads(json.dumps(example["spec"]))
    wrong["theme"] = "cave" if example["spec"].get("theme") != "cave" else "sky"
    assert specdata.score(wrong, example["spec"], example["mentioned"])["accuracy"] < 1.0 or "theme" not in example["mentioned"]
    assert specdata.score(None, example["spec"], example["mentioned"]) == {"valid": False, "accuracy": 0.0, "fields": {}}
    assert specdata.score({"kit": "baska"}, example["spec"], example["mentioned"])["valid"] is False


def test_the_user_prompt_is_never_empty_and_not_absurdly_long(data):
    train, held = data
    for e in train + held:
        text = specdata.prompt_text(e)
        assert 5 < len(text) < 700
