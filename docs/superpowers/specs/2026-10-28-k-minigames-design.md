# K-MiniGames tasarımı

Kullanıcının kendi bilgisayarında, Ollama ile yerel yapay zekaya oyun yaptıran masaüstü uygulaması. Hazır oyun yok; kullanıcı tarif eder, model üretir, uygulama dener, düzeltir ve kütüphanede saklar.

**Kullanıcının söyledikleri**
- Mini oyun koleksiyonu değil: kullanıcı pencerede oyun tarifini yazar, Ollama oyunu yapar.
- Üretilen oyun HTML/JavaScript olur; uygulama kullanıcıya sorup belirlediği klasöre yazar ve her oyun için `.bat` başlatıcı oluşturur.
- K-Series, K-MiniGames'i otomatik algılar ve yalnızca bir ürün kartı gösterir. Oyun kütüphanesi K-MiniGames'in kendi arayüzündedir.
- Ollama'yı ve danışman modeli kullanıcı iki ayrı düğmeyle, boyutlarını görerek indirir. Danışmanla konuşunca danışman oyun için ayrı bir model önerir ve yüklemek için izin ister.
- Oyunlar üret-ve-düzenle mantığıyla çalışır: kullanıcı oyunun o anki halinden sıkılınca düzenleme isteği yazar.
- Kullanıcı doku (resim) dosyaları verebilir; model bunları kullanır.
- Uygulama oyunu kendisi dener, hata bulursa düzeltir; yakalayamayacağı davranışlar için bir test listesi (hafıza) tutar ve her denemede çalıştırır.

**Varsayımlar:** hedef kullanıcı kod bilmeyen biri; yalnızca Windows; arayüz dili K-Series'te seçilen dili izler.

## Kapsam dışı (ilk sürüm)
Hazır oyun içeriği, bulut/API modelleri, görüntü anlayan (vision) model desteği, çok oyunculu oyun, Windows dışı sistemler, modelin oyunu "eğlenceli mi" diye değerlendirmesi.

## Teknoloji
Python 3, tkinter, PyInstaller; K-Optimizer deposuyla aynı yığın. Dış bağımlılık mümkün olduğunca yok (HTTP için standart kütüphane).

## Parçalar

| Parça | Görevi | Bağımlılık |
|---|---|---|
| `ollama_client` | Ollama yerel API'si (`127.0.0.1:11434`): çalışıyor mu, kurulu modeller, sohbet, model indirme (ilerlemeli) | ağ |
| `installer` | Ollama kurulumunu indirip çalıştırır, danışman modelini çektirir; boyutu önceden gösterir; iptal edilebilir | `ollama_client` |
| `advisor` | Danışmanla sohbet; sonunda yapılandırılmış model önerisi (JSON) çıkarır | `ollama_client` |
| `model_check` | Önerilen model adını doğrular (Ollama'da var mı, RAM/VRAM'e sığar mı); uymazsa alternatif sunar | donanım bilgisi |
| `generator` | Tariften HTML üretir; düzenlemede mevcut HTML + istek + dokular + test listesini modele verip yeni sürüm üretir | `ollama_client` |
| `checker` | Dosya adı taraması, oyunu tarayıcıda deneme, test listesini çalıştırma, hatayı modele geri verme (üret → dene → düzelt döngüsü) | `generator`, `report_server` |
| `report_server` | Yalnızca `127.0.0.1` üzerinde, rastgele portlu, jetonlu küçük HTTP sunucusu; oyundaki izleme betiğinden hata ve test sonuçlarını alır | standart kütüphane |
| `library` | Oyun klasörü: oyunlar, sürümler, dokular, `.bat` başlatıcı, `testler.json` | dosya sistemi |
| `settings` | `%LOCALAPPDATA%\K-MiniGames` altında ayarlar (oyun klasörü, seçili model); K-Series buradan okur | dosya sistemi |
| `ui/` | Başlangıç ekranı, danışman sohbeti, kütüphane, düzenleme ekranı | hepsi |

## Oyun klasörü

```
Oyunlar\
  UzayOyunu\
    oyun.html        <- güncel sürüm
    baslat.bat       <- oyunu varsayılan tarayıcıda açar
    assets\          <- kullanıcının eklediği dokular
    surumler\        <- eski sürümler (geri dönüş için)
    testler.json     <- test listesi + çözülmüş hatalar (oyunun hafızası)
```

