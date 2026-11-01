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
import specdata_fps
import specdata_fighter
import specdata_football
import specdata_adventure
import specdata_blast
import specdata_puzzle
import specdata_race
import specdata_sandbox
import specdata_shooter
import specdata_tower

OUT = Path(__file__).resolve().parent / "data"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=int, default=800)
    parser.add_argument("--eval", type=int, default=120)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--shooter", type=int, default=0, help="also write this many shooter-kit training examples (mixed in with the platformer ones)")
    parser.add_argument("--shooter-eval", type=int, default=0)
    parser.add_argument("--sandbox", type=int, default=0, help="also this many cube-world (sandbox kit) training examples")
    parser.add_argument("--sandbox-eval", type=int, default=0)
    parser.add_argument("--fps", type=int, default=0, help="also this many first person shooter (fps kit) training examples")
    parser.add_argument("--fps-eval", type=int, default=0)
    parser.add_argument("--race", type=int, default=0, help="also this many racing (race kit) training examples")
    parser.add_argument("--race-eval", type=int, default=0)
    parser.add_argument("--football", type=int, default=0, help="also this many football (football kit) training examples")
    parser.add_argument("--football-eval", type=int, default=0)
    parser.add_argument("--puzzle", type=int, default=0, help="also this many puzzle (puzzle kit) training examples")
    parser.add_argument("--puzzle-eval", type=int, default=0)
    parser.add_argument("--adventure", type=int, default=0, help="also this many adventure (adventure kit) training examples")
    parser.add_argument("--adventure-eval", type=int, default=0)
    parser.add_argument("--tower", type=int, default=0, help="also this many tower defence (tower kit) training examples")
    parser.add_argument("--tower-eval", type=int, default=0)
    parser.add_argument("--fighter", type=int, default=0, help="also this many fighting (fighter kit) training examples")
    parser.add_argument("--fighter-eval", type=int, default=0)
    parser.add_argument("--blast", type=int, default=0, help="also this many block blast (blast kit) training examples")
    parser.add_argument("--blast-eval", type=int, default=0)
    args = parser.parse_args(argv)
    train, held = specdata.build_examples(args.train, args.eval, args.seed)
    for e in train + held:
        e["kit"] = "platformer"
    if args.shooter or args.shooter_eval:
        s_train, s_held = specdata_shooter.build_shooter_examples(args.shooter, args.shooter_eval, args.seed)
        train, held = train + s_train, held + s_held
    if args.sandbox or args.sandbox_eval:
        b_train, b_held = specdata_sandbox.build_sandbox_examples(args.sandbox, args.sandbox_eval, args.seed)
        train, held = train + b_train, held + b_held
    if args.fps or args.fps_eval:
        f_train, f_held = specdata_fps.build_fps_examples(args.fps, args.fps_eval, args.seed)
        train, held = train + f_train, held + f_held
    if args.race or args.race_eval:
        r_train, r_held = specdata_race.build_race_examples(args.race, args.race_eval, args.seed)
        train, held = train + r_train, held + r_held
    if args.football or args.football_eval:
        t_train, t_held = specdata_football.build_football_examples(args.football, args.football_eval, args.seed)
        train, held = train + t_train, held + t_held
    if args.puzzle or args.puzzle_eval:
        z_train, z_held = specdata_puzzle.build_puzzle_examples(args.puzzle, args.puzzle_eval, args.seed)
        train, held = train + z_train, held + z_held
    if args.adventure or args.adventure_eval:
        a_train, a_held = specdata_adventure.build_adventure_examples(args.adventure, args.adventure_eval, args.seed)
        train, held = train + a_train, held + a_held
    if args.tower or args.tower_eval:
        w_train, w_held = specdata_tower.build_tower_examples(args.tower, args.tower_eval, args.seed)
        train, held = train + w_train, held + w_held
    if args.fighter or args.fighter_eval:
        d_train, d_held = specdata_fighter.build_fighter_examples(args.fighter, args.fighter_eval, args.seed)
        train, held = train + d_train, held + d_held
    if args.blast or args.blast_eval:
        b_train, b_held = specdata_blast.build_blast_examples(args.blast, args.blast_eval, args.seed)
        train, held = train + b_train, held + b_held
    random.Random(args.seed).shuffle(train)
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "train.jsonl").open("w", encoding="utf-8") as f:
        for example in train:
            f.write(json.dumps({"messages": example["messages"]}, ensure_ascii=False) + "\n")
    with (OUT / "eval.jsonl").open("w", encoding="utf-8") as f:
        for example in held:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")
    (OUT / "hand_eval.json").write_text(json.dumps(specdata.HAND_EVAL + (specdata_shooter.HAND_EVAL_SHOOTER if args.shooter_eval else []) + (specdata_sandbox.HAND_EVAL_SANDBOX if args.sandbox_eval else []) + (specdata_fps.HAND_EVAL_FPS if args.fps_eval else []) + (specdata_race.HAND_EVAL_RACE if args.race_eval else []) + (specdata_football.HAND_EVAL_FOOTBALL if args.football_eval else []) + (specdata_puzzle.HAND_EVAL_PUZZLE if args.puzzle_eval else []) + (specdata_adventure.HAND_EVAL_ADVENTURE if args.adventure_eval else []) + (specdata_tower.HAND_EVAL_TOWER if args.tower_eval else []) + (specdata_fighter.HAND_EVAL_FIGHTER if args.fighter_eval else []) + (specdata_blast.HAND_EVAL_BLAST if args.blast_eval else []), ensure_ascii=False, indent=1), encoding="utf-8")
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
