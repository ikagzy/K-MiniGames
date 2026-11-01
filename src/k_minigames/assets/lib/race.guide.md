# kgame.race.js: yukarıdan görünümlü 2 boyutlu piksel araba yarışı kiti (race)
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit pisti (tohumdan, kapalı bir pist: virajlar, kenar şeritleri, çim, başlangıç çizgisi, kenarda ağaç ya da bina ya da kaktüs), arabaları, rakipleri, turları, sıralamayı, küçük haritayı, sesi ve ekranları kendisi kurar; piksel sanatı kodla çizilir ve keskin görünür. Sen yalnızca özeti yaz.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `theme` (city şehir, desert çöl, forest orman, night gece), `music` (race: yarışa özel enerjik parça, varsayılan; overworld, underground, castle, boss), `difficulty` (1-5: rakiplerin hızı), `laps` (1-9 tur sayısı), `rivals` (1-7 rakip araba), `length` (small kısa pist, medium, large uzun pist), `car` (sport spor: dengeli, muscle kas: hızlı ama kaygan, rally ralli: tutuşu iyi, çimde az yavaşlar), `color` (red, blue, yellow, green: senin arabanın rengi), `features` (nitro Boşluk ile hız patlaması, grip daha iyi yol tutuşu).
`musicStyle` (isteğe bağlı, `music` yerine geçer): özgün müziği KENDİ BESTELER: `{mood: happy | calm | tense | epic | mystery | spooky, tempo: slow | medium | fast}`.
Sayıları (seed gibi) yazma, kit kendisi koyar. Pisti kit üretir, sen çizmezsin.
Oynanış: Yukarı ya da W gaz, aşağı ya da S fren ve geri, sol sağ ya da A D direksiyon, Boşluk nitro (özellik varsa), R yeniden başlar, Esc menü. Ekranda sıra, tur, süre, hız ve küçük harita görünür; yol dışına çıkmak yavaşlatır; arabalara çarpmak da. Turları ilk bitirenler podyuma çıkar.
Örnek:
```js
K.kit.run({ kit: 'race', title: 'Şehir Yarışı', theme: 'city', laps: 3, rivals: 5, difficulty: 3, length: 'medium', car: 'sport', color: 'red', music: 'overworld', features: ['nitro'] });
```
