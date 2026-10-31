import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "train"))

import specdata  # noqa: E402
import specdata_shooter as sd  # noqa: E402


@pytest.fixture(scope="module")
def data():
    return sd.build_shooter_examples(n_train=240, n_eval=60, seed=7)


def test_the_data_is_the_same_every_time_for_the_same_seed():
    a = sd.build_shooter_examples(30, 10, seed=3)
    b = sd.build_shooter_examples(30, 10, seed=3)
    assert [e["description"] for e in a[0]] == [e["description"] for e in b[0]]
    assert [e["description"] for e in a[0]] != [e["description"] for e in sd.build_shooter_examples(30, 10, seed=4)[0]]


def test_the_answers_are_small_valid_specs_with_no_seed(data):
    train, held = data
    for e in train + held:
        spec = e["spec"]
        assert spec["kit"] == "shooter" and "seed" not in json.dumps(spec) and "generate" not in spec
        assert set(spec) <= {"kit", "title", "theme", "musicStyle", "difficulty", "waves", "ship", "enemies", "boss", "features"}
        assert set(spec.get("features", [])) <= set(sd.FEATURES) and set(spec.get("enemies", [])) <= set(sd.KINDS)
        assert 3 <= spec.get("waves", {"count": 8})["count"] <= 20
        assert json.loads(e["messages"][-1]["content"]) == spec


def test_the_messages_are_what_the_app_sends_for_the_shooter(data):
    train, _ = data
    e = next(x for x in train if x["kind"] == "create")
    system, user, answer = e["messages"]
    assert "nişancı" in system["content"] and "Seviyeyi (levels)" not in system["content"]
    assert e["description"] in user["content"]
    edit = next(x for x in train if x["kind"] == "edit")
    assert json.dumps(edit["before"], ensure_ascii=False, indent=1) in edit["messages"][1]["content"]


def test_every_field_the_description_mentions_is_in_the_spec_and_the_other_way_round(data):
    train, _ = data
    for e in train:
        if e["kind"] == "create":
            assert set(e["mentioned"]) == set(sd._mentioned(e["spec"]))


def test_the_held_out_set_shares_no_description_with_training(data):
    train, held = data
    assert not {e["description"] for e in train} & {e["description"] for e in held}


def test_everything_the_kit_can_do_appears_in_training(data):
    train, _ = data
    assert {f for e in train for f in e["spec"].get("features", [])} == set(sd.FEATURES)
    assert {k for e in train for k in e["spec"].get("enemies", [])} == set(sd.KINDS)
    assert {e["spec"].get("theme") for e in train if "theme" in e["spec"]} == set(sd.THEMES)
    assert any(e["spec"].get("boss") for e in train) and any(e["spec"].get("boss") is False for e in train)
    assert {e["spec"]["ship"]["fire"] for e in train if "fire" in e["spec"].get("ship", {})} == {"single", "double", "spread"}


def test_scoring_rewards_the_right_choices_and_gives_nothing_for_unusable_answers():
    target = {"kit": "shooter", "theme": "cave", "boss": True, "ship": {"lives": 5}}
    good = sd.score_shooter({"kit": "shooter", "theme": "cave", "boss": True, "ship": {"lives": 5}}, target, ["theme", "boss", "lives"])
    assert good["accuracy"] == 1.0
    half = sd.score_shooter({"kit": "shooter", "theme": "cave", "ship": {"lives": 4}}, target, ["theme", "boss", "lives"])
    assert half["fields"] == {"theme": True, "boss": False, "lives": False}
    assert sd.score_shooter(None, target, ["theme"])["valid"] is False
    assert sd.score_shooter({"kit": "platformer"}, target, ["theme"])["valid"] is False
    assert sd.expect_ok_shooter({"kit": "shooter", "boss": False}, {"boss": False})["boss"] is True


def test_the_hand_written_prompts_never_appear_in_training():
    train, held = sd.build_shooter_examples(400, 40, seed=1)
    seen = {e["description"] for e in train + held}
    assert not [h["prompt"] for h in sd.HAND_EVAL_SHOOTER if h["prompt"] in seen]


def test_every_spec_is_accepted_by_the_real_shooter_kit(data, tmp_path):
    if not shutil.which("node"):
        pytest.skip("node is not installed")
    train, held = data
    path = tmp_path / "specs.json"
    path.write_text(json.dumps([e["spec"] for e in train + held]), encoding="utf-8")
    js = ("const { load } = require('./helpers'); const fs = require('fs');"
          "const K = load('kgame.js','kgame.sprites.js','kgame.animation.js','kgame.hud.js','kgame.audio2.js','kgame.kits.js','kgame.shooter.js');"
          "const specs = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); let bad = [];"
          "specs.forEach((s, i) => { const e = K.kit.check(s); if (e.length) bad.push(i + ': ' + e[0]); });"
          "console.log(JSON.stringify(bad));")
    root = Path(__file__).resolve().parent / "js"
    out = subprocess.check_output(["node", "-e", js, str(path)], cwd=str(root), text=True, encoding="utf-8")
    assert json.loads(out.strip().splitlines()[-1]) == []
