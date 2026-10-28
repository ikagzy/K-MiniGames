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
- Doğrulanamadı (Ollama çalışmıyor, indirme için kullanıcı onayı yok): Görev 3 Adım 5 (qwen2.5:3b'nin Türkçe kalitesi) ve ileride gerçek Ollama gerektiren elle doğrulamalar (Görev 15, 18). Danışman modeli şimdilik varsayılan `qwen2.5:3b`; kötü çıkarsa `data/models.json`'da `llama3.2:3b` dene.
- Uygulama ilerlemesi: Görev 3/18 tamam

## Kullanıcıyla çalışma
- Türkçe konuşulur. Soru başına tek soru, seçenekli.
- Kullanıcı "senin kolayına ne gelirse" diyerek teknik seçimleri bana bırakabilir; yine de sonucu açıklarım.
