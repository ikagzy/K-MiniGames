# kgame.platformer.js: platform oyunu kiti (Mario türü)
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit seviyeyi, kahramanı (koşma, zıplama, kısa/uzun zıplama), düşmanları (ezme), altınları, blokları, mantarı, bayrağı, kamerayı, arayüzü, müziği ve ölme/yeniden başlamayı kendisi yapar. Sayfada `<canvas></canvas>` ve tek `<script>` olsun.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `theme` (sky, cave, castle, night, underwater, space, forest), `music` (overworld, underground, castle, boss), `world` ('1-1'), `time` (saniye), `hero` ({speed: 170, jump: 430, lives: 3}), `gravity`, `qblocks` (soru bloklarının içi sırayla: 'coin', 'mushroom', 'star'), `levels` (satır listeleri; birden çok seviye sırayla oynanır), `features` (['doubleJump']).
Seviye harfleri: `#` zemin, `B` tuğla, `?` soru bloğu, `T` boru, `o` altın, `E` yürüyen düşman, `^` uçan düşman, `S` diken, `M` mantar, `*` yıldız, `P` başlangıç (zorunlu), `F` bayrak (zorunlu), `.` boş. Satırlar aynı uzunlukta olsun, en alta zemin koy. En fazla 3 karo boşluk ve 4 karo yükseklik atlanır; bitirilemeyen seviyede kit hata verir.
Oynanış: A/D ya da oklar yürür, Shift koşar, W/Yukarı/Boşluk zıplar (basılı tutarsan daha yükseğe); düşmanın üstüne inince ezer, yandan çarparsa can gider.
Tam örnek (iki seviye, çift zıplama):
```js
K.kit.run({
  kit: 'platformer', title: 'Kagzy', theme: 'sky', music: 'overworld', world: '1-1', time: 300,
  hero: { speed: 170, jump: 430, lives: 3 },
  qblocks: ['coin', 'coin', 'mushroom'],
  features: ['doubleJump'],
  levels: [
    [
      '..............................',
      '..............................',
      '..........B?B?B...............',
      '..............................',
      '...o.o...........o.o.o....o...',
      'P.....E......T.........E...F..',
      '##########..##################',
      '##########..##################'
    ],
    [
      '........................',
      '........................',
      '....o.o........o.o......',
      '......BBB.....BBBB......',
      '..................*.....',
      'P....E.....^..S...E...F.',
      '##########...###########',
      '##########...###########'
    ]
  ]
});
```
