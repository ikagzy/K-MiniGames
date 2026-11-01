# kgame.puzzle.js: 2 boyutlu piksel bulmaca kiti (puzzle), üç modla
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit oyunu, tahtayı, taş ve blok çizimlerini (piksel sanatı, keskin), puanı, hedefi, hamle ya da hız sınırını, sesi ve ekranları kendisi kurar. Sen yalnızca özeti yaz.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `mode` (blocks: düşen bloklar, Tetris benzeri satır silme; match: üçlü eşleştirme, yan yana iki taşı değiştirip 3 ya da daha fazla aynı taşı patlatma, zincirleme; memory: hafıza kartları, iki aynı kartı bulma), `theme` (candy şeker, neon, forest orman, night gece), `music` (puzzle: bulmacaya özel sakin parça, varsayılan; overworld, underground, castle, boss, race, football), `difficulty` (1-5: blocks hızı, match hamle sayısı ve taş çeşidi, memory bekleme süresi), `size` (small, medium, large: tahta ya da kart sayısı), `goal` (hedef puan; 0 ise blocks bitmez, match kendi hedefini koyar; memory'de 0'dan büyükse hamle sınırı), `features` (ghost: blocks'ta bloğun düşeceği yer görünür, hold: blocks'ta parça saklanır, hint: match'te bekleyince ipucu).
`musicStyle` (isteğe bağlı, `music` yerine geçer): özgün müziği KENDİ BESTELER: `{mood: happy | calm | tense | epic | mystery | spooky, tempo: slow | medium | fast}`.
Sayıları (seed gibi) yazma, kit kendisi koyar.
Oynanış: blocks: oklar ya da A D sağa sola, aşağı hızlı indirir, yukarı ya da X döndürür, Z ters döndürür, Boşluk hemen düşürür, C ya da Shift saklar. match: oklar imleci kaydırır, Boşluk ya da Enter seçip yer değiştirir (ya da fare ile iki taşa tıkla). memory: oklar ve Boşluk ya da Enter (ya da fare) kartı açar. R yeniden başlatır, Esc menü açar.
Örnek:
```js
K.kit.run({ kit: 'puzzle', title: 'Şeker Bulmacası', mode: 'match', theme: 'candy', difficulty: 3, size: 'medium', music: 'puzzle', features: ['hint'] });
```
