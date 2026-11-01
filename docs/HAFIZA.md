# K-MiniGames hafızası

Her oturumun başında okunur. Her iş bitişinde güncellenir (CHECKPOINTS.md ile birlikte).

## Proje nedir
Kullanıcının kendi bilgisayarında Ollama ile yerel yapay zekaya oyun yaptıran Windows masaüstü uygulaması. Hazır oyun yok; kullanıcı tarif eder, model tek dosyalık HTML/JS oyunu üretir, uygulama dener ve düzeltir, kütüphanede saklar. Ayrıntı: `docs/superpowers/specs/2026-10-28-k-minigames-design.md`.

## Alınan kararlar (2026-10-28 brainstorming)
- Başta "mini oyunlar" sanılmıştı; yanlış. Oyunu kullanıcının tarifiyle Ollama yapıyor.
- Çıktı biçimi: HTML/JavaScript (oyun + `assets\` klasörü, çünkü dokular var).
- Uygulama: Windows masaüstü penceresi, Python + tkinter + PyInstaller (K-Optimizer ile aynı yığın; seçimi kullanıcı bana bıraktı).
- Oyunlar uygulamanın kendi kütüphanesinde; K-Series yalnızca K-MiniGames kartını gösterir.
- Başlangıçta iki ayrı düğme: "Ollama'yı indir" ve "Danışmanı indir", boyutları yazılı. Danışman oyuna uygun ayrı bir model önerir ve yüklemek için izin ister; model adını uygulama doğrular.
- Üret ve düzenle: oyun sonradan geliştirilebilir, eski sürümler saklanır.
- Dokular kullanılabilir (model resmi görmez, ad/boyut/açıklama bilir).
- Üret → dene → düzelt döngüsü: Edge'e bağımlı değil, kullanıcının varsayılan tarayıcısı + yerel rapor sunucusu. Test listesi (`testler.json`) kalıcı hafıza; düzenlemede yeniden çalışır. En fazla 3 deneme.
- Her iş bitişinde CHECKPOINTS.md'ye kayıt; bu dosya da HAFIZA.md.

- Danışman ekranı: piksel sanat ofis sahnesi + masanın arkasında mor yaratık (resepsiyonist) + altta diyalog kutusu. Sıra tek tarafta: `DANIŞMAN` / `SEN` etiketi üstte, mesaj altta. Ayrıntı ve kare–durum eşleşmesi: `docs/ui-varliklari.md`.
- Oyun üretme ekranının maskotu ayrı: otel görevlisi ayı, 12 kare (`assets/ui/maskot/`, ikinci set: düz magenta zeminli, GPT ile); eşleşme `docs/ui-varliklari.md`'de. Danışman (mor yaratık) model kurulana kadar, ayı ondan sonra.
- Görseller damalı (sahte şeffaf) geliyor; `tools/remove_checkerboard.py` temizliyor (Pillow yalnızca bu araç için, uygulamaya girmez).

## Durum
- Brainstorming bitti, spec onaylandı (2026-10-28). Uygulama planı yazıldı: `docs/superpowers/plans/2026-10-28-k-minigames.md` (17 görev; 17. görev K-Optimizer deposunda K-Series entegrasyonu). Plana sonradan "çözülmüş hatalar" hafızası eklendi (testler.json `resolved`; düzenleme istemine verilir). Modelin oyunu "eğlenceli mi" diye değerlendirmesi kapsam dışı (kullanıcı da teyit etti). Uygulamanın kendi hafızası eklendi (Görev 18): danışman için `danisman_hafiza.md`, ayı için oyunun `hafiza.md`'si; her mesajdan sonra özetlenir, her modele giden isteğin en başına konur. Kullanıcının planı incelemesi ve yürütme yöntemini (subagent/native) seçmesi bekleniyor.
- UI görselleri (sahne, diyalog kutusu, 9 danışman karesi, 12 ayı karesi) hazır ve repoda (CP-1..CP-3). Üretim ekranının arka planı (otel lobisi, `lobi.png`) eklendi (CP-5). Başlangıç, kütüphane ve düzenleme ekranlarının görselleri henüz yok.
- Danışman modeli: Türkçe deneme yapıldı (aynı soru, 5 model). qwen3.5:4b en doğal, gemma3:4b akıcı, llama3/llama3.1:8b orta, qwen2.5:3b zayıf (bozuk cümleler). Varsayılan danışman qwen3.5:4b (3.4 GB) oldu; alternatif gemma3:4b. Elle doğrulanamayanlar: Görev 15 ve 18'deki gerçek üretim denemeleri (kod yazan model henüz denenmedi).
- Gerçek denemede (llama3.1:8b, kod modeli yok) bulunanlar: model test kodunu JSON içinde ters tırnakla yazıyordu (ayrıştırıcı artık okuyor); madde listesi teknik kuralları madde sanıyordu (istem düzeltildi); boş `return true;` testleri 'anlamsız' diye yakalanıyor. Oyun kalitesi modele bağlı: llama3.1:8b zayıf yazıyor; qwen2.5-coder:7b önerilir ama indirmek kullanıcı onayı ister (henüz indirilmedi, denenmedi).
- Yazı tipi: Determination (FontStruct, anonymous-1438277) eklendi ve bütün yazılara uygulandı (`ui/fonts.py`); atıf pencerede ve `assets/fonts/LICENSE.txt` içinde. Türkçe harflerin hepsi destekleniyor; `✓ → ₺` yok ama Tk yedek yazı tipiyle çiziyor. Lisans metnini kullanıcının verdiği atıf şartından başka doğrulayamadım (yayından önce FontStruct sayfasındaki lisansı okumak gerekir).
- Karakter adları: danışman (mor resepsiyonist) **Don**, ayı (otel görevlisi) **Bob**; konuşma etiketleri DON / BOB / SEN (kullanıcı), adlar çevrilmez.
- Kod modeli denemesi (qwen2.5-coder:14b, kullanıcı yükledi; indirme yapılmadı): aynı tarifle (zıplayan kare) hat ~6,5 dakikada bitti: 3 madde geçti, 1 doğrulanamadı, 3 otomatik düzeltme; oyun gerçekten oynanıyor (zıplama, engel, skor). Karşılaştırma: llama3.1:8b ~3 dakika, hiçbir madde geçmedi, oyun zayıf. Kod modeli kesin daha iyi; varsayılan öneri qwen2.5-coder serisi olarak kalıyor.
- Uygulama ilerlemesi: küp dünya sandık düzeni tamam (CP-109); exe/zip derlendi

## Oyun kütüphanesi (2026-10-30)
- Model oyunu sıfırdan yazmaz; `src/k_minigames/assets/lib/` altındaki JS kütüphanesini (`kgame.js` çekirdek, `kgame.ai.js` bot, `kgame.sports.js` spor) kullanır, yalnızca kuralları yazar. Dosyalar oyun klasörüne kopyalanır, `<script>` etiketlerini uygulama ekler (`kgamelib.ensure_scripts`). Don konuşmadan modül seçer (`Advisor.choose_modules`), oyunun `game.json`'unda `modules` tutulur; Bob bunları kullanır ve Don'un hafıza notunu okur.
- Kılavuzlar `*.guide.md` (bütçe: çekirdek ≤2000, modül ≤1500 token), örnekler `examples/`, düzenleme bul/değiştir yamalarıyla (`patching.py`, uygulanamazsa bütün dosya), `CONFIG` bloğu geçerli JSON olmalı.
- Akıllı denetçi (harness.py yoklamaları): boş ekran, tuş/fare etkisi, NaN durum, büyüyen liste, düz giden top, topa tepki vermeyen bot; hata satırı kod parçasıyla. Yoklamalar oyun bitmeden başlar (mantık yoklaması en önce).
- Tasarım/plan/ölçüm: `docs/superpowers/specs/2026-10-30-oyun-kutuphanesi-design.md`, `plans/2026-10-30-oyun-kutuphanesi.md`, `docs/olcum-kutuphane.md`. Sonraki alt projeler (ölçümden sonra): seviye modülü, 2B tür modülleri, 3B (three.js paketlenip sarmalanacak).

## Kullanıcıyla çalışma
- Türkçe konuşulur. Soru başına tek soru, seçenekli.
- Kullanıcı "senin kolayına ne gelirse" diyerek teknik seçimleri bana bırakabilir; yine de sonucu açıklarım.
