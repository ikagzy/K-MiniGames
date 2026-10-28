# Arayüz görselleri (danışman ekranı)

Danışmanla konuşma ekranı: karanlık piksel sanat bir ofis sahnesi, masanın arkasında danışman (resepsiyonist), altta diyalog kutusu.

## Dosyalar (`src/k_minigames/assets/ui/`)

| Dosya | Boyut | Ne |
|---|---|---|
| `sahne.png` | 1024x572 | Arka plan: tuğla duvar, pencere, "KAGZY" tabelası, masa, sandalye, lamba, açık kapı |
| `diyalog.png` | 733x213 | Beyaz çerçeveli, siyah iç diyalog kutusu (şeffaf dış kenar) |
| `danisman/*.png` | 222x199 (hepsi) | Danışmanın ifadeleri; tümü aynı tuvalde, karakter her karede aynı yerde |

Üretim: kullanıcının gönderdiği damalı (sahte şeffaf) resimler `tools/remove_checkerboard.py` ile gerçek şeffaf PNG'ye çevrildi. Aracı çalıştırmak için `Pillow` gerekir (yalnızca geliştirme makinesinde; uygulama yalnızca tkinter kullanır).

## Hangi kare hangi durumda

| Kare | Görünüm | Kullanılacağı durum |
|---|---|---|
| `bosta` | Uykulu gözlü, kalemle yazıyor | Boşta: kullanıcı bir şey yapmıyor, sohbet henüz başlamadı ya da uzun süre sessizlik |
| `karsilama` | Mutlu, el sallıyor | Danışman ekranı ilk açıldığında selam |
| `veda` | Hafif gülümseyen, el sallıyor | Ekran kapatılırken / sohbet bitince |
| `dinliyor` | İri gözlü, gülümsüyor | Sıra kullanıcıda ("SEN" yazıyor): kullanıcı mesaj yazarken |
| `yaziyor` | Gülümseyip kalemle yazıyor, ışıltılı | Sıra danışmanda ("DANIŞMAN" yazıyor): model cevap üretirken |
| `oneri` | Parmak havada, ampul | Danışman bir model önerdiği an (yükleme izni sorulurken) |
| `emin_degil` | Kafa kaşıyor | Danışman soruyu anlamadı ya da ek bilgi istiyor |
| `hata` | Şaşkın, ağzı "o" | Bir şey ters gitti (Ollama cevap vermedi, indirme hatası) |
| `bulamadi` | İri gözlü, omuz silkiyor | Uygun model ya da cevap bulunamadı (örneğin donanıma uygun model yok) |

## Diyalog kutusu kuralı
Sıra tek tarafta olur, ikisi aynı anda konuşmaz:
- Danışman konuşurken kutunun üstünde `DANIŞMAN` yazar, altında danışmanın mesajı gelir.
- Sıra kullanıcıdayken `SEN` yazar, altına kullanıcı kendi mesajını yazar.
- Kutunun içi simsiyah olduğu için yazı açık renkte olmalı.

## Birleştirirken karara bağlanacaklar
- Karakterin kendi hokkası ve tüy kalemi var; sahnede masada başka bir tüy kalem/hokka da var. Çakışırsa sahnedeki silinir ya da karakterinki kullanılır.
- Sahne ve karakterin piksel boyutları farklı olabilir; yerleştirirken karakter ölçeklenir (en yakın komşu ile, bulanıklaşmasın).
- Yazı tipi: piksel sanata uygun bir yazı tipi gerekebilir (lisansı uygun olanı).
- Zil, defter ve kapı gibi sahne nesnelerinin tıklanabilir bir işi olup olmayacağı ayrı bir konu (şimdilik yok sayılıyor).
