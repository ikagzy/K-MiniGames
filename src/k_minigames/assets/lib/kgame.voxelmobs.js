/* kgame.voxelmobs.js: küp dünyanın CANLILARI: veri (tür, can, boyut, düşen şeyler, piksel çizim) ve yapay zekâ (gezinme, kovalama, ateş etme, patlama).
   Dünya bilgisi dışarıdan gelir (W: get, oyuncu, gündüz ışığı, oyuncuya hasar...), bu dosya dünyayı bilmez. Önce kgame.js ve kgame.voxeldata.js. */
(function (root) {
  var K = root.K;
  var M = K.voxelmobs = {};

  // item ids of the things they drop (kept in kgame.voxeldata.js)
  var DROP = { RAW_BEEF: 82, COOKED_BEEF: 83, RAW_PORK: 84, COOKED_PORK: 85, RAW_MUTTON: 86, COOKED_MUTTON: 87, RAW_CHICKEN: 88, COOKED_CHICKEN: 89, RAW_RABBIT: 110, COOKED_RABBIT: 111,
               FEATHER: 112, LEATHER: 113, STRING: 114, BONE: 115, GUNPOWDER: 116, ROTTEN: 117, ARROW: 118, WOOL: 34 };
  M.DROP = DROP;

  // kind: passive (wanders, flees when hit) or hostile (hunts); size in blocks; speed in blocks per second; drops: [item, [min, max]]
  M.TYPES = {
    cow: { name: "inek", kind: "passive", hp: 10, w: 0.9, h: 1.4, speed: 1.2, drops: [[DROP.RAW_BEEF, [1, 3]], [DROP.LEATHER, [0, 2]]] },
    pig: { name: "domuz", kind: "passive", hp: 10, w: 0.9, h: 0.9, speed: 1.3, drops: [[DROP.RAW_PORK, [1, 3]]] },
    sheep: { name: "koyun", kind: "passive", hp: 8, w: 0.9, h: 1.3, speed: 1.2, drops: [[DROP.WOOL, [1, 1]], [DROP.RAW_MUTTON, [1, 2]]] },
    chicken: { name: "tavuk", kind: "passive", hp: 4, w: 0.4, h: 0.7, speed: 1.1, drops: [[DROP.RAW_CHICKEN, [1, 1]], [DROP.FEATHER, [0, 2]]] },
    rabbit: { name: "tavşan", kind: "passive", hp: 3, w: 0.4, h: 0.5, speed: 2.2, drops: [[DROP.RAW_RABBIT, [1, 2]], [DROP.LEATHER, [0, 1]]] },
    zombie: { name: "zombi", kind: "hostile", hp: 20, w: 0.6, h: 1.8, speed: 1.9, dmg: 3, burns: true, drops: [[DROP.ROTTEN, [0, 2]]] },
    skeleton: { name: "iskelet", kind: "hostile", hp: 20, w: 0.6, h: 1.8, speed: 1.6, ranged: true, burns: true, drops: [[DROP.BONE, [0, 2]], [DROP.ARROW, [0, 2]]] },
    bomber: { name: "patlayıcı", kind: "hostile", hp: 20, w: 0.6, h: 1.7, speed: 1.7, explode: true, drops: [[DROP.GUNPOWDER, [0, 2]]] },
    villager: { name: "köylü", kind: "passive", npc: true, hp: 20, w: 0.6, h: 1.8, speed: 1.0, drops: [] },   // lives in a village, trades with a right click
    spider: { name: "örümcek", kind: "hostile", hp: 16, w: 1.2, h: 0.9, speed: 2.6, dmg: 2, drops: [[DROP.STRING, [0, 2]]] },
    ember: { name: "közcü", kind: "hostile", hp: 16, w: 0.6, h: 1.8, speed: 1.5, ranged: true, drops: [[155, [1, 3]], [43, [0, 1]]] },   // the Kor Diyarı: throws embers from a distance
    warden: { name: "kor bekçisi", kind: "hostile", hp: 30, w: 0.8, h: 1.9, speed: 2.2, dmg: 5, drops: [[155, [0, 2]], [43, [0, 2]]] }   // a heavy brute that hits hard
  };
  M.PASSIVE = ["cow", "pig", "sheep", "chicken", "rabbit"];
  M.HOSTILE = ["zombie", "skeleton", "bomber", "spider"];
  M.NETHER = ["ember", "warden"];   // only in the Kor Diyarı

  // ---- pixel art: rows of colour letters, '.' is clear; each type has its own palette ----
  M.ART = {
    cow: { pal: { b: [92, 60, 40], w: [235, 235, 235], k: [30, 30, 30], p: [210, 160, 160] },
           rows: ["..bb..bb..", "..bbbbbb..", ".bbwbbwbb.", ".bbkbbkbb.", "..bppppb..", "bbbbbbbbbb", "bwwbbbbwwb", "bwwbbbbwwb", "bbbbbbbbbb", "bbbbbbbbbb", "bb.bbbb.bb", "bb.bbbb.bb", "bb......bb"] },
    pig: { pal: { p: [232, 160, 170], d: [200, 120, 130], k: [30, 30, 30] },
           rows: ["..pp....pp..", ".pppppppppp.", ".pkppppppkp.", ".pddppppddp.", ".pppppppppp.", "pppppppppppp", "pppppppppppp", ".pp..pp..pp.", ".pp..pp..pp."] },
    sheep: { pal: { w: [240, 240, 240], g: [200, 200, 205], f: [214, 190, 170], k: [30, 30, 30] },
             rows: ["....ff....", "...ffff...", "..wfkfkf..", "wwwwffffww", "wgwwwwwwgw", "wwwwwwwwww", "wgwwwwwwgw", "wwwwwwwwww", "ww.wwww.ww", "ff.ffff.ff", "ff......ff"] },
    chicken: { pal: { w: [245, 245, 245], y: [240, 190, 60], r: [210, 50, 50], k: [30, 30, 30] },
               rows: ["..rr..", ".wwwy.", ".wkww.", "wwwwww", "wwwwww", ".wwww.", "..yy.."] },
    rabbit: { pal: { t: [180, 140, 100], w: [235, 225, 210], k: [30, 30, 30] },
              rows: [".t..t.", ".t..t.", ".tttt.", "tktktt", "tttttt", "ttwwtt", ".tttt.", ".t..t."] },
    zombie: { pal: { g: [90, 150, 80], s: [60, 100, 170], p: [60, 60, 120], k: [30, 30, 30], r: [160, 40, 40] },
              rows: ["..gggggg..", "..gkggkg..", "..gggggg..", "..grrrrg..", "gggsssssgg", "g.gsssssg.", "g.gsssssg.", "g.gsssssg.", "..pppppp..", "..pp..pp..", "..pp..pp..", "..pp..pp..", "..kk..kk.."] },
    skeleton: { pal: { w: [225, 225, 215], g: [150, 150, 145], k: [40, 40, 40] },
                rows: ["..wwwwww..", "..wkwwkw..", "..wwkkww..", "..wwwwww..", "...gwwg...", "w.wwgwgww.", "w..wgwgw..", "w...wgw...", "....wwww..", "...ww..ww.", "...w....w.", "...w....w.", "..ww....ww"] },
    bomber: { pal: { g: [70, 170, 80], d: [40, 120, 50], k: [20, 40, 20] },
              rows: ["..gggggg..", "..gkggkg..", "..ggkkgg..", "..gkggkg..", "...gggg...", "..gggggg..", "..gdgdgg..", "..gggggg..", "..gggggg..", "..gg..gg..", "..gg..gg..", "..dd..dd.."] },
    ember: { pal: { y: [255, 220, 80], o: [240, 140, 40], r: [170, 50, 30], k: [30, 20, 20] },
             rows: ["..y.yy.y..", "..yyyyyy..", "..oooooo..", "..okooko..", "..oooooo..", "...orro...", "o.oooooo.o", "o.oorroo.o", "..oooooo..", "..oo..oo..", "..rr..rr.."] },
    warden: { pal: { h: [60, 20, 20], r: [150, 50, 45], d: [100, 30, 30], y: [255, 220, 80] },
              rows: ["..hhhhhh..", ".hrrrrrrh.", ".ryrrrryr.", ".rrrddrrr.", "..rrrrrr..", "rrrrrrrrrr", "rr.rrrr.rr", "rr.rddr.rr", "rr.rrrr.rr", "...rr.rr..", "...rr.rr..", "..hh..hh.."] },
    villager: { pal: { r: [120, 84, 60], s: [214, 170, 130], n: [190, 140, 100], k: [30, 30, 30], b: [90, 60, 40], g: [100, 130, 60] },
                rows: ["..bbbbbb..", "..ssssss..", "..sksskss.", "..ssnnss..", "..ssnnss..", "..rrrrrr..", ".rrrrrrrr.", "rrgrrrrgrr", "rrrrrrrrrr", "..rrrrrr..", "..rr..rr..", "..bb..bb.."] },
    spider: { pal: { d: [50, 40, 40], r: [210, 40, 40], g: [90, 80, 80] },
              rows: ["d..........d", ".d..dddd..d.", "..dddrddd...", "ddddrddrdddd", ".dddddddddd.", "d.dd.dd.dd.d", "d..d....d..d"] }
  };

  M.create = function (type, x, y, z) {
    var t = M.TYPES[type];
    return { type: type, x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, hp: t.hp, yaw: 0, onGround: false, wander: 0, dirx: 0, dirz: 0, fear: 0, cooldown: 1, fuse: 0, flash: 0, age: 0, kx: 0, kz: 0, burn: 0 };
  };
  // what dies leaves behind: [[item, count], ...] (chance decided by the random function r() in 0..1)
  M.drops = function (type, r) {
    var out = [];
    M.TYPES[type].drops.forEach(function (d) { var n = d[1][0] + Math.floor(r() * (d[1][1] - d[1][0] + 1)); if (n > 0) out.push([d[0], n]); });
    return out;
  };

  // ---- one step of a creature. W: { get(x,y,z), solid(b), player: {x,y,z}, daylight, rnd(), hurtPlayer(n, why), shoot(from, to), explode(x,y,z) } ----
  function boxFree(W, x, y, z, w, h) {
    for (var bx = Math.floor(x - w / 2); bx <= Math.floor(x + w / 2); bx++) for (var bz = Math.floor(z - w / 2); bz <= Math.floor(z + w / 2); bz++)
      for (var by = Math.floor(y); by <= Math.floor(y + h - 0.01); by++) if (W.solid(W.get(bx, by, bz))) return false;
    return true;
  }
  M.step = function (m, dt, W) {
    var t = M.TYPES[m.type], p = W.player;
    m.age += dt; m.flash = Math.max(0, m.flash - dt); m.cooldown -= dt; m.fear = Math.max(0, m.fear - dt);
    var dx = p.x - m.x, dz = p.z - m.z, dist = Math.sqrt(dx * dx + dz * dz), dy = p.y - m.y, dist3 = Math.sqrt(dist * dist + dy * dy);
    var wantX = 0, wantZ = 0, speed = t.speed;
    if (t.kind === "passive") {
      m.wander -= dt;
      if (m.wander <= 0) { m.wander = 2 + W.rnd() * 4; var a = W.rnd() * 6.283; m.dirx = W.rnd() < 0.4 ? 0 : Math.cos(a); m.dirz = m.dirx === 0 ? 0 : Math.sin(a); }
      wantX = m.dirx; wantZ = m.dirz;
      if (m.fear > 0 && dist > 0.01) { wantX = -dx / dist; wantZ = -dz / dist; speed *= 2; }   // hit: runs from the player
    } else {
      var burning = t.burns && W.daylight > 0.8 && W.skyOpen(m.x, m.y + t.h, m.z);
      if (burning) { m.burn += dt; if (m.burn >= 1) { m.burn = 0; m.hp -= 2; m.flash = 0.2; } }
      if (dist3 < 20 && dist > 0.01) {
        if (t.ranged) {   // keeps its distance and shoots
          if (dist > 9) { wantX = dx / dist; wantZ = dz / dist; } else if (dist < 5) { wantX = -dx / dist; wantZ = -dz / dist; }
          if (dist < 15 && m.cooldown <= 0) { m.cooldown = 2; W.shoot({ x: m.x, y: m.y + 1.4, z: m.z }, { x: p.x, y: p.y + 1.2, z: p.z }); }
        } else if (t.explode) {
          if (dist < 3 && Math.abs(dy) < 2) { m.fuse += dt; speed = 0; if (m.fuse >= 1.5) { W.explode(m.x, m.y + 0.8, m.z); m.dead = true; m.exploded = true; return; } }
          else { m.fuse = Math.max(0, m.fuse - dt); wantX = dx / dist; wantZ = dz / dist; }
        } else {
          wantX = dx / dist; wantZ = dz / dist;
          if (dist < 0.9 && Math.abs(dy) < 1.6 && m.cooldown <= 0) { m.cooldown = 1; W.hurtPlayer(t.dmg, t.name); m.kx = -wantX * 4; m.kz = -wantZ * 4; }
        }
      }
    }
    m.vx = wantX * speed + m.kx; m.vz = wantZ * speed + m.kz;
    m.kx *= 0.85; m.kz *= 0.85;
    if (wantX !== 0 || wantZ !== 0) m.yaw = Math.atan2(wantX, -wantZ);
    var inWater = W.get(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(m.z)) === 14;
    m.vy -= (inWater ? 6 : 26) * dt; if (inWater) m.vy = Math.max(m.vy, -2) + (m.vy < 1 ? 1.5 * dt : 0);
    var nx = m.x + m.vx * dt;
    if (boxFree(W, nx, m.y, m.z, t.w, t.h)) m.x = nx;
    else if (m.onGround && boxFree(W, nx, m.y + 1.01, m.z, t.w, t.h)) { m.vy = 8; }   // jumps a one block step
    var nz = m.z + m.vz * dt;
    if (boxFree(W, m.x, m.y, nz, t.w, t.h)) m.z = nz;
    else if (m.onGround && boxFree(W, m.x, m.y + 1.01, nz, t.w, t.h)) { m.vy = 8; }
    var ny = m.y + m.vy * dt;
    if (boxFree(W, m.x, ny, m.z, t.w, t.h)) { m.y = ny; m.onGround = false; }
    else { if (m.vy < 0) m.onGround = true; m.vy = 0; }
    if (m.y < -5) m.dead = true;
    if (m.hp <= 0) m.dead = true;
  };

  // ---- where the creatures of a new chunk stand: herds on open ground, decided by the seed alone so a world always starts with the same animals ----
  function h2(seed, x, z) { var n = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0; n = (n ^ (n >>> 13)) * 1103515245 | 0; return (((n ^ (n >>> 16)) >>> 0) % 65536) / 65536; }
  M.chunkSpawns = function (seed, cx, cz, biome) {
    var out = [];
    if (h2(seed + 31, cx, cz) > 0.4) return out;
    var pool = biome === "desert" ? ["rabbit", "chicken"] : biome === "snow" ? ["rabbit", "pig", "sheep"] : ["cow", "pig", "sheep", "chicken", "rabbit"];
    var type = pool[Math.floor(h2(seed + 32, cx, cz) * pool.length)], n = 2 + Math.floor(h2(seed + 33, cx, cz) * 3);
    for (var i = 0; i < n; i++) out.push({ type: type, x: cx * 16 + 3 + h2(seed + 34 + i, cx, cz) * 10, z: cz * 16 + 3 + h2(seed + 44 + i, cz, cx) * 10 });
    return out;
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
