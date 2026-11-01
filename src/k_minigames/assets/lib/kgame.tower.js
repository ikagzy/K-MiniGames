/* kgame.tower.js: 2 boyutlu piksel kule savunması kiti (tower). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'tower', title:'Orman Savunması', theme:'grass', difficulty:3, size:'medium', waves:10, enemies:['soldier','runner','tank','swarm'], towers:['arrow','cannon','frost','sniper'], boss:true, music:'tower', world:{seed:2}, features:['speed'] })
   Kit; tohumdan kıvrımlı bir yol çizer, düşman dalgalarını gönderir, sen yola bakan boş karolara kule kurar ve yükseltirsin (ok, top, buz, keskin nişancı). Düşmanlar yolu izleyip kaleye varırsa can gider; canın bitmeden bütün dalgaları geçersen kazanırsın.
   Resim küçük (320x200 piksel) tuvalde keskin çizilir, tam sayı katıyla büyütülür, bulanıklık yok. Haritaya fareyle tıkla (kule kur, kuleyi seç), alttaki şeritten kule türü seç.
   Kontroller: fare ya da oklar imleci kaydırır, 1-4 kule türü, Boşluk/Enter kur ya da yükselt, X sat, N sonraki dalgayı başlat, F hızlandır (speed özelliği), G dondur (freeze özelliği), R yeniden, Esc menü. Özellikler: speed, bonus, freeze.
   Önce kgame.js, kgame.kits.js ve kgame.audio2.js yüklenmiş olmalı. Her şey kodla çizilir (görsel dosya yok). */
