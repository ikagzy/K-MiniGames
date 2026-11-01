# kgame.football.js: yukarıdan görünümlü 2 boyutlu piksel futbol kiti (football)
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit tek bir maçı kurar: iki takım (kaleci, defans, orta saha ve forvet dizilişi takım büyüklüğünden gelir), şeritli saha ve ağlı kaleler, yapay zekâ (top taşıma, pas, şut, pres, kaleci), gol, saat, altın gol uzatması, ses ve ekranlar; piksel sanatı kodla çizilir ve keskin görünür. Sen yalnızca özeti yaz.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `theme` (grass çim saha, night gece maçı, indoor salon, street sokak), `music` (overworld, underground, castle, boss, race), `difficulty` (1-5: rakibin gücü), `teamSize` (2-8: takımdaki oyuncu sayısı, kaleci dahil), `duration` (30-600 saniye maç süresi), `home` (senin takımının forma rengi) ve `away` (rakip), renkler: red, blue, yellow, green, white, black, orange, purple, `keeper` (true: kaleci var), `features` (powershot: basılı tutarak güçlü şut, sprint: daha uzun koşu).
`musicStyle` (isteğe bağlı, `music` yerine geçer): özgün müziği KENDİ BESTELER: `{mood: happy | calm | tense | epic | mystery | spooky, tempo: slow | medium | fast}`.
Sayıları (seed gibi) yazma, kit kendisi koyar.
Oynanış: W A S D ya da oklar koşar (topa en yakın oyuncuyu sen yönetirsin), Shift sprint, Boşluk şut (basılı tut: güç), E ya da K pas, Q oyuncu değiştirir, R yeniden başlar, Esc menü. Süre bitince en çok gol atan kazanır, berabere ise ilk golün kazandığı altın gol oynanır.
Örnek:
```js
K.kit.run({ kit: 'football', title: 'Mahalle Maçı', theme: 'grass', teamSize: 5, duration: 120, difficulty: 3, home: 'red', away: 'blue', keeper: true, music: 'overworld', features: ['powershot'] });
```
