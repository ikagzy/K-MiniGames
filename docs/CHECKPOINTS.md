# Checkpoint'ler

Her iş bitişinde buraya bir kayıt eklenir. Bozulursa "CPn'e dön" denir; her kayıtta dönülecek git commit'i yazar.

Dönüş: `git checkout <commit>` (yeni iş için ondan dal açılır) ya da geri almak istenen işler `git revert` ile geri alınır. Atılacak işler olduğunda önce kullanıcıya sorulur.

| No | Tarih | Yapılan | Commit |
|---|---|---|---|
| CP-0 | 2026-10-28 | Tasarım spec'i yazıldı, hafıza ve checkpoint dosyaları açıldı | 316bf45 |
| CP-1 | 2026-10-28 | Danışman ekranı görselleri (sahne, diyalog kutusu, 9 danışman karesi), damalı arka plan temizleme aracı, kare-durum eşleşmesi (docs/ui-varliklari.md) | 5fa95ef |
| CP-2 | 2026-10-28 | Konuşma karelerinin yeniden adlandırılması (hata/bulamadi -> konusuyor_a/b) ve durum tablosunun düzeltilmesi | b25cbdd |
| CP-3 | 2026-10-28 | Oyun üretme ekranı maskotu (otel görevlisi ayı): 7 eşit boyutlu kare, tools/build_mascot.py, durum eşleşmesi | 9f363fc |
| CP-4 | 2026-10-28 | Ayı maskotu ikinci set (12 kare, düz magenta zemin, tutarlı gövde), build_mascot.py ızgara moduna çevrildi, lobi önizlemesi | a509a28 |
| CP-5 | 2026-10-28 | Lobi arka planı (lobi.png), diyalog kutusu alt kenar temizliği, önizleme güncellendi | c574d35 |
| CP-6 | 2026-10-28 | Spec onaylandı, uygulama planı yazıldı (docs/superpowers/plans/2026-10-28-k-minigames.md) | 5636d7c |
| CP-7 | 2026-10-28 | Plana "çözülmüş hatalar" hafızası eklendi (Görev 7, 10, 11) | 22ab02e |
| CP-8 | 2026-10-28 | Uygulamanın kendi hafızası: danışman (danisman_hafiza.md) ve ayı (oyunun hafiza.md); spec ve plana Görev 18 | a6e5a98 |
| CP-9 | 2026-10-28 | Görev 1: iskelet, ayarlar, dil (9 test) | 6bf6555 |
| CP-10 | 2026-10-28 | Görev 2: ollama_client (sohbet akışı, pull, kopma/iptal hataları; 16 test) | c44fbd0 |
| CP-11 | 2026-10-28 | Görev 3: hardware, catalog, model_check (11 test; elle Türkçe doğrulaması yapılmadı) | afacae9 |
| CP-12 | 2026-10-28 | Görev 4: installer (13 test; iptal/eksik/disk dolu .part bırakmaz) | a82a3a3 |
| CP-13 | 2026-10-28 | Görev 5: advisor + memory.block (12 test) | 4b96acd |
| CP-14 | 2026-10-28 | Görev 6: library (28 test; güvenli klasör adları, sürüm geri dönüşü, doku adları) | 9b0139c |
| CP-15 | 2026-10-28 | Görev 7: generator (20 test; yarım/boş cevap asla oyun sayılmaz) | e7d6584 |
| CP-16 | 2026-10-28 | Görev 8: htmlscan (10 test) | d568df0 |
| CP-17 | 2026-10-28 | Görev 9: report_server + harness (25 test; tarayıcıda elle doğrulandı) | 19f612e |
| CP-18 | 2026-10-28 | Görev 10: testlist + checker (16 test; rapor sunucusuna report_url/clear_events) | 5ca495c |
| CP-19 | 2026-10-28 | Görev 11: studio (15 test; en iyi sürüm, 3 deneme, bozuk düzenleme reddi) | 25c69e5 |
| CP-20 | 2026-10-28 | Görev 12: mascot, assets/runtime, Stage (39 test; gerçek Tk penceresinde görüntü alındı) | 9d8100d |
| CP-21 | 2026-10-28 | Görev 13: kabuk, Worker, başlangıç ekranı, kurulu-model izin akışı, İngilizce çeviriler (49 yeni test; gerçek pencerede doğrulandı) | c9d9f1c |
| CP-22 | 2026-10-28 | Görev 14: AdvisorFlow + AdvisorScreen (21 yeni test; gerçek qwen3.5:4b ile uçtan uca doğrulandı) | 30065bb |
| CP-23 | 2026-10-28 | Görev 15: LibraryScreen, StudioScreen, summary_lines, daktilo yardımcısı (22 yeni test; gerçek modelle uçtan uca oyun üretimi denendi) | b71e9ff |
| CP-24 | 2026-10-28 | Görev 16: launcher, K-MiniGames.spec, make_version, simge, README (3 yeni test; exe derlenip çalıştırıldı) | 0bfdc12 |
