/* kgame.voxel.js: küp dünya kiti (sandbox: madencilik ve inşaat, eski Minecraft tadında bir dünya). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'sandbox', title:'Küp Dünya', biome:'forest', size:'medium', caves:2, ores:2, lakes:true, trees:2, time:'cycle', features:['fly'] })
   Kit; dünyayı 16x16'lık PARÇALAR (chunk) hâlinde ve tohumdan üretir (oyuncu yürüdükçe yeni parçalar belirir; tepeler, göller, mağaralar, madenler,
   ağaçlar), birinci şahıs görüntüyü düşük çözünürlüklü ışın izlemeyle çizer, yürümeyi, zıplamayı, yüzmeyi, blok kırmayı/koymayı, envanteri,
   gündüz-geceyi ve değişiklikleri kaydetmeyi kendisi kurar. Dünya boyutu: small 8x8, medium 16x16, large 32x32 parça. Özellikler: fly (G ile uçma
   açılır), sprint (daha hızlı yürüyüş). Kontroller: W A S D yürür, FARE bakar (sayfaya tıkla; oklar da bakar), Boşluk zıplar, Shift koşar,
   sol tık/F kırar, sağ tık/E koyar, tekerlek/Q/1-9 blok seçer, I envanter, C yaratıcı mod (sınırsız blok), H yardım.
   Önce kgame.js ve kgame.kits.js. Doku ve renklerin hepsi kodla üretilir (resim dosyası yok). */
