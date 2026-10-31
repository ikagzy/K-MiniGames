"""Writes the training and evaluation data for the spec model (CPU only; nothing is downloaded and no model runs).

  python tools/train/make_dataset.py --train 800 --eval 120 --seed 0

Output (tools/train/data/, not in git): train.jsonl ({"messages": [...]} per line), eval.jsonl (full examples),
hand_eval.json (hand-written prompts and what they must give) and stats.json."""
import argparse
import json
from collections import Counter
from pathlib import Path

import random

import specdata
import specdata_shooter

OUT = Path(__file__).resolve().parent / "data"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=int, default=800)
    parser.add_argument("--eval", type=int, default=120)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--shooter", type=int, default=0, help="also write this many shooter-kit training examples (mixed in with the platformer ones)")
    parser.add_argument("--shooter-eval", type=int, default=0)
    args = parser.parse_args(argv)
    train, held = specdata.build_examples(args.train, args.eval, args.seed)
    for e in train + held:
        e["kit"] = "platformer"
    if args.shooter or args.shooter_eval:
        s_train, s_held = specdata_shooter.build_shooter_examples(args.shooter, args.shooter_eval, args.seed)
        train, held = train + s_train, held + s_held
        random.Random(args.seed).shuffle(train)
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "train.jsonl").open("w", encoding="utf-8") as f:
        for example in train:
            f.write(json.dumps({"messages": example["messages"]}, ensure_ascii=False) + "\n")
    with (OUT / "eval.jsonl").open("w", encoding="utf-8") as f:
        for example in held:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")
    (OUT / "hand_eval.json").write_text(json.dumps(specdata.HAND_EVAL + (specdata_shooter.HAND_EVAL_SHOOTER if args.shooter_eval else []), ensure_ascii=False, indent=1), encoding="utf-8")
    stats = {
        "train": len(train), "eval": len(held), "seed": args.seed,
        "kinds": dict(Counter(e["kind"] for e in train)), "languages": dict(Counter(e["lang"] for e in train)), "kits": dict(Counter(e["kit"] for e in train)),
        "themes": dict(Counter(e["spec"].get("theme", "(yok)") for e in train)),
        "prompt_chars_mean": round(sum(len(e["description"]) for e in train) / len(train), 1),
        "answer_chars_mean": round(sum(len(e["messages"][-1]["content"]) for e in train) / len(train), 1),
    }
    (OUT / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
