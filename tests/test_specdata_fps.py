import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "train"))

import specdata_fps as sd  # noqa: E402
from k_minigames import kits  # noqa: E402


@pytest.fixture(scope="module")
def data():
    return sd.build_fps_examples(n_train=240, n_eval=60, seed=7)


def test_the_data_is_the_same_every_time_for_the_same_seed():
    a = sd.build_fps_examples(30, 10, seed=3)
    b = sd.build_fps_examples(30, 10, seed=3)
    assert [e["description"] for e in a[0]] == [e["description"] for e in b[0]]
    assert [e["description"] for e in a[0]] != [e["description"] for e in sd.build_fps_examples(30, 10, seed=4)[0]]


def test_the_answers_are_small_valid_specs_with_no_seed(data):
    train, held = data
    for e in train + held:
        spec = e["spec"]
        assert spec["kit"] == "fps" and "seed" not in json.dumps(spec)
        assert set(spec) <= {"kit", "title", "theme", "musicStyle", "difficulty", "levels", "size", "mode", "map", "rounds", "ammo", "enemies", "weapons", "boss", "features"}
        assert set(spec.get("features", [])) <= set(sd.FEATURES) and set(spec.get("enemies", [])) <= set(sd.ENEMIES) and set(spec.get("weapons", [])) <= set(sd.WEAPONS)
        assert json.loads(e["messages"][-1]["content"]) == spec
        assert kits.repair_spec(json.loads(json.dumps(spec)), "fps")["kit"] == "fps"


def test_the_messages_are_what_the_app_sends_for_the_fps_kit(data):
    train, _ = data
    e = next(x for x in train if x["kind"] == "create")
    assert e["messages"][0]["role"] == "system" and "fps" in e["messages"][0]["content"].lower() and e["messages"][-2]["content"].endswith(e["description"]) or e["description"] in e["messages"][-2]["content"]
    assert e["messages"][-1]["role"] == "assistant"


def test_the_label_scores_itself_perfectly_and_a_wrong_answer_does_not(data):
    train, held = data
    for e in held[:30]:
        assert sd.score_fps(e["spec"], e["spec"], e["mentioned"])["accuracy"] == 1.0
    e = next(x for x in held if "theme" in x["mentioned"])
    wrong = dict(e["spec"], theme="lab" if e["spec"]["theme"] != "lab" else "bunker")
    assert sd.score_fps(wrong, e["spec"], ["theme"])["accuracy"] == 0.0
    assert sd.score_fps(None, e["spec"], e["mentioned"])["valid"] is False and sd.score_fps({"kit": "shooter"}, e["spec"], e["mentioned"])["valid"] is False


def test_every_field_and_both_kinds_of_example_appear_and_the_held_ones_are_new(data):
    train, held = data
    seen = {f for e in train for f in e["mentioned"]}
    assert {"theme", "difficulty", "levels", "size", "mode", "ammo", "enemies", "weapons", "boss", "features", "musicStyle", "title"} <= seen
    assert {e["kind"] for e in train} == {"create", "edit"}
    assert not ({e["description"] for e in held} & {e["description"] for e in train})
    assert {t for e in train for t in e["spec"].get("enemies", [])} == set(sd.ENEMIES) and {w for e in train for w in e["spec"].get("weapons", [])} == set(sd.WEAPONS)


def test_the_hand_written_expectations_check_what_they_say():
    assert sd.expect_ok_fps({"kit": "fps", "theme": "lab", "weapons": ["shotgun"], "difficulty": 5}, sd.HAND_EVAL_FPS[0]["expect"]) == {"theme": True, "weapons": True, "difficulty": True}
    assert sd.expect_ok_fps({"kit": "fps"}, sd.HAND_EVAL_FPS[0]["expect"])["theme"] is False
    assert all(item["kit"] == "fps" and item["prompt"] for item in sd.HAND_EVAL_FPS)
