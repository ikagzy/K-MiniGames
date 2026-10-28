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
- Brainstorming bitti, spec yazıldı; kullanıcı spec'i henüz onaylamadı. Onaydan sonra `writing-plans`.
- UI görselleri (sahne, diyalog kutusu, 9 danışman karesi, 12 ayı karesi) hazır ve repoda (CP-1..CP-3). Üretim ekranı için ayrı arka plan kullanıcı tarafından hazırlanıyor (GPT ile). Başlangıç, kütüphane ve düzenleme ekranlarının görselleri henüz yok.
- Henüz uygulama kodu yok.

## Kullanıcıyla çalışma
- Türkçe konuşulur. Soru başına tek soru, seçenekli.
- Kullanıcı "senin kolayına ne gelirse" diyerek teknik seçimleri bana bırakabilir; yine de sonucu açıklarım.
