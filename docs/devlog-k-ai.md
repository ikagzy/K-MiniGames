# Devlog: k-ai (Bob'un özet modeli)

k-ai, K-MiniGames'te Bob'un kullandığı küçük modeldir (Qwen2.5-Coder-1.5B + bizim LoRA). Kod yazmaz: tarifi okuyup oyunun kısa
özetini (JSON) yazar, kit oyunu bu özetten kurar. Ölçümler `tools/train/data/report_*.json`, yan yana görmek için
`python tools/train/summary.py`.

## v1 (800 örnek, 2 tur)
Bildikleri: 7 tema, zorluk, seviye yoğunlukları (çukur, düşman, altın, blok, boru, uçan düşman, diken), kahraman ayarı (can, hız,
zıplama), tek özellik (çift zıplama), 1-4 seviye, ad, süre, 4 hazır müzikten biri.

| ölçüm | eğitimsiz 3B | k-ai v1 |
|---|---|---|
| üretilmiş tarifler, alan doğruluğu | 0,46 | 0,96 |
| elle yazılmış tarifler, alan | 0,79 | 0,84 |
| elle yazılmış, tarifin tamamı doğru | 0,58 | 0,67 |

## v2 (2000 örnek, 3 tur) ve eklenenler
Kit tarafı: 6 yeni özellik (yaylar, hız zeminleri, halka, kontrol noktası, buz, hareketli platform), tilki karakteri,
2-20 seviyeli kampanya, müzik üreteci (6 ruh hali), özgün tasarımlar, pencereye sığdırma.
Eğitim tarafı: yukarıdakilerin hepsi veride; daha çeşitli cümleler (aksansız yazım, sohbet, liste, markasız ifadeler).

Aynı yeni değerlendirme setinde (118 tarif, 32 elle yazılmış), HF üzerinde (ham model):

| eklenen şey | v1 | v2 |
|---|---|---|
| yeni özellikler | 3/35 (%8) | 36/36 (%100) |
| tilki karakteri | 0/14 | 16/16 |
| kampanya | 0/2 | 8/8 |
| müzik stili | 0/9 | 9/9 |
| elle yazılmış yeni 8 tarif | 0/8 | 6/8 |
| genel alan doğruluğu | 0,81 | 0,98 |
| elle yazılmış tarifin tamamı doğru | 0,44 | 0,69 |

Eskiyi unutma: yok denecek kadar az (tema -2, düşman sayısı -5 puan; diğer hepsi aynı ya da daha iyi).
Hâlâ yanlış giden: "bol altın / bol boru / bol blok" (eğitimde "bol" = 3, değerlendirme "yüksek" = 4 ve üstü bekliyor, tanım
uyuşmazlığı), yazıyla yazılmış sayılar ("on iki bölümlük kampanya" -> 12 yazamıyor; eğitimde rakamlar var).

## Eğitim altyapısı
Eğitim 6-7 kat hızlandı (kayıp yalnızca cevap konumlarında hesaplanıyor, sonuç birebir aynı), ara kayıt ve `--resume` eklendi.
Uzun koşuda bellek parçalanması yavaşlamaya yol açtı: durdurup `--resume` ile yeniden başlatmak çözdü.

## Açık sorun: Ollama'da v2 bozuluyor
HF'de v2 mükemmele yakın ama GGUF'a çevirip Ollama'ya alınca (uygulamanın kullandığı yol) bozuluyor:

| yol | geçerli özet | alan doğruluğu | elle yazılmış, hepsi doğru |
|---|---|---|---|
| v2, HF (ham model) | %100 | 0,98 | 0,69 |
| v2, Ollama q8 | %76 | 0,68 | 0,41 |
| v2, Ollama f16 (sıkıştırmasız) | %78 | 0,69 | 0,41 |
| v1, Ollama q8 | %98 | 0,73 | 0,38 |

