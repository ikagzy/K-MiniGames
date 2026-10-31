/* kgame.voxel.js: küp dünya kiti (sandbox: madencilik ve inşaat, eski Minecraft tadında küçük bir dünya). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'sandbox', title:'Küp Dünya', biome:'forest', size:'medium', caves:2, ores:2, lakes:true, trees:2, time:'cycle', features:['fly'] })
   Kit; tohumdan arazi üretir (tepeler, göller, mağaralar, madenler, ağaçlar), birinci şahıs görüntüyü düşük çözünürlüklü ışın izlemeyle çizer,
   yürümeyi, zıplamayı, blok kırmayı ve koymayı, gündüz-geceyi ve değişiklikleri kaydetmeyi kendisi kurar. Özellikler: fly (uçmak), sprint (koşmak).
   Kontroller: W A S D yürür, oklar bakar, Boşluk zıplar, F ya da sol tık kırar, E ya da sağ tık koyar, Q blok seçer (ya da 1-9).
   Önce kgame.js ve kgame.kits.js. Doku ve renklerin hepsi kodla üretilir (resim dosyası yok). */
(function (root) {
  var K = root.K;
  var NAMES = ["hava", "çimen", "toprak", "taş", "kum", "kütük", "yaprak", "tahta", "cam", "kömür", "demir", "altın", "elmas", "kar", "su", "kaktüs"];
  var AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, LOG = 5, LEAVES = 6, PLANKS = 7, GLASS = 8, COAL = 9, IRON = 10, GOLD = 11, DIAMOND = 12, SNOW = 13, WATER = 14, CACTUS = 15;
  var BIOMES = { forest: { top: GRASS, trees: 1, amp: 5 }, plains: { top: GRASS, trees: 0.2, amp: 3 }, desert: { top: SAND, trees: 0.6, amp: 4 }, snow: { top: SNOW, trees: 0.5, amp: 6 } };
  var SIZES = { small: 48, medium: 64, large: 96 };
  var SY = 32, SEA = 9, RW = 160, RH = 100, REACH = 5, FAR = 36;

  // ---- noise (seeded, no libraries) ----
  function hash(seed, x, y, z) {
    var n = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 1442695041) | 0;
    n = (n ^ (n >>> 13)) * 1103515245 | 0;
    return (((n ^ (n >>> 16)) >>> 0) % 65536) / 65536;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise2(seed, x, z, scale) {
    var fx = x / scale, fz = z / scale, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = smooth(fx - x0), tz = smooth(fz - z0);
    var a = hash(seed, x0, 0, z0), b = hash(seed, x0 + 1, 0, z0), c = hash(seed, x0, 0, z0 + 1), d = hash(seed, x0 + 1, 0, z0 + 1);
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }
  function noise3(seed, x, y, z, scale) {
    var fx = x / scale, fy = y / scale, fz = z / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
    var tx = smooth(fx - x0), ty = smooth(fy - y0), tz = smooth(fz - z0), r = 0;
    for (var i = 0; i < 8; i++) {
      var dx = i & 1, dy = (i >> 1) & 1, dz = (i >> 2) & 1;
      r += hash(seed, x0 + dx, y0 + dy, z0 + dz) * (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
    }
    return r;
  }

  // ---- the world ----
  function makeWorld(o) {
    var S = SIZES[o.size] || 64, seed = (o.seed | 0) + 1, biome = BIOMES[o.biome] || BIOMES.forest;
    var blocks = new Uint8Array(S * SY * S);
    var at = function (x, y, z) { return (y * S + z) * S + x; };
    var heights = new Int16Array(S * S);
    for (var x = 0; x < S; x++) for (var z = 0; z < S; z++) {
      var n = noise2(seed, x, z, 22) * 0.65 + noise2(seed + 7, x, z, 9) * 0.35;
      var h = Math.round(11 + (n - 0.5) * 2 * biome.amp + (o.lakes ? 0 : 3));
      if (!o.lakes) h = Math.max(h, SEA + 1);
      heights[x * S + z] = h = Math.max(2, Math.min(SY - 8, h));
      for (var y = 0; y <= h; y++) {
        var b = STONE;
        if (y === h) b = h <= SEA + 1 && biome.top !== SNOW ? SAND : biome.top;
        else if (y >= h - 3) b = biome.top === SAND || h <= SEA + 1 ? SAND : DIRT;
        blocks[at(x, y, z)] = b;
      }
      for (var w = h + 1; w <= SEA; w++) blocks[at(x, w, z)] = WATER;
    }
    var caves = o.caves | 0, ores = o.ores | 0;
    for (x = 0; x < S; x++) for (z = 0; z < S; z++) {
      var top = heights[x * S + z];
      for (y = 3; y < top - 2; y++) {
        if (caves > 0 && noise3(seed + 3, x, y, z, 7) > 0.78 - caves * 0.045) { blocks[at(x, y, z)] = AIR; continue; }
        if (ores > 0 && blocks[at(x, y, z)] === STONE) {
          var r = hash(seed + 11, x, y, z), rich = 0.5 + ores * 0.5;
          if (y < 6 && r < 0.004 * rich) blocks[at(x, y, z)] = DIAMOND;
          else if (y < 10 && r < 0.010 * rich) blocks[at(x, y, z)] = GOLD;
          else if (y < 16 && r < 0.022 * rich) blocks[at(x, y, z)] = IRON;
          else if (r < 0.04 * rich) blocks[at(x, y, z)] = COAL;
        }
      }
    }
    var trees = (o.trees === undefined ? 1 : o.trees) * biome.trees;
    for (x = 3; x < S - 3; x++) for (z = 3; z < S - 3; z++) {
      var ht = heights[x * S + z], ground = blocks[at(x, ht, z)];
      if (trees <= 0 || ht <= SEA + 1 || hash(seed + 5, x, 0, z) > trees * 0.018) continue;
      if (o.biome === "desert" && ground === SAND) {   // a cactus
        for (var c = 1; c <= 2; c++) blocks[at(x, ht + c, z)] = CACTUS;
      } else if (ground === GRASS || ground === SNOW) {
        var th = 4 + (hash(seed + 9, x, 1, z) > 0.5 ? 1 : 0);
        for (var t = 1; t <= th; t++) blocks[at(x, ht + t, z)] = LOG;
        for (var lx = -2; lx <= 2; lx++) for (var lz = -2; lz <= 2; lz++) for (var ly = th - 1; ly <= th + 1; ly++) {
          if (Math.abs(lx) + Math.abs(lz) + (ly - th + 1) * 0.5 > 3.2 || (lx === 0 && lz === 0 && ly < th)) continue;
          var px = x + lx, pz = z + lz, py = ht + ly;
          if (blocks[at(px, py, pz)] === AIR) blocks[at(px, py, pz)] = LEAVES;
        }
      }
    }
    var best = null;   // the spawn: the open ground nearest the middle (dry, with clear sky above)
    for (var ring = 0; ring < S / 2 && !best; ring++) for (var ox = -ring; ox <= ring && !best; ox++) for (var oz = -ring; oz <= ring && !best; oz++) {
      if (Math.max(Math.abs(ox), Math.abs(oz)) !== ring) continue;
      var sx = (S >> 1) + ox, sz = (S >> 1) + oz;
      if (sx < 2 || sz < 2 || sx >= S - 2 || sz >= S - 2) continue;
      var sh = heights[sx * S + sz], clear = blocks[at(sx, sh, sz)] !== WATER && sh > SEA;
      for (var up = 1; up <= 6 && clear; up++) if (blocks[at(sx, sh + up, sz)] !== AIR) clear = false;
      if (clear) best = { x: sx + 0.5, y: sh + 1.01, z: sz + 0.5 };
    }
    if (!best) { var cx = S >> 1, cz = S >> 1; best = { x: cx + 0.5, y: Math.max(heights[cx * S + cz], SEA) + 1.01, z: cz + 0.5 }; }
    return { S: S, SY: SY, blocks: blocks, heights: heights, spawn: best };
  }

  // ---- pixel textures, made by code: [top, side, bottom] colours with a little noise ----
  var COLORS = { 1: [[88, 152, 52], [134, 96, 62], [134, 96, 62]], 2: [[134, 96, 62]], 3: [[128, 128, 128]], 4: [[222, 208, 150]], 5: [[104, 80, 48], [110, 84, 52]],
                 6: [[52, 120, 40]], 7: [[176, 140, 84]], 8: [[196, 230, 240]], 9: [[128, 128, 128], [30, 30, 30]], 10: [[128, 128, 128], [216, 176, 140]],
                 11: [[128, 128, 128], [250, 216, 60]], 12: [[128, 128, 128], [80, 230, 230]], 13: [[240, 244, 250], [225, 232, 242]], 14: [[50, 100, 200]], 15: [[40, 130, 50]] };
  var textures = {};
  function texture(id, face) {   // face 0 top, 1 side, 2 bottom
    var key = id * 3 + face;
    if (textures[key]) return textures[key];
    var set = COLORS[id] || [[255, 0, 255]], base = set[Math.min(face, set.length - 1)], px = new Uint8Array(16 * 16 * 3);
    for (var v = 0; v < 16; v++) for (var u = 0; u < 16; u++) {
      var n = hash(id * 17 + face, u, 0, v), c = base, k = 0.86 + n * 0.28;
      if (id === 1 && face === 1 && v < 4) c = COLORS[1][0];   // a grass edge on the side
      if ((id >= 9 && id <= 12) && set.length > 1 && hash(id + 90, u >> 1, 3, v >> 1) > 0.78) c = set[1];   // ore flecks
      if (id === 5 && face === 1 && u % 4 === 0) k *= 0.8;
      if (id === 7 && v % 4 === 0) k *= 0.75;
      if (id === 8 && (u === 0 || v === 0 || u === 15 || v === 15)) k = 1.1;
      if (id === 6 && n > 0.8) k *= 0.6;
      px[(v * 16 + u) * 3] = Math.min(255, c[0] * k); px[(v * 16 + u) * 3 + 1] = Math.min(255, c[1] * k); px[(v * 16 + u) * 3 + 2] = Math.min(255, c[2] * k);
    }
    return textures[key] = px;
  }

  K.voxel = { names: NAMES, biomes: Object.keys(BIOMES), sizes: Object.keys(SIZES), makeWorld: makeWorld };

  K.kit.define("sandbox", {
    defaults: {
      title: "Küp Dünya", biome: "forest", size: "medium", caves: 2, ores: 2, lakes: true, trees: 2, time: "cycle", music: "", width: 640, height: 400,
      world: { seed: 1 }, features: []
    },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (!BIOMES[spec.biome]) errors.push("bilinmeyen bölge: " + spec.biome + " (var olanlar: " + Object.keys(BIOMES).join(", ") + ")");
      if (!SIZES[spec.size]) errors.push("bilinmeyen boyut: " + spec.size + " (var olanlar: " + Object.keys(SIZES).join(", ") + ")");
      ["caves", "ores", "trees"].forEach(function (k) { if (typeof spec[k] !== "number" || spec[k] < 0 || spec[k] > 3) errors.push(k + " 0-3 olmalı"); });
      if (["cycle", "day", "night"].indexOf(spec.time) < 0) errors.push("bilinmeyen zaman: " + spec.time + " (cycle, day, night)");
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var w = makeWorld({ seed: (spec.world && spec.world.seed) || 1, biome: spec.biome, size: spec.size, caves: spec.caves, ores: spec.ores, lakes: spec.lakes, trees: spec.trees });
      var S = w.S, blocks = w.blocks, at = function (x, y, z) { return (y * S + z) * S + x; };
      var saveKey = "sandbox." + spec.biome + "." + spec.size + "." + ((spec.world && spec.world.seed) || 1);
      var state = { g: g, spec: spec, world: w, edits: [], selected: 2, fly: false, sprintMul: 1, time: spec.time === "night" ? 0.5 : 0.1, hits: [], heroHooks: [],
                    p: { x: w.spawn.x, y: w.spawn.y, z: w.spawn.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false } };
      var PLACEABLE = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, GLASS, SNOW, COAL, IRON, GOLD, DIAMOND, CACTUS];
      var tune = spec.music;
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      state.hud = { placed: 0, broken: 0, depth: 0 };

      var get = function (x, y, z) { return x < 0 || z < 0 || x >= S || z >= S || y < 0 ? STONE : y >= SY ? AIR : blocks[at(x, y, z)]; };
      var solid = function (b) { return b !== AIR && b !== WATER; };
      state.get = get;
      var set = function (x, y, z, b, remember) {
        if (x < 0 || z < 0 || x >= S || z >= S || y < 1 || y >= SY) return false;
        blocks[at(x, y, z)] = b;
        if (remember) {
          state.edits.push([x, y, z, b]);
          if (state.edits.length > 3000) state.edits.shift();
          try { K.save.set(saveKey, state.edits); } catch (e) { /* no storage: the world is just not kept */ }
        }
        return true;
      };
      state.set = set;
      var saved; try { saved = K.save.get(saveKey, []); } catch (e) { saved = []; }
      (saved instanceof Array ? saved : []).forEach(function (e) { if (e instanceof Array && e.length === 4) { set(e[0], e[1], e[2], e[3], false); state.edits.push(e); } });

      // ---- looking: a ray through the cubes (shared by the picture and by breaking / placing) ----
      var hit = { b: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, t: 0, face: 1, hx: 0, hy: 0, hz: 0 };
      function cast(ox, oy, oz, dx, dy, dz, maxT, skipWater, thin) {
        var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
        var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
        var tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
        var tx = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tdx : 1e30, ty = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tdy : 1e30, tz = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tdz : 1e30;
        var t = 0, nx = 0, ny = 0, nz = 0, steps = 0, first = get(x, y, z);
        while (t <= maxT && steps++ < 200) {
          var b = get(x, y, z);
          if (b !== AIR && !(skipWater && b === WATER) && !(thin && b === first && b === WATER)) {
            hit.b = b; hit.x = x; hit.y = y; hit.z = z; hit.nx = nx; hit.ny = ny; hit.nz = nz; hit.t = t;
            hit.face = ny !== 0 ? (ny > 0 ? 0 : 2) : 1; hit.hx = ox + dx * t; hit.hy = oy + dy * t; hit.hz = oz + dz * t;
            return true;
          }
          if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
          else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
          else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
          if (x < -1 || z < -1 || x > S || z > S || y < -1 || y > SY + 1) return false;
        }
        return false;
      }
      state.cast = cast;
      function eye() { return { x: state.p.x, y: state.p.y + 1.6, z: state.p.z }; }
      function look() {
        var p = state.p, cp = Math.cos(p.pitch);
        return { x: Math.sin(p.yaw) * cp, y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * cp };
      }
      function target() {   // the block the crosshair is on (water is looked through)
        var e = eye(), d = look();
        return cast(e.x, e.y, e.z, d.x, d.y, d.z, REACH, true) ? hit : null;
      }
      state.target = target;

      // ---- breaking and placing ----
      state.breakBlock = function () {
        var t = target();
        if (!t || t.y < 1) return false;
        var tx = t.x, ty = t.y, tz = t.z, b = t.b;
        if (b === DIRT || b === GRASS) K.sfx("click"); else K.sfx("hit");
        set(tx, ty, tz, AIR, true); state.hud.broken++;
        if (b === DIRT || b === GRASS) state.lastBroken = b;
        return true;
      };
      state.placeBlock = function () {
        var t = target();
        if (!t) return false;
        var x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz, p = state.p;
        if (get(x, y, z) !== AIR && get(x, y, z) !== WATER) return false;
        if (x + 1 > p.x - 0.3 && x < p.x + 0.3 && z + 1 > p.z - 0.3 && z < p.z + 0.3 && y + 1 > p.y && y < p.y + 1.8) return false;   // not inside the player
        set(x, y, z, PLACEABLE[state.selected % PLACEABLE.length], true); state.hud.placed++; K.sfx("click");
        return true;
      };
      state.select = function (i) { state.selected = ((i % PLACEABLE.length) + PLACEABLE.length) % PLACEABLE.length; };
      state.selectedBlock = function () { return PLACEABLE[state.selected % PLACEABLE.length]; };

      // ---- the player ----
      function collides(x, y, z) {
        for (var bx = Math.floor(x - 0.3); bx <= Math.floor(x + 0.3); bx++) for (var bz = Math.floor(z - 0.3); bz <= Math.floor(z + 0.3); bz++)
          for (var by = Math.floor(y); by <= Math.floor(y + 1.79); by++) if (solid(get(bx, by, bz))) return true;
        return false;
      }
      state.step = function (dt) {
        var p = state.p, flying = state.fly;
        var turn = (K.key("ArrowRight") ? 1 : 0) - (K.key("ArrowLeft") ? 1 : 0), tilt = (K.key("ArrowUp") ? 1 : 0) - (K.key("ArrowDown") ? 1 : 0);
        p.yaw += turn * 2.2 * dt; p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch + tilt * 1.6 * dt));
        var f = (K.key("w") ? 1 : 0) - (K.key("s") ? 1 : 0), r = (K.key("d") ? 1 : 0) - (K.key("a") ? 1 : 0);
        var speed = 4.3 * state.sprintMul * (K.key("Shift") && state.sprintMul > 1 ? 1.6 : 1);
        var len = Math.sqrt(f * f + r * r) || 1;
        var sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
        var wx = (sin * f + cos * r) / len * speed, wz = (-cos * f + sin * r) / len * speed;
        var inWater = get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === WATER;
        if (inWater) { wx *= 0.5; wz *= 0.5; }
        p.vx = wx; p.vz = wz;
        if (flying) { p.vy = ((K.key(" ") ? 1 : 0) - (K.key("Shift") ? 1 : 0)) * 6; }
        else {
          p.vy -= (inWater ? 8 : 26) * dt;
          if (inWater) p.vy = Math.max(p.vy, -3);
          if (K.key(" ") && (p.onGround || inWater)) { p.vy = inWater ? 3.2 : 8.2; p.onGround = false; }
        }
        var nx = p.x + p.vx * dt; if (!collides(nx, p.y, p.z)) p.x = nx;
        var nz = p.z + p.vz * dt; if (!collides(p.x, p.y, nz)) p.z = nz;
        var ny = p.y + p.vy * dt;
        if (!collides(p.x, ny, p.z)) { p.y = ny; p.onGround = false; }
        else { if (p.vy < 0) p.onGround = true; p.vy = 0; }
        p.x = Math.max(0.35, Math.min(S - 0.35, p.x)); p.z = Math.max(0.35, Math.min(S - 0.35, p.z));
        if (p.y < -10) { p.x = w.spawn.x; p.y = w.spawn.y + 8; p.z = w.spawn.z; p.vy = 0; }
        state.hud.depth = Math.max(0, Math.round(w.heights[Math.floor(p.x) * S + Math.floor(p.z)] - p.y));
        if (spec.time === "cycle") state.time = (state.time + dt / 180) % 1;
        state.heroHooks.forEach(function (h) { h(p, dt); });
      };
      state.daylight = function () {
        if (spec.time === "day") return 1;
        if (spec.time === "night") return 0.18;
        return Math.max(0.18, Math.min(1, 0.59 + 0.6 * Math.cos(state.time * Math.PI * 2)));   // 1 at noon (time 0), dark at midnight (0.5)
      };

      // ---- the picture: RW x RH rays drawn into a small image and scaled up ----
      var buffer = typeof Uint8ClampedArray !== "undefined" ? new Uint8ClampedArray(RW * RH * 4) : [];
      function render(out) {
        var e = eye(), d = look(), light = state.daylight(), p = state.p;
        var rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);   // the right-hand direction on the ground
        var ux = -Math.sin(p.yaw) * Math.sin(p.pitch), uy = Math.cos(p.pitch), uz = Math.cos(p.yaw) * Math.sin(p.pitch);   // up
        var scale = Math.tan(0.62), aspect = RW / RH;
        var skyR = 110 * light + 8, skyG = 170 * light + 10, skyB = 235 * light + 25;
        var inWater = get(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) === WATER;
        var shade = [1, 0.82, 0.55];
        for (var j = 0; j < RH; j++) for (var i = 0; i < RW; i++) {
          var sx = ((i + 0.5) / RW * 2 - 1) * scale * aspect, sy = (1 - (j + 0.5) / RH * 2) * scale;
          var dx = d.x + rx * sx + ux * sy, dy = d.y + uy * sy, dz = d.z + rz * sx + uz * sy;
          var inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz); dx *= inv; dy *= inv; dz *= inv;
          var r = skyR, gg = skyG, bb = skyB, k = (j * RW + i) * 4;
          if (cast(e.x, e.y, e.z, dx, dy, dz, FAR, false, inWater)) {
            var tex = texture(hit.b, hit.face), u, v;
            if (hit.face === 1) { u = hit.nx !== 0 ? hit.hz : hit.hx; v = 1 - hit.hy; } else { u = hit.hx; v = hit.hz; }
            u = Math.floor((u - Math.floor(u)) * 16); v = Math.floor((v - Math.floor(v)) * 16);
            var o = (v * 16 + u) * 3, sh = shade[hit.face] * (0.25 + 0.75 * light) * (hit.nx !== 0 ? 0.92 : 1), fog = Math.min(1, hit.t / FAR);
            fog = fog * fog * 0.85;
            r = tex[o] * sh * (1 - fog) + skyR * fog; gg = tex[o + 1] * sh * (1 - fog) + skyG * fog; bb = tex[o + 2] * sh * (1 - fog) + skyB * fog;
            if (hit.b === WATER) { r = r * 0.7; gg = gg * 0.8; }
          } else if (dy < -0.05) { r = 20; gg = 20; bb = 30; }
          if (inWater) { r *= 0.55; gg *= 0.75; bb = bb * 0.9 + 30; }
          out[k] = r; out[k + 1] = gg; out[k + 2] = bb; out[k + 3] = 255;
        }
        return out;
      }
      state.render = render;
      var small = null, smallCtx = null, image = null;
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined") return;
        if (!small) { small = document.createElement("canvas"); small.width = RW; small.height = RH; smallCtx = small.getContext("2d"); image = smallCtx.createImageData(RW, RH); }
        render(image.data); smallCtx.putImageData(image, 0, 0);
        c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        c.fillStyle = "#fff"; c.fillRect(g.width / 2 - 8, g.height / 2 - 1, 16, 2); c.fillRect(g.width / 2 - 1, g.height / 2 - 8, 2, 16);   // the crosshair
      } }];

      // ---- the screen texts, the keys that act once, the sound ----
      var held = {};
      function once(key, fn) { var now = K.key(key); if (now && !held[key]) { held[key] = true; fn(); } else if (!now) held[key] = false; }
      var clickDown = false;
      g.scene("play", {
        update: function (game, dt) {
          state.step(dt);
          once("f", state.breakBlock); once("e", state.placeBlock); once("q", function () { state.select(state.selected + 1); });
          for (var n = 1; n <= 9; n++) (function (num) { once(String(num), function () { state.select(num - 1); }); })(n);
          if (K.mouse && K.mouse.down && !clickDown) { clickDown = true; state.breakBlock(); } else if (!(K.mouse && K.mouse.down)) clickDown = false;
          g.ui.text("hud.block", "BLOK: " + NAMES[state.selectedBlock()] + "  (Q)", 10, 22, { size: 16 });
          g.ui.text("hud.info", "kırdın " + state.hud.broken + "   koydun " + state.hud.placed + "   derinlik " + state.hud.depth, 10, 44, { size: 14, color: "#cfd8dc" });
          g.ui.text("hud.keys", "F kır  E koy  Boşluk zıpla", g.width - 200, 22, { size: 12, color: "#cfd8dc" });
        }
      });
      state.start = function () { if (tune) K.music.play(tune); };
      state.expose = { g: g, spec: spec, world: w, hud: state.hud, get p() { return state.p; }, state: state };
      return state;
    }
  });

  // ---- features ----
  K.feature.define("fly", { kits: ["sandbox"], options: {}, apply: function (s) { s.fly = true; } });
  K.feature.define("sprint", { kits: ["sandbox"], options: {}, apply: function (s) { s.sprintMul = 1.4; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
