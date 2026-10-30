# K-MiniGames: devir notu (başka bir yapay zekâ/kişi devam edebilsin diye)

Son güncelleme: 2026-10-30. Konuşma dili Türkçe. Depo: `...\K-MiniGames` (Windows, Python 3.11+, tkinter, PyInstaller). Hiçbir şey push edilmedi; her şey yerel commit'lerde (`git log --oneline` ile gör). Kuralların kaynağı: `CLAUDE.md`, `docs/HAFIZA.md`, `docs/CHECKPOINTS.md` (her iş bitince commit + CP satırı + HAFIZA güncellemesi).

## 1. Proje nedir
Kullanıcı bilgisayarında Ollama ile yerel yapay zekâya oyun yaptıran masaüstü uygulaması. Kullanıcı oyunu tarif eder, model tek sayfalık HTML/JS oyun yazar, uygulama tarayıcıda dener, hata bulursa en fazla 3 kez düzelttirir, oyunu kütüphanede saklar. Karakterler: **Don** (mor resepsiyonist, danışman: konuşur, model önerir, kurulum izni ister) ve **Bob** (otel görevlisi ayı: oyunu üretir/düzenler/düzeltir). Yazı tipi Determination (atıf README'de). K-Series (K-Optimizer deposunda) K-MiniGames kartını gösterir.
Ayrıntı: `docs/superpowers/specs/2026-10-28-k-minigames-design.md`, plan `docs/superpowers/plans/2026-10-28-k-minigames.md`, görsel tablo `docs/ui-varliklari.md`.

## 2. Nasıl çalıştırılır / test edilir / derlenir
- Testler (depo kökünden): `python -m pytest -q` (şu an 438 Python testi; içinde `tests/test_kgame_js.py` Node ile 69 JS testini de çalıştırır, Node yoksa atlar). Yalnızca JS: `node --test "tests/js/*.test.js"` (Node 24 kurulu).
- Uygulamayı çalıştırmak: `python -m k_minigames` (src klasörü `PYTHONPATH=src`). Derleme: `python tools/make_version.py k_minigames K-MiniGames K-MiniGames.exe build/version_kminigames.txt` sonra `python -m PyInstaller K-MiniGames.spec --noconfirm` → `dist\K-MiniGames.exe`. Çalışan exe dosyayı kilitler: önce `taskkill //IM K-MiniGames.exe //F`.
- Ollama: `http://127.0.0.1:11434`. Bilgisayarda kurulu modeller: qwen2.5-coder:14b (oyun yazıcı, ~9 GB), gemma3:4b, qwen2.5:3b, llama3/3.1:8b, qwen3.5:4b (danışman varsayılanı). İndirme her zaman kullanıcı onayı ister.
- Gerçek tarayıcı testi: `src/k_minigames/harness.py` yoklamaları görünür bir sekme ister; arka plan sekmede atlanır. Claude'un tarayıcı panelinde `requestAnimationFrame` çalışmaz (örneklerde `setTimeout` vekili kullanıldı).

## 3. Yapılanlar (özet, sırayla)
1. Çekirdek uygulama (CP-0…CP-31): Ollama istemcisi, kurulum/izin akışı, danışman, üret→dene→düzelt döngüsü, rapor sunucusu, test listesi (`testler.json`), sürümler, dokular, hafıza, K-Series entegrasyonu.
2. Bu oturum (CP-32…CP-49): giriş ekranı (Başla/Ayarlar/Çıkış; Başla yalnızca Ollama çalışıyor ve danışman modeli kuruluysa görünür), Ayarlar (Ollama + danışman kurulumu, klasör, hafızayı sil), siyahtan açılma animasyonu, karakterler adlarını söyler, uzun mesajlar sayfalanır (◀ ▶), Don→Bob devri (Bob Don'un hafıza notunu okur), oyun yoksa Başla Don'a gider, cmd pencereleri (Ollama `DETACHED_PROCESS` kaldırıldı), danışman kullanıcının dilinde cevap verir.
3. **Akıllı denetçi** (`harness.py` + `checker.py`): boş ekran, tuş/fare etkisi, NaN durum, büyüyen liste, düz giden top, topa tepki vermeyen bot, hata satırı kod parçasıyla; modelin "geçti" dediği ama yoklamayla çelişen maddeler "doğrulanamadı" olur. Mantık yoklaması oyun bitmeden önce çalışır. Yoklama kırılırsa `probe_error` olayı gönderir (checker yok sayar).
4. **Oyun kütüphanesi** (`src/k_minigames/assets/lib/`): `kgame.js` (2B çekirdek), `kgame.ai.js` (bot), `kgame.sports.js` (voleybol/pong/futbol/basketbol), `*.guide.md` kılavuzları, `examples/` (voleybol, pong, platform). Python tarafı: `kgamelib.py` (modül kaydı, `install`, `ensure_scripts`, `guides`), `patching.py` (bul/değiştir yamaları), `generator.py` (kütüphaneli istemler), `advisor.choose_modules`, `library.modules/set_modules` (`game.json`), `htmlscan` (`K.expose` ve `CONFIG` JSON kontrolü), `report_server` (kütüphane betiklerini oyun klasöründen sunar), exe'ye paketlendi.
   Tasarım: `docs/superpowers/specs/2026-10-30-oyun-kutuphanesi-design.md`; plan: `docs/superpowers/plans/2026-10-30-oyun-kutuphanesi.md` (G1–G15 yapıldı).
5. Bağımsız inceleme yapıldı; 9 bulgudan Önemli olanlar ve 6, 7, 9 testle düzeltildi (yorumdaki `<script>`, çarpışma anahtarı, zamanlayıcılar, hızlı tıklama, yarım yama, futbolda vuruş). **Ertelenen küçük bulgu:** modelin `texture: 'assets/x.png'` (yol dizgesi) vermesi kutu olarak çiziliyor (`kgame.js` draw yalnızca `texture.canvas` çiziyor).

## 4. Ölçüm sonuçları (`docs/olcum-kutuphane.md`, qwen2.5-coder:14b)
| tarif | yöntem | geçti | doğrulanamadı | düzeltme | süre |
|---|---|---|---|---|---|
| voleybol | eski | 0 | 5 | 1 | 458 sn |
| voleybol | yeni (düzeltilmemiş denetçi) | 1 | 4 | 3 | 659 sn |
| voleybol | yeni (düzeltilmiş denetçi) | 0 | 5 | 0 | 161 sn |
| platform | eski | 0 | 4 | 0 | 211 sn (probe_keys uyarısı) |
| platform | yeni | 1 | 4 | 3 | 851 sn (probe_mouse uyarısı) |
Dürüst yorum: **oyun kalitesi/hız farkı net değil**. Voleybolda model kılavuzdaki örneği neredeyse aynen kopyaladı (çalışıyor ama genelleme göstermez); platformda yeni yöntem 3 düzeltme harcadı ve daha yavaştı. "Geçen madde" sayısı modelin yazdığı testlerin kalitesine bağlı, bu yüzden güvenilir ölçüt değil. Daha iyi ölçüt: üretilen oyunu elle oynamak ve denetçinin bulgularını (hata/uyarı) saymak. `tools/_measure/` altında üretilen oyunlar var (git'te yok).

## 5. Sıradaki işler (öncelik sırasıyla)
1. Ölçümü genişlet: farklı tarifler (platform, pong, uzay nişancısı, bulmaca) ve küçük modeller (3B/7B, kullanıcı izniyle) ile eski/yeni karşılaştır; 3 düzeltmenin nedenini bul (platform koşusunda hangi bulgular modele gitti?).
2. Karar: ölçüm anlamlıysa spec §2'deki sıra: seviye modülü (L), 2B tür modülleri (B: platform, nişancı, bulmaca, üstten görünüş…), 3B (C: three.js uygulamayla paketlenip kendi sarmalayıcıyla; voxel/Minecraft, birinci şahıs nişancı). Her biri ayrı plan alır (`superpowers:writing-plans`).
3. Ertelenen küçük bulgu (yukarıda) ve `kgame.js` için doku yolu dizgesi desteği.
4. Yayın/GitHub/CI/itch.io: yalnızca kullanıcı isterse. Font lisansı metni yayından önce FontStruct sayfasından doğrulanmalı.

## 6. Dikkat edilecek tuzaklar
- **Türkçe karakterli klasör yolu** (`klasörler\lazım olabilecek...`). Tk `PhotoImage(file=)` bu yüzden `data=` ile yüklenir. Komut satırı betiklerinde Türkçe harf ve ters eğik çizgi (`\n`) bozulabiliyor: dosya yazarken Write/Edit aracı kullan, `python - <<EOF` içinde `\n` yazma (gerçek satır sonuna dönüşebilir).
- Dosyalarda **CRLF** var (Windows); betikle düzenlerken satır sonunu koru.
- `tests/conftest.py` testleri ağdan/gerçek ayarlardan izole eder; Tk testlerinde çöp toplama fixture'ı şart (aksi halde rapor sunucusu testleri takılır).
- Kaynak metinler Türkçe, `i18n.t()` İngilizce çevirir (`i18n.py`); yeni cümle eklerken çeviri çifti ekle.
- Modele giden istemler `num_ctx = 8192` ile sınırlı: kılavuz bütçeleri `tests/test_guides.py` ile korunur.
- Kütüphanesiz (eski) oyunlar birebir aynı istemlerle çalışmalı (`tests/legacy_messages.json` anlık görüntüsü).
- Çalışan exe `dist\K-MiniGames.exe` dosyasını kilitler; derlemeden önce kapat. Ollama'yı uygulama başlatır (`CREATE_NO_WINDOW`, `DETACHED_PROCESS` YOK).

## 7. Önemli dosyalar
`src/k_minigames/`: `ui/` (ekranlar: title, settings, setup, advisor, library, studio; `stage.py` sahne+diyalog), `studio.py` (üret/düzenle/düzelt akışı), `generator.py`, `checker.py`, `harness.py`, `htmlscan.py`, `kgamelib.py`, `patching.py`, `advisor.py`, `library.py`, `memory.py`, `report_server.py`, `assets/lib/` (JS kütüphanesi). Testler: `tests/`, `tests/js/`. Araçlar: `tools/measure_library.py`, `tools/prepare_assets.py` vb.
