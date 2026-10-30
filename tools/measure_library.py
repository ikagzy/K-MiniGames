"""Ölçüm: aynı oyun tarifini kütüphanesiz (eski) ve kütüphaneli (yeni) yöntemle üretir ve sonuçları karşılaştırır.

Kullanım:
  python tools/measure_library.py --model qwen2.5-coder:14b --recipe volleyball --runs 1
  python tools/measure_library.py --dry-run        (modele hiç gitmez; yalnızca istem boyutlarını yazar)

Gerçek koşu Ollama'nın açık olmasını ve modelin kurulu olmasını ister (indirme yapmaz) ve oyunu varsayılan tarayıcında
açar (sekme görünür kalmalı, yoklamalar bunu ister). Sonuçlar docs/olcum-kutuphane.md dosyasına eklenir."""
import argparse
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from k_minigames import generator, kgamelib, library, studio, testlist  # noqa: E402
from k_minigames.ollama_client import OllamaClient  # noqa: E402
from k_minigames.report_server import ReportServer  # noqa: E402

RECIPES = {
    "volleyball": ("İki kişilik bir mini voleybol oyunu. Oyuncu WASD ile kendi sahasında hareket eder ve fare sol tıklamasıyla "
                   "fare konumuna doğru topa vurur. Rakip bir bot, zorluk kolay. Sahanın ortasında file var, 15 puana kadar oynanır."),
    "platform": ("Basit bir platform oyunu. Oyuncu A ve D ile yürür, W ile zıplar. Sahada altınlar ve devriye gezen bir düşman "
                 "var; tüm altınları toplayınca oyun kazanılır, düşmana çarpınca kaybedilir."),
    "pong": "Klasik pong. Oyuncu W ve S ile sol raketi oynatır, sağ raketi bir bot oynatır. 5 puana kadar oynanır.",
}
MODES = {"old": [], "new": ["core", "ai", "sports"]}
REPORT = ROOT / "docs" / "olcum-kutuphane.md"


def prompt_sizes(recipe: str) -> dict[str, int]:
    text = RECIPES[recipe]
    return {mode: sum(len(m["content"]) for m in generator.build_create_messages(text, [], modules=modules))
            for mode, modules in MODES.items()}


def one_run(model: str, recipe: str, mode: str) -> dict:
    with tempfile.TemporaryDirectory() as folder:
        games = Path(folder) / "Oyunlar"
        games.mkdir()
        game = library.create_game(games, f"{recipe}-{mode}")
        modules = MODES[mode]
        if modules:
            library.set_modules(game, modules)
        server = ReportServer(game.folder)
        server.start()
        started, status = time.time(), []
        try:
            outcome = studio.create_game_flow(
                generator.Generator(OllamaClient(), model), game, RECIPES[recipe], [], server,
                __import__("webbrowser").open, lambda state, text: status.append(state), background=lambda *a: None)
        except generator.GenerationError as exc:
            return {"mode": mode, "error": str(exc), "seconds": round(time.time() - started)}
        finally:
            server.stop()
        counts = testlist.summary(outcome.report.items)
        problems = [p.kind for p in outcome.report.problems]
        kept = ROOT / "tools" / "_measure"
        kept.mkdir(exist_ok=True)
        (kept / f"{recipe}-{mode}.html").write_text(outcome.html, encoding="utf-8")
        return {"mode": mode, "passed": counts[testlist.PASSED], "unverified": counts[testlist.UNVERIFIED],
                "failed": counts[testlist.FAILED], "fixes": outcome.attempts, "js_errors": len(outcome.report.js_errors),
                "problems": problems, "chars": len(outcome.html), "seconds": round(time.time() - started)}


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="qwen2.5-coder:14b")
    parser.add_argument("--recipe", default="volleyball", choices=sorted(RECIPES))
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--modes", default="old,new", help="hangi yöntemler: old,new")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if args.dry_run:
        for recipe in sorted(RECIPES):
            sizes = prompt_sizes(recipe)
            print(f"{recipe}: eski istem {sizes['old']} karakter (~{sizes['old'] / 3.5:.0f} token), "
                  f"yeni istem {sizes['new']} karakter (~{sizes['new'] / 3.5:.0f} token; bağlam 8192)")
        return 0
    client = OllamaClient()
    if not client.is_running() or args.model not in client.models():
        print("Ollama çalışmıyor ya da model kurulu değil:", args.model)
        return 1
    rows = []
    for run in range(args.runs):
        for mode in args.modes.split(","):
            print(f"koşu {run + 1}/{args.runs}: {args.recipe} ({mode}) ...", flush=True)
            row = one_run(args.model, args.recipe, mode)
            print(row, flush=True)
            rows.append(row)
    lines = [f"\n## {time.strftime('%Y-%m-%d %H:%M')} — {args.model}, tarif: {args.recipe}\n",
             "| yöntem | geçti | doğrulanamadı | kaldı | düzeltme | JS hatası | sorunlar | süre (sn) |", "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        if "error" in r:
            lines.append(f"| {r['mode']} | hata: {r['error']} | | | | | | {r['seconds']} |")
        else:
            lines.append(f"| {r['mode']} | {r['passed']} | {r['unverified']} | {r['failed']} | {r['fixes']} | {r['js_errors']} | "
                         f"{', '.join(r['problems']) or '-'} | {r['seconds']} |")
    with REPORT.open("a", encoding="utf-8") as out:
        out.write("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
