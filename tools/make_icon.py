"""Uygulama simgesi: ayının yüzünden kare bir .ico üretir (Pillow gerekir; çıktı repoda durur).

Kullanım: python tools/make_icon.py"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "src" / "k_minigames" / "assets"


def main() -> None:
    frame = Image.open(ROOT / "ui" / "maskot" / "basari.png").convert("RGBA")
    box = frame.getchannel("A").getbbox()
    face = frame.crop((box[0], box[1], box[2], box[1] + (box[2] - box[0])))      # the top square: hat and face
    side = max(face.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(face, ((side - face.width) // 2, (side - face.height) // 2))
    canvas.save(ROOT / "icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    print("yazıldı:", ROOT / "icon.ico")


if __name__ == "__main__":
    main()
