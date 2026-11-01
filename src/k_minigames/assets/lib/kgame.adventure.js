/* kgame.adventure.js: yukarıdan görünümlü 2 boyutlu piksel macera (zindan) kiti (adventure). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'adventure', title:'Kayıp Kale', theme:'dungeon', hero:'knight', difficulty:3, levels:3, size:'medium', enemies:['slime','bat','skeleton'], boss:true, music:'adventure', world:{seed:6}, features:['dash'] })
   Kit; tohumdan kat kat zindanlar kurar (odalar, koridorlar, anahtar ve kilitli kapı, sandıklar, merdiven), düşmanları (balçık, yarasa, iskelet, goblin, hayalet) ve patronu yerleştirir,
   kahramanı (şövalye: kılıç, okçu: ok, büyücü: büyü) savaştırır, can, altın, iksir, anahtar ve deneyim (seviye atlama) tutar. Resim küçük (320x200 piksel) tuvalde keskin çizilir, tam sayı katıyla büyütülür, bulanıklık yok.
   Kontroller: W A S D ya da oklar yürür, Boşluk ya da J saldırı, Shift atılma (dash özelliğiyle), Q iksir, R yeniden, Esc menü. Özellikler: dash, regen, loot.
   Önce kgame.js, kgame.kits.js ve kgame.audio2.js yüklenmiş olmalı. Her şey kodla çizilir (görsel dosya yok). */