(function (root) {
  var K = root.K;
  var NAMES = ["hava", "çimen", "toprak", "taş", "kum", "kütük", "yaprak", "tahta", "cam", "kömür", "demir", "altın", "elmas", "kar", "su", "kaktüs",
                "tarla", "buğday filizi", "büyüyen buğday", "olgun buğday", "tohum", "buğday", "çapa", "ekmek"];
  var AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, LOG = 5, LEAVES = 6, PLANKS = 7, GLASS = 8, COAL = 9, IRON = 10, GOLD = 11, DIAMOND = 12, SNOW = 13, WATER = 14, CACTUS = 15;
  var FARMLAND = 16, CROP1 = 17, CROP3 = 19, SEEDS = 20, WHEAT = 21, HOE = 22, BREAD = 23, CROP_SECONDS = 25;   // crops are blocks 17-19 (young to ripe), 20 and up are things you carry
  var BIOMES = { forest: { top: GRASS, trees: 1, amp: 5 }, plains: { top: GRASS, trees: 0.2, amp: 3 }, desert: { top: SAND, trees: 0.6, amp: 4 }, snow: { top: SNOW, trees: 0.5, amp: 6 } };
  var SIZES = { small: 8, medium: 16, large: 32 };   // chunks on a side
  var CH = 16, SY = 32, SEA = 9, RW = 160, RH = 100, REACH = 5, FAR = 36, LOAD = 3;

  // ---- noise (seeded, no libraries; every value depends only on the world position, so chunks fit together) ----
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

  // ---- the world: chunks made on demand ----
  function makeWorld(o) {
    var N = SIZES[o.size] || 16, S = N * CH, seed = (o.seed | 0) + 1, biome = BIOMES[o.biome] || BIOMES.forest;
    var caves = o.caves | 0, ores = o.ores | 0, trees = (o.trees === undefined ? 1 : o.trees) * biome.trees;
    var chunks = new Array(N * N), heights = new Array(N * N), pending = {};
    var w = { S: S, N: N, SY: SY, chunks: chunks, made: 0, spawn: null, pending: pending };

    function surface(x, z) {
      var n = noise2(seed, x, z, 22) * 0.65 + noise2(seed + 7, x, z, 9) * 0.35;
      var h = Math.round(11 + (n - 0.5) * 2 * biome.amp + (o.lakes ? 0 : 3));
      if (!o.lakes) h = Math.max(h, SEA + 1);
      return Math.max(2, Math.min(SY - 8, h));
    }
    function gen(cx, cz) {
      var idx = cz * N + cx, blocks = new Uint8Array(CH * SY * CH), hm = new Int16Array(CH * CH);
      var at = function (lx, y, lz) { return (y * CH + lz) * CH + lx; };
      for (var lx = 0; lx < CH; lx++) for (var lz = 0; lz < CH; lz++) {
        var x = cx * CH + lx, z = cz * CH + lz, h = surface(x, z);
        hm[lz * CH + lx] = h;
        for (var y = 0; y <= h; y++) {
          var b = STONE;
          if (y === h) b = h <= SEA + 1 && biome.top !== SNOW ? SAND : biome.top;
          else if (y >= h - 3) b = biome.top === SAND || h <= SEA + 1 ? SAND : DIRT;
          blocks[at(lx, y, lz)] = b;
        }
        for (var wy = h + 1; wy <= SEA; wy++) blocks[at(lx, wy, lz)] = WATER;
        for (y = 3; y < h - 2; y++) {
          if (caves > 0 && noise3(seed + 3, x, y, z, 7) > 0.78 - caves * 0.045) { blocks[at(lx, y, lz)] = AIR; continue; }
          if (ores > 0 && blocks[at(lx, y, lz)] === STONE) {
            var r = hash(seed + 11, x, y, z), rich = 0.5 + ores * 0.5;
            if (y < 6 && r < 0.004 * rich) blocks[at(lx, y, lz)] = DIAMOND;
            else if (y < 10 && r < 0.010 * rich) blocks[at(lx, y, lz)] = GOLD;
            else if (y < 16 && r < 0.022 * rich) blocks[at(lx, y, lz)] = IRON;
            else if (r < 0.04 * rich) blocks[at(lx, y, lz)] = COAL;
          }
        }
      }
      for (lx = 2; lx < CH - 2; lx++) for (lz = 2; lz < CH - 2; lz++) {   // trees stay inside their chunk (leaves reach 2 blocks)
        var gx = cx * CH + lx, gz = cz * CH + lz, ht = hm[lz * CH + lx], ground = blocks[at(lx, ht, lz)];
        if (trees <= 0 || ht <= SEA + 1 || hash(seed + 5, gx, 0, gz) > trees * 0.018) continue;
        if (o.biome === "desert" && ground === SAND) {
          for (var c = 1; c <= 2; c++) blocks[at(lx, ht + c, lz)] = CACTUS;
        } else if (ground === GRASS || ground === SNOW) {
          var th = 4 + (hash(seed + 9, gx, 1, gz) > 0.5 ? 1 : 0);
          for (var t = 1; t <= th; t++) blocks[at(lx, ht + t, lz)] = LOG;
          for (var ax = -2; ax <= 2; ax++) for (var az = -2; az <= 2; az++) for (var ay = th - 1; ay <= th + 1; ay++) {
            if (Math.abs(ax) + Math.abs(az) + (ay - th + 1) * 0.5 > 3.2 || (ax === 0 && az === 0 && ay < th)) continue;
            if (blocks[at(lx + ax, ht + ay, lz + az)] === AIR) blocks[at(lx + ax, ht + ay, lz + az)] = LEAVES;
          }
        }
      }
      chunks[idx] = blocks; heights[idx] = hm; w.made++;
      (pending[idx] || []).forEach(function (e) { blocks[at(e[0] - cx * CH, e[1], e[2] - cz * CH)] = e[3]; });   // what the player changed here before
      return blocks;
    }
    w.get = function (x, y, z) {
      if (y < 0) return STONE;
      if (y >= SY) return AIR;
      if (x < 0 || z < 0 || x >= S || z >= S) return STONE;   // the edge of the world is a wall
      var cx = x >> 4, cz = z >> 4, c = chunks[cz * N + cx] || gen(cx, cz);
      return c[(y * CH + (z & 15)) * CH + (x & 15)];
    };
    w.set = function (x, y, z, b) {
      if (x < 0 || z < 0 || x >= S || z >= S || y < 1 || y >= SY) return false;
      w.get(x, y, z);   // makes the chunk
      chunks[(z >> 4) * N + (x >> 4)][(y * CH + (z & 15)) * CH + (x & 15)] = b;
      return true;
    };
    w.heightAt = function (x, z) {
      if (x < 0 || z < 0 || x >= S || z >= S) return 0;
      w.get(x, 0, z);
      return heights[(z >> 4) * N + (x >> 4)][(z & 15) * CH + (x & 15)];
    };
    w.queueEdit = function (e) { var k = (e[2] >> 4) * N + (e[0] >> 4); (pending[k] = pending[k] || []).push(e); };
    w.ensureAround = function (x, z, radius, limit) {   // makes the chunks near a position, a few at a time
      var cx = x >> 4, cz = z >> 4, made = 0;
      for (var r = 0; r <= radius; r++) for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        var nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N || chunks[nz * N + nx]) continue;
        gen(nx, nz); made++;
        if (limit && made >= limit) return made;
      }
      return made;
    };
    w.count = function (id) { var n = 0; chunks.forEach(function (c) { if (c) for (var i = 0; i < c.length; i++) if (c[i] === id) n++; }); return n; };
    w.loaded = function () { return w.made; };
    // the spawn: open ground nearest the middle (dry, clear sky above)
    var mid = S >> 1;
    for (var ring = 0; ring < 40 && !w.spawn; ring++) for (var ox = -ring; ox <= ring && !w.spawn; ox++) for (var oz = -ring; oz <= ring && !w.spawn; oz++) {
      if (Math.max(Math.abs(ox), Math.abs(oz)) !== ring) continue;
      var sx = mid + ox, sz = mid + oz, sh = w.heightAt(sx, sz), clear = w.get(sx, sh, sz) !== WATER && sh > SEA;
      for (var up = 1; up <= 6 && clear; up++) if (w.get(sx, sh + up, sz) !== AIR) clear = false;
      if (clear) w.spawn = { x: sx + 0.5, y: sh + 1.01, z: sz + 0.5 };
    }
    if (!w.spawn) w.spawn = { x: mid + 0.5, y: Math.max(w.heightAt(mid, mid), SEA) + 1.01, z: mid + 0.5 };
    w.ensureAround(w.spawn.x | 0, w.spawn.z | 0, LOAD);
    return w;
  }

  // ---- pixel textures, made by code: [top, side, bottom] colours with a little noise ----
  var COLORS = { 1: [[88, 152, 52], [134, 96, 62], [134, 96, 62]], 2: [[134, 96, 62]], 3: [[128, 128, 128]], 4: [[222, 208, 150]], 5: [[104, 80, 48], [110, 84, 52]],
                 6: [[52, 120, 40]], 7: [[176, 140, 84]], 8: [[196, 230, 240]], 9: [[128, 128, 128], [30, 30, 30]], 10: [[128, 128, 128], [216, 176, 140]],
                 11: [[128, 128, 128], [250, 216, 60]], 12: [[128, 128, 128], [80, 230, 230]], 13: [[240, 244, 250], [225, 232, 242]], 14: [[50, 100, 200]], 15: [[40, 130, 50]],
                 16: [[92, 60, 36], [120, 84, 54], [120, 84, 54]], 17: [[100, 170, 60], [90, 160, 55], [90, 160, 55]], 18: [[150, 185, 60], [120, 170, 55], [120, 170, 55]],
                 19: [[225, 195, 70], [205, 170, 60], [205, 170, 60]], 20: [[170, 150, 80]], 21: [[225, 195, 70]], 22: [[150, 150, 165]], 23: [[200, 140, 70]] };
  var textures = {};
  function texture(id, face) {   // face 0 top, 1 side, 2 bottom
    var key = id * 3 + face;
    if (textures[key]) return textures[key];
    var set = COLORS[id] || [[255, 0, 255]], base = set[Math.min(face, set.length - 1)], px = new Uint8Array(16 * 16 * 3);
    for (var v = 0; v < 16; v++) for (var u = 0; u < 16; u++) {
      var n = hash(id * 17 + face, u, 0, v), c = base, k = 0.86 + n * 0.28;
      if (id === 1 && face === 1 && v < 4) c = COLORS[1][0];
      if ((id >= 9 && id <= 12) && set.length > 1 && hash(id + 90, u >> 1, 3, v >> 1) > 0.78) c = set[1];
      if (id === 5 && face === 1 && u % 4 === 0) k *= 0.8;
      if (id === 7 && v % 4 === 0) k *= 0.75;
      if (id === 8 && (u === 0 || v === 0 || u === 15 || v === 15)) k = 1.1;
      if (id === 6 && n > 0.8) k *= 0.6;
      px[(v * 16 + u) * 3] = Math.min(255, c[0] * k); px[(v * 16 + u) * 3 + 1] = Math.min(255, c[1] * k); px[(v * 16 + u) * 3 + 2] = Math.min(255, c[2] * k);
    }
    return textures[key] = px;
  }

  K.voxel = { cropSeconds: CROP_SECONDS, names: NAMES, biomes: Object.keys(BIOMES), sizes: Object.keys(SIZES), makeWorld: makeWorld };

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
      var seed = (spec.world && spec.world.seed) || 1;
      var w = makeWorld({ seed: seed, biome: spec.biome, size: spec.size, caves: spec.caves, ores: spec.ores, lakes: spec.lakes, trees: spec.trees });
      var S = w.S, N = w.N;
      var saveKey = "sandbox." + spec.biome + "." + spec.size + "." + seed;
      var state = { g: g, spec: spec, world: w, edits: [], hits: [], heroHooks: [], canFly: false, flying: false, sprintMul: 1, time: spec.time === "night" ? 0.5 : 0.1,
                    creative: false, inv: { order: [], count: {} }, slot: 0, showInv: false, showHelp: false, visited: {}, lockHint: true, breakDelay: 0,
                    p: { x: w.spawn.x, y: w.spawn.y, z: w.spawn.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false } };
      var tune = spec.music;
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      state.hud = { placed: 0, broken: 0, depth: 0, explored: 0, harvested: 0 };
      state.crops = [];
      var get = w.get, solid = function (b) { return b !== AIR && b !== WATER && !(b >= CROP1 && b <= CROP3); };   // plants are walked through
      state.get = get;
      var set = function (x, y, z, b, remember) {
        if (!w.set(x, y, z, b)) return false;
        if (remember) {
          state.edits.push([x, y, z, b]);
          if (state.edits.length > 3000) state.edits.shift();
          try { K.save.set(saveKey, state.edits); } catch (e) { /* no storage: the world is just not kept */ }
        }
        return true;
      };
      state.set = set;
      var saved; try { saved = K.save.get(saveKey, []); } catch (e) { saved = []; }
      (saved instanceof Array ? saved : []).forEach(function (e) {
        if (!(e instanceof Array) || e.length !== 4) return;
        state.edits.push(e); w.queueEdit(e);
        if (w.chunks[(e[2] >> 4) * N + (e[0] >> 4)]) w.set(e[0], e[1], e[2], e[3]);   // a chunk that is already there gets it now
      });

      // ---- the inventory: what you hold, in the order you got it; the hotbar is the first nine kinds ----
      var inv = state.inv;
      state.addItem = function (id, n) {
        if (!id || id === AIR || id === WATER) return;
        if (!inv.count[id]) { inv.count[id] = 0; if (inv.order.indexOf(id) < 0) inv.order.push(id); }
        inv.count[id] += n || 1;
      };
      state.hotbar = function () { return inv.order.filter(function (id) { return inv.count[id] > 0; }).slice(0, 9); };
      state.selectedBlock = function () { var bar = state.hotbar(); return bar.length ? bar[Math.min(state.slot, bar.length - 1)] : (state.creative ? STONE : 0); };
      state.select = function (i) { var n = Math.max(1, state.hotbar().length); state.slot = ((i % n) + n) % n; };
      state.setCreative = function (on) {
        state.creative = on;
        if (on) [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, GLASS, SNOW, COAL, IRON, GOLD, DIAMOND, CACTUS].forEach(function (id) { if (inv.order.indexOf(id) < 0) inv.order.push(id); if (!inv.count[id]) inv.count[id] = 1; });
      };
      [[STONE, 20], [DIRT, 20], [PLANKS, 20], [GLASS, 8], [LOG, 10], [HOE, 1], [SEEDS, 6]].forEach(function (s) { state.addItem(s[0], s[1]); });

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
      state.look = function (dx, dy) { state.p.yaw += dx; state.p.pitch = Math.max(-1.5, Math.min(1.5, state.p.pitch - dy)); };   // the mouse

      // ---- breaking and placing ----
      state.breakBlock = function () {
        var t = target();
        if (!t || t.y < 1) return false;
        var tx = t.x, ty = t.y, tz = t.z, b = t.b;
        K.sfx(b === DIRT || b === GRASS || b === SAND ? "click" : "hit");
        set(tx, ty, tz, AIR, true); state.hud.broken++;
        if (b === GRASS) { state.addItem(DIRT, 1); if (hash(7, tx, ty, tz) < 0.25) state.addItem(SEEDS, 1); }   // seeds hide in the grass
        else if (b === FARMLAND) state.addItem(DIRT, 1);
        else if (b === CROP3) { state.addItem(WHEAT, 1); state.addItem(SEEDS, 1 + (hash(8, tx, ty, tz) < 0.5 ? 1 : 0)); state.hud.harvested++; }
        else if (b >= CROP1 && b < CROP3) state.addItem(SEEDS, 1);
        else state.addItem(b, 1);
        return true;
      };
      state.placeBlock = function () {
        var t = target(), id = state.selectedBlock();
        if (!t || !id || (!state.creative && !(inv.count[id] > 0))) return false;
        if (id === HOE) {   // the hoe turns the top of grass or soil into a field
          if (t.ny !== 1 || (t.b !== GRASS && t.b !== DIRT) || get(t.x, t.y + 1, t.z) !== AIR) return false;
          set(t.x, t.y, t.z, FARMLAND, true); K.sfx("click"); return true;
        }
        if (id === SEEDS) {   // seeds go on a field, and the crop grows by itself
          if (t.ny !== 1 || t.b !== FARMLAND || get(t.x, t.y + 1, t.z) !== AIR) return false;
          set(t.x, t.y + 1, t.z, CROP1, true); state.crops.push({ x: t.x, y: t.y + 1, z: t.z, age: 0 }); K.sfx("click");
          if (!state.creative) { inv.count[SEEDS]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); }
          return true;
        }
        if (id >= WHEAT || id === FARMLAND || (id >= CROP1 && id <= CROP3)) return false;   // food and tools are not placed
        var x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz, p = state.p;
        if (get(x, y, z) !== AIR && get(x, y, z) !== WATER) return false;
        if (x + 1 > p.x - 0.3 && x < p.x + 0.3 && z + 1 > p.z - 0.3 && z < p.z + 0.3 && y + 1 > p.y && y < p.y + 1.8) return false;   // not inside the player
        set(x, y, z, id, true); state.hud.placed++; K.sfx("click");
        if (!state.creative) { inv.count[id]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); }
        return true;
      };

      // ---- growing and crafting ----
      state.grow = function (dt) {
        state.crops = state.crops.filter(function (c) {
          var b = get(c.x, c.y, c.z);
          if (b < CROP1 || b > CROP3) return false;   // it was harvested or built over
          c.age += dt;
          var stage = Math.min(2, Math.floor(c.age / CROP_SECONDS));
          if (CROP1 + stage !== b) set(c.x, c.y, c.z, CROP1 + stage, true);
          return CROP1 + stage < CROP3;
        });
      };
      state.recipes = [
        { name: "tahta (1 kütük)", need: [[LOG, 1]], give: [PLANKS, 4] }, { name: "çapa (3 tahta)", need: [[PLANKS, 3]], give: [HOE, 1] },
        { name: "ekmek (3 buğday)", need: [[WHEAT, 3]], give: [BREAD, 1] }, { name: "cam (2 kum)", need: [[SAND, 2]], give: [GLASS, 1] }
      ];
      state.craft = function (i) {
        var r = state.recipes[i];
        if (!r || !r.need.every(function (n) { return (inv.count[n[0]] || 0) >= n[1]; })) return false;
        r.need.forEach(function (n) { inv.count[n[0]] -= n[1]; });
        state.addItem(r.give[0], r.give[1]); K.sfx("coin");
        return true;
      };
      (saved instanceof Array ? saved : []).forEach(function (e) {   // crops that were growing when the world was saved go on growing
        if (e instanceof Array && e[3] >= CROP1 && e[3] < CROP3 && get(e[0], e[1], e[2]) === e[3]) state.crops.push({ x: e[0], y: e[1], z: e[2], age: (e[3] - CROP1) * CROP_SECONDS });
      });

      // ---- the player ----
      function collides(x, y, z) {
        for (var bx = Math.floor(x - 0.3); bx <= Math.floor(x + 0.3); bx++) for (var bz = Math.floor(z - 0.3); bz <= Math.floor(z + 0.3); bz++)
          for (var by = Math.floor(y); by <= Math.floor(y + 1.79); by++) if (solid(get(bx, by, bz))) return true;
        return false;
      }
      var lastSpace = -9, spaceHeld = false;
      state.step = function (dt) {
        var p = state.p, flying = state.canFly && state.flying;
        var turn = (K.key("ArrowRight") ? 1 : 0) - (K.key("ArrowLeft") ? 1 : 0), tilt = (K.key("ArrowUp") ? 1 : 0) - (K.key("ArrowDown") ? 1 : 0);
        p.yaw += turn * 2.2 * dt; p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch + tilt * 1.6 * dt));
        var f = (K.key("w") ? 1 : 0) - (K.key("s") ? 1 : 0), r = (K.key("d") ? 1 : 0) - (K.key("a") ? 1 : 0);
        var speed = 4.3 * state.sprintMul * (K.key("Shift") && !flying ? 1.5 : flying ? 1.6 : 1);
        var len = Math.sqrt(f * f + r * r) || 1;
        var sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
        var wx = (sin * f + cos * r) / len * speed, wz = (-cos * f + sin * r) / len * speed;
        var inWater = get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === WATER;
        if (inWater) { wx *= 0.5; wz *= 0.5; }
        p.vx = wx; p.vz = wz;
        var space = K.key(" ");
        if (space && !spaceHeld) { if (state.canFly && state.time0 - lastSpace < 0.3) state.flying = !state.flying; lastSpace = state.time0; }   // twice quickly: fly on / off
        spaceHeld = space;
        flying = state.canFly && state.flying;
        if (flying) { p.vy = ((space ? 1 : 0) - (K.key("Shift") ? 1 : 0)) * 6; }
        else {
          p.vy -= (inWater ? 8 : 26) * dt;
          if (inWater) p.vy = Math.max(p.vy, -3);
          if (space && (p.onGround || inWater)) { p.vy = inWater ? 3.2 : 8.2; p.onGround = false; }
        }
        var nx = p.x + p.vx * dt; if (!collides(nx, p.y, p.z)) p.x = nx;
        var nz = p.z + p.vz * dt; if (!collides(p.x, p.y, nz)) p.z = nz;
        var ny = p.y + p.vy * dt;
        if (!collides(p.x, ny, p.z)) { p.y = ny; p.onGround = false; }
        else { if (p.vy < 0) { p.onGround = true; if (flying && !space) state.flying = false; } p.vy = 0; }
        p.x = Math.max(0.35, Math.min(S - 0.35, p.x)); p.z = Math.max(0.35, Math.min(S - 0.35, p.z));
        if (p.y < -10) { p.x = w.spawn.x; p.y = w.spawn.y + 8; p.z = w.spawn.z; p.vy = 0; }
        state.hud.depth = Math.max(0, Math.round(w.heightAt(Math.floor(p.x), Math.floor(p.z)) - p.y));
        // the chunks around the player are made ahead of the walk, two at most each frame, and the visited ones are remembered
        w.ensureAround(Math.floor(p.x), Math.floor(p.z), LOAD, 2);
        var key = (Math.floor(p.z) >> 4) * N + (Math.floor(p.x) >> 4);
        if (!state.visited[key]) { state.visited[key] = true; state.hud.explored++; }
        state.chunk = { x: Math.floor(p.x) >> 4, z: Math.floor(p.z) >> 4 };
        if (spec.time === "cycle") state.time = (state.time + dt / 180) % 1;
        state.time0 += dt;
        state.grow(dt);
        state.heroHooks.forEach(function (h) { h(p, dt); });
      };
      state.time0 = 0;
      state.daylight = function () {
        if (spec.time === "day") return 1;
        if (spec.time === "night") return 0.18;
        return Math.max(0.18, Math.min(1, 0.59 + 0.6 * Math.cos(state.time * Math.PI * 2)));   // 1 at noon (time 0), dark at midnight (0.5)
      };

      // ---- the picture: RW x RH rays drawn into a small image and scaled up ----
      var buffer = typeof Uint8ClampedArray !== "undefined" ? new Uint8ClampedArray(RW * RH * 4) : [];
      void buffer;
      function render(out) {
        var e = eye(), d = look(), light = state.daylight(), p = state.p;
        var rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
        var ux = -Math.sin(p.yaw) * Math.sin(p.pitch), uy = Math.cos(p.pitch), uz = Math.cos(p.yaw) * Math.sin(p.pitch);
        var scale = Math.tan(0.62), aspect = RW / RH;
        var skyR = 110 * light + 8, skyG = 170 * light + 10, skyB = 235 * light + 25;
        var inWater = get(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) === WATER;
        var shade = [1, 0.82, 0.55];
        for (var j = 0; j < RH; j++) for (var i = 0; i < RW; i++) {
          var sx = ((i + 0.5) / RW * 2 - 1) * scale * aspect, sy = (1 - (j + 0.5) / RH * 2) * scale;
          var dx = d.x + rx * sx + ux * sy, dy = d.y + uy * sy, dz = d.z + rz * sx + uz * sy;
          var inv2 = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz); dx *= inv2; dy *= inv2; dz *= inv2;
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

      // ---- drawing the screen: the picture, the crosshair, the hotbar, the inventory, the map ----
      var small = null, smallCtx = null, image = null;
      function swatch(c, id, x, y, size) {
        var col = (COLORS[id] || [[255, 0, 255]])[0];
        c.fillStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")"; c.fillRect(x, y, size, size);
        c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x, y + size * 0.65, size, size * 0.35);
      }
      function drawHud(c) {
        c.fillStyle = "#fff"; c.fillRect(g.width / 2 - 8, g.height / 2 - 1, 16, 2); c.fillRect(g.width / 2 - 1, g.height / 2 - 8, 2, 16);
        var bar = state.hotbar(), slot = 38, x0 = g.width / 2 - 9 * slot / 2, y0 = g.height - slot - 8;
        for (var i = 0; i < 9; i++) {
          c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(x0 + i * slot, y0, slot - 3, slot - 3);
          c.strokeStyle = i === Math.min(state.slot, Math.max(0, bar.length - 1)) && bar.length ? "#fff" : "rgba(255,255,255,0.3)"; c.lineWidth = i === state.slot ? 3 : 1;
          c.strokeRect(x0 + i * slot, y0, slot - 3, slot - 3);
          if (bar[i]) {
            swatch(c, bar[i], x0 + i * slot + 6, y0 + 6, slot - 15);
            c.fillStyle = "#fff"; c.font = "12px sans-serif"; c.fillText(state.creative ? "∞" : String(inv.count[bar[i]]), x0 + i * slot + 4, y0 + slot - 7);
          }
          c.fillStyle = "rgba(255,255,255,0.7)"; c.font = "10px sans-serif"; c.fillText(String(i + 1), x0 + i * slot + 3, y0 + 11);
        }
        // the map of the visited chunks (the one you stand in is white)
        var cell = Math.max(3, Math.floor(110 / N)), mx = g.width - N * cell - 10, my = g.height - N * cell - 10;
        c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(mx - 2, my - 2, N * cell + 4, N * cell + 4);
        for (var kk in state.visited) { var vz = Math.floor(kk / N), vx = kk % N; c.fillStyle = "#6fbf73"; c.fillRect(mx + vx * cell, my + vz * cell, cell - 1, cell - 1); }
        if (state.chunk) { c.fillStyle = "#fff"; c.fillRect(mx + state.chunk.x * cell, my + state.chunk.z * cell, cell - 1, cell - 1); }
        if (state.showInv) {
          c.fillStyle = "rgba(0,0,0,0.78)"; c.fillRect(g.width / 2 - 170, 60, 340, 230);
          c.fillStyle = "#fff"; c.font = "16px sans-serif"; c.fillText("ENVANTER " + (state.creative ? "(yaratıcı mod: sınırsız)" : ""), g.width / 2 - 155, 86);
          var all = inv.order.filter(function (id) { return inv.count[id] > 0; });
          all.forEach(function (id, n) {
            var cx = g.width / 2 - 155 + (n % 2) * 160, cy = 104 + Math.floor(n / 2) * 24;
            swatch(c, id, cx, cy, 18); c.fillStyle = "#fff"; c.font = "14px sans-serif"; c.fillText(NAMES[id] + "  x" + (state.creative ? "∞" : inv.count[id]), cx + 26, cy + 14);
          });
        }
        if (state.showCraft) {
          c.fillStyle = "rgba(0,0,0,0.8)"; c.fillRect(g.width / 2 - 170, 60, 340, 170);
          c.fillStyle = "#fff"; c.font = "16px sans-serif"; c.fillText("ÜRETİM (sayı tuşu ile yap, X kapatır)", g.width / 2 - 155, 86);
          state.recipes.forEach(function (r, n) {
            var ok = r.need.every(function (q) { return (inv.count[q[0]] || 0) >= q[1]; });
            c.fillStyle = ok ? "#a5d6a7" : "#777"; c.font = "14px sans-serif"; c.fillText((n + 1) + ". " + r.name + " -> " + NAMES[r.give[0]] + " x" + r.give[1], g.width / 2 - 155, 114 + n * 26);
          });
        }
        if (state.showHelp) {
          c.fillStyle = "rgba(0,0,0,0.8)"; c.fillRect(g.width / 2 - 190, 50, 380, 250);
          c.fillStyle = "#fff"; c.font = "14px sans-serif";
          ["KONTROLLER", "W A S D  yürü       Boşluk  zıpla       Shift  koş", "Fare ya da oklar  bak (önce sayfaya tıkla)", "Sol tık / F  blok kır        Sağ tık / E  blok koy",
           "Tekerlek / Q / 1-9  blok seç", "I  envanter   X  üretim   C  yaratıcı mod (sınırsız blok)", "Çapa: sağ tık ile toprağı sür; tohum: tarlaya sağ tık; ekin büyür, kır ve topla", "G ya da Boşluk'a iki kez bas  uç (uçma özelliğiyle)", "H  bu yardımı kapat"].forEach(function (line, n) {
            c.fillText(line, g.width / 2 - 175, 80 + n * 26);
          });
        }
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined") return;
        if (!small) { small = document.createElement("canvas"); small.width = RW; small.height = RH; smallCtx = small.getContext("2d"); image = smallCtx.createImageData(RW, RH); }
        render(image.data); smallCtx.putImageData(image, 0, 0);
        c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        drawHud(c);
      } }];
      state.drawHud = drawHud;

      // ---- the mouse (it looks when the page has the pointer; left click breaks and keeps breaking, right click places, the wheel chooses) ----
      var mouseLeft = false;
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) {
        var canvas = g.canvas;
        canvas.addEventListener("click", function () { if (canvas.requestPointerLock && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (e) { /* no lock: keys still work */ } } });
        document.addEventListener("mousemove", function (e) { if (document.pointerLockElement === canvas) state.look(e.movementX * 0.0025, e.movementY * 0.0025); });
        canvas.addEventListener("mousedown", function (e) {
          if (e.button === 0) { mouseLeft = true; state.breakBlock(); state.breakDelay = 0.22; } else if (e.button === 2) state.placeBlock();
        });
        document.addEventListener("mouseup", function (e) { if (e.button === 0) mouseLeft = false; });
        canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
        canvas.addEventListener("wheel", function (e) { e.preventDefault(); state.select(state.slot + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
      }

      var held = {};
      function once(key, fn) { var now = K.key(key); if (now && !held[key]) { held[key] = true; fn(); } else if (!now) held[key] = false; }
      g.scene("play", {
        update: function (game, dt) {
          state.step(dt);
          once("f", state.breakBlock); once("e", state.placeBlock); once("q", function () { state.select(state.slot + 1); });
          once("i", function () { state.showInv = !state.showInv; }); once("Tab", function () { state.showInv = !state.showInv; });
          once("c", function () { state.setCreative(!state.creative); }); once("h", function () { state.showHelp = !state.showHelp; });
          once("g", function () { if (state.canFly) state.flying = !state.flying; });
          once("x", function () { state.showCraft = !state.showCraft; });
          for (var n = 1; n <= 9; n++) (function (num) { once(String(num), function () { if (state.showCraft) state.craft(num - 1); else state.select(num - 1); }); })(n);
          state.breakDelay -= dt;
          if (mouseLeft && state.breakDelay <= 0) { state.breakBlock(); state.breakDelay = 0.22; }   // holding the button keeps digging
          var ch = state.chunk || { x: 0, z: 0 };
          g.ui.text("hud.info", "parça " + ch.x + "," + ch.z + "   gezdin " + state.hud.explored + "/" + N * N + "   derinlik " + state.hud.depth + (state.flying ? "   UÇUYOR" : ""), 10, 22, { size: 14 });
          g.ui.text("hud.block", "BLOK: " + (state.selectedBlock() ? NAMES[state.selectedBlock()] : "yok") + "   kırdın " + state.hud.broken + "  koydun " + state.hud.placed, 10, 42, { size: 13, color: "#cfd8dc" });
          g.ui.text("hud.keys", "H yardım  I envanter  X üretim", g.width - 220, 22, { size: 12, color: "#cfd8dc" });
          var locked = typeof document !== "undefined" && g.canvas && document.pointerLockElement === g.canvas;
          if (typeof document !== "undefined" && g.canvas && !locked) g.ui.text("hud.lock", "Fareyle bakmak için ekrana tıkla", g.width / 2 - 110, 70, { size: 14, color: "#ffe082" });
          else delete g.ui.items["hud.lock"];
        }
      });
      state.start = function () { if (tune) K.music.play(tune); };
      state.expose = { g: g, spec: spec, world: w, hud: state.hud, get p() { return state.p; }, state: state };
      return state;
    }
  });

  // ---- features ----
  K.feature.define("fly", { kits: ["sandbox"], options: {}, apply: function (s) { s.canFly = true; } });
  K.feature.define("sprint", { kits: ["sandbox"], options: {}, apply: function (s) { s.sprintMul = 1.3; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
