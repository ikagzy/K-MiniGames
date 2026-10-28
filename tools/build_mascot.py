"""Düz magenta zeminli maskot ızgarasını (4 sütun x 3 satır) ayrı, eşit boyutlu karelere böler.

Kullanım: python tools/build_mascot.py girdi.webp cikti_klasoru

Magenta zemin kenarlardan başlayıp şeffaf yapılır, kenardaki pembemsi artıklar silinir.
Her hücre kasket ucundan ayak tabanına aynı boya ölçeklenir; kasket aynı dikey eksene,
ayaklar aynı çizgiye gelecek şekilde ortak bir tuvale yerleştirilir.
Bir kerelik geliştirme aracıdır, uygulamanın bağımlılığı değildir.
"""
import os
import sys
from collections import deque

from PIL import Image

SUTUN, SATIR = 4, 3
# ızgara sırası: soldan sağa, yukarıdan aşağıya
ADLAR = [
    "bosta", "konusuyor_a", "selamlama", "veda",
    "dinliyor", "dusunuyor", "anladim", "test_ediyor",
    "basari", "hata", "emin_degil", "konusuyor_b",
]
PAY = 6
ZEMIN_FARK = 110   # r-g ve b-g bundan büyükse zemin (magenta)
HALE_FARK = 45     # kenar artığı: r-g ve b-g bundan büyükse pembemsi sayılır


def pembe(p, fark):
    r, g, b = p[:3]
    return r - g > fark and b - g > fark


def zemini_sil(img):
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    gorulen = [[False] * w for _ in range(h)]
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
              + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or gorulen[y][x] or not pembe(px[x, y], ZEMIN_FARK):
            continue
        gorulen[y][x] = True
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    for y in range(h):  # kol ile kafa arasında kapalı kalan zemin ceplerini de sil
        for x in range(w):
            if px[x, y][3] and pembe(px[x, y], ZEMIN_FARK):
                px[x, y] = (0, 0, 0, 0)
    for _ in range(2):  # şeffafa komşu pembemsi kenar artıkları
        sil = [(x, y) for y in range(h) for x in range(w)
               if px[x, y][3] and pembe(px[x, y], HALE_FARK)
               and any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for x, y in sil:
            px[x, y] = (0, 0, 0, 0)
    return img


def kasket_kirmizi(p):
    r, g, b, a = p
    return a > 0 and r > 100 and g < 80 and b < 80 and r - g > 60


def olc(hucre):
    """(kasket üst y, kasket merkez x, alt y) — kırpılmış hücre için."""
    px = hucre.load()
    w, h = hucre.size
    satir = {}
    for y in range(h):
        n = sum(1 for x in range(w) if kasket_kirmizi(px[x, y]))
        if n:
            satir[y] = n
    ust = min(y for y, n in satir.items() if n >= 6)
    alt = hucre.getchannel("A").getbbox()[3]
    kasket = [x for y in range(ust, min(h, ust + 14)) for x in range(w) if kasket_kirmizi(px[x, y])]
    return ust, sum(kasket) / len(kasket), alt


def main(girdi, klasor):
    os.makedirs(klasor, exist_ok=True)
    sayfa = zemini_sil(Image.open(girdi))
    W, H = sayfa.size
    hw, hh = W / SUTUN, H / SATIR
    kareler = {}
    for i, ad in enumerate(ADLAR):
        c, r = i % SUTUN, i // SUTUN
        hucre = sayfa.crop((round(c * hw), round(r * hh), round((c + 1) * hw), round((r + 1) * hh)))
        hucre = hucre.crop(hucre.getchannel("A").getbbox())
        ust, cx, alt = olc(hucre)
        kareler[ad] = (hucre, ust, cx, alt - ust)
    boylar = sorted(b for *_, b in kareler.values())
    hedef = boylar[len(boylar) // 2]
    print("ölçülen boylar:", {a: v[3] for a, v in kareler.items()}, "hedef", hedef)
    olcekli = {}
    for ad, (hucre, ust, cx, boy) in kareler.items():
        o = hedef / boy
        yeni = hucre.convert("RGBa").resize(
            (max(1, round(hucre.width * o)), max(1, round(hucre.height * o))), Image.LANCZOS
        ).convert("RGBA")
        olcekli[ad] = (yeni, round(ust * o), cx * o)
    sol = max(cx for _, _, cx in olcekli.values())
    sag = max(im.width - cx for im, _, cx in olcekli.values())
    ust = max(u for _, u, _ in olcekli.values())
    alt = max(im.height - u for im, u, _ in olcekli.values())
    TW, TH = round(sol + sag) + 2 * PAY, round(ust + alt) + 2 * PAY
    for ad, (im, u, cx) in olcekli.items():
        tuval = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
        tuval.alpha_composite(im, (round(sol - cx) + PAY, round(ust - u) + PAY))
        tuval.save(os.path.join(klasor, ad + ".png"))
    print("tuval", TW, "x", TH)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
