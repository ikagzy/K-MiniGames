# K-MiniGames oyun kütüphanesi — tasarım (2026-10-30)

Durum: sohbette onaylandı (katalog, sıra, 3B yolu, seviye modülü, akıllı denetçi). Bu belge yazılı onay bekliyor.

## 1. Amaç ve neden

Bugün model her oyunu sıfırdan, tek dosyalık HTML/JS olarak yazıyor. Küçük ve orta modeller (özellikle 1.5B–14B) bunda zorlanıyor: uzun kod, değişken kapsamı hataları, eksik fizik, kural hataları. Gerçek denemede (voleybol tarifi, qwen2.5-coder:14b) sonuç basit bir pong oldu; `game` kapsam hatası üç otomatik düzeltmede çözülemedi.

Hedef: oyunun ağır işini (döngü, girdi, çarpışma, fizik, yapay zekâ, seviye, 3B) **benim yazıp sınadığım bir kütüphaneye** vermek. Modelin yazdığı `oyun.html` yalnızca oyunun kurallarını ve ayarlarını içersin (yaklaşık 40–80 satır). Böylece:
- küçük modeller ve zayıf bilgisayarlar da çalışan oyun üretebilsin,
- büyük modellerin kalitesi artsın,
- düzeltme ve düzenleme küçük, güvenli değişikliklerle yapılsın.

