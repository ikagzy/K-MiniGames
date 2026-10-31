# kgame.shooter.js: nişancı oyunu kiti (dikey kayan uzay nişancısı)
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit gemiyi, düşman dalgalarını, güçlendirmeleri, patronu, skoru, canı, sesi ve ekranları kendisi kurar; sen yalnızca özeti yaz.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `theme` (space, night, sky, underwater, cave, castle, forest), `music` (overworld, underground, castle, boss), `difficulty` (1-5, genel zorluk), `waves` ({count: 3-20 dalga sayısı}), `ship` ({speed: 150-400, lives: 1-9, fire: single | double | spread}), `enemies` (kullanılacak düşman türleri: drifter süzülen, zigzag, shooter ateş eden, kamikaze üstüne atılan, tank dayanıklı; en az biri), `boss` (true: son dalgadan sonra patron gelir), `features` (shield kalkan, bomb bomba, spread üç yöne ateş, rapid hızlı ateş).
`musicStyle` (isteğe bağlı, `music` yerine geçer): özgün müziği KENDİ BESTELER: `{mood: happy | calm | tense | epic | mystery | spooky, tempo: slow | medium | fast}`.
Dalgaları kit kurar: zorluk dalga dalga artar, düşman türleri sırayla açılır. Sayılar yazma (seed gibi), kit kendisi koyar.
Oynanış: A/D ya da oklar hareket eder, Boşluk ateş eder, B ya da Shift bomba atar (bomb özelliğiyle); güçlendirmeler düşer (ateş, kalkan, can).
Örnek:
```js
K.kit.run({ kit: 'shooter', title: 'Yıldız Savaşı', theme: 'space', difficulty: 3, waves: { count: 8 },
  ship: { lives: 3, fire: 'double' }, enemies: ['drifter', 'zigzag', 'shooter'], boss: true, features: ['shield', 'bomb'] });
```
