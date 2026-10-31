# kgame.voxel.js: küp dünya kiti (madencilik ve inşaat, küçük bir blok dünyası)
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit tohumdan arazi üretir (tepeler, göller, mağaralar, madenler, ağaçlar), birinci şahıs görüntüyü, yürümeyi, zıplamayı, blok kırmayı ve koymayı, gündüz-geceyi ve değişiklikleri kaydetmeyi kendisi kurar; sen yalnızca özeti yaz.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `biome` (forest orman, plains ova, desert çöl, snow karlı), `size` (small, medium, large dünya boyutu), `caves` (0-3 mağara bolluğu), `ores` (0-3 maden bolluğu: kömür, demir, altın, elmas), `trees` (0-3 ağaç bolluğu), `lakes` (göller olsun mu, true/false), `time` (cycle gece gündüz döngüsü, day hep gündüz, night hep gece), `music` (overworld, underground, castle, boss), `features` (fly uçabilmek, sprint hızlı koşmak).
`musicStyle` (isteğe bağlı, `music` yerine geçer): `{mood: happy | calm | tense | epic | mystery | spooky, tempo: slow | medium | fast}`.
Sayı seçeneklerini yalnızca tarif isterse yaz (örneğin "bol maden" 3, "mağarasız" 0). Dünya tohumunu (seed) yazma, kit koyar.
Oynanış: W A S D yürür, oklar bakar, Boşluk zıplar, F kırar, E koyar, Q blok seçer.
Örnek:
```js
K.kit.run({ kit: 'sandbox', title: 'Küp Dünya', biome: 'forest', size: 'medium', caves: 2, ores: 2, lakes: true, trees: 2, time: 'cycle', features: ['fly'] });
```
