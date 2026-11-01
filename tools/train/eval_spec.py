"""Judges a model on writing game specs: the generated evaluation set (pairs and wordings training never showed) and the
hand-written prompts. Two backends (GPU; run them only when the user agrees):

  python tools/train/eval_spec.py --backend ollama --model qwen2.5:3b --name base3b        (what the app does: JSON schema on)
  <venv>/Scripts/python.exe tools/train/eval_spec.py --backend hf --model <base> --adapter tools/train/out/pilot --name pilot

Reports go to tools/train/data/report_<name>.json. Only what the prompt asked for is judged (specdata.score)."""
import argparse
import json
import sys
import time
from pathlib import Path

import specdata
import specdata_sandbox
import specdata_fps
import specdata_football
import specdata_adventure
import specdata_puzzle
import specdata_race
import specdata_shooter

KITS = {   # per kit: how the app's messages are made for it, how a generated example is scored, how a hand-written expectation is checked
    "platformer": (specdata._messages, specdata.score, specdata.expect_ok),
    "shooter": (specdata_shooter.messages, specdata_shooter.score_shooter, specdata_shooter.expect_ok_shooter),
    "sandbox": (specdata_sandbox.messages, specdata_sandbox.score_sandbox, specdata_sandbox.expect_ok_sandbox),
    "fps": (specdata_fps.messages, specdata_fps.score_fps, specdata_fps.expect_ok_fps),
    "adventure": (specdata_adventure.messages, specdata_adventure.score_adventure, specdata_adventure.expect_ok_adventure),
    "puzzle": (specdata_puzzle.messages, specdata_puzzle.score_puzzle, specdata_puzzle.expect_ok_puzzle),
    "race": (specdata_race.messages, specdata_race.score_race, specdata_race.expect_ok_race),
    "football": (specdata_football.messages, specdata_football.score_football, specdata_football.expect_ok_football),
}

DATA = Path(__file__).resolve().parent / "data"


def ollama_answer(model: str):
    from k_minigames.generator import Generator, GenerationError
    from k_minigames.ollama_client import OllamaClient
    gen = Generator(OllamaClient(), model, keep_alive="2m")

    def ask(example_or_text, kit="platformer"):
        try:
            return gen.create_spec(example_or_text, kit)
        except GenerationError:
            return None
    return ask


def hf_answer(model: str, adapter: str | None):
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from k_minigames import kits
    tokenizer = AutoTokenizer.from_pretrained(model)
    net = AutoModelForCausalLM.from_pretrained(model, torch_dtype=torch.bfloat16, attn_implementation="sdpa").to("cuda")
    if adapter:
        net = PeftModel.from_pretrained(net, adapter)
    net.eval()

    def ask(text, kit="platformer"):
        messages = KITS[kit][0]("create", text, {"kit": kit}, None)[:-1]
        ids = tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt", return_dict=True)["input_ids"].to("cuda")
        with torch.no_grad():
            out = net.generate(ids, max_new_tokens=900, do_sample=False)
        answer = tokenizer.decode(out[0][ids.shape[1]:], skip_special_tokens=True)
        try:
            return kits.parse_spec(answer, kit)
        except kits.SpecError:
            return None
    return ask


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", choices=("ollama", "hf"), required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--adapter")
    parser.add_argument("--name", required=True)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args(argv)
    ask = ollama_answer(args.model) if args.backend == "ollama" else hf_answer(args.model, args.adapter)

    held = [json.loads(line) for line in (DATA / "eval.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    held = [e for e in held if e["kind"] == "create"]
    if args.limit:
        held = held[:args.limit]
    started, results = time.time(), []
    for example in held:
        kit = example.get("kit", "platformer")
        pred = ask(example["description"], kit)
        scorer = KITS[kit][1]
        results.append(scorer(pred, example["spec"], example["mentioned"]) | {"id": example["id"], "kit": kit})
    hand = json.loads((DATA / "hand_eval.json").read_text(encoding="utf-8"))
    hand_results = []
    for item in hand:
        kit = item.get("kit", "platformer")
        pred = ask(item["prompt"], kit)
        met = KITS[kit][2](pred, item["expect"])
        hand_results.append({"prompt": item["prompt"], "met": met, "all": all(met.values()) if met else pred is not None})
    valid = sum(r["valid"] for r in results) / max(1, len(results))
    report = {
        "name": args.name, "model": args.model, "adapter": args.adapter, "seconds": round(time.time() - started),
        "generated": {"n": len(results), "valid": round(valid, 3),
                      "accuracy": round(sum(r["accuracy"] for r in results) / max(1, len(results)), 3)},
        "hand": {"n": len(hand_results), "all_met": round(sum(r["all"] for r in hand_results) / max(1, len(hand_results)), 3),
                 "fields_met": round(sum(v for r in hand_results for v in r["met"].values()) / max(1, sum(len(r["met"]) for r in hand_results)), 3)},
        "details": {"generated": results, "hand": hand_results},
    }
    (DATA / f"report_{args.name}.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("name", "model", "seconds", "generated", "hand")}, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
