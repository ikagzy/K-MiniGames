# kgame.blast.js: 2 boyutlu piksel blok yerleştirme kiti (blast, Block Blast türü)
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit tahtayı, her turda verilen üç parçayı (döndürme yok), sürükle-bırak ve klavye kontrolünü, dolan satır ve sütunların patlamasını, kombo çarpanını, en iyi skoru, sesi ve ekranları kendisi kurar; piksel sanatı kodla çizilir ve keskin görünür. Sen yalnızca özeti yaz.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `theme` (candy şeker, neon, ocean okyanus, night gece), `size` (small 6x6 tahta, medium 8x8, large 10x10), `difficulty` (1-5: parçaların zorluğu ve tahtanın baştaki dolu karesi), `goal` (hedef puan; 0 ise oyun bitmeden sürer, sonsuz), `music` (blast: bu oyuna özel parça, varsayılan; overworld, underground, castle, boss, race, football, puzzle, adventure, tower, fighter), `features` (hint: bekleyince nereye konacağını gösterir, undo: son hamleyi üç kez geri alır, bomb: ara sıra 3x3 alan temizleyen bomba parçası gelir).
`musicStyle` (isteğe bağlı, `music` yerine geçer): özgün müziği KENDİ BESTELER: `{mood: happy | calm | tense | epic | mystery | spooky, tempo: slow | medium | fast}`.
Sayıları (seed gibi) yazma, kit kendisi koyar.
Oynanış: alttaki üç parçadan birini fareyle tutup tahtaya sürükle ve bırak (ya da oklarla imleci kaydır, 1-2-3 ile parça seç, Boşluk ya da Enter ile koy). Dolan satır ve sütun patlar; art arda patlatırsan kombo büyür; tahtayı bütün boşaltırsan +100. Üç parçadan hiçbiri sığmazsa oyun biter. U geri alır (undo), H ipucu verir (hint), R yeniden başlatır, Esc menü açar.
Örnek:
```js
K.kit.run({ kit: 'blast', title: 'Blok Patlat', theme: 'candy', size: 'medium', difficulty: 3, goal: 0, music: 'blast', features: ['hint', 'undo'] });
```
