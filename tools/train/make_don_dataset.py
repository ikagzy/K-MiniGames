"""Writes Don's (the advisor's) training and evaluation data (CPU only):

  python tools/train/make_don_dataset.py --per-kit 300 --eval 40 --seed 0

Output in tools/train/data/don/ (not in git): train.jsonl ({"messages": [...]} per line) and eval.jsonl (full examples with what they must give)."""
import argparse
import json
from collections import Counter
from pathlib import Path

import specdata_don

OUT = Path(__file__).resolve().parent / "data" / "don"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-kit", type=int, default=300)
    parser.add_argument("--eval", type=int, default=40)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)
    train, held = specdata_don.build_don_examples(args.per_kit, args.eval, args.seed)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "train.jsonl").write_text("".join(json.dumps({"messages": e["messages"]}, ensure_ascii=False) + "\n" for e in train), encoding="utf-8")
    (OUT / "eval.jsonl").write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in held), encoding="utf-8")
    print(len(train), "train,", len(held), "eval;", dict(Counter((e["task"], e["kind"]) for e in train)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
