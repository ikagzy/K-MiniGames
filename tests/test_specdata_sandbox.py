import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "train"))

import specdata_sandbox as sd  # noqa: E402


@pytest.fixture(scope="module")
def data():
    return sd.build_sandbox_examples(n_train=240, n_eval=60, seed=7)


def test_the_data_is_the_same_every_time_for_the_same_seed():
    a = sd.build_sandbox_examples(30, 10, seed=3)
    b = sd.build_sandbox_examples(30, 10, seed=3)
    assert [e["description"] for e in a[0]] == [e["description"] for e in b[0]]
    assert [e["description"] for e in a[0]] != [e["description"] for e in sd.build_sandbox_examples(30, 10, seed=4)[0]]


def test_the_answers_are_small_valid_specs_with_no_seed(data):
    train, held = data
    for e in train + held:
        spec = e["spec"]
        assert spec["kit"] == "sandbox" and "seed" not in json.dumps(spec) and "world" not in spec and "generate" not in spec
        assert set(spec) <= {"kit", "title", "biome", "size", "caves", "ores", "trees", "lakes", "time", "musicStyle", "features"}
        assert json.loads(e["messages"][-1]["content"]) == spec


def test_the_messages_are_what_the_app_sends_for_the_sandbox(data):
    train, _ = data
    e = next(x for x in train if x["kind"] == "create")
    system, user, answer = e["messages"]
    assert "küp dünya" in system["content"] and "Seviyeyi (levels)" not in system["content"]
    assert e["description"] in user["content"]


def test_every_field_the_description_mentions_is_in_the_spec(data):
    train, _ = data
    for e in train:
        if e["kind"] == "create":
            assert set(e["mentioned"]) == set(sd._mentioned(e["spec"]))


def test_the_held_out_set_shares_no_description_with_training(data):
    train, held = data
    assert not {e["description"] for e in train} & {e["description"] for e in held}


def test_everything_the_kit_can_do_appears_in_training(data):
    train, _ = data
    assert {e["spec"].get("biome") for e in train if "biome" in e["spec"]} == set(sd.BIOMES)
    assert {e["spec"].get("size") for e in train if "size" in e["spec"]} == set(sd.SIZES)
    assert {f for e in train for f in e["spec"].get("features", [])} == set(sd.FEATURES)
    assert {e["spec"]["caves"] for e in train if "caves" in e["spec"]} == {0, 1, 2, 3}
    assert {e["spec"]["time"] for e in train if "time" in e["spec"]} == {"cycle", "day", "night"}
    assert {e["spec"]["lakes"] for e in train if "lakes" in e["spec"]} == {True, False}


def test_scoring_and_the_hand_written_prompts():
    target = {"kit": "sandbox", "biome": "snow", "caves": 3}
    assert sd.score_sandbox({"kit": "sandbox", "biome": "snow", "caves": 3}, target, ["biome", "caves"])["accuracy"] == 1.0
    assert sd.score_sandbox({"kit": "sandbox", "biome": "snow"}, target, ["biome", "caves"])["fields"] == {"biome": True, "caves": False}
    assert sd.score_sandbox({"kit": "shooter"}, target, ["biome"])["valid"] is False
    assert sd.expect_ok_sandbox({"kit": "sandbox", "time": "day"}, {"time": "day"})["time"] is True
    train, held = sd.build_sandbox_examples(400, 40, seed=1)
    seen = {e["description"] for e in train + held}
    assert not [h["prompt"] for h in sd.HAND_EVAL_SANDBOX if h["prompt"] in seen]


def test_every_spec_is_accepted_by_the_real_sandbox_kit(data, tmp_path):
    if not shutil.which("node"):
        pytest.skip("node is not installed")
    train, held = data
    path = tmp_path / "specs.json"
    path.write_text(json.dumps([e["spec"] for e in train + held]), encoding="utf-8")
    js = ("const { load } = require('./helpers'); const fs = require('fs');"
          "const K = load('kgame.js','kgame.audio2.js','kgame.kits.js','kgame.voxel.js');"
          "const specs = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); let bad = [];"
          "specs.forEach((s, i) => { const e = K.kit.check(s); if (e.length) bad.push(i + ': ' + e[0]); });"
          "console.log(JSON.stringify(bad));")
    root = Path(__file__).resolve().parent / "js"
    out = subprocess.check_output(["node", "-e", js, str(path)], cwd=str(root), text=True, encoding="utf-8")
    assert json.loads(out.strip().splitlines()[-1]) == []
