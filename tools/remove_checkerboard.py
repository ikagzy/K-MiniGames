"""Resme gömülü damalı (şeffaflık önizlemesi) arka planı gerçek şeffaflığa çevirir.

Kullanım:
  python tools/remove_checkerboard.py girdi.png cikti.png
  python tools/remove_checkerboard.py --ortak-kirp cikti_klasoru girdi1.png=ad1 girdi2.png=ad2 ...

Kenarlardan başlayıp dama grilerine benzeyen (renksiz, iki tonun arasında) pikselleri
şeffaf yapar; resmin içindeki gri/mor/siyah ayrıntılar dokunulmaz kalır. Sonra yalnızca
dama kalıntısı olan küçük kopuk parçaları siler (sarı ışıltı gibi renkli parçalar kalır).
--ortak-kirp: tüm karelerin birleşik sınırına kırpar; karakter kareler arasında kaymaz.
Bir kerelik geliştirme aracıdır, uygulamanın bağımlılığı değildir.
"""
import argparse
import os
from collections import deque

from PIL import Image

GRAY_SPREAD = 8     # R, G, B arası fark bundan küçükse "renksiz" sayılır
TOLERANCE = 14      # iki dama tonunun dışına taşabilecek pay
HALO_PASSES = 2     # şeffaf kenarda kalan yarı gri piksel temizliği
SPECK_MAX = 400     # bundan küçük kopuk parça "benek" adayıdır
SPECK_GRAY = 0.8    # benek adayının bu oranı dama grisiyse silinir


def two_tones(img):
    """Üst şeritteki gri değerleri iki kümeye böler (2-means), dama tonlarını verir.

    Yalnızca üst şerit kullanılır: alt/yan kenarlara değen çerçeve ya da karakter
    parçaları tonları kaydırıp gerçek beyaz/gri çizgilerin silinmesine yol açıyordu.
    """
    w, h = img.size
    px = img.load()
    vals = []
    for y in range(min(60, h)):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if max(r, g, b) - min(r, g, b) <= GRAY_SPREAD:
                vals.append(r)
    lo, hi = min(vals), max(vals)
    for _ in range(20):
        mid = (lo + hi) / 2
        a = [v for v in vals if v <= mid]
        b = [v for v in vals if v > mid]
        if not a or not b:
            break
        lo, hi = sum(a) / len(a), sum(b) / len(b)
    return lo, hi


def is_checker(p, lo, hi, spread=GRAY_SPREAD, tol=TOLERANCE):
    r, g, b = p[:3]
    if max(r, g, b) - min(r, g, b) > spread:
        return False
    return lo - tol <= r <= hi + tol


def flood_background(img, px, lo, hi):
    w, h = img.size
    seen = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y][x]:
            continue
        if not is_checker(px[x, y], lo, hi):
            continue
        seen[y][x] = True
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))


def strip_halo(img, px, lo, hi):
    w, h = img.size
    for _ in range(HALO_PASSES):
        kill = []
        for y in range(h):
            for x in range(w):
                if px[x, y][3] == 0:
                    continue
                if not is_checker(px[x, y], lo, hi, spread=GRAY_SPREAD + 6, tol=TOLERANCE + 14):
                    continue
                if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    kill.append((x, y))
        for x, y in kill:
            px[x, y] = (0, 0, 0, 0)


def strip_specks(img, px, lo, hi):
    """Küçük, kopuk ve çoğunlukla dama grisi olan parçaları siler."""
    w, h = img.size
    seen = [[False] * w for _ in range(h)]
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or px[sx, sy][3] == 0:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy][sx] = True
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny][3] != 0:
                            seen[ny][nx] = True
                            q.append((nx, ny))
            if len(comp) <= SPECK_MAX:
                grays = sum(1 for x, y in comp
                            if is_checker(px[x, y], lo, hi, spread=GRAY_SPREAD + 6, tol=TOLERANCE + 14))
                if grays / len(comp) >= SPECK_GRAY:
                    for x, y in comp:
                        px[x, y] = (0, 0, 0, 0)


def remove(img):
    """Tam boyutlu RGBA döndürür (kırpma yok)."""
    img = img.convert("RGBA")
    px = img.load()
    lo, hi = two_tones(img)
    flood_background(img, px, lo, hi)
    strip_halo(img, px, lo, hi)
    strip_specks(img, px, lo, hi)
    return img


def dense_box(img, ratio=0.25):
    """Tek tük kalmış beneklere aldırmadan, asıl şeklin sınırını verir (satır/sütun yoğunluğuna göre)."""
    a = img.getchannel("A")
    w, h = a.size
    data = a.load()
    rows = [sum(1 for x in range(w) if data[x, y]) for y in range(h)]
    cols = [sum(1 for y in range(h) if data[x, y]) for x in range(w)]
    ry = [y for y in range(h) if rows[y] >= ratio * max(rows)]
    cx = [x for x in range(w) if cols[x] >= ratio * max(cols)]
    if not ry or not cx:
        return a.getbbox()
    return (min(cx), min(ry), max(cx) + 1, max(ry) + 1)


def union_box(boxes):
    boxes = [b for b in boxes if b]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ortak-kirp", action="store_true")
    ap.add_argument("yollar", nargs="+")
    a = ap.parse_args()
    if a.ortak_kirp:
        klasor, *ciftler = a.yollar
        os.makedirs(klasor, exist_ok=True)
        islenen = []
        for cift in ciftler:
            girdi, ad = cift.rsplit("=", 1)
            islenen.append((ad, remove(Image.open(girdi))))
        kutu = union_box([im.getchannel("A").getbbox() for _, im in islenen])
        for ad, im in islenen:
            yol = os.path.join(klasor, ad + ".png")
            im.crop(kutu).save(yol)
            print(yol, kutu[2] - kutu[0], "x", kutu[3] - kutu[1])
    else:
        girdi, cikti = a.yollar
        out = remove(Image.open(girdi))
        box = dense_box(out)
        if box:
            out = out.crop(box)
        out.save(cikti)
        print(cikti, out.size)
