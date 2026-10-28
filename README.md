# K-MiniGames

Kendi bilgisayarında, Ollama ile yerel yapay zekaya oyun yaptır. Oyunu tarif edersin; uygulama tek dosyalık HTML/JavaScript oyunu yazdırır, tarayıcıda dener, hata bulursa düzeltir ve kütüphanende saklar. İstediğin zaman "topu hızlandır" gibi isteklerle oyunu geliştirebilirsin.

- Windows masaüstü uygulaması (Python + tkinter), bulut ya da API anahtarı yok.
- Hiçbir şey sormadan indirilmez: Ollama, danışman modeli ve oyun modeli yalnızca onayınla kurulur. Bilgisayarında yeterli bir model zaten varsa önce onu kullanmayı önerir.
- Arayüz dili K-Series'te seçtiğin dili izler. K-Series, K-MiniGames'i otomatik algılar.

Tasarım: [docs/superpowers/specs/2026-10-28-k-minigames-design.md](docs/superpowers/specs/2026-10-28-k-minigames-design.md) · Plan: [docs/superpowers/plans/2026-10-28-k-minigames.md](docs/superpowers/plans/2026-10-28-k-minigames.md) · Görseller: [docs/ui-varliklari.md](docs/ui-varliklari.md)

## Geliştirme

```bash
pip install -r requirements.txt            # pytest, pyinstaller
python -m pytest -q                        # testler
python -m k_minigames                      # uygulamayı çalıştır (src klasöründen: PYTHONPATH=src)
python -m k_minigames --screen setup       # belirli bir ekranla aç: setup | advisor | library | studio
```

Exe derlemek için:

```bash
python tools/make_version.py k_minigames K-MiniGames K-MiniGames.exe build/version_kminigames.txt
python -m PyInstaller K-MiniGames.spec     # dist/K-MiniGames.exe
```

Görsel araçları (`tools/`: damalı arka planı temizleme, ayı karelerini bölme, çalışma görsellerini hazırlama, simge) Pillow ister: `pip install -r requirements-tools.txt`. Uygulamanın kendisi yalnızca standart kütüphaneyi kullanır.

## Atıflar

- Yazı tipi: The FontStruction “Determination” (https://fontstruct.com/fontstructions/show/2368299) by “anonymous-1438277”. Lisansı o sayfada yazılıdır; atıf burada (README) verilir ve yazı tipiyle birlikte `src/k_minigames/assets/fonts/LICENSE.txt` içinde durur. Uygulamanın penceresinde gösterilmez.
