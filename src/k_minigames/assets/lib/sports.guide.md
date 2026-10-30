# kgame.sports.js: spor oyunları (voleybol, pong, futbol, basketbol)
Önce `K.sports.court(g, {type:'volleyball'|'pong'|'football'|'basketball', net})` ile saha, sonra `K.sports.ball(g, court, {radius, bounce})` ile top kur. Saha duvarı, zemini, fileyi, kaleyi ve top fiziğini kendisi halleder.
- `court.floorY`, `court.netX`, `court.sideOf(x)` ('left'|'right'). Voleybol/basketbolda `K.game({gravity: 700})` ver; pong/futbol yerçekimsizdir.
- `K.sports.hit(g, top, vuran, {x,y}, {power=650, reach=60, lift=0.35})`: vuran topa yakınsa topu hedefe gönderir (x VE y hızı verir, hep biraz yukarı); true/false döner.
- `K.sports.hitOnClick(g, top, oyuncu, {power})`: fareye her tıklayışta oyuncu topa fare konumuna vurur.
- `K.sports.autoHit(g, top, bot, {level, power, cooldown=0.5})`: bot topa yaklaşınca onu karşı sahaya gönderir. Botu hareket ettirmek için ayrıca `K.ai.paddle(bot, top, {axis:'x'})` kullan.
- Kurallar (skoru, servisi, kazananı yönetir; sonunda `g.go('over')`): `K.sports.rules.volleyball(g, court, {to=15, touches=3})`, `rules.pong(g, court, {to})`, `rules.goal(g, court, {to})` (futbol ve basketbol). Döndürdüğü `{scoreLeft, scoreRight, winner}` nesnesini göster.
- Pong'da raketlere `tag:'paddle'` ver; top raketten sekince yan hız kazanır.
- Oyuncu için `floor: court.floorY`, `jump`, `xmin/xmax` (file ortasını geçmesin) kullan.
Tam örnek (voleybol: oyuncu WASD + fare tıklaması, rakip bot):
```js
const CONFIG = {"gravity": 700, "hitPower": 650, "to": 15, "botLevel": "easy"};
const g = K.game({ width: 800, height: 450, gravity: CONFIG.gravity });
const court = K.sports.court(g, { type: 'volleyball', net: true });
const ball = K.sports.ball(g, court, { radius: 12, bounce: 0.85 });
const me = g.add({ shape: 'rect', x: 150, y: 300, w: 30, h: 50, color: '#4af', controls: 'wasd', axis: 'x',
                   speed: 220, gravity: true, floor: court.floorY, jump: 420, xmin: 0, xmax: court.netX - 33 });
const cpu = g.add({ shape: 'rect', x: 620, y: 300, w: 30, h: 50, color: '#f64', floor: court.floorY,
                    xmin: court.netX + 3, xmax: 770 });
K.ai.paddle(cpu, ball, { level: CONFIG.botLevel, axis: 'x' });
K.sports.autoHit(g, ball, cpu, { level: CONFIG.botLevel });
K.sports.hitOnClick(g, ball, me, { power: CONFIG.hitPower });
const rules = K.sports.rules.volleyball(g, court, { to: CONFIG.to });
g.ui.text('score', '0 - 0', 360, 30);
g.scene('play', { update: () => g.ui.text('score', rules.scoreLeft + ' - ' + rules.scoreRight, 360, 30) });
g.scene('over', { draw: (g, c) => { c.fillStyle = '#fff'; c.font = '40px sans-serif';
                                    c.fillText(rules.winner === 'left' ? 'Kazandın!' : 'Kaybettin', 300, 200); } });
K.expose({ g, ball, me, cpu, court, rules });
g.run();
```
