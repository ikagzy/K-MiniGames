"""Prints the evaluation reports side by side (no GPU, no model; it only reads tools/train/data/report_*.json).

  python tools/train/summary.py
  python tools/train/summary.py --compare k-ai-v1-yeni-set k-ai-v2      (two reports side by side, by field and by hand-written prompt)
  python tools/train/summary.py --added   k-ai-v1-yeni-set k-ai-v2      (only what the second round added: new features, fox, campaign, music style)

Columns: valid = share of answers that are usable specs; accuracy = share of the asked-for fields the answer got right on the
generated set; hand = the hand-written prompts (all = prompts fully right, fields = single expectations right)."""
import argparse
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"


def by_field(report):
    out = {}
    for item in report["details"]["generated"]:
        for field, ok in item["fields"].items():
            out.setdefault(field, [0, 0])
            out[field][0] += bool(ok)
            out[field][1] += 1
    return out


def compare(a_name, b_name) -> int:
    a, b = (json.loads((DATA / f"report_{n}.json").read_text(encoding="utf-8")) for n in (a_name, b_name))
    fa, fb = by_field(a), by_field(b)
    print(f"{'field':14} {a_name[:18]:>18} {b_name[:18]:>18}   change")
    for field in sorted(set(fa) | set(fb), key=lambda f: (fb.get(f, [0, 1])[0] / fb.get(f, [0, 1])[1]) - (fa.get(f, [0, 1])[0] / fa.get(f, [0, 1])[1])):
        x, y = fa.get(field), fb.get(field)
        px = f"{x[0]}/{x[1]} {100 * x[0] // x[1]}%" if x else "-"
        py = f"{y[0]}/{y[1]} {100 * y[0] // y[1]}%" if y else "-"
        delta = f"{100 * y[0] / y[1] - 100 * x[0] / x[1]:+.0f}" if x and y else ""
        print(f"{field:14} {px:>18} {py:>18}   {delta}")
    print(f"\nhand-written prompts:{a_name} all {a['hand']['all_met']}, fields {a['hand']['fields_met']}  |  {b_name} all {b['hand']['all_met']}, fields {b['hand']['fields_met']}")
    ha, hb = a["details"]["hand"], b["details"]["hand"]
    for i, (x, y) in enumerate(zip(ha, hb)):
        if x["prompt"] == y["prompt"] and x["all"] != y["all"]:
            print(f"  {'now right' if y['all'] else 'now WRONG'}: {y['prompt'][:70]}")
    only_b = [y for y in hb[len(ha):]]
    if only_b:
        print(f"  ({len(only_b)} hand prompts exist only in {b_name}: {sum(y['all'] for y in only_b)} fully right)")
    return 0


NEW_FEATURES = {"spring", "dashPad", "rings", "checkpoint", "ice", "movingPlatforms"}


def added(a_name, b_name) -> int:
    """The things added in the second round (new features, the fox, the campaign, the music style), judged on the examples that
    ask for them, for two reports on the same evaluation set (eval.jsonl)."""
    truth = {}
    for line in (DATA / "eval.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            e = json.loads(line)
            truth[e["id"]] = e
    groups = {
        "new feature (spring, dashPad, rings, checkpoint, ice, movingPlatforms)": ("features", lambda s: NEW_FEATURES & set(s.get("features", []))),
        "the fox character (hero.character)": ("hero", lambda s: s.get("hero", {}).get("character")),
        "campaign (5-20 levels)": ("campaign", lambda s: "campaign" in s),
        "music style (mood, tempo)": ("musicStyle", lambda s: "musicStyle" in s),
    }
    reports = [json.loads((DATA / f"report_{n}.json").read_text(encoding="utf-8")) for n in (a_name, b_name)]
    print(f"{'what was added':72} {a_name[:14]:>14} {b_name[:14]:>14}")
    for label, (field, has) in groups.items():
        cells = []
        for r in reports:
            hit = total = 0
            for item in r["details"]["generated"]:
                e = truth.get(item["id"])
                if e and e["kind"] == "create" and has(e["spec"]) and field in item["fields"]:
                    total += 1
                    hit += bool(item["fields"][field])
            cells.append(f"{hit}/{total} {100 * hit // total}%" if total else "-")
        print(f"{label:72} {cells[0]:>14} {cells[1]:>14}")
    news = [h for h in reports[1]["details"]["hand"]][24:]
    olds = [h for h in reports[0]["details"]["hand"]][24:]
    print(f"\nhand-written prompts for the new things (the last {len(news)}): {a_name}: {sum(h['all'] for h in olds)}/{len(olds)} right   {b_name}: {sum(h['all'] for h in news)}/{len(news)} right")
    for h in news:
        print(f"  {'ok  ' if h['all'] else 'MISS'} {h['prompt'][:78]}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compare", nargs=2, metavar=("A", "B"))
    parser.add_argument("--added", nargs=2, metavar=("A", "B"), help="judge only the things added in the second round")
    args = parser.parse_args()
    if args.added:
        return added(*args.added)
    if args.compare:
        return compare(*args.compare)
    reports = sorted(DATA.glob("report_*.json"), key=lambda p: p.stat().st_mtime)
    if not reports:
        print("no reports yet in", DATA)
        return 1
    print(f"{'name':22} {'n':>4} {'valid':>6} {'accuracy':>9} {'hand n':>7} {'all':>6} {'fields':>7} {'sec':>5}")
    for path in reports:
        r = json.loads(path.read_text(encoding="utf-8"))
        g, h = r["generated"], r["hand"]
        print(f"{r['name']:22} {g['n']:>4} {g['valid']:>6} {g['accuracy']:>9} {h['n']:>7} {h['all_met']:>6} {h['fields_met']:>7} {r['seconds']:>5}")
    newest = json.loads(reports[-1].read_text(encoding="utf-8"))
    weak = {}
    for item in newest["details"]["generated"]:
        for field, ok in item["fields"].items():
            weak.setdefault(field, [0, 0])
            weak[field][0] += bool(ok)
            weak[field][1] += 1
    print(f"\nper field, {newest['name']} (worst first):")
    for field, (hit, total) in sorted(weak.items(), key=lambda kv: kv[1][0] / kv[1][1]):
        print(f"  {field:12} {hit}/{total}  {100 * hit // total}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