Kullanıcı kitlesi: herkes (yalnızca geliştiricinin 32 GB'lık bilgisayarı değil). Oyunlar internetsiz, kendi klasöründen çalışır.

## 2. Kapsam ve parçalama

Bu tek proje değil; sırayla yapılacak alt projeler. Her biri ayrı plan ve uygulama döngüsü alır.

| Alt proje | İçerik | Durum |
|---|---|---|
| E | Akıllı denetçi (tarayıcıda yoklamalar, hata satırı, çelişen testler) | **Bitti** (CP-45) |
| A | 2B çekirdek + bot modülü + modele gösterilen kılavuz | ilk |
| D | Akış entegrasyonu (istem, modül seçimi, kütüphane kopyalama, CONFIG, yama düzenleme) | A ile birlikte, küçük hâliyle |
| S | Spor modülü (voleybol vb.) + **ölçüm** | A/D'den hemen sonra |
| L | Seviye modülü | sonra |
| B | 2B tür modülleri | sonra |
| C | 3B (three.js + sarmalayıcı), voxel, birinci şahıs nişancı | sonra |

Ölçüm kapısı: A+D+S bitince aynı voleybol tarifi 14B ile eski ve yeni yöntemle üretilip karşılaştırılır. Fark küçükse yön yeniden konuşulur; büyükse B, L, C sırayla yapılır.

## 3. Mimari

### 3.1 Dosyalar ve nereye konur
Kütüphane uygulamanın içinde (`src/k_minigames/assets/lib/`) durur ve paketlenir (PyInstaller `datas`). Oyun oluşturulurken `library.py` gereken dosyaları oyun klasörüne kopyalar:

```
Oyunlar/<oyun>/
  oyun.html          modelin yazdığı (küçük)
  kgame.js           2B çekirdek
  kgame.ai.js        bot modülü
  kgame.<tür>.js     seçilen tür modülleri
  kgame3d.js, three.min.js   yalnızca 3B oyunlarda
  assets/            kullanıcı dokuları
```
`oyun.html` göreli yolla çağırır; klasör taşınsa da oyun çalışır. Kütüphane güncellenirse oyunlar eski kopyayla çalışmaya devam eder (sürüm numarası dosyanın başında).

### 3.2 Modeli bağlamda boğmama
Model bağlamı 8192 token. Bu yüzden kütüphane **modüllü** ve modele yalnızca **kılavuz** gösterilir:
- çekirdek kılavuzu her istemde (yaklaşık 1500–2000 token),
- seçilen 1–2 modülün kılavuzu (modül başına en fazla 1500–2000 token),
- 1–2 kısa tam örnek oyun.

Kılavuz bir API listesi + örnektir; kütüphane kodu modele gösterilmez. Her modülün kılavuzu `*.guide.md` dosyasıdır, testle en fazla belirlenen token bütçesini aşmadığı doğrulanır.

### 3.3 Modül seçimi
Don, kullanıcıyla konuşunca JSON ile `{"model": "...", "modules": ["sports","ai"], "dimension": "2d"}` gibi kısıtlı bir çıktı verir (Ollama yapılandırılmış çıktı). Uygulama listede olmayan modülü atar. Bob oyun üretirken yalnızca seçilen modüllerin kılavuzunu isteme koyar.

### 3.4 Ayarlar (`CONFIG`)
Oyunun sayısal ve renkli ayarları `oyun.html`'in en üstünde tek bir `CONFIG = {...}` bloğunda toplanır (hız, yerçekimi, renk, tuşlar, zorluk). Basit düzenlemeler ("topu yavaşlat") yalnızca bu bloğu değiştirir ve JSON olarak doğrulanır.

### 3.5 Düzenleme: yama
Düzenlemede bütün oyunu yeniden yazdırmak yerine model "bul/değiştir" blokları üretir; uygulama yamayı uygular, uygulanamazsa eski yönteme (bütün dosya) döner. Böylece çalışan kısımlar bozulmaz (bugünkü `game` hatası türü sorunlar azalır).

### 3.6 Standart durum
Her oyun `K.expose({...})` ile durumunu `window.__game`'e açar. Akıllı denetçi ve testler hep aynı yerden okur.

## 4. Modül kataloğu

**Çekirdek (`kgame.js`):** sabit adımlı döngü, girdi (klavye/fare/dokunma), varlıklar (konum, hız, yerçekimi, sekme, sürtünme), çarpışma (kare, daire, karo haritası), kamera (takip, sarsıntı, yakınlaştırma), sahneler (menü/oyun/bitti), arayüz (skor, can, yazı, düğme), ses (WebAudio ile üretilen efektler), parçacıklar, zamanlayıcı/tween, rastgele, kayıt (en yüksek skor), **üretilen dokular** (`K.texture.*` ile kodla çizilen piksel sanat; dışarıdan resim gerekmez).

**Bot / yapay zekâ (`kgame.ai.js`):** durum makineleri, davranış ağacı, yönlendirme (kovala, kaç, dolaş, sürü), yol bulma (A*), görüş ve ses algısı, zorluk ayarı (`easy/normal/hard`). Hazır botlar: pong/voleybol rakibi, nişancı, yarış botu, düşman dalgası.

**Seviye (`kgame.levels.js`):** ASCII harita ayrıştırıcısı (`K.levels.parse`), çoklu seviye ve geçiş, **doğrulama** (başlangıçtan çıkışa ulaşılabilir mi, zıplama menzili yeterli mi), zorluk eğrili üretim (`generate`: platform, zindan, labirent, mağara), ilerleme kaydı, isteğe bağlı oyun içi seviye düzenleyici.

**2B tür modülleri:** platform, üstten görünüş/RPG, 2B nişancı, **spor** (voleybol, futbol, basketbol, pong), yarış, bulmaca (eşleştirme, Sokoban, Tetris, 2048, mayın tarlası), kart/tahta, kule savunması, dövüş, rastgele zindan, sonsuz koşucu, uzay, tıklama/idle, ritim, fizik oyuncağı, strateji.

**3B (`kgame3d.js`, three.js üstünde):** tek çağrıyla sahne, ilkel şekiller, ışık, kamera kipleri (yörünge, birinci şahıs, takip, üstten), yerçekimi/çarpışma, 2B arayüz katmanı. Türler: voxel/Minecraft (parçalı dünya, blok koy/kır, arazi üretimi, hotbar, gece-gündüz, yaratık), birinci şahıs nişancı (işaretçi kilidi, ışın isabeti, botlar), üçüncü şahıs, 3B yarış, uçuş, 3B platform, şehir/tycoon, korku.

three.js (MIT) uygulamayla paketlenir; lisans metni `assets/lib/` içinde saklanır. Model three.js'i değil yalnızca sarmalayıcının kısa API'sini öğrenir.

### Örnek: modelin yazacağı voleybol oyunu (hedef biçim)
```js
const CONFIG = { gravity: 700, hitPower: 650, to: 15 };
const g = K.game({ width: 800, height: 450, gravity: CONFIG.gravity });
const court = K.sports.court({ type: 'volleyball', net: true });
const ball = K.sports.ball(court, { bounce: 0.85 });
const me = g.add({ shape: 'rect', x: 150, y: 350, w: 30, h: 50, controls: 'wasd', speed: 220 });
const cpu = K.ai.paddle(g.add({ shape: 'rect', x: 650, y: 350, w: 30, h: 50 }), ball, { level: 'easy' });
K.sports.hit(ball, me, K.mouse, { power: CONFIG.hitPower });
K.sports.rules.volleyball(court, { to: CONFIG.to });
K.expose({ ball, me, cpu, court });
g.run();
```

## 5. Sınama

- Her modülün kendi test sayfası gerçek tarayıcıda (döngü, çarpışma, girdi, bot, kurallar, 3B sahne) çalıştırılır; sonuç rapor sunucusuna düşer (akıllı denetçinin altyapısı yeniden kullanılır).
- Python tarafı (kopyalama, modül seçimi, yama, kılavuz token bütçesi, JSON doğrulama) pytest ile.
- Uçtan uca: 14B ile aynı tarifler eski ve yeni yöntemle üretilir, geçen madde sayısı ve oynanabilirlik karşılaştırılır. Küçük modellerle (3B, 7B) en az bir deneme yapılır (indirme için kullanıcı izni alınır).

## 6. Hatalar ve geri dönüş
- Kütüphane dosyası eksik/bozuksa oyun üretimi durur ve açık bir hata gösterilir.
- Yama uygulanamazsa bütün dosya yöntemine dönülür.
- Modül listesi dışı bir istek atılır, çekirdekle devam edilir.
- Eski (kütüphanesiz) oyunlar çalışmaya devam eder; düzenlemede eski yöntem kullanılır.

## 7. Bellek ve donanım notu
Üretim bitince modelin bellekten kısa sürede bırakılması (Ollama `keep_alive`, örn. 1–2 dakika) bu işin yanında ayrıca eklenir. Don, bilgisayarın gücüne göre oyunu sadeleştirmesini önerir.

## 8. Kapsam dışı
Çevrimiçi çok oyunculu, bulut modeller, oyunun "eğlenceli mi" diye değerlendirilmesi, ses/müzik dosyası üretimi, harici ağ bağımlılıkları.

## 9. Başarı ölçütleri
- A+D+S sonunda: voleybol tarifi 14B ile kontrol listesinin çoğunu geçen, oynanabilir bir oyun veriyor (bugün: 0 madde doğrulandı, pong çıktı).
- Düzenleme yaması sonrası çalışan kısımlar bozulmuyor.
- Kılavuz bütçeleri test ile korunuyor.
- Kütüphane sürümü ve lisansları belgelenmiş.
