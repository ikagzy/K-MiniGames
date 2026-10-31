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
| CP-25 | 2026-10-28 | Görev 17: K-Series, K-MiniGames'i algılıyor ve ana sayfada kart gösteriyor (K-Optimizer deposunda, 331 test) | K-Optimizer 581e83e |
| CP-26 | 2026-10-28 | Görev 18: memory (danışman + oyun hafızası, yedek yol, arka plan kancası; 22 yeni test; gerçek modelle yeniden açılışta doğrulandı) | 7e2c5c4 |
| CP-27 | 2026-10-28 | Determination yazı tipi (FontStruct, anonymous-1438277): yükleyici, tüm yazılara uygulama, atıf | f095a76 |
| CP-28 | 2026-10-28 | Karakter adları: danışman Don, ayı Bob (konuşma etiketleri) | b34ec12 |
| CP-29 | 2026-10-28 | Bağımsız inceleme düzeltmeleri (6 Önemli + 3 yeniden derecelendirilen; 25 yeni test) | a5a4a97 |
| CP-30 | 2026-10-28 | Ertelenen küçük bulgular düzeltildi (#8 #10 #11 #12 #13 #14, K-Optimizer'da #16); 8 yeni test | c5b8710 |
| CP-31 | 2026-10-28 | Atıf yalnızca README'de; konuşma animasyonu 240 ms'de bir kare; aynı kare yeniden çizilmiyor; Ollama hata metni (HTTP 500); testlerde Tk çöp toplama; 6 yeni test | dbfbdc5 |
| CP-32 | 2026-10-28 | Giriş ekranı (Başla/Ayarlar/Çıkış, kalp imleci) ve Ayarlar ekranı (Ollama ve danışman modeli kurulumu, klasör, hafızayı sil); Determination yazı tipi exe'ye eklendi (spec'te eksikti); 3 yeni test; dist/K-MiniGames.exe derlendi | e81bf5b |
| CP-33 | 2026-10-28 | Danışman kullanıcının yazdığı dilde cevap veriyor (İngilizce yazana Türkçe cevap veriyordu); exe yeniden derlendi | 1cbc27f |
| CP-34 | 2026-10-28 | Don sandalyeye ortalandı (ADVISOR_ANCHOR x 535); danışman dil düzeltmesi dahil exe yeniden derlendi | fff4965 |
| CP-35 | 2026-10-28 | Don defterin üstüne oturacak şekilde aşağı alındı ve sandalyeye ortalandı (ADVISOR_ANCHOR 529,329); exe yeniden derlendi | aa9e8ec |
| CP-36 | 2026-10-28 | Ana menüde Başla yalnızca Ollama çalışıyor ve danışman modeli kuruluysa görünüyor; uzun mesajlar küçülerek diyalog kutusuna sığıyor; 3 yeni test; exe derlendi | 9655895 |
| CP-37 | 2026-10-28 | Don masanın üstüne alındı (ADVISOR_ANCHOR 529,323); exe derlendi | c5c5d4f |
| CP-38 | 2026-10-28 | Don defterin üstünden çıkarıldı, masanın arkasına alındı (ADVISOR_ANCHOR 529,309); exe derlendi | 48cb3dc |
| CP-39 | 2026-10-28 | Don 12 piksel daha yukarı alındı (ADVISOR_ANCHOR 529,297); exe derlendi | 21a7156 |
| CP-40 | 2026-10-28 | Don ve Bob'un ekranları siyahtan ~1,2 sn'de açılıyor; karakterler adlarını söylüyor (Ben Don!/Ben Bob!); sığmayan mesajlar sayfalara bölünüyor (◀ ▶ ve fare tekerleği); 2 yeni test; exe derlendi | 180cfd3 |
| CP-41 | 2026-10-28 | Bob, Don'un hafıza notlarını okuyor: ad sorulduktan sonra 'Don bana şunları anlattı...' diyor, 'evet' ya da ekleme bekliyor; tarif baştan sorulmuyor; 2 yeni test; exe derlendi | 10892d7 |
| CP-42 | 2026-10-28 | Başla: oyun yoksa Don, varsa Bob'un kütüphanesi; Yeni oyun Don'la başlar, Don bitirince Bob'a geçer; model zaten seçildiyse Don tekrar sormaz; testler güncellendi; exe derlendi | f3c5344 |
| CP-43 | 2026-10-28 | Sayfa okları sola alındı (sağ üstteki Doku ekle/Kütüphane düğmelerine basılamıyordu); düzeltme istemine ReferenceError kapsam ipucu eklendi (gerçek voleybol oyununda 'game' hatası çözüldü); 1 yeni test; exe derlendi | 339eb71 |
| CP-44 | 2026-10-28 | Çalışırken cmd pencerelerinin açılıp kapanması giderildi: ollama serve artık DETACHED_PROCESS olmadan (yalnız CREATE_NO_WINDOW) başlıyor; 1 test güçlendirildi; exe derlendi | aae712a |
| CP-45 | 2026-10-28 | Akıllı denetçi: tarayıcıda yoklamalar (boş ekran, tuş/fare etkisi, NaN durum, büyüyen listeler); hata satırı kod parçasıyla ve doğru satır numarasıyla; yoklamayla çelişen 'geçti' maddeleri doğrulanamadı; 4 yeni test; gerçek tarayıcıda denendi; exe derlendi | 161b7ab |
| CP-46 | 2026-10-28 | Mantık yoklamaları: dümdüz giden top (hata), topa tepki vermeyen bot (hata; hiç kımıldamıyorsa uyarı), takılı top; somut düzeltme ipuçları; çelişen maddeler doğrulanamadı; 3 yeni test; bozuk pong ve çalışan voleybol oyunuyla gerçek tarayıcıda denendi; oyun kütüphanesi tasarım belgesi eklendi; exe derlendi | 3c0a679 |
| CP-47 | 2026-10-28 | Oyun kütüphanesi uygulama planı yazıldı (15 görev: modül kaydı, rapor sunucusu, Node JS testleri, çekirdek, bot, spor, kılavuzlar, istemler, modül seçimi, yama, CONFIG, paketleme, ölçüm); kod yok | ee10be7 |
| CP-48 | 2026-10-28 | Oyun kütüphanesi G1–G8: kgamelib (modül kaydı, kurulum, etiket ekleme), rapor sunucusu betikleri, Node JS test altyapısı, 2B çekirdek, bot ve spor modülleri; 51 JS testi + 10 yeni Python testi | b3b856a |
| CP-49 | 2026-10-28 | Oyun kütüphanesi G9–G15 + inceleme düzeltmeleri: kılavuzlar, istemler, modül seçimi, yama düzenleme, CONFIG, paketleme, ölçüm aracı; bağımsız inceleme bulguları (yorumdaki script, çarpışma anahtarı, zamanlayıcılar, hızlı tıklama, yarım yama, futbol vuruşu) testle düzeltildi; bot yoklaması yanlış alarmı giderildi; exe derlendi | bffe7e0 |
| CP-50 | 2026-10-28 | Devir notu (docs/DEVIR-NOTU.md) ve ölçüm sonuçları (voleybol/platform, eski/yeni) eklendi | 707e814 |
| CP-51 | 2026-10-28 | Kütüphane dalga 1 (sprites, animation, themes, levels+üreteç, hud, audio2, items, enemies, kits, platformer), özet-önce mimari (kits.py, özet/düzeltme/düzenleme akışı), seviye üreteci, eğitim ortamı kuruldu; 3B ile mario özeti 13 sn 5/5; exe derlendi | 73907eb |
| CP-52 | 2026-10-28 | Eğitim hazırlığı: özet veri seti üreticisi (800/120 örnek, tuttulan çiftler ve elle yazılmış değerlendirme), puanlama, LoRA eğitim ve değerlendirme betikleri; müzik özgünleştirildi; GPU adımları onay bekliyor | ecfcdfd |
| CP-53 | 2026-10-28 | Taban ölçüm: qwen2.5:3b özet doğruluğu 0.46 (geçerlilik 1.0), sayısal alanlar zayıf; pilot eğitim onay bekliyor | ddf316e |
| CP-54 | 2026-10-28 | Pilot eğitim (k-ai-pilot, 1.5B, 300 örnek): üretilmiş doğruluk 0,46->0,86, doğal cümlelerde kazanç yok; model adı k-ai; konuşma sürümü sonraya | d0a3a50 |
| CP-55 | 2026-10-28 | k-ai-v1 (800 örnek, çeşitlendirilmiş veri): üretilmiş 0,963, elle yazılmış alan 0,841 ve tam 0,667 (3B 0,794/0,583); kgame.js pencereye sığdırma; sırada form modu ve kademeli model | e6998bd |
| CP-56 | 2026-10-28 | Platform kitine Sonic özellikleri: spring, dashPad, rings (130 JS testi, tarayıcıda denendi); k-ai henüz bilmiyor, yeniden eğitim gerekli | b8cdf2d |
| CP-57 | 2026-10-28 | hero.character ve özgün runner karakteri (turuncu tilki); Hız Koşusu demosu yeniden kuruldu; Mario benzeri tasarımlar bekliyor | 70641fe |
| CP-58 | 2026-10-28 | Özgün varsayılan tasarımlar (kâşif, yaratık, mücevher blok, iksir, taş sütun), marka adları temizlendi, campaign (2-20 seviye, kademeli zorluk), 134 JS testi | 82ce684 |
| CP-59 | 2026-10-28 | Platform çeşitliliği: checkpoint, ice (buz), movingPlatforms; floorHooks/slip/checkpoint kancaları; 139 JS testi; boss yapılmadı | c64f2b7 |
| CP-60 | 2026-10-28 | Müzik üreteci: K.music.compose (6 ruh hali, tempo, seed), iki sesli motor, musicStyle alanı; kulakla doğrulanmadı; 142 JS testi | 3cc159a |
| CP-61 | 2026-10-28 | Müzik düzeltmeleri (ruh hali tohuma karışır, açılış çeşitliliği, tekrar azaltma), gizli easter egg parçası sabitlendi, yeni mystery örneği; 144 JS testi | 563fc9b |
| CP-62 | 2026-10-28 | Eğitim verisi yeni alanları öğretir (1150 özet kitle doğrulandı); eğitim 6x hızlandı (answer_loss), ara kayıt ve --resume; k-ai-v2 henüz eğitilmedi | e4881cc |
| CP-63 | 2026-10-28 | k-ai v1 Ollama'ya GGUF ile kuruldu, uygulamada Bob'un modeli yapıldı (game_model), install_kai.py, exe yeniden derlendi; v2 eğitimi sürüyor | 4259461 |
| CP-64 | 2026-10-28 | k-ai v2 eğitildi ve ölçüldü (HF'de yeni özellikler %100, genel 0,98); Ollama'da v2 bozuluyor (açık sorun); k-ai için şemasız çağrı; devlog | 34b738c |
| CP-65 | 2026-10-28 | v2 sorunu Ollama'da değil: aynı GGUF llama.cpp'de de bozuk (elle yazılmış 0,41); eğitimsiz 14B elle yazılmış 0,44 (k-ai v2 0,69) | a722418 |
| CP-66 | 2026-10-28 | v2 sorununun sebebi bulundu: öğrenilemeyen rastgele seed rakamları (dönüştürme bozuk değil); seed artık modele yazdırılmıyor, uygulama dolduruyor; v3 eğitimi bekliyor | b67ba09 |
| CP-67 | 2026-10-28 | k-ai v3 (ek eğitim, ham 0,97/0,88) + onarım ve kurallar katmanı; uygulamada v2+kurallar (Ollama'da doğruluk 0,84, elle yazılmış 0,84); exe yeniden derlendi | 99f5cc1 |
| CP-68 | 2026-10-28 | Ollama bozulmasının kök sebebi çözüldü (GGUF'ta rope_theta 10000 yazılıyordu); v1/v2/v3 yeniden kuruldu, Ollama ham = HF; uygulamada k-ai-v3 (+onarım+kurallar: doğruluk 0,97, elle yazılmış 0,94) | 1b58529 |
| CP-69 | 2026-10-28 | specrules düzeltmesi (yıldız≠gece teması): v3 uygulama 0,976 (ham 0,972), elle yazılmış 0,94/0,97; exe ve arkadaş paketi yenilendi | cd174f9 |
| CP-70 | 2026-10-28 | bölüm çeşitliliği: 5 bölüm tarzı (tepeli/merdivenli, çukurlu, düşman kapışması, gökyüzü), kampanyada tarz ve yoğunluk çeşitlemesi; 146 JS testi; exe henüz yeniden derlenmedi | 65475ec |
| CP-71 | 2026-10-28 | k-ai uygulamada görünmüyordu (ayar 'k-ai-v3', Ollama 'k-ai-v3:latest' diyor, uygulama 14B öneriyordu): is_installed ile düzeltildi; ayar ve KUR.bat ':latest' yazıyor; exe yeniden derlenmedi | d430a27 |
| CP-72 | 2026-10-28 | kök sebep: Claude'un AppData yazmaları sanal klasöre gidiyordu, ayar değişiklikleri kullanıcının uygulamasına ulaşmadı; tools/k-ai-sec.bat eklendi | e958afc |
| CP-73 | 2026-10-28 | belirsiz tarifler farklı oyun veriyor (özette olmayan tema/müzik/seviye ayrıntıları rastgele doldurulur), düzenlemede seed korunur; doğruluk 0,973 | 8508676 |
| CP-74 | 2026-10-28 | nişancı kiti: dikey kayan uzay nişancısı (5 düşman türü, dalgalar, patron, güçlendirme, 4 özellik), şema, rehber, Bob kontrolleri, kurallar; bot testiyle her zorlukta yenilebilir; k-ai verisi henüz yok | e414109 |
| CP-75 | 2026-10-28 | k-ai v4: nişancı kiti öğrenildi (üretilmiş 1,00, elle yazılmış 0,9), platformda gerileme yok; kurallar düzeltildi; Ollama'ya k-ai-v4 olarak kuruldu | b1746fd |
| CP-76 | 2026-10-28 | küp dünya kiti (sandbox, eski Minecraft tadında): tohumdan arazi, mağara, maden, ağaç, kırma/koyma, gündüz-gece, kayıt, ışın izlemeli düşük çözünürlüklü çizim; k-ai verisi henüz yok | c900ede |
| CP-77 | 2026-10-28 | küp dünya: parça tabanlı dünya, envanter, fare/tekerlek kontrolleri, harita, tarım (çapa/tohum/ekin/hasat), üretim menüsü; v5 eğitimi sürüyor | d48c34e |
| CP-78 | 2026-10-28 | küp dünya: 44 tarif (1.8.9 çekirdek), 5 kademe alet, kazma süresi ve alet kademeleri, fırın/eritme/yakıt, tarif menüsü; v5 eğitimi sürüyor | bf67988 |
| CP-79 | 2026-10-28 | küp dünya: net eşya simgeleri, can/açlık/düşme/boğulma/yemek; v5 eğitimi bitmek üzere | 406d8bc |
| CP-80 | 2026-10-28 | küp dünya: canlılar (hayvan/gece düşmanı), dövüş, zırh, alet dayanıklılığı, başarımlar, et/yün; v5 Ollama'ya kuruldu, ölçüm sürüyor | ecbfaf5 |
| CP-81 | 2026-10-28 | k-ai v5 (3 kit: platform+nişancı+küp dünya, elle yazılmış 0,97/1,0/0,9) kuruldu; küp dünya lav/yatak/kum/fidan/taşlar; kömür cevheri hatası düzeltildi | 5f73a5e |
| CP-82 | 2026-10-31 | küp dünya: yarım blok, basamak, çit, kapı, merdiven (şekilli bloklar), ana menü ve Esc menüsü; 203 JS testi | 9bcf740 |
| CP-83 | 2026-10-31 | küp dünya boyutları (Kor Diyarı, Gök Adaları), geçit/çakmak/kara kaya, kapı kaydı düzeltmesi; v5.5 sürümü; 207 JS testi | 1d36a7e |
| CP-84 | 2026-10-31 | Kor Diyarı canlıları (közcü, kor bekçisi), köz tozu ve ışık taşı tarifi, saydam geçit; 209 JS testi | ba04203 |
| CP-85 | 2026-10-31 | küp dünya: eşyasız başlangıç, masa/fırın yakınlığına göre tarifler, sağ tıkla menü, elde tutulan eşya; 210 JS testi | 46e6a38 |
| CP-86 | 2026-10-31 | küp dünya: sudan kıyıya çıkma düzeltmesi; 211 JS testi | f5d4b1f |
| CP-87 | 2026-10-31 | Oyna eski oyunun kütüphane dosyalarını yeniler (eski oyunda eşyayla başlama/masa/envanter sorunu), kısa tuş vuruşu; 525 Python+211 JS test | 761022f |
| CP-88 | 2026-10-31 | k-ai-chat: Don için 0.5B model eğitildi ve Ollama'ya kuruldu (cevap 2,2 sn, modül %92); k-ai-chat-sec.bat | 0ff56ca |
| CP-89 | 2026-10-31 | Don kuralları: kısa istekte öneri tutulup soru sorulur, Don'un mesajı ekranda okunur kalır; 530 Python testi | 0b896f9 |
| CP-90 | 2026-10-31 | Don hafızası k-ai-chat ile kirleniyordu (Bob'da tekrarlayan mesajlar, 2 dk bekleme): kullanıcının sözleri tutulur, jeton sınırı; hafıza silme bat'ı | 56cb52b |
| CP-91 | 2026-10-31 | küp dünya: E envanter ızgarası, Ctrl koş/Shift eğil, klavye kırma-koyma kalktı; müzik kapatma hatası düzeltildi; 214 JS testi | 268bbab |
| CP-92 | 2026-10-31 | küp dünya: yemek animasyonu/iyileşme, kılıç kalkanı, tavşan eti, damar madenler (lapis, kızıltaş, zümrüt, 1.8.9 derinlikleri), geçit ipucu; 217 JS testi | f528677 |
| CP-93 | 2026-10-31 | küp dünya: büyü masası + deneyim + 4 büyü, köyler (ev, çiftlik, kuyu, saman), çöl tapınağı, köylüler ve takas, sandık ganimeti; 220 JS testi | 0e4c717 |
