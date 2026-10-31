"""Measures a model as Don (the advisor) on the held-out set of specdata_don (needs a running Ollama; the model runs on the card/CPU):

  python tools/train/eval_don.py --model k-ai-chat --limit 80
  python tools/train/eval_don.py --model qwen3.5:4b --limit 40

Chat answers are judged by specdata_don.judge (asks stay short and without JSON, proposals end with a JSON line naming a catalog model);
module answers are asked with the same JSON schema as the app and must match exactly. Prints the share that passed and the time per answer."""
import argparse
import json
import random
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

import specdata_don
from k_minigames import advisor

DATA = Path(__file__).resolve().parent / "data" / "don" / "eval.jsonl"


def ask(model: str, messages: list, schema: dict | None, seed: int) -> str:
    body = {"model": model, "messages": messages, "stream": False, "options": {"num_ctx": 4096, "seed": seed}}
    if schema:
        body["format"] = schema
    request = urllib.request.Request("http://localhost:11434/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=900) as response:
        return json.load(response)["message"]["content"]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--limit", type=int, default=80)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", help="write the report here (json)")
    args = parser.parse_args(argv)
    rows = [json.loads(line) for line in DATA.read_text(encoding="utf-8").splitlines() if line.strip()]
    random.Random(args.seed).shuffle(rows)
    rows = rows[:args.limit]
    ask(args.model, [{"role": "user", "content": "merhaba"}], None, 0)   # loads the model: the first answer is not timed
    stats, times, failures = defaultdict(lambda: [0, 0, 0]), [], []
    for row in rows:
        schema = advisor.MODULE_SCHEMA if row["task"] == "modules" else None
        start = time.time()
        answer = ask(args.model, row["messages"][:-1], schema, args.seed)
        times.append(time.time() - start)
        verdict = specdata_don.judge(row["task"], row["kind"], row["expect"], answer)
        key = f'{row["task"]}/{row["kind"]}'
        stats[key][0] += 1
        stats[key][1] += bool(verdict["ok"])
        stats[key][2] += bool(verdict.get("exact_model", True))
        if not verdict["ok"] and len(failures) < 12:
            failures.append({"kind": key, "user": row["messages"][-2]["content"][:100], "answer": answer[:200], "verdict": verdict})
    report = {"model": args.model, "n": len(rows), "seconds_per_answer": round(sum(times) / len(times), 2),
              "by_kind": {k: {"n": v[0], "ok": round(v[1] / v[0], 3), "exact_model": round(v[2] / v[0], 3)} for k, v in sorted(stats.items())}, "failures": failures}
    print(json.dumps(report, ensure_ascii=False, indent=1))
    if args.out:
        Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
