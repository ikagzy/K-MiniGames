"""assets/ui (kaynak görseller) -> assets/runtime (uygulamanın kullandığı, sabit boyutlu görseller).

Tkinter görselleri yalnızca tam sayı oranlarında ölçekleyebildiği için boyutlar burada, Pillow ile önceden hazırlanır.
Çalıştırmak için: pip install -r requirements-tools.txt ; python tools/prepare_assets.py
Sahne sabit 1024x572'dir."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "src" / "k_minigames" / "assets"
SRC, OUT = ROOT / "ui", ROOT / "runtime"
STAGE = (1024, 572)
ADVISOR_SCALE = 0.7   # danışman, sahnedeki sandalyeye göre
BEAR_SCALE = 0.75     # ayı, lobinin zeminine göre


def scaled(image: Image.Image, scale: float) -> Image.Image:
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    Image.open(SRC / "lobi.png").convert("RGB").resize(STAGE, Image.LANCZOS).save(OUT / "lobi.png")
    Image.open(SRC / "sahne.png").convert("RGB").resize(STAGE, Image.LANCZOS).save(OUT / "danisman_sahne.png")
    Image.open(SRC / "diyalog.png").convert("RGBA").save(OUT / "diyalog.png")
    for folder, scale in (("danisman", ADVISOR_SCALE), ("maskot", BEAR_SCALE)):
        (OUT / folder).mkdir(exist_ok=True)
        for path in sorted((SRC / folder).glob("*.png")):
            scaled(Image.open(path), scale).save(OUT / folder / path.name)
    print("hazır:", OUT)


if __name__ == "__main__":
    main()
