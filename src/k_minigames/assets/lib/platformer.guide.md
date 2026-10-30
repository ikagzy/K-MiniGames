# kgame.platformer.js: platform oyunu kiti (Mario türü)
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit seviyeyi, kahramanı (koşma, zıplama, kısa/uzun zıplama), düşmanları (ezme), altınları, blokları, mantarı, bayrağı, kamerayı, arayüzü, müziği ve ölme/yeniden başlamayı kendisi yapar.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `theme` (sky, cave, castle, night, underwater, space, forest), `music` (overworld, underground, castle, boss), `world` ('1-1'), `time` (saniye), `hero` ({speed: 170, jump: 430, lives: 3}), `gravity`, `qblocks` (soru bloklarının içi sırayla: 'coin', 'mushroom', 'star'), `features` (['doubleJump']), `generate`.
`generate`: seviyeleri ÜRETİR; her eleman bir seviyedir (birden çok seviye sırayla oynanır). Seviyeyi çizme, sayılarla tarif et: `width` (24-160), `difficulty` (1-5), `seed` (0-9999; başka sayı başka seviye) ve yoğunluklar 0-5: `pits` çukur, `enemies` yürüyen düşman, `blocks` tuğla ve soru bloğu, `pipes` boru, `coins` altın, `flyers` uçan düşman, `spikes` diken (diken zorluk 3'ten sonra). Üretilen seviye her zaman bitirilebilir.
Oynanış: A/D ya da oklar yürür, Shift koşar, W/Yukarı/Boşluk zıplar (basılı tutarsan daha yükseğe); düşmanın üstüne inince ezer, yandan çarparsa can gider; bayrağa ulaşınca seviye biter.
Örnek (iki seviye, çift zıplama):
```js
K.kit.run({
  kit: 'platformer', title: 'Kagzy', theme: 'sky', music: 'overworld', world: '1-1', time: 300,
  hero: { speed: 170, jump: 430, lives: 3 },
  features: ['doubleJump'],
  generate: [
    { width: 60, difficulty: 1, seed: 3, pits: 2, enemies: 2, blocks: 3, pipes: 2, coins: 3 },
    { width: 80, difficulty: 3, seed: 8, pits: 3, enemies: 3, blocks: 2, pipes: 3, coins: 2, flyers: 2, spikes: 2 }
  ]
});
```
İleri (seviyeyi elle çizmek istersen): `levels: [[satırlar]]` yaz, `generate` yerine geçer. Harfler: `#` zemin, `B` tuğla, `?` soru bloğu, `T` boru, `o` altın, `E` düşman, `^` uçan düşman, `S` diken, `M` mantar, `*` yıldız, `P` başlangıç, `F` bayrak (P ve F zorunlu); en fazla 3 karo boşluk atlanır.