(function (root) {
  var K = root.K;
  var T = 16, VW = 320, VH = 200;
  var SIZES = { small: { W: 40, H: 30, rooms: 5 }, medium: { W: 52, H: 38, rooms: 7 }, large: { W: 68, H: 48, rooms: 10 } };
  var THEMES = {
    dungeon: { floor: [[70, 66, 82], [64, 60, 76]], wall: [[40, 36, 54], [30, 26, 42]], top: [92, 88, 110], door: [150, 100, 50], mood: "stone" },
    forest: { floor: [[64, 110, 64], [58, 100, 58]], wall: [[28, 66, 38], [20, 52, 30]], top: [58, 120, 66], door: [140, 100, 50], mood: "trees" },
    desert: { floor: [[216, 188, 130], [206, 178, 122]], wall: [[150, 110, 70], [124, 88, 56]], top: [190, 150, 100], door: [120, 80, 40], mood: "sand" },
    castle: { floor: [[150, 144, 150], [140, 134, 142]], wall: [[84, 50, 60], [66, 38, 48]], top: [130, 84, 96], door: [160, 120, 50], mood: "stone" }
  };
  var HEROES = { knight: { name: "şövalye", hp: 12, spd: 66, dmg: 2.2, color: [200, 70, 70], atk: 0.38, kind: "melee" }, ranger: { name: "okçu", hp: 10, spd: 74, dmg: 1.6, color: [70, 170, 90], atk: 0.42, kind: "arrow" }, mage: { name: "büyücü", hp: 8, spd: 68, dmg: 2.6, color: [150, 90, 220], atk: 0.7, kind: "bolt" } };
  var ENEMIES = {
    slime: { name: "balçık", hp: 3, spd: 24, dmg: 1, xp: 2, r: 5, color: [90, 200, 110] },
    bat: { name: "yarasa", hp: 2, spd: 60, dmg: 1, xp: 2, r: 4, color: [120, 80, 150], erratic: true },
    skeleton: { name: "iskelet", hp: 4, spd: 30, dmg: 2, xp: 4, r: 5, color: [226, 222, 206], ranged: true },
    goblin: { name: "goblin", hp: 5, spd: 46, dmg: 2, xp: 5, r: 5, color: [110, 170, 70] },
    ghost: { name: "hayalet", hp: 6, spd: 26, dmg: 2, xp: 6, r: 5, color: [190, 210, 240], phase: true }
  };
  var BOSS = { name: "patron", hp: 36, spd: 34, dmg: 3, xp: 40, r: 9, color: [200, 60, 120], boss: true };
  var FEATURES = ["dash", "regen", "loot"];

  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(a, b, c) { var n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; n = (n ^ (n >>> 13)) * 1103515245 | 0; return (((n ^ (n >>> 16)) >>> 0) % 65536) / 65536; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shade(c, k) { return [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function wrap(a) { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; }

  // ---- one floor: rooms chained by corridors, the last room behind a locked door (the key lies in an earlier room), chests and monsters ----
  // grid: 0 floor, 1 wall, 2 locked door, 3 stairs
  function genFloor(seed, index, spec, last) {
    var sz = SIZES[spec.size] || SIZES.medium, W = sz.W, H = sz.H, tries, d = spec.difficulty;
    for (tries = 0; tries < 40; tries++) {
      var rnd = rng(seed * 977 + index * 131 + tries * 17 + 3), grid = new Uint8Array(W * H).fill(1), rooms = [], att, i, x, y;
      for (att = 0; att < 400 && rooms.length < sz.rooms; att++) {
        var rw = 6 + Math.floor(rnd() * 6), rh = 5 + Math.floor(rnd() * 5), rx = 2 + Math.floor(rnd() * (W - rw - 4)), ry = 2 + Math.floor(rnd() * (H - rh - 4)), ok = true;
        for (i = 0; i < rooms.length; i++) { var o = rooms[i]; if (rx < o.x + o.w + 3 && rx + rw + 3 > o.x && ry < o.y + o.h + 3 && ry + rh + 3 > o.y) { ok = false; break; } }
        if (ok) rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
      }
      if (rooms.length < 4) continue;
      rooms.forEach(function (r) { for (y = r.y; y < r.y + r.h; y++) for (x = r.x; x < r.x + r.w; x++) grid[y * W + x] = 0; });
      var inRoom = function (px, py, r) { return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h; };
      var doorCell = null;
      for (i = 0; i < rooms.length - 1; i++) {
        var a = rooms[i], b = rooms[i + 1], cx = a.cx, cy = a.cy, wide = i < rooms.length - 2, path = [];
        while (cx !== b.cx) { cx += cx < b.cx ? 1 : -1; path.push([cx, cy]); }
        while (cy !== b.cy) { cy += cy < b.cy ? 1 : -1; path.push([cx, cy]); }
        path.forEach(function (c) { grid[c[1] * W + c[0]] = 0; if (wide) { if (c[0] + 1 < W - 1) grid[c[1] * W + c[0] + 1] = 0; if (c[1] + 1 < H - 1) grid[(c[1] + 1) * W + c[0]] = 0; } });
        if (!wide) {   // the last corridor is one tile wide: a door in its last tile before the room
          var inside = -1; for (var k = 0; k < path.length; k++) if (inRoom(path[k][0], path[k][1], b)) { inside = k; break; }
          var dk = inside > 0 ? inside - 1 : -1;
          if (dk > 0 && !inRoom(path[dk][0], path[dk][1], a) && !inRoom(path[dk][0], path[dk][1], b)) { doorCell = path[dk]; grid[doorCell[1] * W + doorCell[0]] = 2; }
        }
      }
      if (!doorCell) continue;
      var start = rooms[0], exit = rooms[rooms.length - 1];
      grid[exit.cy * W + exit.cx] = 3;
      var keyRoom = rooms[1 + Math.floor(rnd() * (rooms.length - 2))];
      var seen = new Uint8Array(W * H), stack = [[start.cx, start.cy]]; seen[start.cy * W + start.cx] = 1;   // the exit must be shut off by the door, the key must be reachable without it
      while (stack.length) { var cur = stack.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) { var nx = cur[0] + dd[0], ny = cur[1] + dd[1]; if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[ny * W + nx] && (grid[ny * W + nx] === 0)) { seen[ny * W + nx] = 1; stack.push([nx, ny]); } }); }
      if (seen[exit.cy * W + exit.cx - 1] || !seen[keyRoom.cy * W + keyRoom.cx]) continue;
      var keyPos = { x: (keyRoom.cx + (rnd() < 0.5 ? -1 : 1)) * T + T / 2, y: (keyRoom.cy + 1) * T + T / 2 };
      var chests = [], enemies = [], pickups = [];
      rooms.forEach(function (r, ri) {
        if (ri > 0 && ri < rooms.length - 1 && rnd() < 0.55) chests.push({ x: (r.x + 1) * T + T / 2, y: (r.y + 1) * T + T / 2, open: false, kind: rnd() < 0.5 ? "coins" : rnd() < 0.5 ? "heart" : "potion" });
        if (ri === 0) return;
        var n = Math.round((r.w * r.h / 28) * (0.55 + 0.17 * d) * (ri === rooms.length - 1 ? 1.2 : 1));
        for (var q = 0; q < n; q++) { var ex = (r.x + 1 + Math.floor(rnd() * (r.w - 2))) * T + T / 2, ey = (r.y + 1 + Math.floor(rnd() * (r.h - 2))) * T + T / 2; if (grid[Math.floor(ey / T) * W + Math.floor(ex / T)] === 0) enemies.push({ kind: spec.enemies[Math.floor(rnd() * spec.enemies.length)], x: ex, y: ey }); }
        if (rnd() < 0.6) pickups.push({ kind: "coin", x: (r.cx) * T + T / 2 + 8, y: (r.cy) * T + T / 2 - 8 });
      });
      var boss = last && spec.boss ? { kind: "boss", x: exit.cx * T + T / 2, y: (exit.cy - 1) * T + T / 2 } : null;
      return { W: W, H: H, grid: grid, rooms: rooms, start: { x: start.cx * T + T / 2, y: start.cy * T + T / 2 }, exit: { x: exit.cx, y: exit.cy }, door: doorCell, keyPos: keyPos, chests: chests, enemies: enemies, pickups: pickups, boss: boss, last: last };
    }
    throw new Error("kat üretilemedi");
  }

  // ---- pixel art ----
  var HERO = ["...hhhh...", "..hhhhhh..", "..ssssss..", "..sskkss..", "...ssss...", ".bbbbbbbb.", "abbbbbbbba", "abbbbbbbba", ".bbbbbbbb.", "..dddddd.."];
  var LEGS = [["..dd..dd..", ".kkk..kkk."], [".dd....dd.", "kkk....kkk"]];
  var SPR = {
    slime: { rows: ["....gggg....", "..gGGGGGGg..", ".gGwGGGwGGg.", "gGGkGGGkGGGg", "gGGGGGGGGGGg", ".gggggggggg."], pal: { g: [60, 150, 80], G: [100, 210, 120], w: [255, 255, 255], k: [20, 40, 30] } },
    bat: { rows: ["p..pp..pp..p", "pp.pppppp.pp", "ppppwpwpoppp", ".pppppppppp.", "..pp.pp.pp.."], pal: { p: [96, 60, 130], w: [255, 240, 120], o: [60, 30, 80] } },
    skeleton: { rows: ["..wwwww..", ".wwkwkww.", ".wwwwwww.", "..wkkkw..", "..wwwww..", ".wwwwwww.", "w.wwwww.w", "..wwwww..", "..ww.ww..", ".ww...ww."], pal: { w: [228, 224, 208], k: [30, 30, 36] } },
    goblin: { rows: ["g.ggggg.g", ".ggkggkg.", ".ggggggg.", "..grrrg..", "..ggggg..", ".bbbbbbb.", "gbbbbbbbg", ".bbbbbbb.", "..bb.bb..", ".kk...kk."], pal: { g: [100, 160, 64], k: [20, 20, 20], r: [180, 50, 50], b: [120, 80, 50] } },
    ghost: { rows: ["..wwwwww..", ".wwwwwwww.", "wwkkwwkkww", "wwkkwwkkww", "wwwwwwwwww", "wwwwkkwwww", "wwwwwwwwww", "ww.ww.ww.w", "w..w..w..."], pal: { w: [200, 220, 250], k: [40, 50, 90] } },
    boss: { rows: ["..mm......mm..", ".mmmm....mmmm.", ".mmmmmmmmmmmm.", "mmmwwmmmmwwmmm", "mmmwkmmmmwkmmm", "mmmmmmmmmmmmmm", "mmmkkkkkkkkmmm", ".mmmmmmmmmmmm.", "mmddmmmmmmddmm", "mm.dmmmmmmd.mm", "mm..dd..dd..mm", ".dd.dd..dd.dd."], pal: { m: [190, 56, 110], w: [255, 240, 150], k: [30, 10, 30], d: [120, 30, 70] } },
    chest: { rows: ["bbbbbbbbbb", "bhhhhhhhhb", "bbbbbbbbbb", "bbbbyybbbb", "bddddddddb", "bddddddddb", "bbbbbbbbbb"], pal: { b: [150, 100, 50], h: [190, 140, 70], y: [240, 200, 60], d: [110, 70, 36] } },
    chestOpen: { rows: ["bhhhhhhhhb", "b........b", "bbbbbbbbbb", "bddddddddb", "bddddddddb", "bbbbbbbbbb"], pal: { b: [150, 100, 50], h: [190, 140, 70], d: [60, 40, 20] } },
    key: { rows: ["..yyy...", ".y...y..", ".y...y..", "..yyy...", "..y.....", "..yyy...", "..y.....", "..yy...."], pal: { y: [250, 210, 60] } },
    heart: { rows: [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."], pal: { r: [230, 50, 70] } },
    coin: { rows: [".yyyy.", "yyYYyy", "yYyyYy", "yYyyYy", "yyYYyy", ".yyyy."], pal: { y: [240, 190, 40], Y: [255, 240, 130] } },
    potion: { rows: ["..kk..", "..bb..", ".bbbb.", "bbrrbb", "brrrrb", "brrrrb", ".bbbb."], pal: { k: [150, 110, 70], b: [180, 200, 230], r: [220, 50, 90] } },
    stairs: { rows: ["dddddddddddd", "dllllllllllld", "dddddddddddd", ".dllllllllld.", ".dddddddddd.", "..dllllllld..", "..dddddddd..", "...dllllld..", "...ddddddd.."], pal: { d: [60, 56, 70], l: [170, 160, 190] } }
  };
  function drawRows(c, rows, pal, x, y, tint) { for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) { var cc = pal[rows[j].charAt(i)]; if (cc) { c.fillStyle = rgb(tint ? [clamp(cc[0] + tint[0], 0, 255), clamp(cc[1] + tint[1], 0, 255), clamp(cc[2] + tint[2], 0, 255)] : cc); c.fillRect(x + i, y + j, 1, 1); } } }
  function heroSheet(col, hero) {
    var pal = { h: shade(col, 0.5), s: [236, 188, 150], k: [30, 30, 36], b: col, a: shade(col, 1.25), d: shade(col, 0.5) }, out = [];
    for (var f = 0; f < 2; f++) { var cv = document.createElement("canvas"); cv.width = 10; cv.height = 12; drawRows(cv.getContext("2d"), HERO.concat(LEGS[f]), pal, 0, 0); out.push(cv); }
    return out;
  }
  function tileTexture(theme, kind, variant, rowBelowFloor) {
    var cv = document.createElement("canvas"); cv.width = cv.height = T; var c = cv.getContext("2d"), im = c.createImageData(T, T);
    for (var v = 0; v < T; v++) for (var u = 0; u < T; u++) {
      var n = hash(kind * 17 + variant, u, v), col;
      if (kind === 0) { col = shade(theme.floor[variant], 0.92 + n * 0.16); if (theme.mood === "stone" && (u === 0 || v === 0)) col = shade(col, 0.82); if (n > 0.97) col = shade(col, 1.2); }
      else if (kind === 1) { col = shade(theme.wall[variant], 0.9 + n * 0.2); if (rowBelowFloor && v < 3) col = shade(theme.top, 0.9 + n * 0.2); if (rowBelowFloor && v === 3) col = shade(theme.top, 0.6); if (theme.mood === "trees" && n > 0.8) col = shade(theme.top, 0.85); if (theme.mood === "stone" && v % 8 === 4) col = shade(col, 0.8); }
      else if (kind === 2) { col = theme.door; col = shade(col, 0.9 + n * 0.2); if (u === 0 || u === 15 || v === 0 || v === 15) col = shade(col, 0.6); if (u > 5 && u < 10 && v > 5 && v < 10) col = [250, 210, 60]; }
      else { col = [60, 56, 70]; }
      var o = (v * T + u) * 4; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 255;
    }
    c.putImageData(im, 0, 0); return cv;
  }

  K.kit.define("adventure", {
    defaults: { title: "Macera", theme: "dungeon", hero: "knight", difficulty: 3, levels: 3, size: "medium", enemies: ["slime", "bat", "skeleton"], boss: true, music: "adventure", world: { seed: 1 }, width: 640, height: 400, features: [] },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (!HEROES[spec.hero]) errors.push("bilinmeyen kahraman: " + spec.hero + " (var olanlar: " + Object.keys(HEROES).join(", ") + ")");
      if (!SIZES[spec.size]) errors.push("bilinmeyen boyut: " + spec.size + " (small, medium, large)");
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      if (typeof spec.levels !== "number" || spec.levels < 1 || spec.levels > 6) errors.push("levels 1-6 olmalı");
      if (!(spec.enemies instanceof Array) || !spec.enemies.length) errors.push("enemies boş olmamalı");
      else spec.enemies.forEach(function (k) { if (!ENEMIES[k]) errors.push("bilinmeyen düşman: " + k + " (var olanlar: " + Object.keys(ENEMIES).join(", ") + ")"); });
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var seed = (spec.world && spec.world.seed) || 1, theme = THEMES[spec.theme], hero = HEROES[spec.hero], d = spec.difficulty, tune = spec.music, feats = spec.features || [], rnd = rng(seed * 61 + 5);
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      var state = { g: g, spec: spec, p: null, level: null, floor: 0, enemies: [], shots: [], foes: [], pickups: [], chests: [], parts: [], explored: {}, time: 0, over: false, won: false, message: "", messageT: 0, hasDash: feats.indexOf("dash") >= 0, hasRegen: feats.indexOf("regen") >= 0, hasLoot: feats.indexOf("loot") >= 0, kills: 0, bossDead: false, shake: 0 };
      state.menu = { open: K.adventure.menuAtStart !== false, kind: "main", index: 0, started: false }; state.paused = state.menu.open; state.musicOn = true;
      state.say = function (t, s) { state.message = t; state.messageT = s || 2.2; };
      function tileAt(x, y) { var L = state.level, gx = Math.floor(x / T), gy = Math.floor(y / T); return gx < 0 || gy < 0 || gx >= L.W || gy >= L.H ? 1 : L.grid[gy * L.W + gx]; }
      state.tileAt = tileAt;
      function solid(x, y) { var t = tileAt(x, y); return t === 1 || t === 2; }
      function blocked(x, y, r) { return solid(x - r, y - r) || solid(x + r, y - r) || solid(x - r, y + r) || solid(x + r, y + r); }

      // ---- floors ----
      state.loadFloor = function (index) {
        var L = genFloor(seed, index, spec, index === spec.levels - 1); state.level = L; state.floor = index; state.explored = {}; state.shots = []; state.foes = []; state.parts = []; state.bossDead = !L.boss;
        state.enemies = L.enemies.map(function (e) { return makeEnemy(e.kind, e.x, e.y); }); if (L.boss) state.enemies.push(makeEnemy("boss", L.boss.x, L.boss.y));
        state.chests = L.chests.map(function (c) { return { x: c.x, y: c.y, open: false, kind: c.kind }; });
        state.pickups = L.pickups.map(function (q) { return { kind: q.kind, x: q.x, y: q.y }; }); state.pickups.push({ kind: "key", x: L.keyPos.x, y: L.keyPos.y });
        var p = state.p; p.x = L.start.x; p.y = L.start.y; p.vx = p.vy = 0; p.keys = 0; p.hurtT = 0.6;
        state.say("Kat " + (index + 1) + " / " + spec.levels + ": anahtarı bul, kilitli kapıyı aç", 3); state.bg = null;
      };
      function makeEnemy(kind, x, y) { var def = kind === "boss" ? BOSS : ENEMIES[kind], hpScale = 0.8 + 0.15 * d; return { kind: kind, def: def, x: x, y: y, hp: Math.max(1, Math.round(def.hp * hpScale)), maxHp: Math.max(1, Math.round(def.hp * hpScale)), vx: 0, vy: 0, cd: 1 + rnd(), flash: 0, dead: false, alert: false, a: rnd() * 6.28, anim: 0, kb: 0, dashT: 0 }; }
      state.reset = function () {
        state.p = { x: 0, y: 0, vx: 0, vy: 0, face: 1, hp: hero.hp, maxHp: hero.hp, lvl: 1, xp: 0, gold: 0, potions: 1, keys: 0, atkT: 0, swing: 0, dashT: 0, dashCd: 0, hurtT: 0, anim: 0, regenT: 0 };
        state.over = false; state.won = false; state.time = 0; state.kills = 0; state.messageT = 0; state.menuStartedFloor = true;
        state.loadFloor(0); if (g.current !== "play") g.go("play");
      };
      state.start = function () { state.reset(); if (tune && state.musicOn) K.music.play(tune); };
      function finish(win) { state.over = true; state.won = win; K.music.stop(); K.sfx(win ? "coin" : "hit"); }

      // ---- the hero ----
      state.damageOf = function () { return hero.dmg * (1 + 0.18 * (state.p.lvl - 1)); };
      state.attack = function () {
        var p = state.p; if (p.atkT > 0 || state.over) return false;
        p.atkT = hero.atk; p.swing = 0.18; var dmg = state.damageOf(), dx = Math.cos(p.face), dy = Math.sin(p.face);
        if (hero.kind === "melee") {
          K.sfx("click");
          state.enemies.forEach(function (e) { if (e.dead) return; var ex = e.x - p.x, ey = e.y - p.y, dist = Math.hypot(ex, ey); if (dist < 22 + e.def.r && Math.abs(wrap(Math.atan2(ey, ex) - p.face)) < 1.1) hitEnemy(e, dmg, dx, dy); });
        } else { K.sfx("fire"); state.shots.push({ x: p.x + dx * 8, y: p.y + dy * 8, vx: dx * (hero.kind === "arrow" ? 230 : 170), vy: dy * (hero.kind === "arrow" ? 230 : 170), dmg: dmg, life: 1.1, kind: hero.kind, mine: true }); }
        return true;
      };
      function hitEnemy(e, dmg, dx, dy) {
        e.hp -= dmg; e.flash = 0.15; e.alert = true; e.kb = 0.12; e.vx = dx * (e.def.boss ? 30 : 110); e.vy = dy * (e.def.boss ? 30 : 110);
        for (var i = 0; i < 4; i++) state.parts.push({ x: e.x, y: e.y, vx: (rnd() - 0.5) * 80, vy: (rnd() - 0.5) * 80, life: 0.3, c: e.def.color });
        if (e.hp <= 0 && !e.dead) {
          e.dead = true; state.kills++; K.sfx("boom"); gainXp(e.def.xp);
          var luck = state.hasLoot ? 0.55 : 0.3;
          if (rnd() < luck) state.pickups.push({ kind: rnd() < 0.5 ? "coin" : rnd() < 0.6 ? "heart" : "potion", x: e.x, y: e.y });
          if (e.def.boss) { state.bossDead = true; state.say("Patron düştü! Merdiven açık.", 3); for (var k = 0; k < 5; k++) state.pickups.push({ kind: "coin", x: e.x + (rnd() - 0.5) * 30, y: e.y + (rnd() - 0.5) * 30 }); }
        }
      }
      function gainXp(n) { var p = state.p; p.xp += n; var need = 8 + 6 * p.lvl; while (p.xp >= need) { p.xp -= need; p.lvl++; p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 4); state.say("Seviye " + p.lvl + "!", 2.2); K.sfx("coin"); need = 8 + 6 * p.lvl; } }
      state.hurt = function (n) {
        var p = state.p; if (state.over || p.hurtT > 0 || p.dashT > 0) return false;
        p.hp -= n; p.hurtT = 0.8; state.shake = 0.18; K.sfx("hit");
        if (p.hp <= 0) { p.hp = 0; finish(false); }
        return true;
      };
      state.clickAttack = function (sx, sy) {   // a click in picture pixels: turn towards it and strike (or shoot)
        var p = state.p, cam = state.cam || { x: 0, y: 0 }; if (!p || state.over || state.paused) return false;
        p.face = Math.atan2(sy + cam.y - p.y, sx + cam.x - p.x); return state.attack();
      };
      state.usePotion = function () { var p = state.p; if (p.potions <= 0 || p.hp >= p.maxHp || state.over) return false; p.potions--; p.hp = Math.min(p.maxHp, p.hp + 6); K.sfx("coin"); state.say("İyileştin"); return true; };
      state.dash = function () { var p = state.p; if (!state.hasDash || p.dashCd > 0 || state.over) return false; p.dashT = 0.18; p.dashCd = 1; K.sfx("click"); return true; };

      // ---- the monsters ----
      function enemyShot(e, p) { var a = Math.atan2(p.y - e.y, p.x - e.x); state.foes.push({ x: e.x, y: e.y, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85, life: 3, dmg: e.def.dmg }); }
      function moveEntity(e, dx, dy, r, phase) {
        if (phase || !blocked(e.x + dx, e.y, r)) e.x += dx; if (phase || !blocked(e.x, e.y + dy, r)) e.y += dy;
      }
      function stepEnemies(dt) {
        var p = state.p;
        state.enemies.forEach(function (e) {
          if (e.dead) return; var def = e.def, dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1; e.anim += dt; e.flash = Math.max(0, e.flash - dt); e.cd -= dt;
          if (e.kb > 0) { e.kb -= dt; moveEntity(e, e.vx * dt, e.vy * dt, def.r, def.phase); return; }
          var sees = dist < 110 + 8 * d && (def.phase || lineClear(e.x, e.y, p.x, p.y)); if (sees) e.alert = true;
          if (!e.alert) return;
          var sp = def.spd * (0.85 + 0.07 * d) * dt, ux = dx / dist, uy = dy / dist;
          if (def.erratic) { e.a += (rnd() - 0.5) * 8 * dt; ux = ux * 0.7 + Math.cos(e.a) * 0.7; uy = uy * 0.7 + Math.sin(e.a) * 0.7; }
          if (def.ranged) { if (dist < 60) { ux = -ux; uy = -uy; } else if (dist < 105) { ux = uy = 0; } if (sees && e.cd <= 0 && dist < 130) { e.cd = 1.8 - 0.1 * d; enemyShot(e, p); } }
          if (def.boss) { if (e.cd <= 0) { e.cd = 2.4 - 0.15 * d; for (var k = 0; k < 8; k++) { var a = k / 8 * 6.2832 + e.anim; state.foes.push({ x: e.x, y: e.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 3, dmg: 2 }); } } if (e.hp < e.maxHp / 2) sp *= 1.5; }
          moveEntity(e, ux * sp, uy * sp, def.r, def.phase);
          if (dist < def.r + 5 && !def.ranged) state.hurt(def.dmg);
        });
        state.foes.forEach(function (s) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (solid(s.x, s.y)) s.life = 0; if (Math.hypot(s.x - p.x, s.y - p.y) < 6 && s.life > 0) { if (state.hurt(s.dmg)) s.life = 0; } });
        state.foes = state.foes.filter(function (s) { return s.life > 0; });
        state.shots.forEach(function (s) {
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (solid(s.x, s.y)) s.life = 0;
          state.enemies.forEach(function (e) { if (!e.dead && s.life > 0 && Math.hypot(e.x - s.x, e.y - s.y) < e.def.r + 3) {
            if (s.kind === "bolt") { state.enemies.forEach(function (o) { if (!o.dead && Math.hypot(o.x - s.x, o.y - s.y) < 18) hitEnemy(o, s.dmg * (o === e ? 1 : 0.6), s.vx / 170, s.vy / 170); }); for (var i = 0; i < 8; i++) state.parts.push({ x: s.x, y: s.y, vx: (rnd() - 0.5) * 120, vy: (rnd() - 0.5) * 120, life: 0.3, c: [180, 120, 255] }); }
            else hitEnemy(e, s.dmg, s.vx / 230, s.vy / 230); s.life = 0; } });
        });
        state.shots = state.shots.filter(function (s) { return s.life > 0; });
      }
      function lineClear(x0, y0, x1, y1) { var n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8); for (var i = 1; i < n; i++) { if (solid(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false; } return true; }

      // ---- one step ----
      state.step = function (dt) {
        var p = state.p; if (!p || state.paused) return;
        state.messageT = Math.max(0, state.messageT - dt); state.shake = Math.max(0, state.shake - dt);
        state.parts = state.parts.filter(function (pt) { pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; return pt.life > 0; });
        if (state.over) return;
        state.time += dt; p.atkT = Math.max(0, p.atkT - dt); p.swing = Math.max(0, p.swing - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.dashCd = Math.max(0, p.dashCd - dt); p.dashT = Math.max(0, p.dashT - dt);
        var mx = ((K.key("ArrowRight") || K.key("d")) ? 1 : 0) - ((K.key("ArrowLeft") || K.key("a")) ? 1 : 0), my = ((K.key("ArrowDown") || K.key("s")) ? 1 : 0) - ((K.key("ArrowUp") || K.key("w")) ? 1 : 0);
        if (mx || my) { var len = Math.hypot(mx, my); p.face = Math.atan2(my, mx); var sp = hero.spd * (p.dashT > 0 ? 3 : 1); p.vx = mx / len * sp; p.vy = my / len * sp; p.anim += dt * 8; } else { p.vx = p.vy = 0; }
        moveEntity(p, p.vx * dt, p.vy * dt, 4, false);
        if (K.key(" ") || K.key("j")) state.attack();
        if (K.key("Shift") && !state.shiftHeld) state.dash(); state.shiftHeld = K.key("Shift");
        if (K.key("q") && !state.qHeld) state.usePotion(); state.qHeld = K.key("q");
        if (state.hasRegen && p.hp < p.maxHp) { p.regenT += dt; if (p.regenT >= 8) { p.regenT = 0; p.hp = Math.min(p.maxHp, p.hp + 1); } }
        // doors, stairs, chests, pickups
        var t = tileAt(p.x + Math.cos(p.face) * 6, p.y + Math.sin(p.face) * 6), L = state.level;
        if (t === 2 && p.keys > 0) { var gx = Math.floor((p.x + Math.cos(p.face) * 6) / T), gy = Math.floor((p.y + Math.sin(p.face) * 6) / T); L.grid[gy * L.W + gx] = 0; p.keys--; K.sfx("coin"); state.say("Kapı açıldı"); state.bg = null; }
        else if (t === 2 && (!state.doorHintT || state.time - state.doorHintT > 2.5)) { state.doorHintT = state.time; state.say("Kilitli kapı: anahtar gerek"); }
        if (tileAt(p.x, p.y) === 3) {
          if (!state.bossDead) { if (!state.stairHintT || state.time - state.stairHintT > 2.5) { state.stairHintT = state.time; state.say("Önce patronu yen!"); } }
          else if (state.floor + 1 >= spec.levels) finish(true); else { K.sfx("coin"); state.loadFloor(state.floor + 1); return; }
        }
        state.chests.forEach(function (c) { if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 11) { c.open = true; K.sfx("coin"); var n = c.kind === "coins" ? 4 : 1; for (var i = 0; i < n; i++) state.pickups.push({ kind: c.kind === "coins" ? "coin" : c.kind, x: c.x + (i - n / 2) * 6, y: c.y + 12 }); } });
        state.pickups = state.pickups.filter(function (q) {
          if (Math.hypot(q.x - p.x, q.y - p.y) > 9) return true;
          if (q.kind === "heart") { if (p.hp >= p.maxHp) return true; p.hp = Math.min(p.maxHp, p.hp + 2); }
          else if (q.kind === "coin") { p.gold++; } else if (q.kind === "potion") { p.potions++; state.say("İksir"); } else if (q.kind === "key") { p.keys++; state.say("Anahtar alındı"); }
          K.sfx("coin"); return false;
        });
        stepEnemies(dt);
        var gx0 = Math.floor(p.x / T), gy0 = Math.floor(p.y / T); for (var oy = -3; oy <= 3; oy++) for (var ox = -3; ox <= 3; ox++) state.explored[(gy0 + oy) * L.W + gx0 + ox] = true;
      };

      // ---- the menus ----
      var CONTROLS = ["W A S D ya da oklar  yürü      Boşluk, J ya da sol tık (tıkladığın yöne)  saldır      Shift  atıl (dash özelliği)      Q  iksir iç", "R  yeniden başla      Esc  menü", "Anahtarı bul, kilitli kapıyı aç, merdivene in. Son katta patron seni bekliyor."];
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.paused = true; };
      state.closeMenu = function () { state.menu.open = false; state.menu.started = true; state.paused = false; };
      state.toggleMusic = function () { state.musicOn = !state.musicOn; if (state.musicOn) { if (tune) K.music.play(tune); } else K.music.stop(); };
      state.menuItems = function () {
        var m = state.menu, music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic }, controls = { label: "Kontroller", act: function () { m.back = m.kind; m.kind = "controls"; m.index = 0; } };
        if (m.kind === "main") return [{ label: m.started ? "Devam et" : "Maceraya başla", act: state.closeMenu }, controls, music];
        return [{ label: "Devam et", act: state.closeMenu }, controls, music, { label: "Baştan başla", act: function () { state.reset(); state.closeMenu(); } }, { label: "Ana menü", act: function () { state.openMenu("main"); } }];
      };
      var tapped = {}, tap = function (k) { var dd = K.key(k), hit = dd && !tapped[k]; tapped[k] = dd; return hit; };
      var rowY = function (n) { return g.height / 2 - n * 22 + 10; };
      state.menuClick = function () {
        var m = state.menu; if (!m.open) return false;
        if (m.kind === "controls") { m.kind = m.back || "main"; m.index = 0; return true; }
        var items = state.menuItems(), i = Math.floor((K.mouse.y - rowY(items.length)) / 44);
        if (K.mouse.x > g.width / 2 - 150 && K.mouse.x < g.width / 2 + 150 && i >= 0 && i < items.length) { m.index = i; items[i].act(); }
        return true;
      };
      state.menuUpdate = function () {
        var m = state.menu;
        if (m.kind === "controls") { if (tap("Escape") || tap("Enter") || tap(" ")) { m.kind = m.back || "main"; m.index = 0; } return; }
        var items = state.menuItems();
        if (K.mouse && K.mouse.y) { var hv = Math.floor((K.mouse.y - rowY(items.length)) / 44); if (K.mouse.x > g.width / 2 - 150 && K.mouse.x < g.width / 2 + 150 && hv >= 0 && hv < items.length && state.hoverY !== K.mouse.y) { m.index = hv; state.hoverY = K.mouse.y; } }   // the mouse chooses a row
        if (tap("ArrowUp") || tap("w")) m.index = (m.index + items.length - 1) % items.length;
        if (tap("ArrowDown") || tap("s")) m.index = (m.index + 1) % items.length;
        if (tap("Enter") || tap(" ")) items[Math.min(m.index, items.length - 1)].act();
        if (tap("Escape") && m.kind === "pause") state.closeMenu();
      };

      // ---- the picture ----
      var small = null, sc = null, sheets = {}, camx = 0, camy = 0;
      function buildBg() {
        var L = state.level, cv = document.createElement("canvas"); cv.width = L.W * T; cv.height = L.H * T; var c = cv.getContext("2d");
        var tex = { f: [0, 1].map(function (v) { return tileTexture(theme, 0, v, false); }), w: tileTexture(theme, 1, 0, false), wt: tileTexture(theme, 1, 1, true), d: tileTexture(theme, 2, 0, false), s: tileTexture(theme, 0, 1, false) };
        for (var y = 0; y < L.H; y++) for (var x = 0; x < L.W; x++) {
          var k = L.grid[y * L.W + x];
          if (k === 1) { var below = y + 1 < L.H && L.grid[(y + 1) * L.W + x] !== 1; var above = y > 0 && L.grid[(y - 1) * L.W + x] !== 1; c.drawImage(below ? tex.wt : tex.w, x * T, y * T); }
          else if (k === 2) c.drawImage(tex.d, x * T, y * T); else { c.drawImage(tex.f[(x + y) % 2], x * T, y * T); }
          if (k === 3) drawRows(c, SPR.stairs.rows, SPR.stairs.pal, x * T + 2, y * T + 3);
        }
        state.bg = cv; return cv;
      }
      function heroSprite() { var key = hero.color.join(",") + spec.hero; if (!sheets[key]) sheets[key] = heroSheet(hero.color, spec.hero); return sheets[key]; }
      function drawWorld(c) {
        var p = state.p, L = state.level; if (!state.bg) buildBg();
        camx = clamp(Math.round(p.x - VW / 2), 0, L.W * T - VW); camy = clamp(Math.round(p.y - VH / 2), 0, L.H * T - VH);
        if (state.shake > 0) { camx += Math.round((rnd() - 0.5) * 3); camy += Math.round((rnd() - 0.5) * 3); }
        state.cam = { x: camx, y: camy };
        c.imageSmoothingEnabled = false; c.drawImage(state.bg, camx, camy, VW, VH, 0, 0, VW, VH);
        c.save(); c.translate(-camx, -camy);
        var list = [];
        state.chests.forEach(function (ch) { list.push({ y: ch.y, f: function () { var s2 = ch.open ? SPR.chestOpen : SPR.chest; drawRows(c, s2.rows, s2.pal, Math.round(ch.x - 5), Math.round(ch.y - 4)); } }); });
        state.pickups.forEach(function (q) { list.push({ y: q.y, f: function () { var s2 = SPR[q.kind], bob = Math.round(Math.sin(state.time * 4 + q.x) * 1); drawRows(c, s2.rows, s2.pal, Math.round(q.x - s2.rows[0].length / 2), Math.round(q.y - s2.rows.length / 2 + bob)); } }); });
        state.enemies.forEach(function (e) { if (e.dead) return; list.push({ y: e.y, f: function () {
          var s2 = SPR[e.kind], w = s2.rows[0].length, h = s2.rows.length, bob = Math.round(Math.sin(e.anim * 6) * (e.def.erratic ? 2 : 1)), px = Math.round(e.x - w / 2), py = Math.round(e.y - h / 2 + bob);
          c.fillStyle = "rgba(0,0,0,0.28)"; c.fillRect(px + 1, py + h - 1, w - 2, 2); drawRows(c, s2.rows, s2.pal, px, py, e.flash > 0 ? [90, 90, 90] : null);
          if (e.maxHp > 4 && e.hp < e.maxHp) { c.fillStyle = "#300"; c.fillRect(px, py - 3, w, 2); c.fillStyle = "#e33"; c.fillRect(px, py - 3, Math.max(1, Math.round(w * e.hp / e.maxHp)), 2); }
        } }); });
        list.push({ y: p.y, f: function () {
          var sh = heroSprite()[Math.floor(p.anim) % 2], px = Math.round(p.x - 5), py = Math.round(p.y - 8);
          if (p.hurtT > 0 && Math.floor(p.hurtT * 20) % 2) return;
          c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(px + 1, py + 10, 8, 2); c.drawImage(sh, px, py);
          var fx = Math.cos(p.face), fy = Math.sin(p.face);
          if (hero.kind === "melee" && p.swing > 0) { c.fillStyle = "#e8e8f4"; for (var i = 4; i < 20; i += 2) { var a = p.face - 0.9 + (1 - p.swing / 0.18) * 1.8; c.fillRect(Math.round(p.x + Math.cos(a) * i), Math.round(p.y + Math.sin(a) * i), 2, 2); } }
          else if (hero.kind === "melee") { c.fillStyle = "#c8c8d8"; c.fillRect(Math.round(p.x + fx * 7), Math.round(p.y + fy * 7), 2, 2); }
          else { c.fillStyle = hero.kind === "arrow" ? "#a0724a" : "#b080f0"; c.fillRect(Math.round(p.x + fx * 7), Math.round(p.y + fy * 7), 2, 2); }
        } });
        list.sort(function (a, b) { return a.y - b.y; }).forEach(function (it) { it.f(); });
        state.shots.forEach(function (s) { c.fillStyle = s.kind === "arrow" ? "#e6d2a0" : "#d0a0ff"; c.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, s.kind === "arrow" ? 4 : 3, s.kind === "arrow" ? 2 : 3); });
        state.foes.forEach(function (s) { c.fillStyle = "#ff6a4a"; c.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 3, 3); });
        state.parts.forEach(function (pt) { c.fillStyle = rgb(pt.c); c.fillRect(Math.round(pt.x), Math.round(pt.y), 2, 2); });
        c.restore();
      }
      function drawHud(c) {
        var W = g.width, H = g.height, p = state.p, L = state.level, i;
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, 8, 18 * Math.min(8, Math.ceil(p.maxHp / 2)) + 12, 24);
        for (i = 0; i < Math.ceil(p.maxHp / 2); i++) { var full = p.hp >= (i + 1) * 2, half = p.hp === i * 2 + 1; c.fillStyle = "#3a1018"; c.fillRect(14 + (i % 8) * 18, 12 + Math.floor(i / 8) * 14, 14, 12); c.fillStyle = full ? "#e8344c" : half ? "#e8344c" : "#3a1018"; c.fillRect(14 + (i % 8) * 18, 12 + Math.floor(i / 8) * 14, full ? 14 : half ? 7 : 0, 12); }
        var need = 8 + 6 * p.lvl; c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, 38 + (p.maxHp > 16 ? 14 : 0), 150, 34); c.fillStyle = "#fff"; c.font = "bold 12px sans-serif"; c.textAlign = "left";
        var ty = 52 + (p.maxHp > 16 ? 14 : 0); c.fillText("SEV " + p.lvl + "   ALTIN " + p.gold + "   İKSİR " + p.potions + (p.keys ? "   ANAHTAR" : ""), 14, ty);
        c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(14, ty + 6, 138, 5); c.fillStyle = "#7cd0ff"; c.fillRect(14, ty + 6, 138 * p.xp / need, 5);
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(W - 98, H - 30, 90, 22); c.fillStyle = "#ffd54f"; c.font = "bold 13px sans-serif"; c.textAlign = "right"; c.fillText("KAT " + (state.floor + 1) + " / " + spec.levels, W - 14, H - 15); c.textAlign = "left";
        if (state.hasDash) { c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, H - 28, 90, 18); c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(12, H - 22, 82, 6); c.fillStyle = "#80e0a0"; c.fillRect(12, H - 22, 82 * (1 - p.dashCd), 6); }
        var ms = 2, mw = L.W * ms, mh = L.H * ms, mx = W - mw - 8, my = 8; c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
        for (var y = 0; y < L.H; y++) for (var x = 0; x < L.W; x++) if (state.explored[y * L.W + x]) { var k = L.grid[y * L.W + x]; if (k !== 1) { c.fillStyle = k === 3 ? "#ffd54f" : k === 2 ? "#c07040" : "rgba(210,210,230,0.6)"; c.fillRect(mx + x * ms, my + y * ms, ms, ms); } }
        c.fillStyle = "#4caf50"; c.fillRect(mx + Math.floor(p.x / T) * ms - 1, my + Math.floor(p.y / T) * ms - 1, 4, 4);
        if (state.messageT > 0) { c.textAlign = "center"; c.fillStyle = "#ffe082"; c.font = "bold 18px sans-serif"; c.fillText(state.message, W / 2, H - 50); c.textAlign = "left"; }
        if (state.over) {
          c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(W / 2 - 160, H / 2 - 90, 320, 180); c.textAlign = "center"; c.fillStyle = state.won ? "#ffd54f" : "#fff"; c.font = "bold 28px sans-serif";
          c.fillText(state.won ? "ZAFER!" : "ÖLDÜN", W / 2, H / 2 - 40); c.font = "15px sans-serif"; c.fillStyle = "#fff"; c.fillText("Seviye " + p.lvl + "   Altın " + p.gold + "   Öldürülen " + state.kills, W / 2, H / 2 + 2); c.fillStyle = "#b0bec5"; c.font = "13px sans-serif"; c.fillText("R: yeniden oyna", W / 2, H / 2 + 50); c.textAlign = "left";
        }
      }
      function drawMenu(c) {
        var m = state.menu, W = g.width, H = g.height; c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, W, H); c.textAlign = "center";
        c.fillStyle = "#fff"; c.font = "bold 34px sans-serif"; c.fillText(m.kind === "main" ? (spec.title || "Macera") : m.kind === "controls" ? "Kontroller" : "Duraklatıldı", W / 2, 70);
        if (m.kind === "controls") { c.font = "13px sans-serif"; c.fillStyle = "#e0e0e0"; CONTROLS.forEach(function (t, i) { c.fillText(t, W / 2, 140 + i * 34); }); c.fillStyle = "#ffd54f"; c.fillText("Esc ya da tık: geri", W / 2, H - 40); c.textAlign = "left"; return; }
        var items = state.menuItems();
        items.forEach(function (it, i) { var y = rowY(items.length) + i * 44 - 4, on = i === m.index; c.fillStyle = on ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.08)"; c.fillRect(W / 2 - 150, y, 300, 38); c.strokeStyle = on ? "#ffd54f" : "rgba(255,255,255,0.2)"; c.strokeRect(W / 2 - 150, y, 300, 38); c.fillStyle = on ? "#ffd54f" : "#fff"; c.font = "bold 17px sans-serif"; c.fillText(it.label, W / 2, y + 25); });
        c.font = "12px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla", W / 2, H - 30); c.textAlign = "left";
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined" || g.current !== "play" || !state.p || !state.level) return;
        if (!small) { small = document.createElement("canvas"); small.width = VW; small.height = VH; sc = small.getContext("2d"); }
        drawWorld(sc); c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        if (!(state.menu.open && state.menu.kind === "main")) drawHud(c); if (state.menu.open) drawMenu(c);
      } }];
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) g.canvas.addEventListener("mousedown", function (e) { if (e.button !== 0) return; if (state.menu.open) state.menuClick(); else state.clickAttack(K.mouse.x * VW / g.width, K.mouse.y * VH / g.height); });
      g.scene("play", { update: function (game, dt) {
        if (state.menu.open) { state.menuUpdate(); return; }
        if (tap("Escape")) { state.openMenu("pause"); return; }
        if (tap("r")) { state.reset(); if (tune && state.musicOn) K.music.play(tune); return; }
        state.step(dt);
      } });
      state.expose = { g: g, spec: spec, state: state, get p() { return state.p; } };
      return state;
    }
  });

  K.adventure = { themes: Object.keys(THEMES), heroes: Object.keys(HEROES), enemies: Object.keys(ENEMIES), sizes: Object.keys(SIZES), features: FEATURES, genFloor: genFloor, TILE: T, menuAtStart: true };
  K.feature.define("dash", { kits: ["adventure"], options: {}, apply: function (s) { s.hasDash = true; } });
  K.feature.define("regen", { kits: ["adventure"], options: {}, apply: function (s) { s.hasRegen = true; } });
  K.feature.define("loot", { kits: ["adventure"], options: {}, apply: function (s) { s.hasLoot = true; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
