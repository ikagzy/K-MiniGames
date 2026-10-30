# kgame.ai.js: bot / yapay zekâ
Botlar bir varlığın `vx/vy`'sini her karede ayarlar. Hepsi `K.ai.` altında; `e` hareket edecek varlık.
- `K.ai.follow(e, hedef, {speed=120, stopAt=0})`: hedefe gider, `stopAt` uzaklıkta durur. `K.ai.flee(e, tehdit, {speed})` kaçar.
- `K.ai.wander(e, {speed=60})` rastgele dolaşır. `K.ai.patrol(e, [[x,y],[x2,y2]], {speed})` noktalar arasında gidip gelir (x,y = varlığın konumu).
- `K.ai.paddle(e, top, {level:'easy'|'normal'|'hard', axis:'y'|'x', speed})`: pong/voleybol rakibi; topun konumunu takip eder. `easy` yavaş ve gecikmeli, `hard` hızlı. `axis:'y'` yukarı-aşağı, `'x'` sağa-sola kayar. Botu topa BAKARAK hareket ettir; sabit salınım yazma.
- `K.ai.fsm(e, {bekle:(e,dt)=>{ ...; return 'kovala' }, kovala:(e,dt)=>{...}}, 'bekle')`: durum makinesi; işlev bir ad döndürürse o duruma geçer. Dönen `.state` şimdiki durumdur.
- `K.ai.astar(grid, [sutun,satir], [sutun,satir])`: grid[satır][sütun] 0 geçilir 1 duvar; yol [[c,r],...] ya da yol yoksa null.
- `K.ai.sees(a, b, duvarlarListesi, menzil)`: b'yi görüyor mu (arada duvar yok, menzil içinde).
- `K.ai.swarm(liste, {cohesion=0.3, separation=30, speed=80})`: sürü hareketi.
Düşman dalgası: `K.timer.every(2000, () => { const d = g.add({shape:'rect', x:K.rand(0,780), y:0, w:24, h:24, tag:'enemy'}); K.ai.follow(d, oyuncu, {speed:80}); })`.
