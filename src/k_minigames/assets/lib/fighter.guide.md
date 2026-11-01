# kgame.fighter.js: yandan görünümlü 2 boyutlu piksel dövüş kiti (fighter)
Oyunu KOD olarak değil ÖZET olarak yaz: tek çağrı `K.kit.run({...})`; kütüphane dosyaları için `<script src>` yazma. Kit sahneyi, iki dövüşçüyü, yumruk ve tekme ve bloğu, kombo sayacını, can ve özel çubuğunu, turları, rakibi oynayan yapay zekâyı, sesi ve ekranları kendisi kurar; piksel sanatı kodla çizilir ve keskin görünür. Sen yalnızca özeti yaz.
Özet alanları (hepsi isteğe bağlı, yazmazsan varsayılan): `title`, `theme` (dojo dövüş salonu, street sokak, temple tapınak, volcano yanardağ), `hero` (senin dövüşçün) ve `rival` (rakip): brawler dengeli dövüşçü, ninja hızlı ama az canlı, sumo yavaş ama çok canlı ve sert vuran, `color` (senin dövüşçünün rengi: red, blue, yellow, green), `music` (fighter: dövüşe özel sert parça, varsayılan; overworld, underground, castle, boss, race, football, puzzle, adventure, tower), `difficulty` (1-5: rakibin gücü ve tepkisi), `rounds` (1-5: maçı kazanmak için gereken tur sayısı), `time` (20-99 saniye tur süresi), `features` (special: özel çubuğu dolunca ateş topu, versus: ikinci oyuncu da klavyeden oynar, rage: canı azalınca daha sert vurur).
`musicStyle` (isteğe bağlı, `music` yerine geçer): özgün müziği KENDİ BESTELER: `{mood: happy | calm | tense | epic | mystery | spooky, tempo: slow | medium | fast}`.
Sayıları (seed gibi) yazma, kit kendisi koyar.
Oynanış: A D yürür, W zıplar, J yumruk (hızlı), K tekme (uzun ve sert), L blok (basılı tut), U özel hareket; versus ile ikinci oyuncu: oklar yürür ve zıplar, N yumruk, M tekme, virgül blok, nokta özel. R yeniden başlatır, Esc menü açar. Rakibin canını bitirirsen ya da süre bitince canın fazlaysa turu alırsın, `rounds` tur kazanan maçı alır.
Örnek:
```js
K.kit.run({ kit: 'fighter', title: 'Sokak Dövüşü', theme: 'street', hero: 'brawler', rival: 'ninja', color: 'red', difficulty: 3, rounds: 2, time: 60, music: 'fighter', features: ['special'] });
```
