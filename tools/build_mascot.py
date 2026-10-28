"""Tek sayfada gelen maskot pozlarını (damalı arka planlı, etiketli) ayrı, eşit boyutlu karelere böler.

Kullanım: python tools/build_mascot.py girdi.webp cikti_klasoru

Her poz: kutudan kesilir (etiket yazıları kutunun dışında kalır), damalı arka plan şeffaf yapılır,
kasket ucundan ayak tabanına kadar aynı boya ölçeklenir, ayaklar aynı çizgiye ve gövde (kasket)
aynı dikey eksene gelecek şekilde ortak bir tuvale yerleştirilir.
Bir kerelik geliştirme aracıdır, uygulamanın bağımlılığı değildir.
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import remove_checkerboard as rc  # noqa: E402

# ad: (sol, üst, sağ, alt) — etiket satırlarını dışarıda bırakacak şekilde, 1024x572 sayfa için
KUTULAR = {
    "bosta": (60, 30, 205, 282),
    "selamlama": (225, 30, 480, 282),
    "konusuyor_a": (560, 30, 760, 282),
    "konusuyor_b": (760, 30, 965, 282),
    "dusunuyor": (225, 316, 450, 522),
    "anladim": (470, 316, 615, 522),
    "veda": (660, 316, 820, 522),
}
HEDEF_BOY = 200  # kasket ucu - ayak tabanı, piksel
PAY = 6


def is_hat_red(p):
    r, g, b, a = p
    return a > 0 and r > 120 and g < 90 and b < 90


def yazi_parcalarini_sil(parca, en_cok=1500, oran=0.7):
    """Komşu etiketlerden kutuya taşan kopuk yazı parçalarını (beyaz+siyah, küçük) siler."""
    from collections import deque
    px = parca.load()
    w, h = parca.size
    gorulen = [[False] * w for _ in range(h)]
    for sy in range(h):
        for sx in range(w):
            if gorulen[sy][sx] or px[sx, sy][3] == 0:
                continue
            bilesen, q = [], deque([(sx, sy)])
            gorulen[sy][sx] = True
            while q:
                x, y = q.popleft()
                bilesen.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not gorulen[ny][nx] and px[nx, ny][3]:
                            gorulen[ny][nx] = True
                            q.append((nx, ny))
            if len(bilesen) > en_cok:
                continue
            yazi = sum(1 for x, y in bilesen
                       if min(px[x, y][:3]) >= 190 or max(px[x, y][:3]) <= 90)
            if yazi / len(bilesen) >= oran:
                for x, y in bilesen:
                    px[x, y] = (0, 0, 0, 0)


def ayir(sayfa, kutu):
    parca = sayfa.crop(kutu)
    yazi_parcalarini_sil(parca)
    kutu_alpha = parca.getchannel("A").getbbox()
    parca = parca.crop(kutu_alpha)
    px = parca.load()
    w, h = parca.size
    kirmizi = [(x, y) for y in range(h) for x in range(w) if is_hat_red(px[x, y])]
    satir = {}
    for _, y in kirmizi:
        satir[y] = satir.get(y, 0) + 1
    ust = min(y for y, n in satir.items() if n >= 6)   # ampul gibi tek tük kırmızı piksele aldanma
    kirmizi = [(x, y) for x, y in kirmizi if y >= ust]
    # kasket: en üstteki kırmızı bölgenin (üst %15) yatay merkezi
    kasket = [x for x, y in kirmizi if y < ust + max(6, int(0.12 * (h - ust)))]
    cx = sum(kasket) / len(kasket)
    return parca, ust, cx


def main(girdi, klasor):
    os.makedirs(klasor, exist_ok=True)
    sayfa = rc.remove(Image.open(girdi))
    parcalar = {}
    for ad, kutu in KUTULAR.items():
        parca, ust, cx = ayir(sayfa, kutu)
        boy = parca.height - ust            # kasket ucu -> en alt (ayak / bavul / tepsi alt)
        olcek = HEDEF_BOY / boy
        yeni = parca.convert("RGBa").resize(
            (max(1, round(parca.width * olcek)), max(1, round(parca.height * olcek))), Image.LANCZOS
        ).convert("RGBA")
        parcalar[ad] = (yeni, round(ust * olcek), cx * olcek)
        print(ad, "ölçek", round(olcek, 2))
    sol = max(cx for _, _, cx in parcalar.values())
    sag = max(im.width - cx for im, _, cx in parcalar.values())
    ust = max(u for _, u, _ in parcalar.values())          # kasket üstü ile görüntü üstü arası (ampul vb.)
    alt = max(im.height - u for im, u, _ in parcalar.values())
    W, H = round(sol + sag) + 2 * PAY, round(ust + alt) + 2 * PAY
    for ad, (im, u, cx) in parcalar.items():
        tuval = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        tuval.alpha_composite(im, (round(sol - cx) + PAY, round(ust - u) + PAY))
        yol = os.path.join(klasor, ad + ".png")
        tuval.save(yol)
        px = tuval.load()
        sat = {}
        for yy in range(H):
            sat[yy] = sum(1 for xx in range(W) if is_hat_red(px[xx, yy]))
        kirmizi_ust = min(yy for yy, n in sat.items() if n >= 6)
        alt_y = tuval.getchannel("A").getbbox()[3]
        print("  ", ad, "kasket ucu", kirmizi_ust, "alt", alt_y, "boy", alt_y - kirmizi_ust)
    print("tuval", W, "x", H)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
