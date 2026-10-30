"""Prints the evaluation reports side by side (no GPU, no model; it only reads tools/train/data/report_*.json).

  python tools/train/summary.py

Columns: valid = share of answers that are usable specs; accuracy = share of the asked-for fields the answer got right on the
generated set; hand = the hand-written prompts (all = prompts fully right, fields = single expectations right)."""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"


def main() -> int:
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
