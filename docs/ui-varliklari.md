# Arayüz görselleri (danışman ekranı)

Danışmanla konuşma ekranı: karanlık piksel sanat bir ofis sahnesi, masanın arkasında danışman (resepsiyonist), altta diyalog kutusu.

## Dosyalar (`src/k_minigames/assets/ui/`)

| Dosya | Boyut | Ne |
|---|---|---|
| `sahne.png` | 1024x572 | Arka plan: tuğla duvar, pencere, "KAGZY" tabelası, masa, sandalye, lamba, açık kapı |
| `diyalog.png` | 733x212 | Beyaz çerçeveli, siyah iç diyalog kutusu (şeffaf dış kenar) |
| `lobi.png` | 1678x937 | Oyun üretme ekranının arka planı: otel lobisi (GPT ile, ilk sahneyle aynı stil). Ortası ayı için boş; zemin çizgisi yaklaşık %60 yükseklikte |
| `danisman/*.png` | 222x199 (hepsi) | Danışmanın ifadeleri; tümü aynı tuvalde, karakter her karede aynı yerde |

Üretim: kullanıcının gönderdiği damalı (sahte şeffaf) resimler `tools/remove_checkerboard.py` ile gerçek şeffaf PNG'ye çevrildi. Aracı çalıştırmak için `Pillow` gerekir (yalnızca geliştirme makinesinde; uygulama yalnızca tkinter kullanır).

## Hangi kare hangi durumda

| Kare | Görünüm | Kullanılacağı durum |
|---|---|---|
| `bosta` | Uykulu gözlü, kalemle yazıyor | Boşta: kullanıcı bir şey yapmıyor, sohbet henüz başlamadı ya da uzun süre sessizlik |
| `karsilama` | Mutlu, el sallıyor | Danışman ekranı ilk açıldığında selam |
| `veda` | Hafif gülümseyen, el sallıyor | Ekran kapatılırken / sohbet bitince |
| `dinliyor` | İri gözlü, gülümsüyor | Sıra kullanıcıda ("SEN" yazıyor): kullanıcı mesaj yazarken |
| `yaziyor` | Gülümseyip kalemle yazıyor, ışıltılı | Sıra danışmanda: model cevabı henüz üretirken (bekleme); cevap gelince `konusuyor_a/b` devreye girer |
| `oneri` | Parmak havada, ampul | Danışman bir model önerdiği an (yükleme izni sorulurken) |
| `emin_degil` | Kafa kaşıyor | Danışman soruyu anlamadı, ek bilgi istiyor; ayrıca hata / uygun model bulunamadı durumlarında da bu kare (ayrı hata karesi yok) |
| `konusuyor_a` | Ağzı açık, kol açık | Danışmanın mesajı ekrana yazılırken: `konusuyor_b` ile dönüşümlü gösterilir (ağız hareketi) |
| `konusuyor_b` | Ağzı açık, kol açık | `konusuyor_a` ile aynı |

## Oyun üretme ekranının maskotu (otel görevlisi ayı)

Danışman, model bulunup kurulana kadarki ekranın maskotu. Bulunan model ile oyun yapıldığı ekranda (tarif yazma, üretim, deneme, düzenleme) bu ayı görünür. Kareler `assets/ui/maskot/` altında, 269x339 (ampul ve ışıltılar için üstte pay var), hepsi aynı tuvalde: kasket ucundan ayak tabanına yaklaşık 271 piksel, ayaklar aynı çizgide, kasket aynı dikey eksende. İkinci (düz magenta zeminli, 4x3 ızgara) set `tools/build_mascot.py` ile bölündü; ilk, damalı set CP-3'te duruyor.

Sahnede yaklaşık 0.75 ölçekle (200 piksel boy) iyi oturuyor; en yakın komşu değil, LANCZOS ile küçültüldü.

| Kare | Görünüm | Kullanılacağı durum |
|---|---|---|
| `bosta` | Eller önde, sakin, ağzı kapalı | Boşta: tarif bekleniyor |
| `dinliyor` | Kafası hafif eğik, dikkatli | Kullanıcı tarif yazarken |
| `selamlama` | Kapalı gözlü gülümseme, el sallıyor | Ekran ilk açıldığında |
| `veda` | Hafif gülümseme, el sallıyor | Ekran kapatılırken |
| `konusuyor_a` | `bosta` ile aynı poz, ağzı açık | Maskotun mesajı yazılırken; `bosta` ve `konusuyor_b` ile dönüşümlü (ağız animasyonu) |
| `konusuyor_b` | `bosta` ile aynı poz, yuvarlak "o" ağız | `konusuyor_a` ile aynı |
| `dusunuyor` | Kafasını kaşıyor, soru işareti | Oyun üretilirken |
| `test_ediyor` | Büyüteçle bakıyor | Oyun deneniyorken (test sekmesi açıkken) |
| `anladim` | Parmak havada, ampul | Hata bulunup çözüldüğünde ("buldum") |
| `basari` | İki kolu havada, ışıltılı | Oyun hazır olduğunda |
| `hata` | Elleri yanaklarında, ter damlası | Bir şey ters gitti (Ollama cevap vermedi, indirme hatası) |
| `emin_degil` | Omuz silkiyor | Test maddesi doğrulanamadı; uygun model/cevap bulunamadı |

Önizleme: `docs/onizleme-lobi.png` (lobi arka planı 1024x572'ye küçültülmüş + `bosta` karesi 0.75 ölçekle + diyalog kutusu). Ayı lobinin loş ışığına göre biraz parlak; sahneye koyarken hafifçe koyulaştırılacak.

## Diyalog kutusu kuralı
Sıra tek tarafta olur, ikisi aynı anda konuşmaz:
- Danışman konuşurken kutunun üstünde `DANIŞMAN` yazar, altında danışmanın mesajı gelir.
- Sıra kullanıcıdayken `SEN` yazar, altına kullanıcı kendi mesajını yazar.
- Kutunun içi simsiyah olduğu için yazı açık renkte olmalı.

## Birleştirirken karara bağlanacaklar
- Danışman ekranındaki karakterin kendi hokkası ve tüy kalemi var; sahnede masada başka bir tüy kalem/hokka da var. Çakışırsa sahnedeki silinir ya da karakterinki kullanılır. (Ayı ekranında bu sorun yok: lobi ayrı bir sahne.)
- Sahne ve karakterin piksel boyutları farklı olabilir; yerleştirirken karakter ölçeklenir (en yakın komşu ile, bulanıklaşmasın).
- Yazı tipi: piksel sanata uygun bir yazı tipi gerekebilir (lisansı uygun olanı).
- Zil, defter ve kapı gibi sahne nesnelerinin tıklanabilir bir işi olup olmayacağı ayrı bir konu (şimdilik yok sayılıyor).
