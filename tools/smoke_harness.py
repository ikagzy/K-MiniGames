"""Elle doğrulama: küçük bir oyunu rapor sunucusuyla açar ve tarayıcıdan gelen olayları yazdırır.

Kullanım: python tools/smoke_harness.py [--no-open]
  --no-open  tarayıcıyı açmaz, yalnızca adresi yazdırır (adresi kendin bir tarayıcıda aç).
Beklenen çıktı: en az bir `error`, geçen bir `test` (passed: true) ve `done`."""
import sys
import tempfile
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from k_minigames.harness import TestSpec, inject  # noqa: E402
from k_minigames.report_server import ReportServer  # noqa: E402

GAME = """<!doctype html><html><head><title>Duman testi</title></head><body>
<canvas id="c" width="200" height="100"></canvas>
<img src="assets/yok.png">
<script>
window.__game = {score: 3};
setTimeout(function () { undefinedFunction(); }, 200);   // bilerek hatali satir
</script></body></html>"""


def main(argv: list[str]) -> int:
    with tempfile.TemporaryDirectory() as folder:
        server = ReportServer(Path(folder))
        server.start()
        try:
            server.set_page(inject(GAME, f"http://127.0.0.1:{server.port}/report/{server.token}", [
                TestSpec("skor", "return game.score === 3;"),
                TestSpec("bos", "return true;"),
            ]))
            print("Adres:", server.page_url())
            if "--no-open" not in argv:
                webbrowser.open(server.page_url())
            done = server.wait_for("done", 60)
            for event in server.events():
                print(event)
            print("done geldi" if done else "done GELMEDI (zaman aşımı)")
            return 0 if done else 1
        finally:
            server.stop()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
