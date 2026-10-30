# kgame.js: oyun kütüphanesi (ÇEKİRDEK)
Oyunu bu kütüphaneyle yaz: yalnızca oyunun KURALLARINI yaz (40-80 satır). Kütüphane dosyaları için `<script src>` YAZMA, uygulama ekler. Sayfada bir `<canvas></canvas>` ve bir `<script>` olsun.
Düzen: en üstte `const CONFIG = {"hiz": 200}` (GEÇERLİ JSON: tırnaklı anahtarlar; sayılar, renkler, tuşlar burada); sonra `const g = K.game({...})`; en sonda `K.expose({ g, ...oyuncu, top, düşmanlar })` ve `g.run()`. Skor, konum gibi durum `K.expose` ile açılır (testler okur).
Konum: dikdörtgenin x,y'si SOL-ÜST köşesi; dairenin x,y'si MERKEZİ. Hızlar piksel/saniye.

## Oyun ve varlık
- `K.game({width=800,height=450,gravity=0,background})` -> g. `g.run()` döngüyü başlatır.
- `g.add({shape:'rect'|'circle'|'text', x,y,w,h,r,text,size,color, vx,vy, gravity:true, bounce:0..1, friction, bounds:true, tag, texture, life:ms, onUpdate:(e,dt)=>{}})` -> e. `bounds:true` dünya kenarlarında tutar/sektirir.
- Hareket: `controls:'wasd'|'arrows'` (+ `speed`, `axis:'x'|'y'` yalnız yatay/dikey, `jump:420` yerden zıplama), `floor:y` (varlığın kendi zemin çizgisi, `e.onFloor`), `xmin`/`xmax` (x sınırı).
- `g.remove(e)`, `g.all(tag?)`, `e.cx`, `e.cy`, `e.left/right/top/bottom`, `e.dead`.
- `g.onCollide(a, b, (a,b)=>{})`: a,b varlık ya da tag; temasın başında bir kez çağrılır.
## Girdi
- `K.key('a')`, `K.key('ArrowLeft')`, `K.key(' ')` basılı mı. `K.mouse.x/y/down` (oyun koordinatı).
## Sahne, skor, arayüz
- `g.scene('over', {enter(g), update(g,dt), draw(g,ctx)})`, `g.go('over')`. Dünya yalnız 'play' sahnesinde işler (başlangıç).
- `g.addScore('p', 1)`, `g.score('p')`. `g.ui.text(id, metin, x, y)`, `g.ui.bar(id, deger, max, x, y, genislik)`.
## Diğer
- `K.tilemap(['#..','.P#'], {'#':'wall'}, 32)` -> `map.addTo(g)` (duvarları çizer), `map.spawn('P')` -> [{x,y}], `g.collideTiles(e, map)` (her karede, oyuncuyu duvardan iter).
- `K.hit.rectRect(a,b)`, `K.hit.circleCircle`, `K.hit.circleRect`, `K.overlap(a,b)`.
- `g.follow(e, 0.1)` kamera, `g.shake(8, 200)`. `K.rand(a,b)`, `K.pick(liste)`, `K.seed(n)`.
- `K.timer.after(ms, fn)`, `K.timer.every(ms, fn)`, `K.tween(obj, {x:100}, 500)`.
- `K.sfx('jump'|'hit'|'coin'|'boom')` ses; `K.particles.burst(g, x, y, {count,color})`.
- `K.texture.make('brick'|'grass'|'stone'|'wood'|'water'|'sky', 32)` -> `texture` olarak ver (resim dosyası gerekmez).
- `K.save.set('en', 10)`, `K.save.get('en', 0)` en yüksek skor.
Hata yapma: `const game = ...` gibi bir değişkeni fonksiyonun İÇİNDE tanımlayıp başka fonksiyonda kullanma; tüm oyun değişkenlerini en üstte (`g`, `me`, `ball`...) tanımla.