## Akış
1. **İlk açılış:** Ollama kurulu mu, danışman model var mı kontrol edilir. Eksikse iki ayrı düğme çıkar: "Ollama'yı indir" ve "Danışmanı indir", her birinin yanında boyut bilgisi. Oyun klasörü sorulur.
2. **Danışmanla konuşma:** Kullanıcı ne tür oyun istediğini anlatır; danışman oyun için ayrı bir model önerir (JSON). `model_check` adı ve donanım uygunluğunu doğrular, kullanıcıdan yükleme izni istenir.
3. **Üretim:** Kullanıcı tarif yazar (isteğe bağlı doku ekler, her dokuya kısa açıklama yazar). `generator` HTML'yi üretir; model ayrıca bir kontrol listesi yazar. Oyuna `window.__game` durum nesnesi açması (skor, konum, can) söylenir.
4. **Deneme ve düzeltme:** `checker` çalışır (aşağıda). Sonuç kullanıcıya dürüstçe gösterilir: "4 madde geçti, 1 madde doğrulanamadı".
5. **Kütüphane ve oynama:** Oyun kütüphanede görünür; `.bat` ile ya da arayüzden açılır.
6. **Düzenleme:** Kullanıcı "topu hızlandır" gibi istek yazar; mevcut HTML modele geri verilir, eski sürüm `surumler\`e alınır, test listesi yeniden çalışır (daha önce geçen madde bozulduysa fark edilir), yeni istekler listeye madde olarak eklenir.

## Dokular
- Dosyalar düzenleme ekranından eklenir, `assets\`e kopyalanır; ad, boyut ve kullanıcı açıklaması modele verilir.
- Model resmi görmez; yalnızca ad, boyut ve açıklama bilir.
- Yerel dosyada tarayıcı piksel okumayı (`getImageData`) engellediği için modele bu kullanımdan kaçınması söylenir.
- Üretim sonrası HTML'deki dosya adları taranır; olmayan bir dosyaya başvuru varsa modele geri bildirilir.

## Deneme ve test (checker)
1. **Dosya adı taraması:** `assets\` içeriği ile HTML'deki başvurular karşılaştırılır.
2. **Tarayıcıda deneme:** Oyun kullanıcının **varsayılan tarayıcısında** açılır (Edge'e bağımlı değil; arka planda gizli çalıştırma yok). Oyuna eklenen izleme betiği JavaScript hatalarını, yüklenemeyen resimleri ve konsol hatalarını `report_server`'a bildirir. Test sırasında sekmenin ön planda kalması gerekir (arka plan sekmelerinde zamanlayıcılar yavaşlar); arayüz "Oyun deneniyor, sekmeyi kapatma" der, bitince sekme "Test bitti, kapatabilirsin" der.
3. **Test listesi:** Her madde için model küçük bir test yazar; test sahte tuş/fare olayları gönderip `window.__game` durumunu kontrol eder. Maddeler `testler.json`da durumlarıyla saklanır: bekliyor / geçti / kaldı / doğrulanamadı.
4. **Döngü:** Hata ya da kalan madde varsa hata mesajı ve ilgili kod modele verilir. En fazla 3 deneme; düzelmezse en iyi sürüm saklanır, ilgili madde "doğrulanamadı" işaretlenir.
5. **Bilinen sınır:** Testi de model yazdığı için sorunun oyunda mı testte mi olduğu her zaman ayrılamaz. Testin kendisi önce boş durumla çalıştırılıp anlamsız sonuç veriyor mu diye bakılır; bu hatayı tamamen elemez, bu yüzden sonuç kullanıcıya olduğu gibi gösterilir.

## K-Series entegrasyonu
K-Series `k_series/products.py` içinde K-MiniGames'i yeni bir ürün olarak algılar (çalışan süreç, kayıtlı yol `%LOCALAPPDATA%\K-MiniGames`, Programs/Program Files, masaüstü taraması; sürüm exe'den okunur). Yalnızca kart gösterir: sürüm, çalışıyor mu, "Aç". Bu değişiklik K-Optimizer deposunda ayrı bir iştir ve bu spec'in uygulama planında ayrı adım olarak yer alır.

## Hata durumları
- Ollama kurulu değil / çalışmıyor: başlangıç ekranı ilgili düğmeyi gösterir, hata değil durumdur.
- İndirme yarıda kesildi: kaldığı yerden denenir, olmazsa yeniden başlat seçeneği.
- Model önerisi geçersiz ya da donanıma fazla büyük: alternatif sunulur, kullanıcıya açıklanır.
- Üretilen HTML boş / bozuk: otomatik düzeltme turuna girer, 3 turdan sonra kullanıcıya bildirilir.
- Disk dolu / klasöre yazılamıyor: oyun üretilmeden önce kontrol edilir.

## Güvenlik
- `report_server` yalnızca `127.0.0.1`'de dinler, rastgele port ve tek kullanımlık jeton kullanır.
- Model çıktısı kod olarak kullanıcının tarayıcısında çalışır; modele dış ağ isteği yapmaması söylenir ve üretim sonrası HTML'de `http://`, `https://` başvuruları taranıp uyarı verilir.
- Ollama ve danışman modeli yalnızca kullanıcının tıklamasıyla indirilir; indirme adresi ve boyut önceden gösterilir.

## Test stratejisi (uygulamanın kendisi için)
`ollama_client`, `model_check`, `library`, `checker` mantığı sahte Ollama yanıtlarıyla ve geçici klasörlerle birim testi alır. Arayüz ekranları elle ve ekran görüntüsüyle doğrulanır. Gerçek model gerektiren akış ayrı, elle çalıştırılan bir uçtan uca denemedir.

## Açık noktalar (planda kararlaştırılacak)
- Danışman modelin seçimi: yaklaşık 1-2 GB, Türkçe bilen küçük bir model; plan aşamasında denenerek seçilir.
- Varsayılan tarayıcıda test sekmesi kapanmadığı için kullanıcı deneyiminin nasıl hissettirdiği ilk prototipte değerlendirilir.

## Geliştirme süreci
- Her iş bitişinde `docs/CHECKPOINTS.md`a kayıt eklenir (numara, tarih, yapılan iş, git commit'i). Bozulursa "CPn'e dön" denerek o commit'e dönülür.
- `docs/HAFIZA.md` konuşulanların ve yapılanların özetini tutar; her oturumun başında okunur (`CLAUDE.md` bunu söyler).
