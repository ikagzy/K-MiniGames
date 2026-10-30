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

DATA = Path(__file__).resolve().parent / "data"


def ollama_answer(model: str):
    from k_minigames.generator import Generator, GenerationError
    from k_minigames.ollama_client import OllamaClient
    gen = Generator(OllamaClient(), model, keep_alive="2m")

    def ask(example_or_text):
        try:
            return gen.create_spec(example_or_text, "platformer")
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

    def ask(text):
        messages = specdata._messages("create", text, {"kit": "platformer"}, None)[:-1]
        ids = tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to("cuda")
        with torch.no_grad():
            out = net.generate(ids, max_new_tokens=900, do_sample=False)
        answer = tokenizer.decode(out[0][ids.shape[1]:], skip_special_tokens=True)
        try:
            return kits.parse_spec(answer, "platformer")
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
        pred = ask(example["description"])
        results.append(specdata.score(pred, example["spec"], example["mentioned"]) | {"id": example["id"]})
    hand = json.loads((DATA / "hand_eval.json").read_text(encoding="utf-8"))
    hand_results = []
    for item in hand:
        pred = ask(item["prompt"])
        met = specdata.expect_ok(pred, item["expect"])
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