Belirti: fazladan `}` ve `]]`, `generate` alanı kaybı, sürekli 9999/9113/9111 gibi seed. Elenen sebepler: istem farkı (jeton sayısı
birebir aynı, 1370), şablon, tekrar cezası, sıkıştırma (f16 de aynı), birleştirme hassasiyeti (float32 ile de aynı; birleştirilmiş
model HF'de doğru), donanım (CPU ve GPU birebir aynı çıktı). Kalan şüpheli: llama.cpp b6000 dönüştürmesi ya da Ollama'nın bu
modeli çalıştırması. Denenecekler: resmi llama.cpp ikilisiyle (llama-cli) aynı GGUF'u çalıştırmak (hata Ollama'da mı llama.cpp'de mi),
başka bir llama.cpp etiketiyle dönüştürmek, taban modeli aynı hatla çevirip HF ile karşılaştırmak.
Uygulamada şimdilik `game_model` = `k-ai` (v1); v2 (`k-ai-v2`) deneme amaçlı Ollama'da duruyor, HF doğruluğunu vermiyor.

## Ollama mı, dönüştürme mi? (llama.cpp testi)
Aynı `k-ai-v2-q8.gguf` resmi llama.cpp (b6000, `llama-server`, işlemcide) ile çalıştırıldı, aynı istemler ve aynı puanlama (`--limit 3` + 32 elle yazılmış):

| yol | elle yazılmış, hepsi doğru | alan |
|---|---|---|
| v2, HF (ham model) | 0,69 | 0,84 |
| v2, Ollama q8 | 0,41 | 0,58 |
| v2, llama.cpp q8 | 0,41 | 0,60 |

Sonuç: llama.cpp'de de aynı düşüş, yani sorun Ollama'da değil; GGUF dönüştürmesinde (ya da llama.cpp'nin bu modeli çalıştırmasında). Sıradaki: başka llama.cpp etiketiyle dönüştürmek, taban modeli aynı yoldan çevirip HF ile karşılaştırmak.
Not: llama.cpp ikilisi `<train env>/llamabin` altında (CPU, b6000). Türkçe karakterli yolu okuyamıyor, GGUF'u oraya kopyalamak gerekti.

## 14B ile karşılaştırma (eğitimsiz qwen2.5-coder:14b, şema açık)
32 elle yazılmış tarif: hepsi doğru 0,44, alan 0,72 (v2: 0,69 / 0,84; v1 yeni sette 0,44 / 0,70). Üretilmiş tarifler yalnızca 5 örnekle ölçüldü (güvenilmez). 14B karta sığmıyor (%43 işlemcide), istek başına ~17 sn; tam ölçüm ~35 dk daha sürerdi. Rapor: `report_base14b.json`.

## Sorunun asıl sebebi: seed rakamları (bulundu)
Aynı komutu HF'de (birleştirilmiş float32 model) ve llama.cpp'de jeton jeton karşılaştırdım (`first divergence`): iki yoldaki olasılıklar
0,03 farkla aynı, yani **dönüştürme bozuk değil**. Ayrışma, `"seed": ` sonrasındaki rakamda başlıyor: seed eğitimde rastgele (0-9999),
öğrenilemez, rakamlar arasında olasılık düz (hepsi ~%12). Üstelik "seed rakamı yaz" ile "`}` yazıp bitir" arasında da yazı-tura
durumu var (HF: `},` -2,28 / `9` -2,30). Böyle bir yerde minik sayı farkı (HF bf16/f32 ile llama.cpp q8) hangisinin seçileceğini
değiştiriyor; model bir kez yoldan çıkınca fazladan `}` yazıyor, `generate` alanını unutuyor. HF'de "şansa" doğru çıkıyordu.

Çözüm: **modelden seed istememek.** `specdata.py` artık seed yazdırmıyor (seviye, kampanya, müzik; seed alanı kitte zaten isteğe bağlı),
uygulama eksik seed'leri kendisi rastgele dolduruyor (`kits.fill_seeds`, `Generator._spec` içinde). Bu sürümü (v3) eğitmek gerekiyor;
v2 (seed'li) olduğu gibi kullanılırsa seed bölgesinde yine sapabilir.

## v3 ve kurallar katmanı (hangisi uygulamada?)
**v3** = v2 adaptörünün üstüne 1 tur ek eğitim (1000 örnek, 18 dk, `train_lora.py --init-adapter`): seed'siz cevaplar, "bol" = 4, yazıyla yazılmış kampanya sayıları.
Ham model (HF) v3: geçerli %100, doğruluk 0,97, elle yazılmış hepsi doğru 0,875 / alan 0,93 (v2 ham: 0,69 / 0,84). Not: bu artışın bir kısmı "bol" ve yazılı sayı düzeltmelerinden geliyor (ölçümün beklediği yöne çekilen veri); üretilmiş setteki 0,98 → 0,97 daha adil, fark yok.
Ama uygulama Ollama kullanıyor ve orada (GGUF) hem v2 hem v3 ham değerlerin çok altında kalıyor (Ollama / llama.cpp aynı). Kök sebep tam çözülmedi: seed rakamları tek sebep değil (v3 seed'siz eğitilse de Ollama'da düşük).

Uygulama tarafında iki katman eklendi (modelden bağımsız, eğitim gerektirmez):
- `kits.repair_spec`: şemaya göre onarım (bilinmeyen alan/değer atılır, sayılar aralığa çekilir, `generate` yoksa eklenir, **seed'leri hep uygulama rastgele koyar**).
- `specrules.apply` (`src/k_minigames/specrules.py`): tarifteki açık sözcüklerden alanları kuralla koyar (tema, tilki, özellikler, müzik ruh hali, kampanya sayısı yazıyla da, can, zorluk, "bol/az/olmasın" miktarları). Yalnızca k-ai modellerinde ve oluşturmada çalışır.

Ollama üzerinde ölçüm (117 üretilmiş + 32 elle yazılmış tarif):

| yol | geçerli | doğruluk | elle yazılmış hepsi / alan |
|---|---|---|---|
| v2 ham Ollama (kuralsız) | %76 | 0,68 | 0,41 / 0,58 |
| v2 + onarım | %100 | 0,75 | 0,50 / 0,73 |
| **v2 + onarım + kurallar** | **%100** | **0,84** | **0,84 / 0,92** |
| v3 + onarım + kurallar | %93 | 0,78 | 0,72 / 0,87 |

Karar: uygulamada `game_model` = `k-ai-v2` (kurallarla en iyisi). Ham v3 uygulamaya konamaz (PyTorch gerektirir); llama.cpp'li v3 de v2+kurallardan iyi değil ve uygulamaya bağlı değil.

## ÇÖZÜLDÜ: Ollama'da bozulmanın sebebi (rope_theta)
Sebep: transformers 5.x, birleştirilmiş modelin config'ine rope tabanını `rope_parameters.rope_theta` olarak yazıyor; llama.cpp b6000 dönüştürme
betiği yalnızca `rope_theta` okuyor ve bulamayınca **10000** yazıyordu (model 1.000.000 ile eğitildi). llama.cpp günlüğünde `freq_base_train = 10000`
görünüyordu. Konumlar yanlış kodlandığı için küçük hatalar birikiyor, özet bozuluyordu. v1, v2 ve v3'ün hepsi etkilenmişti. Seed, sıkıştırma,
Ollama, önbellek, ceza: hiçbiri sebep değildi (hepsi elendi; HF `generate`'in sessizce `repetition_penalty 1.1` uyguladığı da bulundu ama doğruluğu değiştirmiyor).
Düzeltme: `<train env>/llamacpp/convert_hf_to_gguf.py` içindeki `load_hparams`'a "K-MiniGames patch" eklendi (rope_parameters'tan rope_theta kopyalanıyor);
`install_kai.py` yama yoksa dönüştürmeyi reddediyor. Doğrulama: aynı istemde HF ve llama.cpp olasılıkları 0,01 içinde aynı (öncesinde 0,5-11 fark).

Düzeltilmiş GGUF ile Ollama ölçümü (117 üretilmiş + 32 elle yazılmış tarif):

| model / yol | geçerli | doğruluk | elle yazılmış hepsi / alan |
|---|---|---|---|
| v2 ham Ollama (onarım ve kural yok) | %100 | 0,925 | 0,688 / 0,851 |
| v2 uygulama (onarım + kurallar) | %100 | 0,961 | 0,906 / 0,959 |
| v3 ham Ollama | %100 | 0,972 | 0,875 / 0,932 |
| **v3 uygulama (onarım + kurallar)** | %100 | **0,969** | **0,938 / 0,973** |

Ham Ollama sayıları HF ölçümleriyle birebir aynı. Uygulamada `game_model` = `k-ai-v3`. Onarım ve kurallar katmanı kaldı (hâlâ +0,03-0,06 ekliyor).
Not: v3'ün elle yazılmış tarif artışının bir kısmı "bol" ve yazılı sayı düzeltmelerinden. Önceki "Ollama'da v3 v2'den kötü" ölçümleri hatalı GGUF'a aitti, geçersiz.