(function (root) {
  var K = root.K;
  var T = 16, GW = 20, GH = 10, VW = 320, VH = 200, BAR = 160;
  var THEMES = {
    grass: { grass: [[84, 140, 76], [76, 130, 70]], path: [[176, 140, 90], [166, 130, 82]], edge: [120, 90, 56], deco: "tree", sky: [30, 50, 30] },
    desert: { grass: [[222, 190, 120], [212, 180, 110]], path: [[150, 110, 80], [140, 102, 74]], edge: [96, 70, 50], deco: "rock", sky: [60, 40, 20] },
    night: { grass: [[26, 62, 56], [22, 54, 50]], path: [[84, 84, 104], [76, 76, 96]], edge: [44, 44, 62], deco: "tree", sky: [10, 14, 30], tint: "rgba(6,10,40,0.3)" },
    lava: { grass: [[70, 52, 52], [62, 46, 46]], path: [[150, 70, 40], [140, 62, 36]], edge: [90, 36, 22], deco: "rock", sky: [40, 12, 8] }
  };
  var SIZES = { small: 2, medium: 3, large: 4 };
  var TOWERS = {
    arrow: { name: "ok kulesi", key: 1, cost: [40, 50, 80], dmg: [3, 5, 8], range: [48, 56, 64], rate: [0.55, 0.45, 0.35], color: [190, 140, 70], proj: "arrow" },
    cannon: { name: "top", key: 2, cost: [70, 80, 120], dmg: [8, 14, 22], range: [44, 50, 56], rate: [1.5, 1.3, 1.1], color: [90, 90, 100], proj: "ball", splash: [18, 22, 28] },
    frost: { name: "buz kulesi", key: 3, cost: [60, 60, 90], dmg: [1, 2, 3], range: [46, 54, 62], rate: [0.9, 0.8, 0.7], color: [110, 190, 240], proj: "ice", slow: [0.5, 0.4, 0.3] },
    sniper: { name: "keskin nişancı", key: 4, cost: [90, 100, 150], dmg: [20, 36, 60], range: [96, 112, 128], rate: [2.2, 2.0, 1.8], color: [170, 70, 200], proj: "beam" }
  };
  var ENEMIES = {
    soldier: { name: "asker", hp: 10, spd: 26, reward: 5, lives: 1, r: 4, color: [200, 80, 70] },
    runner: { name: "koşucu", hp: 6, spd: 46, reward: 5, lives: 1, r: 3, color: [240, 200, 70] },
    tank: { name: "zırhlı", hp: 40, spd: 16, reward: 14, lives: 2, r: 6, color: [110, 120, 140] },
    swarm: { name: "sürü", hp: 3, spd: 34, reward: 2, lives: 1, r: 2, color: [140, 200, 90] }
  };
  var BOSS = { name: "patron", hp: 260, spd: 14, reward: 80, lives: 10, r: 8, color: [190, 50, 120], boss: true };
  var FEATURES = ["speed", "bonus", "freeze"];

  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(a, b, c) { var n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; n = (n ^ (n >>> 13)) * 1103515245 | 0; return (((n ^ (n >>> 16)) >>> 0) % 65536) / 65536; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shade(c, k) { return [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  // ---- the map: a road from the left edge to the right edge made of horizontal and vertical stretches, never touching itself ----
  function genMap(seed, size) {
    var turns = SIZES[size] || 3, rnd = rng(seed * 211 + 13), tries, grid, cells;
    for (tries = 0; tries < 60; tries++) {
      var xs = [], x = 2 + Math.floor(rnd() * 2), i;
      for (i = 0; i < turns; i++) { xs.push(x); x += 3 + Math.floor(rnd() * 3); }
      if (xs[xs.length - 1] > GW - 3) continue;
      var ys = [1 + Math.floor(rnd() * (GH - 2))];
      for (i = 0; i < turns; i++) { var y, guard = 0; do { y = 1 + Math.floor(rnd() * (GH - 2)); guard++; } while (Math.abs(y - ys[ys.length - 1]) < 3 && guard < 40); if (Math.abs(y - ys[ys.length - 1]) < 3) break; ys.push(y); }
      if (ys.length !== turns + 1) continue;
      cells = []; var cx = 0, cy = ys[0]; cells.push([cx, cy]);
      for (i = 0; i < turns; i++) { while (cx < xs[i]) { cx++; cells.push([cx, cy]); } while (cy !== ys[i + 1]) { cy += cy < ys[i + 1] ? 1 : -1; cells.push([cx, cy]); } }
      while (cx < GW - 1) { cx++; cells.push([cx, cy]); }
      grid = new Uint8Array(GW * GH);
      cells.forEach(function (c) { grid[c[1] * GW + c[0]] = 1; });
      var deco = 0, dr = rng(seed * 59 + 7);
      for (var gy = 0; gy < GH; gy++) for (var gx = 0; gx < GW; gx++) if (!grid[gy * GW + gx] && dr() < 0.1) { grid[gy * GW + gx] = 2; deco++; }
      grid[cells[cells.length - 1][1] * GW + GW - 1] = 3; grid[cells[0][1] * GW + 0] = 4;
      return { W: GW, H: GH, grid: grid, cells: cells, path: cells.map(function (c) { return { x: c[0] * T + T / 2, y: c[1] * T + T / 2 }; }) };
    }
    throw new Error("harita üretilemedi");
  }

  // ---- waves: what comes, in order, from the wave number and the spec ----
  function waveList(n, waves, spec, rnd) {
    var d = spec.difficulty, kinds = spec.enemies.filter(function (k) { return k === "soldier" || (k === "runner" && n >= 2) || (k === "swarm" && n >= 3) || (k === "tank" && n >= 4); });
    if (!kinds.length) kinds = [spec.enemies[0]];
    var budget = 6 + n * 3.4 * (0.8 + 0.12 * d), out = [], cost = { soldier: 1, runner: 1, swarm: 0.4, tank: 4 };
    if (spec.boss && n === waves) { out.push({ kind: "boss", delay: 1 }); budget *= 0.45; }
    while (budget > 0) { var k = kinds[Math.floor(rnd() * kinds.length)]; out.push({ kind: k, delay: k === "swarm" ? 0.35 : k === "tank" ? 1.8 : 0.9 }); budget -= cost[k] || 1; }
    return out;
  }

  // ---- pixel art ----
  var SPR = {
    arrow: { rows: ["....kk....", "...kyyk...", "..kbbbbk..", "..kbwwbk..", "..kbbbbk..", "..kbbbbk..", ".kbbbbbbk.", ".kddddddk.", "kddddddddk"], pal: { k: [40, 30, 20], b: [170, 120, 60], y: [230, 200, 90], w: [250, 240, 200], d: [110, 80, 40] } },
    cannon: { rows: ["..........", "...kkkk...", "..kggggk..", ".kgGggggk.", ".kggggggk.", ".kgggGggk.", "..kggggk..", "..kddddk..", ".kddddddk."], pal: { k: [20, 20, 26], g: [90, 90, 104], G: [150, 150, 170], d: [60, 60, 72] } },
    frost: { rows: ["....cc....", "...cCCc...", "..cCCCCc..", "..cCwCCc..", "...cCCc...", "..cCCCCc..", "...cCCc...", "..kddddk..", ".kddddddk."], pal: { c: [90, 160, 220], C: [160, 220, 250], w: [255, 255, 255], k: [30, 50, 70], d: [60, 90, 120] } },
    sniper: { rows: ["....pp....", "...pPPp...", "..pPwwPp..", "..pPPPPp..", "...pPPp...", "...pPPp...", "..kpPPpk..", "..kddddk..", ".kddddddk."], pal: { p: [140, 56, 170], P: [200, 120, 230], w: [255, 240, 120], k: [40, 20, 50], d: [80, 40, 100] } },
    soldier: { rows: ["..rrrr..", ".rrrrrr.", ".rwkkwr.", "..rrrr..", ".bbbbbb.", "bbbbbbbb", ".b.bb.b.", ".kk..kk."], pal: { r: [200, 80, 70], w: [250, 230, 210], k: [30, 20, 20], b: [150, 50, 50] } },
    runner: { rows: ["..yyy..", ".yyyyy.", ".ywkwy.", "..yyy..", ".yyyyy.", "yy.y.yy", ".k...k."], pal: { y: [240, 200, 70], w: [255, 255, 255], k: [60, 40, 10] } },
    tank: { rows: ["..gggggg..", ".gGGGGGGg.", "gGGkGGkGGg", "gGGGGGGGGg", "gGGGGGGGGg", "ggGGGGGGgg", "gggggggggg", "kk.kkkk.kk", ".kk....kk."], pal: { g: [90, 100, 120], G: [140, 152, 176], k: [30, 30, 40] } },
    swarm: { rows: ["gggg", "gwkg", "gggg", ".gg."], pal: { g: [140, 200, 90], w: [255, 255, 255], k: [20, 40, 20] } },
    boss: { rows: ["..mm....mm..", ".mmmm..mmmm.", ".mmmmmmmmmm.", "mmwwmmmmwwmm", "mmwkmmmmwkmm", "mmmmmmmmmmmm", "mmkkkkkkkkmm", ".mmmmmmmmmm.", "mmdmmmmmmdmm", "mm.dd..dd.mm", ".dd.dd.dd.dd"], pal: { m: [190, 50, 120], w: [255, 240, 150], k: [30, 10, 30], d: [110, 30, 70] } },
    castle: { rows: ["k.k.k.k.k.k.", "kkkkkkkkkkkk", "kssssssssssk", "kssswwsssswk", "kssssssssssk", "kssssddsssss", "kssssddsssss", "kkkkkkkkkkkk"], pal: { k: [60, 56, 70], s: [140, 136, 150], w: [90, 160, 230], d: [100, 70, 40] } },
    cave: { rows: ["..kkkkkk..", ".kddddddk.", "kddddddddk", "kdd0000ddk", "kdd0000ddk", "kdd0000ddk"], pal: { k: [30, 26, 24], d: [70, 60, 54], 0: [10, 8, 8] } },
    tree: { rows: ["..gggg..", ".gGgGgg.", "gggGgggg", "gGgggGgg", ".gggggg.", "...tt...", "...tt..."], pal: { g: [38, 110, 48], G: [64, 150, 70], t: [90, 60, 34] } },
    rock: { rows: ["..rrrr..", ".rRRrrr.", "rRRrrrrr", "rrrrrdrr", ".rrdddr.", "..dddd.."], pal: { r: [140, 126, 110], R: [184, 170, 150], d: [90, 80, 70] } }
  };
  function drawRows(c, rows, pal, x, y, tint) { for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) { var cc = pal[rows[j].charAt(i)]; if (cc) { c.fillStyle = rgb(tint ? [clamp(cc[0] + tint[0], 0, 255), clamp(cc[1] + tint[1], 0, 255), clamp(cc[2] + tint[2], 0, 255)] : cc); c.fillRect(x + i, y + j, 1, 1); } } }
  function tileTex(theme, kind, variant, edges) {
    var cv = document.createElement("canvas"); cv.width = cv.height = T; var c = cv.getContext("2d"), im = c.createImageData(T, T);
    for (var v = 0; v < T; v++) for (var u = 0; u < T; u++) {
      var n = hash(kind * 13 + variant, u, v), col = kind === 0 ? shade(theme.grass[variant], 0.92 + n * 0.16) : shade(theme.path[variant], 0.92 + n * 0.16);
      if (kind === 0 && n > 0.95) col = shade(theme.grass[variant], 1.25);
      if (kind === 1) { if (n > 0.96) col = shade(col, 0.8); if (edges && ((edges & 1 && v < 2) || (edges & 2 && u > 13) || (edges & 4 && v > 13) || (edges & 8 && u < 2))) col = shade(theme.edge, 0.9 + n * 0.2); }
      var o = (v * T + u) * 4; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 255;
    }
    c.putImageData(im, 0, 0); return cv;
  }

  K.kit.define("tower", {
    defaults: { title: "Kule Savunması", theme: "grass", difficulty: 3, size: "medium", waves: 10, enemies: ["soldier", "runner", "tank", "swarm"], towers: ["arrow", "cannon", "frost", "sniper"], boss: true, music: "tower", world: { seed: 1 }, width: 640, height: 400, features: [] },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (SIZES[spec.size] === undefined) errors.push("bilinmeyen boyut: " + spec.size + " (small, medium, large)");
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      if (typeof spec.waves !== "number" || spec.waves < 1 || spec.waves > 30) errors.push("waves 1-30 olmalı");
      if (!(spec.enemies instanceof Array) || !spec.enemies.length) errors.push("enemies boş olmamalı");
      else spec.enemies.forEach(function (k) { if (!ENEMIES[k]) errors.push("bilinmeyen düşman: " + k + " (var olanlar: " + Object.keys(ENEMIES).join(", ") + ")"); });
      if (!(spec.towers instanceof Array) || !spec.towers.length) errors.push("towers boş olmamalı");
      else spec.towers.forEach(function (k) { if (!TOWERS[k]) errors.push("bilinmeyen kule: " + k + " (var olanlar: " + Object.keys(TOWERS).join(", ") + ")"); });
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var seed = (spec.world && spec.world.seed) || 1, theme = THEMES[spec.theme], d = spec.difficulty, tune = spec.music, feats = spec.features || [], rnd = rng(seed * 83 + 21), avail = spec.towers.slice();
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      var map = genMap(seed, spec.size), P = map.path, cum = [0];
      for (var pi = 1; pi < P.length; pi++) cum.push(cum[pi - 1] + Math.hypot(P[pi].x - P[pi - 1].x, P[pi].y - P[pi - 1].y));
      var LEN = cum[cum.length - 1];
      var state = { g: g, spec: spec, map: map, pathLen: LEN, towers: [], enemies: [], shots: [], parts: [], queue: [], wave: 0, waves: spec.waves, waveOn: false, gold: 0, lives: 0, over: false, won: false, message: "", messageT: 0, time: 0, cx: 4, cy: 4, sel: avail[0], picked: null, countdown: 0, speed: 1, freezeCd: 0, frozen: 0, kills: 0, hasSpeed: feats.indexOf("speed") >= 0, hasBonus: feats.indexOf("bonus") >= 0, hasFreeze: feats.indexOf("freeze") >= 0, spawnT: 0 };
      state.menu = { open: K.tower.menuAtStart !== false, kind: "main", index: 0, started: false }; state.paused = state.menu.open; state.musicOn = true;
      state.say = function (t, s) { state.message = t; state.messageT = s || 2; };
      function posAt(dist) {
        dist = clamp(dist, 0, LEN); var lo = 0, hi = cum.length - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= dist) lo = mid; else hi = mid; }
        var seg = cum[hi] - cum[lo] || 1, t = (dist - cum[lo]) / seg; return { x: P[lo].x + (P[hi].x - P[lo].x) * t, y: P[lo].y + (P[hi].y - P[lo].y) * t };
      }
      state.posAt = posAt;
      state.reset = function () {
        state.towers = []; state.enemies = []; state.shots = []; state.parts = []; state.queue = []; state.wave = 0; state.waveOn = false; state.over = false; state.won = false; state.kills = 0; state.time = 0; state.messageT = 0; state.frozen = 0; state.freezeCd = 0;
        state.gold = Math.round((90 + 10 * (6 - d)) * (state.hasBonus ? 1.5 : 1)); state.lives = [30, 25, 20, 15, 10][d - 1]; state.countdown = 12; state.sel = avail[0]; state.picked = null; state.speed = 1;
        state.say("Kule kur: 1-" + avail.length + " tür, tıkla ya da Boşluk. N: dalgayı başlat", 4); if (g.current !== "play") g.go("play");
      };
      state.start = function () { state.reset(); if (tune && state.musicOn) K.music.play(tune); };
      function finish(win) { state.over = true; state.won = win; K.music.stop(); K.sfx(win ? "coin" : "hit"); }

      // ---- towers ----
      function towerAt(gx, gy) { for (var i = 0; i < state.towers.length; i++) if (state.towers[i].gx === gx && state.towers[i].gy === gy) return state.towers[i]; return null; }
      state.towerAt = towerAt;
      state.canBuild = function (gx, gy) { return gx >= 0 && gy >= 0 && gx < GW && gy < GH && map.grid[gy * GW + gx] === 0 && !towerAt(gx, gy); };
      state.build = function (gx, gy, type) {
        type = type || state.sel; var def = TOWERS[type]; if (!def || avail.indexOf(type) < 0 || state.over) return false;
        if (!state.canBuild(gx, gy)) return false; if (state.gold < def.cost[0]) { state.say("Altın yetmiyor: " + def.cost[0]); return false; }
        state.gold -= def.cost[0]; state.towers.push({ type: type, gx: gx, gy: gy, x: gx * T + T / 2, y: gy * T + T / 2, lvl: 0, cd: 0.3, spent: def.cost[0], aim: 0 }); K.sfx("coin"); state.picked = state.towers[state.towers.length - 1]; return true;
      };
      state.upgrade = function (gx, gy) {
        var t = towerAt(gx, gy); if (!t || state.over) return false; var def = TOWERS[t.type];
        if (t.lvl >= 2) { state.say("En üst seviye"); return false; } var cost = def.cost[t.lvl + 1]; if (state.gold < cost) { state.say("Altın yetmiyor: " + cost); return false; }
        state.gold -= cost; t.spent += cost; t.lvl++; K.sfx("coin"); state.say(def.name + " seviye " + (t.lvl + 1)); return true;
      };
      state.sell = function (gx, gy) {
        var t = towerAt(gx, gy); if (!t || state.over) return false; state.gold += Math.round(t.spent * 0.7); state.towers.splice(state.towers.indexOf(t), 1); if (state.picked === t) state.picked = null; K.sfx("click"); return true;
      };
      state.damageOf = function (t) { return TOWERS[t.type].dmg[t.lvl]; };
      state.rangeOf = function (t) { return TOWERS[t.type].range[t.lvl]; };
      state.press = function (gx, gy) {   // a click or Space on a tile: a tower there is chosen (a second press upgrades it), an empty tile gets the chosen kind
        var t = towerAt(gx, gy); state.cx = gx; state.cy = gy;
        if (t) { if (state.picked === t) return state.upgrade(gx, gy); state.picked = t; K.sfx("click"); return true; }
        state.picked = null; return state.build(gx, gy, state.sel);
      };

      // ---- waves and enemies ----
      state.startWave = function () {
        if (state.waveOn || state.over || state.wave >= state.waves) return false;
        state.wave++; state.waveOn = true; state.countdown = 0; state.queue = waveList(state.wave, state.waves, spec, rnd).map(function (q) { return { kind: q.kind, delay: q.delay }; }); state.spawnT = 0.5;
        state.say("Dalga " + state.wave + " / " + state.waves + (state.wave === state.waves && spec.boss ? "  PATRON!" : ""), 2.4); K.sfx("click"); return true;
      };
      function spawn(kind) {
        var def = kind === "boss" ? BOSS : ENEMIES[kind], scale = (1 + 0.14 * state.wave) * (0.85 + 0.1 * d);
        state.enemies.push({ kind: kind, def: def, dist: 0, hp: Math.round(def.hp * scale), maxHp: Math.round(def.hp * scale), slowT: 0, slowF: 1, flash: 0, dead: false, x: P[0].x, y: P[0].y, anim: rnd() * 6 });
      }
      state.damageEnemy = function (e, dmg) {
        if (e.dead) return; e.hp -= dmg; e.flash = 0.1;
        if (e.hp <= 0) { e.dead = true; state.kills++; state.gold += e.def.reward; K.sfx("boom"); for (var i = 0; i < 5; i++) state.parts.push({ x: e.x, y: e.y, vx: (rnd() - 0.5) * 70, vy: (rnd() - 0.5) * 70, life: 0.35, c: e.def.color }); }
      };
      state.freeze = function () { if (!state.hasFreeze || state.freezeCd > 0 || state.over) return false; state.frozen = 3; state.freezeCd = 25; K.sfx("click"); state.say("Dondu!", 1.2); return true; };

      // ---- one step ----
      function firstTarget(t, range) { var best = null; state.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= range && (!best || e.dist > best.dist)) best = e; }); return best; }
      state.step = function (dt) {
        if (state.paused) return; dt *= state.speed;
        state.messageT = Math.max(0, state.messageT - dt / state.speed);
        state.parts = state.parts.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.life > 0; });
        if (state.over) return;
        state.time += dt; state.freezeCd = Math.max(0, state.freezeCd - dt); state.frozen = Math.max(0, state.frozen - dt);
        if (!state.waveOn && state.wave < state.waves) { state.countdown -= dt; if (state.countdown <= 0) state.startWave(); }
        if (state.waveOn && state.queue.length) { state.spawnT -= dt; if (state.spawnT <= 0) { var q = state.queue.shift(); spawn(q.kind); state.spawnT = q.delay; } }
        state.enemies.forEach(function (e) {
          if (e.dead) return; e.flash = Math.max(0, e.flash - dt); e.anim += dt * 6; e.slowT = Math.max(0, e.slowT - dt); if (e.slowT <= 0) e.slowF = 1;
          if (state.frozen <= 0) e.dist += e.def.spd * e.slowF * dt; var p = posAt(e.dist); e.x = p.x; e.y = p.y;
          if (e.dist >= LEN) { e.dead = true; state.lives -= e.def.lives; state.say("Kaleye vurdu! -" + e.def.lives, 1.2); K.sfx("hit"); if (state.lives <= 0) { state.lives = 0; finish(false); } }
        });
        state.towers.forEach(function (t) {
          t.cd -= dt; if (t.cd > 0) return; var def = TOWERS[t.type], tgt = firstTarget(t, def.range[t.lvl]); if (!tgt) return;
          t.cd = def.rate[t.lvl]; t.aim = Math.atan2(tgt.y - t.y, tgt.x - t.x);
          if (def.proj === "beam") { state.damageEnemy(tgt, def.dmg[t.lvl]); state.shots.push({ kind: "beam", x: t.x, y: t.y, tx: tgt.x, ty: tgt.y, life: 0.12 }); K.sfx("fire"); }
          else state.shots.push({ kind: def.proj, x: t.x, y: t.y, target: tgt, spd: def.proj === "ball" ? 90 : 170, dmg: def.dmg[t.lvl], splash: def.splash ? def.splash[t.lvl] : 0, slow: def.slow ? def.slow[t.lvl] : 0, life: 3 });
        });
        state.shots.forEach(function (s) {
          if (s.kind === "beam") { s.life -= dt; return; }
          var tg = s.target; if (!tg || tg.dead) { s.life = 0; return; } var dx = tg.x - s.x, dy = tg.y - s.y, dist = Math.hypot(dx, dy), step = s.spd * dt;
          if (dist <= step + tg.def.r) {
            if (s.splash) { state.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - tg.x, e.y - tg.y) <= s.splash) state.damageEnemy(e, s.dmg); }); for (var i = 0; i < 6; i++) state.parts.push({ x: tg.x, y: tg.y, vx: (rnd() - 0.5) * 90, vy: (rnd() - 0.5) * 90, life: 0.25, c: [250, 170, 60] }); }
            else { state.damageEnemy(tg, s.dmg); if (s.slow) { tg.slowF = s.slow; tg.slowT = 1.6; } }
            s.life = 0; return;
          }
          s.x += dx / dist * step; s.y += dy / dist * step; s.life -= dt;
        });
        state.shots = state.shots.filter(function (s) { return s.life > 0; }); state.enemies = state.enemies.filter(function (e) { return !e.dead; });
        if (state.waveOn && !state.queue.length && !state.enemies.length) {
          state.waveOn = false; state.gold += 12 + state.wave * 3; state.countdown = 9;
          if (state.wave >= state.waves) finish(true); else state.say("Dalga geçti! +" + (12 + state.wave * 3) + " altın", 2);
        }
      };

      // ---- the menus ----
      var CONTROLS = ["Fare  haritaya tıkla: kule kur, kuleye tıkla: seç, tekrar tıkla: yükselt      Alttaki şeritten kule türü seç", "Oklar  imleç      1-4  kule türü      Boşluk ya da Enter  kur / yükselt      X  sat      N  dalgayı hemen başlat", "F  hızlandır (speed)      G  dondur (freeze)      R  yeniden      Esc  menü.   Düşmanlar kaleye varırsa can gider."];
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.paused = true; };
      state.closeMenu = function () { state.menu.open = false; state.menu.started = true; state.paused = false; };
      state.toggleMusic = function () { state.musicOn = !state.musicOn; if (state.musicOn) { if (tune) K.music.play(tune); } else K.music.stop(); };
      state.menuItems = function () {
        var m = state.menu, music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic }, controls = { label: "Kontroller", act: function () { m.back = m.kind; m.kind = "controls"; m.index = 0; } };
        if (m.kind === "main") return [{ label: m.started ? "Devam et" : "Savunmaya başla", act: state.closeMenu }, controls, music];
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
        if (tap("ArrowUp") || tap("w")) m.index = (m.index + items.length - 1) % items.length;
        if (tap("ArrowDown") || tap("s")) m.index = (m.index + 1) % items.length;
        if (tap("Enter") || tap(" ")) items[Math.min(m.index, items.length - 1)].act();
        if (tap("Escape") && m.kind === "pause") state.closeMenu();
      };
      state.click = function (sx, sy) {   // a click in picture pixels: the map, or the strip of towers under it
        if (sy < BAR) return state.press(Math.floor(sx / T), Math.floor(sy / T));
        for (var i = 0; i < avail.length; i++) if (sx >= 8 + i * 42 && sx < 8 + i * 42 + 40) { state.sel = avail[i]; state.picked = null; K.sfx("click"); return true; }
        if (sx >= 250 && sx < 312 && state.picked) { return sy < 180 ? state.upgrade(state.picked.gx, state.picked.gy) : state.sell(state.picked.gx, state.picked.gy); }
        return false;
      };
      state.keys = function () {
        if (tap("ArrowLeft")) state.cx = Math.max(0, state.cx - 1); if (tap("ArrowRight")) state.cx = Math.min(GW - 1, state.cx + 1); if (tap("ArrowUp")) state.cy = Math.max(0, state.cy - 1); if (tap("ArrowDown")) state.cy = Math.min(GH - 1, state.cy + 1);
        for (var i = 0; i < avail.length; i++) if (tap(String(i + 1))) { state.sel = avail[i]; state.picked = null; }
        if (tap(" ") || tap("Enter")) state.press(state.cx, state.cy);
        if (tap("x")) state.sell(state.cx, state.cy); if (tap("n")) state.startWave(); if (tap("g")) state.freeze(); if (tap("f") && state.hasSpeed) state.speed = state.speed === 1 ? 2 : 1;
      };

      // ---- the picture ----
      var bg = null, small = null, sc = null;
      function buildBg() {
        var cv = document.createElement("canvas"); cv.width = GW * T; cv.height = GH * T; var c = cv.getContext("2d");
        var gt = [0, 1].map(function (v) { return tileTex(theme, 0, v, 0); }), pt = [0, 1].map(function (v) { return {}; });
        var isPath = function (x, y) { return x >= 0 && y >= 0 && x < GW && y < GH && (map.grid[y * GW + x] === 1 || map.grid[y * GW + x] === 3 || map.grid[y * GW + x] === 4); };
        for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++) {
          var k = map.grid[y * GW + x];
          if (k === 1 || k === 3 || k === 4) { var e = (isPath(x, y - 1) ? 0 : 1) | (isPath(x + 1, y) ? 0 : 2) | (isPath(x, y + 1) ? 0 : 4) | (isPath(x - 1, y) ? 0 : 8); var key = (x + y) % 2 + "_" + e; if (!pt[(x + y) % 2][e]) pt[(x + y) % 2][e] = tileTex(theme, 1, (x + y) % 2, e); c.drawImage(pt[(x + y) % 2][e], x * T, y * T); }
          else c.drawImage(gt[(x + y) % 2], x * T, y * T);
        }
        for (var y2 = 0; y2 < GH; y2++) for (var x2 = 0; x2 < GW; x2++) {
          var k2 = map.grid[y2 * GW + x2];
          if (k2 === 2) { var s = SPR[theme.deco]; c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(x2 * T + 3, y2 * T + 11, 10, 3); drawRows(c, s.rows, s.pal, x2 * T + 4, y2 * T + 6 - s.rows.length / 2 + 2); }
          if (k2 === 3) drawRows(c, SPR.castle.rows, SPR.castle.pal, x2 * T + 2, y2 * T + 4);
          if (k2 === 4) drawRows(c, SPR.cave.rows, SPR.cave.pal, x2 * T + 3, y2 * T + 5);
        }
        bg = cv; small = document.createElement("canvas"); small.width = VW; small.height = VH; sc = small.getContext("2d");
      }
      function pixCircle(c, cx, cy, r, col) { c.fillStyle = col; for (var a = 0; a < 6.2832; a += 0.9 / r) c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
      function towerSprite(c, t, x, y) {
        var def = TOWERS[t.type], s = SPR[t.type]; c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x + 2, y + 12, 12, 3);
        drawRows(c, s.rows, s.pal, x + 3, y + 3, t.lvl === 1 ? [20, 20, 20] : t.lvl === 2 ? [45, 45, 30] : null);
        for (var i = 0; i <= t.lvl; i++) { c.fillStyle = "#ffd54f"; c.fillRect(x + 4 + i * 3, y + 1, 2, 2); }
      }
      function drawWorld(c) {
        c.imageSmoothingEnabled = false; c.drawImage(bg, 0, 0);
        var picked = state.picked;
        if (picked) { var r = TOWERS[picked.type].range[picked.lvl]; pixCircle(c, picked.x, picked.y, r, "rgba(255,255,255,0.55)"); }
        else if (state.canBuild(state.cx, state.cy)) { var rr = TOWERS[state.sel].range[0]; pixCircle(c, state.cx * T + 8, state.cy * T + 8, rr, "rgba(255,255,255,0.25)"); }
        state.towers.forEach(function (t) { towerSprite(c, t, t.gx * T, t.gy * T - 2); });
        state.enemies.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (e) {
          var s = SPR[e.kind], w = s.rows[0].length, h = s.rows.length, bob = Math.round(Math.sin(e.anim) * 1), px = Math.round(e.x - w / 2), py = Math.round(e.y - h / 2 + bob);
          c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(px + 1, py + h - 1, w - 2, 2); drawRows(c, s.rows, s.pal, px, py, e.flash > 0 ? [80, 80, 80] : e.slowT > 0 ? [-30, 20, 60] : null);
          if (e.maxHp > 4 && e.hp < e.maxHp) { c.fillStyle = "#300"; c.fillRect(px, py - 3, w, 2); c.fillStyle = "#e33"; c.fillRect(px, py - 3, Math.max(1, Math.round(w * e.hp / e.maxHp)), 2); }
        });
        state.shots.forEach(function (s) {
          if (s.kind === "beam") { c.fillStyle = "#e0a0ff"; var n = Math.ceil(Math.hypot(s.tx - s.x, s.ty - s.y) / 2); for (var i = 0; i <= n; i++) c.fillRect(Math.round(s.x + (s.tx - s.x) * i / n), Math.round(s.y + (s.ty - s.y) * i / n), 1, 1); return; }
          c.fillStyle = s.kind === "arrow" ? "#f0e0b0" : s.kind === "ball" ? "#202028" : "#bfeaff"; var sz = s.kind === "ball" ? 4 : 2; c.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, sz, sz);
        });
        state.parts.forEach(function (p) { c.fillStyle = rgb(p.c); c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); });
        if (!state.paused && !state.over) { c.fillStyle = state.canBuild(state.cx, state.cy) ? "#7CFC7C" : "#ffd54f"; var kx = state.cx * T, ky = state.cy * T; c.fillRect(kx, ky, 4, 1); c.fillRect(kx, ky, 1, 4); c.fillRect(kx + T - 4, ky, 4, 1); c.fillRect(kx + T - 1, ky, 1, 4); c.fillRect(kx, ky + T - 1, 4, 1); c.fillRect(kx, ky + T - 4, 1, 4); c.fillRect(kx + T - 4, ky + T - 1, 4, 1); c.fillRect(kx + T - 1, ky + T - 4, 1, 4); }
        if (state.frozen > 0) { c.fillStyle = "rgba(140,200,255,0.18)"; c.fillRect(0, 0, GW * T, BAR); }
        if (theme.tint) { c.fillStyle = theme.tint; c.fillRect(0, 0, VW, BAR); }
        c.fillStyle = "#1c1a24"; c.fillRect(0, BAR, VW, VH - BAR); c.fillStyle = "#4a4660"; c.fillRect(0, BAR, VW, 1);
        avail.forEach(function (name, i) {
          var x = 8 + i * 42, on = state.sel === name, def = TOWERS[name], afford = state.gold >= def.cost[0];
          c.fillStyle = on ? "#4a4278" : "#2c2838"; c.fillRect(x, BAR + 4, 40, 32); c.fillStyle = on ? "#ffd54f" : "#4a4660"; c.fillRect(x, BAR + 4, 40, 1); c.fillRect(x, BAR + 35, 40, 1); c.fillRect(x, BAR + 4, 1, 32); c.fillRect(x + 39, BAR + 4, 1, 32);
          drawRows(c, SPR[name].rows, SPR[name].pal, x + 15, BAR + 6, afford ? null : [-70, -70, -70]);
        });
        if (state.picked) { c.fillStyle = "#2c2838"; c.fillRect(250, BAR + 4, 62, 14); c.fillRect(250, BAR + 20, 62, 14); c.fillStyle = state.picked.lvl < 2 && state.gold >= TOWERS[state.picked.type].cost[state.picked.lvl + 1] ? "#4a8a4a" : "#444"; c.fillRect(250, BAR + 4, 62, 1); c.fillStyle = "#8a4a4a"; c.fillRect(250, BAR + 20, 62, 1); }
      }
      function drawHud(c) {
        var W = g.width, H = g.height, k = W / VW;
        c.textAlign = "left"; c.font = "bold 13px sans-serif"; c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(6, 6, state.hasFreeze ? 390 : 300, 22);
        c.fillStyle = "#ffd54f"; c.fillText("ALTIN " + state.gold, 12, 22); c.fillStyle = "#ff6b6b"; c.fillText("CAN " + state.lives, 100, 22); c.fillStyle = "#fff"; c.fillText("DALGA " + Math.max(state.wave, 0) + " / " + state.waves, 168, 22);
        if (!state.waveOn && state.wave < state.waves && !state.over) { c.fillStyle = "#9be39b"; c.fillText("N: " + Math.ceil(state.countdown) + " sn", 248, 22); }
        if (state.speed > 1) { c.fillStyle = "#80d0ff"; c.fillText("x2", 290, 22); }
        c.font = "bold 10px sans-serif"; avail.forEach(function (name, i) { var def = TOWERS[name]; c.fillStyle = state.gold >= def.cost[0] ? "#fff" : "#888"; c.textAlign = "center"; c.fillText((i + 1) + "  " + def.cost[0], (8 + i * 42 + 20) * k, (BAR + 32) * k - 2); });
        c.textAlign = "left";
        if (state.picked) {
          var t = state.picked, def = TOWERS[t.type]; c.font = "bold 11px sans-serif"; c.fillStyle = "#fff"; c.fillText(def.name + " (" + (t.lvl + 1) + ")", 178 * k, (BAR + 12) * k);
          c.font = "10px sans-serif"; c.fillStyle = "#cfd8dc"; c.fillText("hasar " + def.dmg[t.lvl] + "  menzil " + def.range[t.lvl], 178 * k, (BAR + 24) * k); c.fillText("sat " + Math.round(t.spent * 0.7) + " altın", 178 * k, (BAR + 34) * k);
          c.textAlign = "center"; c.font = "bold 10px sans-serif"; c.fillStyle = "#fff"; c.fillText(t.lvl < 2 ? "YÜKSELT " + def.cost[t.lvl + 1] : "EN ÜST", 281 * k, (BAR + 14) * k); c.fillText("SAT", 281 * k, (BAR + 30) * k); c.textAlign = "left";
        } else { c.font = "10px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText(TOWERS[state.sel].name + ": hasar " + TOWERS[state.sel].dmg[0] + "  menzil " + TOWERS[state.sel].range[0], 178 * k, (BAR + 16) * k); c.fillText("boş karoya tıkla: kur", 178 * k, (BAR + 28) * k); }
        if (state.hasFreeze) { c.font = "bold 10px sans-serif"; c.fillStyle = state.freezeCd > 0 ? "#888" : "#9fd8ff"; c.fillText("G dondur" + (state.freezeCd > 0 ? " " + Math.ceil(state.freezeCd) : ""), 318, 22); }
        if (state.messageT > 0) { c.textAlign = "center"; c.fillStyle = "#ffe082"; c.font = "bold 18px sans-serif"; c.fillText(state.message, W / 2, 56); c.textAlign = "left"; }
        if (state.over) {
          c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(W / 2 - 150, H / 2 - 80, 300, 160); c.textAlign = "center"; c.fillStyle = state.won ? "#ffd54f" : "#fff"; c.font = "bold 28px sans-serif";
          c.fillText(state.won ? "SAVUNDUN!" : "KALE DÜŞTÜ", W / 2, H / 2 - 34); c.font = "15px sans-serif"; c.fillStyle = "#fff"; c.fillText("Dalga " + state.wave + " / " + state.waves + "   Öldürülen " + state.kills, W / 2, H / 2 + 6); c.fillStyle = "#b0bec5"; c.font = "13px sans-serif"; c.fillText("R: yeniden oyna", W / 2, H / 2 + 50); c.textAlign = "left";
        }
      }
      function drawMenu(c) {
        var m = state.menu, W = g.width, H = g.height; c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, W, H); c.textAlign = "center";
        c.fillStyle = "#fff"; c.font = "bold 34px sans-serif"; c.fillText(m.kind === "main" ? (spec.title || "Kule Savunması") : m.kind === "controls" ? "Kontroller" : "Duraklatıldı", W / 2, 70);
        if (m.kind === "controls") { c.font = "13px sans-serif"; c.fillStyle = "#e0e0e0"; CONTROLS.forEach(function (t, i) { c.fillText(t, W / 2, 140 + i * 34); }); c.fillStyle = "#ffd54f"; c.fillText("Esc ya da tık: geri", W / 2, H - 40); c.textAlign = "left"; return; }
        var items = state.menuItems();
        items.forEach(function (it, i) { var y = rowY(items.length) + i * 44 - 4, on = i === m.index; c.fillStyle = on ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.08)"; c.fillRect(W / 2 - 150, y, 300, 38); c.strokeStyle = on ? "#ffd54f" : "rgba(255,255,255,0.2)"; c.strokeRect(W / 2 - 150, y, 300, 38); c.fillStyle = on ? "#ffd54f" : "#fff"; c.font = "bold 17px sans-serif"; c.fillText(it.label, W / 2, y + 25); });
        c.font = "12px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla", W / 2, H - 30); c.textAlign = "left";
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined" || g.current !== "play") return;
        if (!bg) buildBg();
        drawWorld(sc); c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        if (!(state.menu.open && state.menu.kind === "main")) drawHud(c); if (state.menu.open) drawMenu(c);
      } }];
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) {
        g.canvas.addEventListener("mousedown", function (e) { if (e.button !== 0) return; if (state.menu.open) { state.menuClick(); return; } if (!state.over && !state.paused) state.click(K.mouse.x * VW / g.width, K.mouse.y * VH / g.height); });
        g.canvas.addEventListener("mousemove", function () { if (!state.menu.open) { var gx = Math.floor(K.mouse.x * VW / g.width / T), gy = Math.floor(K.mouse.y * VH / g.height / T); if (gy < GH && gx >= 0 && gx < GW) { state.cx = gx; state.cy = gy; } } });
      }
      g.scene("play", { update: function (game, dt) {
        if (state.menu.open) { state.menuUpdate(); return; }
        if (tap("Escape")) { state.openMenu("pause"); return; }
        if (tap("r")) { state.reset(); if (tune && state.musicOn) K.music.play(tune); return; }
        state.keys(); state.step(dt);
      } });
      state.expose = { g: g, spec: spec, state: state, get p() { return state.towers; } };
      return state;
    }
  });

  K.tower = { themes: Object.keys(THEMES), towers: Object.keys(TOWERS), enemies: Object.keys(ENEMIES), sizes: Object.keys(SIZES), features: FEATURES, genMap: genMap, waveList: waveList, TILE: T, GW: GW, GH: GH, menuAtStart: true };
  K.feature.define("speed", { kits: ["tower"], options: {}, apply: function (s) { s.hasSpeed = true; } });
  K.feature.define("bonus", { kits: ["tower"], options: {}, apply: function (s) { s.hasBonus = true; } });
  K.feature.define("freeze", { kits: ["tower"], options: {}, apply: function (s) { s.hasFreeze = true; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
