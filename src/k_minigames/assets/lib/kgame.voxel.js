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
  var D = K.voxeldata, NAMES = D.NAME;
  var AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, LOG = 5, LEAVES = 6, PLANKS = 7, GLASS = 8, COAL = 9, IRON = 10, GOLD = 11, DIAMOND = 12, SNOW = 13, WATER = 14, CACTUS = 15;
  var FARMLAND = 16, CROP1 = 17, CROP3 = 19, SEEDS = 20, WHEAT = 21, BREAD = 23, CROP_SECONDS = 25, BED = 35, LAVA = 37, SAPLING = 38, APPLE = 120, TREE_SECONDS = 40, FENCE = 140, DOOR_LO = 141, DOOR_HI = 142, DOOR_ITEM = 143, LADDER = 149, PORTAL = 150, OBSIDIAN = 151, LIGHTER = 152, NETHERRACK = 153, GLOWSTONE = 154;
  var TABLE = 24, FURNACE = 25, TORCH = 33, COAL_ITEM = 41;   // (the coal you carry: COAL above is the ore in the ground)   // crops are blocks 17-19 (young to ripe), 20 and up are things you carry
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
    var chunks = new Array(N * N), heights = new Array(N * N), pending = {}, dim = o.dim || "over", treesBase = trees;
    var w = { S: S, N: N, SY: SY, chunks: chunks, made: 0, spawn: null, pending: pending, dim: dim };

    function surface(x, z) {
      var n = noise2(seed, x, z, 22) * 0.65 + noise2(seed + 7, x, z, 9) * 0.35;
      var h = Math.round(11 + (n - 0.5) * 2 * biome.amp + (o.lakes ? 0 : 3));
      if (!o.lakes) h = Math.max(h, SEA + 1);
      return Math.max(2, Math.min(SY - 8, h));
    }
    function rockAt(x, y, z) {   // 1.8 added granite, diorite and andesite: blobs of them lie in the stone
      if (y < 4) return STONE;
      if (noise3(seed + 41, x, y, z, 6) > 0.8) return 121;
      if (noise3(seed + 42, x, y, z, 6) > 0.8) return 122;
      if (noise3(seed + 43, x, y, z, 6) > 0.8) return 123;
      return STONE;
    }
    function fillDimension(blocks, hm, cx, cz, at) {   // the other worlds: the Kor Diyarı (a red cave with a lava sea) and the Gök Adaları (islands in the void)
      for (var lx = 0; lx < CH; lx++) for (var lz = 0; lz < CH; lz++) {
        var x = cx * CH + lx, z = cz * CH + lz, y, h;
        if (dim === "nether") {
          h = 5 + Math.round(noise2(seed + 61, x, z, 14) * 9 + noise2(seed + 62, x, z, 5) * 3);
          var ceil = 26 + Math.round(noise2(seed + 63, x, z, 10) * 3);
          hm[lz * CH + lx] = h;
          for (y = 0; y <= h; y++) blocks[at(lx, y, lz)] = y === 0 ? STONE : (y < h - 1 && hash(seed + 65, x, y, z) < 0.02 ? GOLD : NETHERRACK);
          for (y = h + 1; y <= SEA; y++) blocks[at(lx, y, lz)] = LAVA;
          if (h > SEA && noise2(seed + 64, x, z, 6) > 0.84) for (y = h + 1; y < ceil; y++) blocks[at(lx, y, lz)] = NETHERRACK;   // a pillar
          for (y = ceil; y < SY; y++) blocks[at(lx, y, lz)] = y === ceil && hash(seed + 66, x, 0, z) < 0.07 ? GLOWSTONE : NETHERRACK;
          if (hash(seed + 67, x, 0, z) < 0.04) { blocks[at(lx, ceil - 1, lz)] = GLOWSTONE; blocks[at(lx, ceil - 2, lz)] = GLOWSTONE; }
        } else {
          var mid = S >> 1, d = Math.sqrt((x - mid) * (x - mid) + (z - mid) * (z - mid));
          var mask = noise2(seed + 71, x, z, 24) * 0.8 + noise2(seed + 72, x, z, 9) * 0.2 - d / S * 0.15 + (d < 22 ? (1 - d / 22) * 0.9 : 0);
          hm[lz * CH + lx] = 0;
          if (mask > 0.58) {
            var top = 20 + Math.round(noise2(seed + 73, x, z, 12) * 4), bottom = top - (Math.round((mask - 0.58) * 22) + 2);
            hm[lz * CH + lx] = top;
            for (y = Math.max(1, bottom); y <= top; y++) {
              var b = y === top ? GRASS : y >= top - 2 ? DIRT : STONE, r = hash(seed + 74, x, y, z);
              if (b === STONE && r < 0.03) b = COAL; else if (b === STONE && r < 0.045) b = IRON;
              blocks[at(lx, y, lz)] = b;
            }
          }
        }
      }
    }
    function gen(cx, cz) {
      var idx = cz * N + cx, blocks = new Uint8Array(CH * SY * CH), hm = new Int16Array(CH * CH);
      var at = function (lx, y, lz) { return (y * CH + lz) * CH + lx; };
      if (dim !== "over") fillDimension(blocks, hm, cx, cz, at);
      else for (var lx = 0; lx < CH; lx++) for (var lz = 0; lz < CH; lz++) {
        var x = cx * CH + lx, z = cz * CH + lz, h = surface(x, z);
        hm[lz * CH + lx] = h;
        for (var y = 0; y <= h; y++) {
          var b = rockAt(x, y, z);   // stone, with veins of the three other kinds
          if (y === h) b = h <= SEA + 1 && biome.top !== SNOW ? SAND : biome.top;
          else if (y >= h - 3) b = biome.top === SAND || h <= SEA + 1 ? SAND : DIRT;
          blocks[at(lx, y, lz)] = b;
        }
        for (var wy = h + 1; wy <= SEA; wy++) blocks[at(lx, wy, lz)] = WATER;
        for (y = 3; y < h - 2; y++) {
          if (caves > 0 && noise3(seed + 3, x, y, z, 7) > 0.78 - caves * 0.045) { blocks[at(lx, y, lz)] = y <= 5 ? LAVA : AIR; continue; }   // the lowest caves are lava lakes
          if (ores > 0 && (blocks[at(lx, y, lz)] === STONE || (blocks[at(lx, y, lz)] >= 121 && blocks[at(lx, y, lz)] <= 123))) {
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
      if (w.onChunk) w.onChunk(cx, cz);
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
    w.switchDim = function (d) {   // forget every chunk and make the world of another dimension (the changes of that dimension are queued by the caller)
      dim = d; w.dim = d; trees = d === "nether" ? 0 : treesBase;
      for (var i = 0; i < chunks.length; i++) { chunks[i] = undefined; heights[i] = undefined; }
      for (var k in pending) delete pending[k];
      w.made = 0; w.spawn = null;
    };
    // the spawn: open ground nearest the middle (dry, clear sky above)
    w.findSpawn = function () {
    var mid = S >> 1; w.spawn = null;
    for (var ring = 0; ring < 40 && !w.spawn; ring++) for (var ox = -ring; ox <= ring && !w.spawn; ox++) for (var oz = -ring; oz <= ring && !w.spawn; oz++) {
      if (Math.max(Math.abs(ox), Math.abs(oz)) !== ring) continue;
      var sx = mid + ox, sz = mid + oz, sh = w.heightAt(sx, sz), clear = w.get(sx, sh, sz) !== WATER && sh > SEA;
      for (var up = 1; up <= 6 && clear; up++) if (w.get(sx, sh + up, sz) !== AIR) clear = false;
      if (clear) w.spawn = { x: sx + 0.5, y: sh + 1.01, z: sz + 0.5 };
    }
    if (!w.spawn) w.spawn = { x: mid + 0.5, y: Math.max(w.heightAt(mid, mid), SEA) + 1.01, z: mid + 0.5 };
    w.ensureAround(w.spawn.x | 0, w.spawn.z | 0, LOAD);
    };
    w.findSpawn();
    return w;
  }

  // ---- pixel textures, made by code: [top, side, bottom] colours with a little noise ----
  var COLORS = D.COLOR;
  var textures = {};
  function texture(id, face) {   // face 0 top, 1 side, 2 bottom
    id = D.texId(id);   // a half block or a stair wears the picture of its block
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
      if (id === 28 && (u % 8 === 0 || v % 4 === 0)) k *= 0.78;   // brick lines
      if (id >= 124 && id <= 126 && (u === 0 || v === 0)) k *= 0.82;   // the edge of a polished block
      if (id === 127 && face === 1 && v % 4 === 0) k *= 0.8;   // the straw bands
      if (id === 150) k *= 0.7 + 0.6 * Math.abs(Math.sin((u + v) * 0.7 + n * 3));   // the swirl of a portal
      if (id === 151 && n > 0.86) c = [90, 50, 140];   // purple flecks in the black rock
      if (id === 153 && n > 0.8) k *= 0.7;
      if (id === 154 && n > 0.55) k = 1.25;
      if (id === 24 && face === 0 && (u % 5 === 0 || v % 5 === 0)) k *= 0.8;   // the table top
      if (id === 25 && face === 1 && u > 3 && u < 12 && v > 6 && v < 13) k *= 0.35;   // the furnace mouth
      if (id === 26 && face === 1 && (v === 7 || v === 8)) k *= 0.7;   // the chest band
      px[(v * 16 + u) * 3] = Math.min(255, c[0] * k); px[(v * 16 + u) * 3 + 1] = Math.min(255, c[1] * k); px[(v * 16 + u) * 3 + 2] = Math.min(255, c[2] * k);
    }
    return textures[key] = px;
  }

  K.voxel = { menuAtStart: true, cropSeconds: CROP_SECONDS, treeSeconds: TREE_SECONDS, names: NAMES, biomes: Object.keys(BIOMES), sizes: Object.keys(SIZES), makeWorld: makeWorld };

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
      var baseKey = "sandbox." + spec.biome + "." + spec.size + "." + seed, saveKey = baseKey;   // the other dimensions keep their changes under baseKey.nether and baseKey.sky
      var state = { g: g, spec: spec, world: w, edits: [], hits: [], heroHooks: [], canFly: false, flying: false, sprintMul: 1, time: spec.time === "night" ? 0.5 : 0.1,
                    creative: false, inv: { order: [], count: {} }, slot: 0, showInv: false, showHelp: false, visited: {}, lockHint: true, breakDelay: 0,
                    p: { x: w.spawn.x, y: w.spawn.y, z: w.spawn.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false, peak: w.spawn.y },
                    ever: {}, stats: { crafted: {}, eaten: 0, smelted: 0, slept: 0, grown: 0 }, ach: {}, showAch: false, achT: 0, saplings: [], lavaT: 0, respawn: null, mobs: [], arrows: [], attackCd: 0, wear: {}, spawnT: 0, kills: 0,
                    health: 20, food: 20, air: 10, hungerT: 0, regenT: 0, starveT: 0, drownT: 0, hurtFlash: 0, deaths: 0, message: "", messageT: 0 };
      var tune = spec.music;
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      state.hud = { placed: 0, broken: 0, depth: 0, explored: 0, harvested: 0 };
      state.crops = [];
      var get = w.get, solid = function (b) { return b !== AIR && b !== WATER && !(b >= CROP1 && b <= CROP3) && b !== TORCH && b !== LAVA && b !== SAPLING && b !== PORTAL; };   // plants and torches are walked through, and lava is a liquid
      state.get = get;
      var set = function (x, y, z, b, remember, meta) {
        if (!w.set(x, y, z, b)) return false;
        if (state.meta) { if (meta !== undefined) state.meta[x + "," + y + "," + z] = meta; else if (b === AIR) delete state.meta[x + "," + y + "," + z]; }
        if (remember) {
          state.edits.push(meta !== undefined ? [x, y, z, b, meta] : [x, y, z, b]);
          if (state.edits.length > 3000) state.edits.shift();
          try { K.save.set(saveKey, state.edits); } catch (e) { /* no storage: the world is just not kept */ }
        }
        return true;
      };
      state.set = set;
      var pendingMeta = {};   // the facing and open state of shaped blocks put down in an earlier visit
      var saved; try { saved = K.save.get(saveKey, []); } catch (e) { saved = []; }
      (saved instanceof Array ? saved : []).forEach(function (e) {
        if (!(e instanceof Array) || (e.length !== 4 && e.length !== 5)) return;
        state.edits.push(e); w.queueEdit(e); if (e.length === 5) pendingMeta[e[0] + "," + e[1] + "," + e[2]] = e[4];
        if (w.chunks[(e[2] >> 4) * N + (e[0] >> 4)]) w.set(e[0], e[1], e[2], e[3]);   // a chunk that is already there gets it now
      });

      // ---- the inventory: what you hold, in the order you got it; the hotbar is the first nine kinds ----
      var inv = state.inv;
      state.addItem = function (id, n) {
        if (!id || id === AIR || id === WATER) return;
        state.ever[id] = true;   // (achievements look at what you ever held)
        if (!inv.count[id]) { inv.count[id] = 0; if (inv.order.indexOf(id) < 0) inv.order.push(id); }
        inv.count[id] += n || 1;
      };
      state.hotbar = function () { return inv.order.filter(function (id) { return inv.count[id] > 0; }); };   // every kind you hold, in the order you got them
      state.selectedBlock = function () { var bar = state.hotbar(); return bar.length ? bar[Math.min(state.slot, bar.length - 1)] : (state.creative ? STONE : 0); };
      state.select = function (i) { var n = Math.max(1, state.hotbar().length); state.slot = ((i % n) + n) % n; };
      state.windowStart = function () { var n = state.hotbar().length; return Math.max(0, Math.min(state.slot - 4, n - 9)); };   // the nine slots shown
      state.setCreative = function (on) {
        state.creative = on;
        if (on) [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, GLASS, SNOW, COAL, IRON, GOLD, DIAMOND, CACTUS].forEach(function (id) { if (inv.order.indexOf(id) < 0) inv.order.push(id); if (!inv.count[id]) inv.count[id] = 1; });
      };
      [[STONE, 20], [DIRT, 20], [PLANKS, 20], [GLASS, 8], [LOG, 10], [D.hoeId(0), 1], [SEEDS, 6]].forEach(function (s) { state.addItem(s[0], s[1]); });
      state.ever = {};   // the starter things do not count

      // ---- looking: a ray through the cubes (shared by the picture and by breaking / placing) ----
      var hit = { b: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, t: 0, face: 1, hx: 0, hy: 0, hz: 0 };
      // ---- shaped blocks: the boxes a block fills (inside its own cell, 0 to 1); a fence reaches out to its neighbours, a door turns, stairs face the way you looked ----
      state.meta = pendingMeta;   // facing 0-3 (north, east, south, west) and +4 for an open door, for the blocks that have one
      var metaOf = function (x, y, z) { return state.meta[x + "," + y + "," + z] || 0; };
      state.metaOf = metaOf;
      var isFence = function (b) { return b === FENCE; };
      var SHAPED = function (b) { return (b >= 130 && b <= 139) || b === FENCE || b === DOOR_LO || b === DOOR_HI || (b >= 144 && b <= 149) || b === PORTAL; };
      function sideBox(f, thick) {   // a panel of the given thickness against side f
        return f === 0 ? [0, 0, 0, 1, 1, thick] : f === 1 ? [1 - thick, 0, 0, 1, 1, 1] : f === 2 ? [0, 0, 1 - thick, 1, 1, 1] : [0, 0, 0, thick, 1, 1];
      }
      function shapeBoxes(b, x, y, z, forBody) {
        if (b >= 130 && b <= 134) return [[0, 0, 0, 1, 0.5, 1]];
        if (b >= 135 && b <= 139) return [[0, 0.5, 0, 1, 1, 1]];
        if (b >= 144 && b <= 148) {
          var sf = metaOf(x, y, z) & 3;
          return [[0, 0, 0, 1, 0.5, 1], sf === 0 ? [0, 0.5, 0, 1, 1, 0.5] : sf === 1 ? [0.5, 0.5, 0, 1, 1, 1] : sf === 2 ? [0, 0.5, 0.5, 1, 1, 1] : [0, 0.5, 0, 0.5, 1, 1]];
        }
        if (b === FENCE) {
          var top = forBody ? 1.5 : 1, out = [[0.375, 0, 0.375, 0.625, top, 0.625]], hs = forBody ? [0.375, 1.5] : [0.375, 0.9375];
          var join = function (nb) { return isFence(nb) || (nb !== AIR && nb !== WATER && nb !== LAVA && !SHAPED(nb) && solid(nb) && !(nb >= 17 && nb <= 19)); };
          if (join(get(x, y, z - 1))) out.push([0.4375, hs[0], 0, 0.5625, hs[1], 0.375]);
          if (join(get(x + 1, y, z))) out.push([0.625, hs[0], 0.4375, 1, hs[1], 0.5625]);
          if (join(get(x, y, z + 1))) out.push([0.4375, hs[0], 0.625, 0.5625, hs[1], 1]);
          if (join(get(x - 1, y, z))) out.push([0, hs[0], 0.4375, 0.375, hs[1], 0.5625]);
          return out;
        }
        if (b === DOOR_LO || b === DOOR_HI) {
          var m = metaOf(x, y, z), f = m & 3, open = (m & 4) !== 0;
          return [sideBox(open ? (f + 3) % 4 : f, 0.1875)];
        }
        if (b === PORTAL) return forBody ? [] : ((metaOf(x, y, z) & 1) ? [[0.44, 0, 0, 0.56, 1, 1]] : [[0, 0, 0.44, 1, 1, 0.56]]);
        if (b === LADDER) return forBody ? [] : [sideBox(metaOf(x, y, z) & 3, 0.125)];
        return null;
      }
      state.shapeBoxes = shapeBoxes;
      function boxRay(ox, oy, oz, dx, dy, dz, cx, cy, cz, boxes, t0, maxT) {   // where a ray first meets any of the boxes of a cell (null when it passes through)
        var best = null;
        for (var i = 0; i < boxes.length; i++) {
          var bx = boxes[i], lo = [cx + bx[0], cy + bx[1], cz + bx[2]], hi = [cx + bx[3], cy + bx[4], cz + bx[5]], o = [ox, oy, oz], d = [dx, dy, dz], near = -1e30, far = 1e30, axis = -1, sign = 0, miss = false;
          for (var a = 0; a < 3; a++) {
            if (d[a] === 0) { if (o[a] < lo[a] || o[a] > hi[a]) { miss = true; break; } continue; }
            var ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a], enter = ta < tb ? ta : tb, leave = ta < tb ? tb : ta;
            if (enter > near) { near = enter; axis = a; sign = d[a] > 0 ? -1 : 1; }
            if (leave < far) far = leave;
          }
          if (miss || near > far || far < t0 || near < t0 - 1e-6 || near > maxT) continue;
          if (!best || near < best.t) best = { t: near, nx: axis === 0 ? sign : 0, ny: axis === 1 ? sign : 0, nz: axis === 2 ? sign : 0 };
        }
        return best;
      }
      state.toggleDoor = function (x, y, z) {
        var lowY = get(x, y, z) === DOOR_LO ? y : y - 1;
        if (get(x, lowY, z) !== DOOR_LO) return false;
        var m = metaOf(x, lowY, z) ^ 4;
        set(x, lowY, z, DOOR_LO, true, m); set(x, lowY + 1, z, DOOR_HI, true, m); K.sfx("click");
        return true;
      };
      var facing = function () { return Math.floor(state.p.yaw / (Math.PI / 2) + 0.5) & 3; };   // 0 looking north, 1 east, 2 south, 3 west
      function cast(ox, oy, oz, dx, dy, dz, maxT, skipWater, thin) {
        var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
        var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
        var tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
        var tx = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tdx : 1e30, ty = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tdy : 1e30, tz = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tdz : 1e30;
        var t = 0, nx = 0, ny = 0, nz = 0, steps = 0, first = get(x, y, z);
        while (t <= maxT && steps++ < 200) {
          var b = get(x, y, z);
          if (SHAPED(b)) {   // only the parts of the cell that are filled stop the ray
            var sh = boxRay(ox, oy, oz, dx, dy, dz, x, y, z, shapeBoxes(b, x, y, z, false), t, maxT);
            if (sh) {
              hit.b = b; hit.x = x; hit.y = y; hit.z = z; hit.nx = sh.nx; hit.ny = sh.ny; hit.nz = sh.nz; hit.t = sh.t;
              hit.face = sh.ny !== 0 ? (sh.ny > 0 ? 0 : 2) : 1; hit.hx = ox + dx * sh.t; hit.hy = oy + dy * sh.t; hit.hz = oz + dz * sh.t;
              return true;
            }
          } else if (b !== AIR && !(skipWater && (b === WATER || b === LAVA)) && !(thin && b === first && b === WATER)) {
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
      state.have = function (kind) {   // the best tier of a tool kind in the inventory (-1: none); the right tool is used by itself
        var best = -1;
        Object.keys(inv.count).forEach(function (k) { var t = D.toolOf(+k); if (t && t.kind === kind && inv.count[k] > 0 && t.tier > best) best = t.tier; });
        return best;
      };
      state.mining = { key: "", progress: 0, need: 0 };
      state.settle = function (x, y, z) {   // sand does not hang in the air: it falls until it rests on something
        if (get(x, y, z) !== SAND) return false;
        var ny = y; while (ny > 1 && (get(x, ny - 1, z) === AIR || get(x, ny - 1, z) === WATER || get(x, ny - 1, z) === LAVA)) ny--;
        if (ny === y) return false;
        set(x, y, z, AIR, true); set(x, ny, z, SAND, true); return true;
      };
      state.sleep = function () {   // a bed: the night is over, and it is where you come back to
        var p = state.p;
        if (state.dim === "nether") { state.say("Bu diyarda uyuyamazsın."); return false; }
        if (state.daylight() >= 0.45 && spec.time !== "night") { state.say("Sadece geceleri uyuyabilirsin."); return false; }
        if (spec.time === "cycle") state.time = 0.85;
        state.respawn = { x: p.x, y: p.y, z: p.z }; state.stats.slept++;
        state.mobs = state.mobs.filter(function (m) { return K.voxelmobs.TYPES[m.type].kind === "passive"; });
        state.say(spec.time === "cycle" ? "İyi uyudun, sabah oldu. Yatağın artık doğma noktan." : "Yatağın artık doğma noktan.");
        return true;
      };
      state.growTree = function (x, y, z) {   // a sapling at (x,y,z) becomes a tree if there is room
        var th = 4 + (hash(11, x, y, z) > 0.5 ? 1 : 0);
        for (var t = 0; t <= th + 1; t++) { var b0 = get(x, y + t, z); if (t > 0 && b0 !== AIR) return false; }
        set(x, y, z, LOG, true);
        for (var t2 = 1; t2 <= th; t2++) set(x, y + t2, z, LOG, true);
        for (var ax = -2; ax <= 2; ax++) for (var az = -2; az <= 2; az++) for (var ay = th - 1; ay <= th + 1; ay++) {
          if (Math.abs(ax) + Math.abs(az) + (ay - th + 1) * 0.5 > 3.2 || (ax === 0 && az === 0 && ay < th)) continue;
          if (get(x + ax, y + ay, z + az) === AIR) set(x + ax, y + ay, z + az, LEAVES, true);
        }
        return true;
      };
      state.breakBlock = function () {
        var t = target();
        if (!t || t.y < 1) return false;
        var tx = t.x, ty = t.y, tz = t.z, b = t.b;
        K.sfx(b === DIRT || b === GRASS || b === SAND ? "click" : "hit");
        set(tx, ty, tz, AIR, true); state.hud.broken++;
        var kindUsed = D.rightTool(b); if (kindUsed) state.useTool(kindUsed);
        if (b === DOOR_LO || b === DOOR_HI) { var dl = b === DOOR_LO ? ty : ty - 1; set(tx, dl, tz, AIR, true); set(tx, dl + 1, tz, AIR, true); state.addItem(DOOR_ITEM, 1); return true; }
        for (var sy2 = ty + 1; sy2 <= ty + 8; sy2++) if (get(tx, sy2, tz) === SAND) state.settle(tx, sy2, tz);   // the sand above falls into the hole
        if (b === LEAVES) { if (hash(9, tx, ty, tz) < 0.1) state.addItem(SAPLING, 1); if (hash(10, tx, ty, tz) < 0.03) state.addItem(APPLE, 1); }
        if (b === CROP3) { state.addItem(WHEAT, 1); state.addItem(SEEDS, 1 + (hash(8, tx, ty, tz) < 0.5 ? 1 : 0)); state.hud.harvested++; }
        else if (b >= CROP1 && b < CROP3) state.addItem(SEEDS, 1);
        else {
          D.drops(b, state.have).forEach(function (d) { state.addItem(d[0], d[1]); });
          if (b === GRASS && hash(7, tx, ty, tz) < 0.25) state.addItem(SEEDS, 1);   // seeds hide in the grass
        }
        return true;
      };
      // ---- menus: the main menu when the game opens, and the pause menu on Esc; the world keeps drawing behind them ----
      state.menu = { open: K.voxel.menuAtStart !== false, kind: "main", index: 0, confirm: false };
      state.musicOn = true; state.menuStarted = state.menu.open;
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.menu.confirm = false; g.ui.items = {}; try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* not in a page */ } };
      state.closeMenu = function () { state.menu.open = false; state.menu.confirm = false; };
      state.toggleMusic = function () { state.musicOn = !state.musicOn; if (state.musicOn) { if (tune) K.music.play(tune); } else K.music.stop(); };
      state.resetWorld = function () {   // the saved changes and the achievements of this world are deleted; in a page it opens again from scratch
        try { [baseKey, baseKey + ".nether", baseKey + ".sky"].forEach(function (k) { K.save.set(k, []); }); K.save.set(baseKey + ".ach", {}); } catch (e) { /* nothing was kept anyway */ }
        state.edits.length = 0; state.resetRequested = true;
        if (typeof location !== "undefined" && location.reload) location.reload();
      };
      state.menuItems = function () {
        var m = state.menu, toggleCreative = { label: "Yaratıcı mod: " + (state.creative ? "açık" : "kapalı"), act: function () { state.setCreative(!state.creative); } };
        var music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic };
        var controls = { label: "Kontroller", act: function () { m.kind = m.kind === "main" ? "controls-main" : "controls-pause"; m.index = 0; } };
        if (m.kind === "main") return [
          { label: state.edits.length || state.hud.broken || state.hud.placed ? "Devam et" : "Oyna", act: state.closeMenu }, controls, toggleCreative, music,
          { label: m.confirm ? "Emin misin? Tekrar seç: dünya sıfırlanır" : "Dünyayı sıfırla (kaydı sil)", act: function () { if (m.confirm) state.resetWorld(); else m.confirm = true; } }];
        return [{ label: "Devam et", act: state.closeMenu }, controls, toggleCreative, music, { label: "Ana menü", act: function () { state.openMenu("main"); } }];
      };
      var CONTROL_LINES = ["W A S D  yürü       Boşluk  zıpla       Shift  koş", "Fare ya da oklar  bak (önce ekrana tıkla)", "Sol tık (basılı)  kır ya da vur       Sağ tık  koy / ye / kapıyı aç / uyu",
                           "Tekerlek, Q ya da 1-9  eşya seç       I  envanter       X  tarifler", "B  başarımlar       C  yaratıcı mod       H  yardım       Esc  menü", "Uçmak: G ya da Boşluk'a iki kez (uçma özelliğiyle)", "Geçit: 4x5 kara kaya çerçeve (köşesiz), çakmakla içine bak ve sağ tık. Cam çerçeve = Gök Adaları"];
      state.menuUpdate = function (dt) {
        var m = state.menu;
        g.ui.items = {};
        if (m.kind === "main") { state.p.yaw += dt * 0.12; state.p.pitch = -0.08; }   // the world turns slowly behind the main menu
        if (m.kind.indexOf("controls") === 0) {
          once("Escape", function () { m.kind = m.kind === "controls-main" ? "main" : "pause"; m.index = 1; });
          once("Enter", function () { m.kind = m.kind === "controls-main" ? "main" : "pause"; m.index = 1; });
          return;
        }
        var items = state.menuItems();
        once("ArrowUp", function () { m.index = (m.index + items.length - 1) % items.length; m.confirm = false; });
        once("ArrowDown", function () { m.index = (m.index + 1) % items.length; m.confirm = false; });
        once("Enter", function () { items[Math.min(m.index, items.length - 1)].act(); });
        once(" ", function () { items[Math.min(m.index, items.length - 1)].act(); });
        once("Escape", function () { if (m.kind === "pause") state.closeMenu(); });
        if (K.mouse) {   // the mouse: over a row selects it, a click does it
          var hover = Math.floor((K.mouse.y - (g.height / 2 - items.length * 22)) / 44);
          if (K.mouse.x > g.width / 2 - 150 && K.mouse.x < g.width / 2 + 150 && hover >= 0 && hover < items.length) {
            if (m.mouseSeen !== hover) { m.index = hover; m.mouseSeen = hover; }
            if (K.mouse.down && !m.clickDown) { m.clickDown = true; items[hover].act(); } else if (!K.mouse.down) m.clickDown = false;
          } else if (!K.mouse.down) m.clickDown = false;
        }
      };
      function drawMenu(c) {
        var m = state.menu;
        c.fillStyle = "rgba(10,14,20,0.62)"; c.fillRect(0, 0, g.width, g.height);
        c.textAlign = "center";
        if (m.kind.indexOf("controls") === 0) {
          c.fillStyle = "#fff"; c.font = "bold 20px sans-serif"; c.fillText("KONTROLLER", g.width / 2, 90);
          c.font = "15px sans-serif"; CONTROL_LINES.forEach(function (line, i) { c.fillText(line, g.width / 2, 140 + i * 34); });
          c.fillStyle = "#cfd8dc"; c.font = "13px sans-serif"; c.fillText("Esc ya da Enter: geri", g.width / 2, g.height - 40);
          c.textAlign = "left"; return;
        }
        var items = state.menuItems(), y0 = g.height / 2 - items.length * 22;
        items.forEach(function (it, i) {
          var on = i === m.index;
          c.fillStyle = on ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.38)"; c.fillRect(g.width / 2 - 150, y0 + i * 44, 300, 38);
          c.strokeStyle = on ? "#ffe082" : "rgba(255,255,255,0.25)"; c.lineWidth = on ? 2 : 1; c.strokeRect(g.width / 2 - 150, y0 + i * 44, 300, 38);
          c.fillStyle = on ? "#ffe082" : "#fff"; c.font = (on ? "bold " : "") + "16px sans-serif"; c.fillText(it.label, g.width / 2, y0 + i * 44 + 25);
        });
        c.fillStyle = "#cfd8dc"; c.font = "12px sans-serif"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla" + (m.kind === "pause" ? "   Esc devam" : ""), g.width / 2, g.height - 30);
        c.textAlign = "left";
      }
      // ---- creatures: animals that wander and can be hunted, and hostile ones that come out at night ----
      var M = K.voxelmobs;
      var mr = (function () { var q = (seed * 7919 + 13) >>> 0; return function () { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; })();
      var MW = {   // what a creature may ask of the world
        get: get, solid: solid, rnd: mr,
        get player() { return state.p; },
        get daylight() { return state.daylight(); },
        skyOpen: function (x, y, z) { for (var yy = Math.floor(y); yy < SY; yy++) { var b = get(Math.floor(x), yy, Math.floor(z)); if (b !== AIR && b !== TORCH) return false; } return true; },
        hurtPlayer: function (n, why) { state.hurtPlayer(n, why); },
        shoot: function (from, to) {
          var dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          state.arrows.push({ x: from.x, y: from.y, z: from.z, vx: dx / L * 16, vy: dy / L * 16 + 1.5, vz: dz / L * 16, age: 0 }); K.sfx("click");
        },
        explode: function (x, y, z) { state.explode(x, y, z); }
      };
      state.armorPoints = function () {   // the best piece you own for each of the four places counts, no need to put anything on
        var best = [0, 0, 0, 0];
        Object.keys(inv.count).forEach(function (k) { var a = D.armorOf(+k); if (a && inv.count[k] > 0 && a.points > best[a.slot]) best[a.slot] = a.points; });
        return best[0] + best[1] + best[2] + best[3];
      };
      state.hurtPlayer = function (n, why) { return state.hurt(Math.max(1, Math.round(n * (1 - Math.min(20, state.armorPoints()) * 0.04))), why); };   // each armour point takes off 4 percent
      state.explode = function (x, y, z) {
        var p = state.p, dist = Math.sqrt((p.x - x) * (p.x - x) + (p.y + 0.9 - y) * (p.y + 0.9 - y) + (p.z - z) * (p.z - z));
        for (var bx = -3; bx <= 3; bx++) for (var by = -3; by <= 3; by++) for (var bz = -3; bz <= 3; bz++) {
          if (bx * bx + by * by + bz * bz <= 7 && Math.floor(y) + by >= 1) set(Math.floor(x) + bx, Math.floor(y) + by, Math.floor(z) + bz, AIR, false);
        }
        if (dist < 5) state.hurtPlayer(Math.round((1 - dist / 5) * 18) + 2, "patlama");
        K.sfx("boom"); g.shake(8, 300);
      };
      state.useTool = function (kind) {   // a tool wears out: a wooden one after 59 uses, a diamond one after 1561
        if (state.creative) return;
        var tier = state.have(kind); if (tier < 0) return;
        var id = kind === "hoe" ? D.hoeId(tier) : D.toolId(kind, tier);
        state.wear[id] = (state.wear[id] === undefined ? D.DUR[tier] : state.wear[id]) - 1;
        if (state.wear[id] <= 0) { inv.count[id]--; delete state.wear[id]; state.say("Alet kırıldı: " + NAMES[id]); }
      };
      state.mobTarget = function () {   // the creature under the crosshair, nearer than any block (the mob is a ball for the ray)
        var e = eye(), d = look(), bt = cast(e.x, e.y, e.z, d.x, d.y, d.z, REACH, true) ? hit.t : 99, best = null, bestT = 3.6;
        state.mobs.forEach(function (m) {
          var t = M.TYPES[m.type], r = Math.max(t.w, t.h * 0.6) / 2 + 0.25, ox = m.x - e.x, oy = m.y + t.h / 2 - e.y, oz = m.z - e.z, tc = ox * d.x + oy * d.y + oz * d.z;
          if (tc < 0 || tc > bestT) return;
          var d2 = ox * ox + oy * oy + oz * oz - tc * tc; if (d2 > r * r) return;
          var th = tc - Math.sqrt(r * r - d2); if (th < 0) th = tc;
          if (th < bestT && th < bt) { bestT = th; best = m; }
        });
        return best;
      };
      var SWORD = [4, 5, 6, 4, 7];   // damage with a wood, stone, iron, gold, diamond sword (bare hands 1)
      state.killMob = function (m) {
        m.dead = true; state.kills++;
        M.drops(m.type, mr).forEach(function (d) { state.addItem(d[0], d[1]); });
      };
      state.attackMob = function (m) {
        if (m.dead || state.attackCd > 0) return false;   // a dead one is not hit again
        state.attackCd = 0.5;
        var tier = state.have("sword"), dmg = tier >= 0 ? SWORD[tier] : 1, p = state.p, dx = m.x - p.x, dz = m.z - p.z, L = Math.sqrt(dx * dx + dz * dz) || 1;
        m.hp -= dmg; m.flash = 0.25; m.kx = dx / L * 5; m.kz = dz / L * 5; m.vy = 4; if (M.TYPES[m.type].kind === "passive") m.fear = 4;
        K.sfx("hit"); if (tier >= 0) state.useTool("sword");
        if (m.hp <= 0) state.killMob(m);
        return true;
      };
      state.spawnHostile = function () {   // at night, on open ground a little way off, never more than six near you
        var hostiles = state.mobs.filter(function (m) { return M.TYPES[m.type].kind === "hostile"; }).length;
        if (state.daylight() >= 0.45 || hostiles >= 6 || state.mobs.length >= 40) return null;
        var p = state.p, a = mr() * 6.283, d = 14 + mr() * 10, x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
        if (x < 2 || z < 2 || x >= S - 2 || z >= S - 2) return null;
        var h = w.heightAt(x, z);
        if (h <= SEA || get(x, h, z) === WATER || get(x, h + 1, z) !== AIR || get(x, h + 2, z) !== AIR) return null;
        var roll = mr(), type = roll < 0.4 ? "zombie" : roll < 0.65 ? "skeleton" : roll < 0.85 ? "bomber" : "spider";
        var m = M.create(type, x + 0.5, h + 1.01, z + 0.5); state.mobs.push(m); return m;
      };
      state.updateMobs = function (dt) {
        var p = state.p;
        state.attackCd -= dt;
        state.mobs.forEach(function (m) { M.step(m, dt, MW); });
        state.mobs = state.mobs.filter(function (m) {
          if (m.dead) return false;
          var dx = m.x - p.x, dz = m.z - p.z;
          return dx * dx + dz * dz < (M.TYPES[m.type].kind === "hostile" ? 48 * 48 : 90 * 90);
        });
        state.arrows = state.arrows.filter(function (a) {
          a.age += dt; a.vy -= 12 * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
          if (a.age > 6 || solid(get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)))) return false;
          var dx = a.x - p.x, dy = a.y - (p.y + 0.9), dz = a.z - p.z;
          if (dx * dx + dz * dz < 0.35 && Math.abs(dy) < 1) { state.hurtPlayer(3, "ok"); return false; }
          return true;
        });
        state.spawnT += dt; if (state.spawnT >= 2) { state.spawnT = 0; state.spawnHostile(); }
      };
      w.onChunk = function (cx, cz) {   // a chunk made for the first time gets its herd, when the ground is open
        if (state.dim === "nether") return;
        M.chunkSpawns(seed, cx, cz, spec.biome).forEach(function (sp) {
          var x = Math.floor(sp.x), z = Math.floor(sp.z), h = w.heightAt(x, z), top = get(x, h, z);
          if (h > SEA + 1 && (top === GRASS || top === SNOW || top === SAND) && get(x, h + 1, z) === AIR) state.mobs.push(M.create(sp.type, sp.x, h + 1.01, sp.z));
        });
      };
      w.chunks.forEach(function (c, i) { if (c) w.onChunk(i % N, Math.floor(i / N)); });

      state.mineStep = function (dt, holding) {   // holding the button hits a creature in front, or digs the block, as fast as your best tool allows
        var m = state.mining, mob = holding ? state.mobTarget() : null;
        if (mob) { m.key = ""; m.progress = 0; m.need = 0; state.attackMob(mob); return true; }
        var t = holding ? target() : null;
        if (!t) { m.key = ""; m.progress = 0; m.need = 0; return false; }
        var key = t.x + "," + t.y + "," + t.z;
        if (m.key !== key) { m.key = key; m.progress = 0; }
        m.need = state.creative ? 0 : D.mineTime(t.b, state.have);
        m.progress += dt;
        if (m.progress >= m.need) { state.breakBlock(); m.key = ""; m.progress = 0; return true; }
        return false;
      };
      state.eat = function (id) {   // food fills the hunger bar, only when it is not full
        var gain = D.FOOD[id];
        if (!gain || state.food >= 20 || (!state.creative && !(inv.count[id] > 0))) return false;
        state.food = Math.min(20, state.food + gain);
        if (!state.creative) inv.count[id]--;
        if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1);
        K.sfx("coin"); state.stats.eaten++; return true;
      };
      state.placeBlock = function () {
        var bedT = target(); if (bedT && bedT.b === BED) return state.sleep();
        if (bedT && (bedT.b === DOOR_LO || bedT.b === DOOR_HI)) return state.toggleDoor(bedT.x, bedT.y, bedT.z);   // a right click on a door opens or shuts it
        if (D.FOOD[state.selectedBlock()]) return state.eat(state.selectedBlock());
        var t = target(), id = state.selectedBlock();
        if (!t || !id || (!state.creative && !(inv.count[id] > 0))) return false;
        if (D.toolOf(id) && D.toolOf(id).kind === "hoe") {   // the hoe turns the top of grass or soil into a field
          if (t.ny !== 1 || (t.b !== GRASS && t.b !== DIRT) || get(t.x, t.y + 1, t.z) !== AIR) return false;
          set(t.x, t.y, t.z, FARMLAND, true); K.sfx("click"); state.useTool("hoe"); return true;
        }
        if (id === SEEDS) {   // seeds go on a field, and the crop grows by itself
          if (t.ny !== 1 || t.b !== FARMLAND || get(t.x, t.y + 1, t.z) !== AIR) return false;
          set(t.x, t.y + 1, t.z, CROP1, true); state.crops.push({ x: t.x, y: t.y + 1, z: t.z, age: 0 }); K.sfx("click");
          if (!state.creative) { inv.count[SEEDS]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); }
          return true;
        }
        if (id === SAPLING) {   // a sapling stands on grass or soil and becomes a tree by itself
          if (t.ny !== 1 || (t.b !== GRASS && t.b !== DIRT) || get(t.x, t.y + 1, t.z) !== AIR) return false;
          set(t.x, t.y + 1, t.z, SAPLING, true); state.saplings.push({ x: t.x, y: t.y + 1, z: t.z, age: 0 }); K.sfx("click");
          if (!state.creative) { inv.count[SAPLING]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); }
          return true;
        }
        if (id === LIGHTER) { state.lightPortal(t.x, t.y, t.z); return true; }   // a çakmak lights the portal frame it points at
        if (id === DOOR_ITEM) {   // a door stands in the cell next to what you clicked, on solid ground, two high
          var dx0 = t.x + t.nx, dy0 = t.y + t.ny, dz0 = t.z + t.nz;
          if (get(dx0, dy0, dz0) !== AIR || get(dx0, dy0 + 1, dz0) !== AIR || !solid(get(dx0, dy0 - 1, dz0)) || SHAPED(get(dx0, dy0 - 1, dz0))) return false;
          var df = (facing() + 2) & 3;   // the panel is on the side you stand on
          set(dx0, dy0, dz0, DOOR_LO, true, df); set(dx0, dy0 + 1, dz0, DOOR_HI, true, df); K.sfx("click"); state.hud.placed++;
          if (!state.creative) { inv.count[id]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); }
          return true;
        }
        if (id === LADDER) {   // a ladder is fixed to the side of a solid block
          if (t.ny !== 0 || !solid(get(t.x, t.y, t.z)) || SHAPED(t.b)) return false;
          var lx = t.x + t.nx, lz = t.z + t.nz;
          if (get(lx, t.y, lz) !== AIR) return false;
          set(lx, t.y, lz, LADDER, true, t.nx === 1 ? 3 : t.nx === -1 ? 1 : t.nz === 1 ? 0 : 2); K.sfx("click"); state.hud.placed++;
          if (!state.creative) { inv.count[id]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); }
          return true;
        }
        var slabItem = D.slabOf(id);
        if (slabItem) {   // a half block goes low or high by where you clicked, and two of a kind make a whole block
          var tSlab = D.slabOf(t.b), done = false;
          if (tSlab && tSlab.base === slabItem.base && ((t.ny === 1 && t.b === tSlab.bottom) || (t.ny === -1 && t.b === tSlab.top))) { set(t.x, t.y, t.z, slabItem.base, true); done = true; }
          else {
            var sx2 = t.x + t.nx, sy2 = t.y + t.ny, sz2 = t.z + t.nz;
            if (get(sx2, sy2, sz2) !== AIR && get(sx2, sy2, sz2) !== WATER) return false;
            var high = t.ny === -1 ? true : t.ny === 1 ? false : (t.hy - Math.floor(t.hy)) >= 0.5;
            set(sx2, sy2, sz2, high ? slabItem.top : slabItem.bottom, true); done = true;
          }
          if (done) { state.hud.placed++; K.sfx("click"); if (!state.creative) { inv.count[id]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); } }
          return done;
        }
        if (D.stairOf(id)) {   // stairs rise the way you are looking
          var tx3 = t.x + t.nx, ty3 = t.y + t.ny, tz3 = t.z + t.nz;
          if (get(tx3, ty3, tz3) !== AIR && get(tx3, ty3, tz3) !== WATER) return false;
          set(tx3, ty3, tz3, id, true, facing()); state.hud.placed++; K.sfx("click");
          if (!state.creative) { inv.count[id]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); }
          return true;
        }
        if (!D.isBlock(id)) return false;   // food, tools and materials are not placed
        var x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz, p = state.p;
        if (get(x, y, z) !== AIR && get(x, y, z) !== WATER) return false;
        if (x + 1 > p.x - 0.3 && x < p.x + 0.3 && z + 1 > p.z - 0.3 && z < p.z + 0.3 && y + 1 > p.y && y < p.y + 1.8) return false;   // not inside the player
        set(x, y, z, id, true); state.hud.placed++; K.sfx("click"); if (id === SAND) state.settle(x, y, z);
        if (!state.creative) { inv.count[id]--; if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1); }
        return true;
      };

      // ---- growing and crafting ----
      state.growSaplings = function (dt) {
        state.saplings = state.saplings.filter(function (sp) {
          if (get(sp.x, sp.y, sp.z) !== SAPLING) return false;
          sp.age += dt;
          if (sp.age < TREE_SECONDS) return true;
          if (state.growTree(sp.x, sp.y, sp.z)) { state.stats.grown++; return false; }
          sp.age = TREE_SECONDS - 5; return true;   // no room yet: it tries again later
        });
      };
      state.grow = function (dt) {
        state.growSaplings(dt);
        state.crops = state.crops.filter(function (c) {
          var b = get(c.x, c.y, c.z);
          if (b < CROP1 || b > CROP3) return false;   // it was harvested or built over
          c.age += dt;
          var stage = Math.min(2, Math.floor(c.age / CROP_SECONDS));
          if (CROP1 + stage !== b) set(c.x, c.y, c.z, CROP1 + stage, true);
          return CROP1 + stage < CROP3;
        });
      };
      state.recipes = D.recipes; state.fuel = 0; state.craftCursor = 0;
      state.near = function (id, r) {   // is a block of this kind within r blocks of the player
        var p = state.p, x0 = Math.floor(p.x), y0 = Math.floor(p.y), z0 = Math.floor(p.z);
        for (var dx = -r; dx <= r; dx++) for (var dy = -2; dy <= 3; dy++) for (var dz = -r; dz <= r; dz++) if (get(x0 + dx, y0 + dy, z0 + dz) === id) return true;
        return false;
      };
      state.canCraft = function (r) {
        if (!r.need.every(function (n) { return (inv.count[n[0]] || 0) >= n[1]; })) return false;
        if (r.where === "table") return state.near(TABLE, 5);
        if (r.where === "furnace") return state.near(FURNACE, 5) && (state.fuel > 0 || (inv.count[COAL_ITEM] || 0) >= 1);
        return true;
      };
      state.craft = function (which) {   // by number in the list or by name
        var r = typeof which === "string" ? state.recipes[D.recipeIndex(which)] : state.recipes[which];
        if (!r || !state.canCraft(r)) return false;
        if (r.where === "furnace") { if (state.fuel <= 0) { inv.count[COAL_ITEM]--; state.fuel = 8; } state.fuel--; }   // a coal smelts eight
        r.need.forEach(function (n) { inv.count[n[0]] -= n[1]; });
        state.addItem(r.give[0], r.give[1]); K.sfx("coin");
        state.stats.crafted[r.name] = (state.stats.crafted[r.name] || 0) + 1; if (r.where === "furnace") state.stats.smelted++;
        return true;
      };
      state.craftPage = function () { return Math.floor(state.craftCursor / 8) * 8; };
      state.menuMove = function (d) { state.craftCursor = Math.max(0, Math.min(state.recipes.length - 1, state.craftCursor + d)); };
      (saved instanceof Array ? saved : []).forEach(function (e) {   // crops that were growing when the world was saved go on growing
        if (e instanceof Array && e[3] === SAPLING && get(e[0], e[1], e[2]) === SAPLING) state.saplings.push({ x: e[0], y: e[1], z: e[2], age: 0 });
        if (e instanceof Array && e[3] >= CROP1 && e[3] < CROP3 && get(e[0], e[1], e[2]) === e[3]) state.crops.push({ x: e[0], y: e[1], z: e[2], age: (e[3] - CROP1) * CROP_SECONDS });
      });

      // ---- dimensions: a portal frame (kara kaya = Kor Diyarı, cam = Gök Adaları) lit with a çakmak leads to another world made by the same seed; each keeps its own changes ----
      var DIMS = { nether: { name: "Kor Diyarı", frame: OBSIDIAN, code: 1 }, sky: { name: "Gök Adaları", frame: GLASS, code: 2 } }, DIM_BY_CODE = [null, "nether", "sky"];
      state.dim = "over"; state.homes = {}; state.dimsSeen = {}; state.portalT = 0; state.portalLock = true; state.dimNames = { over: "Ana dünya", nether: "Kor Diyarı", sky: "Gök Adaları" };
      function portalCell(ix, iy, iz, axis, a, b) { return axis === 0 ? [ix + a, iy + b, iz] : [ix, iy + b, iz + a]; }
      function frameFits(ix, iy, iz, axis, mat) {   // a free 2 wide, 3 high opening with a ring of `mat` around it (corners are not needed)
        for (var a = -1; a <= 2; a++) for (var b = -1; b <= 3; b++) {
          var c = portalCell(ix, iy, iz, axis, a, b), inside = a >= 0 && a <= 1 && b >= 0 && b <= 2, corner = (a === -1 || a === 2) && (b === -1 || b === 3);
          if (corner) continue;
          var here = get(c[0], c[1], c[2]);
          if (inside ? here !== AIR : here !== mat) return false;
        }
        return true;
      }
      state.lightPortal = function (x, y, z) {
        var mat = get(x, y, z);
        if (mat !== OBSIDIAN && mat !== GLASS) return false;
        var code = state.dim !== "over" ? 0 : mat === OBSIDIAN ? 1 : 2;
        for (var axis = 0; axis <= 1; axis++) for (var da = -4; da <= 4; da++) for (var iy = y - 4; iy <= y + 1; iy++) {
          var ix = axis === 0 ? x + da : x, iz = axis === 0 ? z : z + da;
          if (!frameFits(ix, iy, iz, axis, mat)) continue;
          for (var a = 0; a <= 1; a++) for (var b = 0; b <= 2; b++) { var c = portalCell(ix, iy, iz, axis, a, b); set(c[0], c[1], c[2], PORTAL, true, axis + 4 * code); }
          K.sfx("coin"); state.say("Geçit açıldı."); return true;
        }
        state.say("Çerçeve olmadı: 4 geniş, 5 yüksek, köşesiz, içi boş.");
        return false;
      };
      function buildArrival(ax, h, az, dest) {   // the way back: a small portal standing on flat ground, with room around it
        for (var x = ax - 1; x <= ax + 2; x++) for (var z = az - 1; z <= az + 1; z++) {
          var under = get(x, h, z); if (!solid(under) || under === LAVA) set(x, h, z, dest === "nether" ? NETHERRACK : STONE, true);
          for (var y = h + 1; y <= h + 4; y++) if (get(x, y, z) !== AIR) set(x, y, z, AIR, true);
        }
        [[ax, h], [ax + 1, h]].forEach(function (c) { set(c[0], c[1], az, OBSIDIAN, true); set(c[0], h + 4, az, OBSIDIAN, true); });
        for (var yy = h + 1; yy <= h + 3; yy++) { set(ax - 1, yy, az, OBSIDIAN, true); set(ax + 2, yy, az, OBSIDIAN, true); set(ax, yy, az, PORTAL, true, 0); set(ax + 1, yy, az, PORTAL, true, 0); }
      }
      function restoreGrowth(list) {   // saplings and crops that were growing in this world go on
        list.forEach(function (e) {
          if (e[3] === SAPLING && get(e[0], e[1], e[2]) === SAPLING) state.saplings.push({ x: e[0], y: e[1], z: e[2], age: 0 });
          if (e[3] >= CROP1 && e[3] < CROP3 && get(e[0], e[1], e[2]) === e[3]) state.crops.push({ x: e[0], y: e[1], z: e[2], age: (e[3] - CROP1) * CROP_SECONDS });
        });
      }
      state.travel = function (dest) {
        if (dest === state.dim || (dest !== "over" && !DIMS[dest])) return false;
        var p = state.p, from = state.dim, fromPos = { x: p.x, y: p.y, z: p.z };
        state.homes[from] = fromPos; state.dim = dest; state.dimsSeen[dest] = true;
        saveKey = dest === "over" ? baseKey : baseKey + "." + dest;
        state.edits = []; state.meta = {}; state.mobs = []; state.arrows = []; state.saplings = []; state.crops = [];
        w.switchDim(dest);
        var sv; try { sv = K.save.get(saveKey, []); } catch (e) { sv = []; }
        var list = (sv instanceof Array ? sv : []).filter(function (e) { return e instanceof Array && (e.length === 4 || e.length === 5); });
        list.forEach(function (e) { state.edits.push(e); w.queueEdit(e); if (e.length === 5) state.meta[e[0] + "," + e[1] + "," + e[2]] = e[4]; });
        w.findSpawn();
        var home = state.homes[dest];
        if (home) { w.ensureAround(home.x | 0, home.z | 0, LOAD); p.x = home.x; p.y = home.y; p.z = home.z; }
        else if (dest === "over") { p.x = w.spawn.x; p.y = w.spawn.y; p.z = w.spawn.z; }
        else {
          var tx = dest === "nether" ? Math.max(8, Math.min(S - 8, Math.floor(fromPos.x / 2))) : w.spawn.x | 0, tz = dest === "nether" ? Math.max(8, Math.min(S - 8, Math.floor(fromPos.z / 2))) : w.spawn.z | 0, ax = tx, az = tz, h = 0, found = false;
          w.ensureAround(tx, tz, 3);
          for (var ring = 0; ring < 40 && !found; ring++) for (var ox = -ring; ox <= ring && !found; ox++) for (var oz = -ring; oz <= ring && !found; oz++) {
            if (Math.max(Math.abs(ox), Math.abs(oz)) !== ring) continue;
            var cx2 = tx + ox, cz2 = tz + oz; if (cx2 < 3 || cz2 < 3 || cx2 > S - 4 || cz2 > S - 4) continue;
            var hh = w.heightAt(cx2, cz2); if (hh > SEA && hh < 18 && get(cx2, hh, cz2) !== LAVA) { ax = cx2; az = cz2; h = hh; found = true; }
          }
          if (!found) { ax = tx; az = tz; h = Math.max(12, w.heightAt(tx, tz)); }
          buildArrival(ax, h, az, dest);
          state.homes[dest] = { x: ax + 1.0, y: h + 1.01, z: az + 0.5 };
          p.x = ax + 1.0; p.y = h + 1.01; p.z = az + 1.5;
        }
        p.vx = p.vy = p.vz = 0; p.peak = p.y; state.portalLock = true; state.portalT = 0; state.visited = {};
        w.ensureAround(p.x | 0, p.z | 0, LOAD);
        restoreGrowth(list);
        K.sfx("coin"); state.say(state.dimNames[dest]);
        return true;
      };
      state.portalStep = function (dt) {
        var p = state.p, fx = Math.floor(p.x), fz = Math.floor(p.z);
        var cellY = get(fx, Math.floor(p.y + 0.2), fz) === PORTAL ? Math.floor(p.y + 0.2) : get(fx, Math.floor(p.y + 1.2), fz) === PORTAL ? Math.floor(p.y + 1.2) : -1;
        if (cellY < 0) { state.portalT = 0; state.portalLock = false; return; }
        if (state.portalLock) return;
        state.portalT += dt;
        if (state.portalT >= 1.2) { var code = metaOf(fx, cellY, fz) >> 2; state.travel(DIM_BY_CODE[code] || "over"); }
      };

      // ---- the player ----
      function collides(x, y, z) {
        for (var bx = Math.floor(x - 0.3); bx <= Math.floor(x + 0.3); bx++) for (var bz = Math.floor(z - 0.3); bz <= Math.floor(z + 0.3); bz++)
          for (var by = Math.floor(y) - 1; by <= Math.floor(y + 1.79); by++) {
            var b = get(bx, by, bz);
            if (SHAPED(b)) {   // only the filled boxes of a shaped block are in the way
              var boxes = shapeBoxes(b, bx, by, bz, true);
              for (var k = 0; k < boxes.length; k++) {
                var q = boxes[k];
                if (x + 0.3 > bx + q[0] && x - 0.3 < bx + q[3] && z + 0.3 > bz + q[2] && z - 0.3 < bz + q[5] && y + 1.79 > by + q[1] && y < by + q[4]) return true;
              }
            } else if (by >= Math.floor(y) && solid(b)) return true;
          }
        return false;
      }
      state.say = function (text) { state.message = text; state.messageT = 4; };
      state.hurt = function (n, why) {
        if (state.creative || n <= 0) return false;
        state.health -= n; state.hurtFlash = 0.35; K.sfx("hit");
        if (state.health <= 0) state.die(why);
        return true;
      };
      state.die = function (why) {   // you come back at the spawn with everything you carry
        var p = state.p;
        state.deaths++; state.health = 20; state.food = 20; state.air = 10; state.hungerT = state.regenT = state.starveT = state.drownT = 0;
        if (state.dim !== "over") state.travel("over");   // you wake up in the main world
        var rs = state.respawn || w.spawn; p.x = rs.x; p.y = rs.y; p.z = rs.z; p.vx = p.vy = p.vz = 0; p.peak = p.y;
        state.mobs = state.mobs.filter(function (m) { return K.voxelmobs.TYPES[m.type].kind === "passive"; });   // the night things are gone when you come back
        state.say("Öldün" + (why ? " (" + why + ")" : "") + ". Doğma noktasında yeniden doğdun.");
      };
      state.landed = function (p) {   // falling more than three blocks hurts, a block of height per point
        var drop = p.peak - p.y;
        if (drop > 3.3 && !state.canFly) state.hurt(Math.floor(drop - 3), "düşme");
        else if (drop > 3.3 && !state.flying) state.hurt(Math.floor(drop - 3), "düşme");
        p.peak = p.y;
      };
      var savedAch; try { savedAch = K.save.get(baseKey + ".ach", {}); } catch (e) { savedAch = {}; }
      if (savedAch && typeof savedAch === "object") Object.keys(savedAch).forEach(function (k) { state.ach[k] = true; });
      state.checkAch = function () {   // an achievement that comes true is announced once and kept with the world
        var gained = [];
        D.ACH.forEach(function (a) { if (!state.ach[a.id] && a.test(state)) { state.ach[a.id] = true; gained.push(a); } });
        if (gained.length) {
          state.say("Başarım: " + gained[0].name + " (" + gained[0].desc + ")"); K.sfx("powerup");
          try { K.save.set(baseKey + ".ach", state.ach); } catch (e) { /* not kept */ }
        }
        return gained;
      };
      state.vitals = function (dt) {
        var p = state.p;
        state.achT += dt; if (state.achT >= 0.5) { state.achT = 0; state.checkAch(); }
        var inLava = get(Math.floor(p.x), Math.floor(p.y + 0.2), Math.floor(p.z)) === LAVA || get(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) === LAVA;
        if (inLava) { state.lavaT = (state.lavaT || 0) + dt; if (state.lavaT >= 0.5) { state.lavaT = 0; state.hurt(4, "lav"); } } else state.lavaT = 0;
        state.hungerT += dt * (K.key("Shift") ? 1.8 : 1);
        if (state.hungerT >= 45) { state.hungerT = 0; if (!state.creative) state.food = Math.max(0, state.food - 1); }
        if (state.food >= 18 && state.health < 20) { state.regenT += dt; if (state.regenT >= 4) { state.regenT = 0; state.health++; } } else state.regenT = 0;
        if (state.food <= 0) { state.starveT += dt; if (state.starveT >= 4) { state.starveT = 0; if (state.health > 1) state.hurt(1, "açlık"); } } else state.starveT = 0;
        var head = get(Math.floor(p.x), Math.floor(p.y + 1.6), Math.floor(p.z)) === WATER;
        if (head && !state.creative) { state.air = Math.max(0, state.air - dt); if (state.air <= 0) { state.drownT += dt; if (state.drownT >= 1) { state.drownT = 0; state.hurt(2, "boğulma"); } } }
        else { state.air = Math.min(10, state.air + 4 * dt); state.drownT = 0; }
        if (state.hurtFlash > 0) state.hurtFlash -= dt;
        if (state.messageT > 0) { state.messageT -= dt; if (state.messageT <= 0) state.message = ""; }
      };
      var lastSpace = -9, spaceHeld = false;
      state.step = function (dt) {
        var p = state.p, flying = state.canFly && state.flying;
        var turn = (K.key("ArrowRight") ? 1 : 0) - (K.key("ArrowLeft") ? 1 : 0), tilt = (K.key("ArrowUp") ? 1 : 0) - (K.key("ArrowDown") ? 1 : 0);
        if (state.showCraft) { turn = 0; tilt = 0; }   // the arrows move in the recipe list instead
        p.yaw += turn * 2.2 * dt; p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch + tilt * 1.6 * dt));
        var f = (K.key("w") ? 1 : 0) - (K.key("s") ? 1 : 0), r = (K.key("d") ? 1 : 0) - (K.key("a") ? 1 : 0);
        var speed = 4.3 * state.sprintMul * (K.key("Shift") && !flying ? 1.5 : flying ? 1.6 : 1);
        var len = Math.sqrt(f * f + r * r) || 1;
        var sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
        var wx = (sin * f + cos * r) / len * speed, wz = (-cos * f + sin * r) / len * speed;
        var inWater = get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === WATER;
        var inLavaStep = get(Math.floor(p.x), Math.floor(p.y + 0.2), Math.floor(p.z)) === LAVA;
        if (inWater || inLavaStep) { wx *= 0.5; wz *= 0.5; }
        p.vx = wx; p.vz = wz;
        var space = K.key(" ");
        if (space && !spaceHeld) { if (state.canFly && state.time0 - lastSpace < 0.3) state.flying = !state.flying; lastSpace = state.time0; }   // twice quickly: fly on / off
        spaceHeld = space;
        flying = state.canFly && state.flying;
        var ladderHere = get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === LADDER || get(Math.floor(p.x), Math.floor(p.y + 1.2), Math.floor(p.z)) === LADDER;
        if (flying) { p.vy = ((space ? 1 : 0) - (K.key("Shift") ? 1 : 0)) * 6; }
        else if (ladderHere) { p.vy = ((space || K.key("w") ? 1 : 0) - (K.key("Shift") || K.key("s") ? 1 : 0)) * 3; p.peak = p.y; }   // a ladder is climbed, not fallen
        else {
          p.vy -= (inWater ? 8 : 26) * dt;
          if (inWater) p.vy = Math.max(p.vy, -3);
          if (space && (p.onGround || inWater)) { p.vy = inWater ? 3.2 : 8.2; p.onGround = false; }
        }
        p.peak = (p.onGround || inWater || flying) ? p.y : Math.max(p.peak, p.y);
        var nx = p.x + p.vx * dt;   // a step of up to half a block is climbed without jumping (half blocks, stairs)
        if (!collides(nx, p.y, p.z)) p.x = nx; else if (p.onGround && !flying && !collides(nx, p.y + 0.55, p.z) && !collides(p.x, p.y + 0.55, p.z)) { p.x = nx; p.y += 0.55; }
        var nz = p.z + p.vz * dt;
        if (!collides(p.x, p.y, nz)) p.z = nz; else if (p.onGround && !flying && !collides(p.x, p.y + 0.55, nz) && !collides(p.x, p.y + 0.55, p.z)) { p.z = nz; p.y += 0.55; }
        var ny = p.y + p.vy * dt;
        if (!collides(p.x, ny, p.z)) { p.y = ny; p.onGround = false; }
        else { if (p.vy < 0) { p.onGround = true; if (flying && !space) state.flying = false; state.landed(p); } p.vy = 0; }
        p.x = Math.max(0.35, Math.min(S - 0.35, p.x)); p.z = Math.max(0.35, Math.min(S - 0.35, p.z));
        if (p.y < (state.dim === "sky" ? 2 : -10)) { if (state.dim === "sky") state.say("Boşluğa düştün."); p.x = w.spawn.x; p.y = w.spawn.y + 8; p.z = w.spawn.z; p.vy = 0; p.peak = p.y; }
        state.hud.depth = Math.max(0, Math.round(w.heightAt(Math.floor(p.x), Math.floor(p.z)) - p.y));
        // the chunks around the player are made ahead of the walk, two at most each frame, and the visited ones are remembered
        w.ensureAround(Math.floor(p.x), Math.floor(p.z), LOAD, 2);
        var key = (Math.floor(p.z) >> 4) * N + (Math.floor(p.x) >> 4);
        if (!state.visited[key]) { state.visited[key] = true; state.hud.explored++; }
        state.chunk = { x: Math.floor(p.x) >> 4, z: Math.floor(p.z) >> 4 };
        if (spec.time === "cycle") state.time = (state.time + dt / 180) % 1;
        state.time0 += dt;
        state.grow(dt);
        state.vitals(dt);
        state.portalStep(dt);
        state.updateMobs(dt);
        state.heroHooks.forEach(function (h) { h(p, dt); });
      };
      state.time0 = 0;
      state.daylight = function () {
        if (state.dim === "nether") return 0.3;   // always dim, lit only by the lava and the glowing stone
        if (spec.time === "day") return 1;
        if (spec.time === "night") return 0.18;
        return Math.max(0.18, Math.min(1, 0.59 + 0.6 * Math.cos(state.time * Math.PI * 2)));   // 1 at noon (time 0), dark at midnight (0.5)
      };

      // ---- the picture: RW x RH rays drawn into a small image and scaled up ----
      var buffer = typeof Uint8ClampedArray !== "undefined" ? new Uint8ClampedArray(RW * RH * 4) : [];
      void buffer;
      function render(out) {
        var e = eye(), d = look(), light = state.dim === "nether" ? 0.62 : state.daylight(), p = state.p;
        var rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
        var ux = -Math.sin(p.yaw) * Math.sin(p.pitch), uy = Math.cos(p.pitch), uz = Math.cos(p.yaw) * Math.sin(p.pitch);
        var scale = Math.tan(0.62), aspect = RW / RH;
        var skyR = 110 * light + 8, skyG = 170 * light + 10, skyB = 235 * light + 25;
        if (state.dim === "nether") { skyR = 80; skyG = 16; skyB = 12; }
        var inWater = get(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) === WATER;
        var shade = [1, 0.82, 0.55];
        for (var j = 0; j < RH; j++) for (var i = 0; i < RW; i++) {
          var sx = ((i + 0.5) / RW * 2 - 1) * scale * aspect, sy = (1 - (j + 0.5) / RH * 2) * scale;
          var dx = d.x + rx * sx + ux * sy, dy = d.y + uy * sy, dz = d.z + rz * sx + uz * sy;
          var inv2 = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz); dx *= inv2; dy *= inv2; dz *= inv2;
          var r = skyR, gg = skyG, bb = skyB, k = (j * RW + i) * 4; state.depth[j * RW + i] = 1e9;
          if (cast(e.x, e.y, e.z, dx, dy, dz, FAR, false, inWater)) {
            state.depth[j * RW + i] = hit.t; var tex = texture(hit.b, hit.face), u, v;
            if (hit.face === 1) { u = hit.nx !== 0 ? hit.hz : hit.hx; v = 1 - hit.hy; } else { u = hit.hx; v = hit.hz; }
            u = Math.floor((u - Math.floor(u)) * 16); v = Math.floor((v - Math.floor(v)) * 16);
            var o = (v * 16 + u) * 3, sh = shade[hit.face] * (0.25 + 0.75 * light) * (hit.nx !== 0 ? 0.92 : 1), fog = Math.min(1, hit.t / FAR);
            fog = fog * fog * 0.85;
            r = tex[o] * sh * (1 - fog) + skyR * fog; gg = tex[o + 1] * sh * (1 - fog) + skyG * fog; bb = tex[o + 2] * sh * (1 - fog) + skyB * fog;
            if (hit.b === WATER) { r = r * 0.7; gg = gg * 0.8; }
            if (hit.b === LAVA) { r = tex[o]; gg = tex[o + 1]; bb = tex[o + 2]; }   // lava glows, night does not darken it
          } else if (dy < -0.05) { r = 20; gg = 20; bb = 30; }
          if (inWater) { r *= 0.55; gg *= 0.75; bb = bb * 0.9 + 30; }
          out[k] = r; out[k + 1] = gg; out[k + 2] = bb; out[k + 3] = 255;
        }
        state.drawMobs(out, e, d, rx, rz, ux, uy, uz, scale, aspect, light);
        return out;
      }
      // creatures and arrows are flat pictures that always face you, hidden behind blocks by the depth of the picture
      state.depth = new Float32Array(RW * RH);
      state.drawMobs = function (out, e, d, rx, rz, ux, uy, uz, scale, aspect, light) {
        var list = state.mobs.map(function (m) { var t = M.TYPES[m.type], vx = m.x - e.x, vy = m.y + t.h / 2 - e.y, vz = m.z - e.z; return { m: m, t: t, vx: vx, vy: vy, vz: vz, dist: Math.sqrt(vx * vx + vy * vy + vz * vz) }; });
        list.sort(function (a, b) { return b.dist - a.dist; });
        var shadeM = 0.35 + 0.65 * light;
        list.forEach(function (it) {
          var cz = it.vx * d.x + it.vy * d.y + it.vz * d.z; if (cz < 0.4 || cz > FAR) return;
          var cx = it.vx * rx + it.vz * rz, cy = it.vx * ux + it.vy * uy + it.vz * uz, sxN = cx / (cz * scale * aspect), syN = cy / (cz * scale);
          if (Math.abs(sxN) > 1.6 || Math.abs(syN) > 1.6) return;
          var art = M.ART[it.m.type], cols = art.rows[0].length, nrows = art.rows.length, hPx = it.t.h / (cz * scale) * 0.5 * RH, wPx = hPx * cols / nrows;
          var pxC = (sxN * 0.5 + 0.5) * RW, pyC = (0.5 - syN * 0.5) * RH, x0 = Math.floor(pxC - wPx / 2), x1 = Math.ceil(pxC + wPx / 2), y0 = Math.floor(pyC - hPx / 2), y1 = Math.ceil(pyC + hPx / 2);
          for (var sy = Math.max(0, y0); sy < Math.min(RH, y1); sy++) for (var sx = Math.max(0, x0); sx < Math.min(RW, x1); sx++) {
            if (it.dist >= state.depth[sy * RW + sx]) continue;
            var col = art.pal[art.rows[Math.min(nrows - 1, Math.floor((sy - y0) / (y1 - y0) * nrows))].charAt(Math.min(cols - 1, Math.floor((sx - x0) / (x1 - x0) * cols)))];
            if (!col) continue;
            var k = (sy * RW + sx) * 4, rr = col[0] * shadeM, gg2 = col[1] * shadeM, bb2 = col[2] * shadeM;
            if (it.m.flash > 0 || (it.m.fuse > 0 && Math.floor(it.m.fuse * 8) % 2)) { rr = 255; gg2 = gg2 * 0.4 + 40; bb2 = bb2 * 0.4 + 40; }   // hit: red; about to blow: flashing
            out[k] = rr; out[k + 1] = gg2; out[k + 2] = bb2; out[k + 3] = 255;
          }
        });
        state.arrows.forEach(function (a) {
          var vx = a.x - e.x, vy = a.y - e.y, vz = a.z - e.z, cz = vx * d.x + vy * d.y + vz * d.z; if (cz < 0.4) return;
          var px = Math.floor(((vx * rx + vz * rz) / (cz * scale * aspect) * 0.5 + 0.5) * RW), py = Math.floor((0.5 - (vx * ux + vy * uy + vz * uz) / (cz * scale) * 0.5) * RH);
          for (var ax = 0; ax < 2; ax++) for (var ay = 0; ay < 2; ay++) { var qx = px + ax, qy = py + ay; if (qx >= 0 && qy >= 0 && qx < RW && qy < RH) { var kk = (qy * RW + qx) * 4; out[kk] = 240; out[kk + 1] = 230; out[kk + 2] = 190; out[kk + 3] = 255; } }
        });
      };
      state.render = render;

      // ---- drawing the screen: the picture, the crosshair, the hotbar, the inventory, the map ----
      var small = null, smallCtx = null, image = null;
      var icons = {};
      function tile(id, face) {   // a 16x16 canvas of a block face
        var tex = texture(id, face), cv = document.createElement("canvas"); cv.width = cv.height = 16;
        var cx = cv.getContext("2d"), im = cx.createImageData(16, 16);
        for (var i = 0; i < 256; i++) { im.data[i * 4] = tex[i * 3]; im.data[i * 4 + 1] = tex[i * 3 + 1]; im.data[i * 4 + 2] = tex[i * 3 + 2]; im.data[i * 4 + 3] = 255; }
        cx.putImageData(im, 0, 0); return cv;
      }
      function iconOf(id) {   // 32x32: a little cube for a block, a pixel-art picture for a tool or a material
        if (typeof document === "undefined") return null;
        if (icons[id] !== undefined) return icons[id];
        var cv = document.createElement("canvas"); cv.width = cv.height = 32;
        var cx = cv.getContext("2d");
        if (!cx) return icons[id] = null;
        cx.imageSmoothingEnabled = false;
        if (D.isBlock(id) && id !== TORCH && id !== SAPLING) {   // a torch is drawn as a torch, not as a cube
          var top = tile(id, 0), side = tile(id, 1);
          cx.setTransform(1, 0.5, -1, 0.5, 16, 0); cx.drawImage(top, 0, 0);
          cx.setTransform(1, 0.5, 0, 1, 0, 8); cx.drawImage(side, 0, 0); cx.fillStyle = "rgba(0,0,0,0.22)"; cx.fillRect(0, 0, 16, 16);
          cx.setTransform(1, -0.5, 0, 1, 16, 16); cx.drawImage(side, 0, 0); cx.fillStyle = "rgba(0,0,0,0.42)"; cx.fillRect(0, 0, 16, 16);
          cx.setTransform(1, 0, 0, 1, 0, 0);
        } else {
          var ic = D.icon(id);
          if (!ic) return icons[id] = null;
          ic.rows.forEach(function (row, y) { for (var x = 0; x < 16; x++) { var col = ic.pal[row.charAt(x)]; if (col) { cx.fillStyle = "rgb(" + (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0) + ")"; cx.fillRect(x * 2, y * 2, 2, 2); } } });
        }
        return icons[id] = cv;
      }
      function drawIcon(c, id, x, y, size) {
        var ic = iconOf(id);
        if (ic) { c.imageSmoothingEnabled = false; c.drawImage(ic, x, y, size, size); } else swatch(c, id, x, y, size);
      }
      function swatch(c, id, x, y, size) {
        var col = (COLORS[id] || [[255, 0, 255]])[0];
        c.fillStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")"; c.fillRect(x, y, size, size);
        c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x, y + size * 0.65, size, size * 0.35);
      }
      function drawHud(c) {
        c.fillStyle = "#fff"; c.fillRect(g.width / 2 - 8, g.height / 2 - 1, 16, 2); c.fillRect(g.width / 2 - 1, g.height / 2 - 8, 2, 16);
        var all = state.hotbar(), start = state.windowStart(), bar = all.slice(start, start + 9), slot = 38, x0 = g.width / 2 - 9 * slot / 2, y0 = g.height - slot - 8;
        if (state.mining && state.mining.need > 0 && state.mining.progress > 0) {   // the block being dug
          c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(g.width / 2 - 30, g.height / 2 + 18, 60, 6);
          c.fillStyle = "#ffe082"; c.fillRect(g.width / 2 - 30, g.height / 2 + 18, 60 * Math.min(1, state.mining.progress / state.mining.need), 6);
        }
        for (var i = 0; i < 9; i++) {
          c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(x0 + i * slot, y0, slot - 3, slot - 3);
          c.strokeStyle = start + i === Math.min(state.slot, Math.max(0, all.length - 1)) && all.length ? "#fff" : "rgba(255,255,255,0.3)"; c.lineWidth = start + i === state.slot ? 3 : 1;
          c.strokeRect(x0 + i * slot, y0, slot - 3, slot - 3);
          if (bar[i]) {
            drawIcon(c, bar[i], x0 + i * slot + 4, y0 + 2, slot - 9);
            c.fillStyle = "#fff"; c.font = "12px sans-serif"; c.fillText(state.creative ? "∞" : String(inv.count[bar[i]]), x0 + i * slot + 4, y0 + slot - 7);
          }
          c.fillStyle = "rgba(255,255,255,0.7)"; c.font = "10px sans-serif"; c.fillText(String(i + 1), x0 + i * slot + 3, y0 + 11);
        }
        if (state.nameT > 0 && state.selectedBlock()) { c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(g.width / 2 - 90, y0 - 52, 180, 24); c.fillStyle = "#fff"; c.font = "bold 16px sans-serif"; c.textAlign = "center"; c.fillText(NAMES[state.selectedBlock()], g.width / 2, y0 - 34); c.textAlign = "left"; }
        var armor = state.armorPoints(), mobLook = state.mobTarget();
        for (var ai2 = 0; ai2 < Math.ceil(armor / 2); ai2++) { c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(g.width / 2 - 9 * slot / 2 + ai2 * 15, y0 - 31, 13, 12); c.fillStyle = armor - ai2 * 2 >= 2 ? "#cfd8dc" : "#78909c"; c.fillRect(g.width / 2 - 9 * slot / 2 + ai2 * 15 + 2, y0 - 29, 9, 8); }
        if (mobLook) { c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(g.width / 2 - 60, g.height / 2 - 46, 120, 20); c.fillStyle = "#fff"; c.font = "13px sans-serif"; c.textAlign = "center"; c.fillText(K.voxelmobs.TYPES[mobLook.type].name + "  " + Math.max(0, Math.ceil(mobLook.hp)) + "/" + K.voxelmobs.TYPES[mobLook.type].hp, g.width / 2, g.height / 2 - 32); c.textAlign = "left"; }
        var hx = g.width / 2 - 9 * slot / 2, hy = y0 - 16;   // hearts on the left, hunger on the right, air bubbles above it when swimming
        for (var hi = 0; hi < 10; hi++) {
          var pts = Math.max(0, Math.min(2, state.health - hi * 2));
          c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(hx + hi * 15, hy, 13, 12);
          c.fillStyle = pts === 2 ? "#e53935" : pts === 1 ? "#ef9a9a" : "rgba(60,0,0,0.6)"; c.fillRect(hx + hi * 15 + 2, hy + 2, 9, 8);
          var fp = Math.max(0, Math.min(2, state.food - hi * 2)), fx = hx + 9 * slot - 14 - hi * 15;
          c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(fx, hy, 13, 12);
          c.fillStyle = fp === 2 ? "#ef9d36" : fp === 1 ? "#d9b27c" : "rgba(60,40,0,0.6)"; c.fillRect(fx + 2, hy + 2, 9, 8);
        }
        if (state.air < 10) for (var ai = 0; ai < Math.ceil(state.air); ai++) { c.fillStyle = "#81d4fa"; c.fillRect(hx + 9 * slot - 14 - ai * 15 + 3, hy - 14, 8, 8); }
        if (state.hurtFlash > 0) { c.fillStyle = "rgba(200,0,0," + Math.min(0.45, state.hurtFlash) + ")"; c.fillRect(0, 0, g.width, g.height); }
        if (state.message) { c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(g.width / 2 - 230, 118, 460, 28); c.fillStyle = "#fff"; c.font = "15px sans-serif"; c.fillText(state.message, g.width / 2 - 220, 138); }
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
            drawIcon(c, id, cx, cy - 2, 22); c.fillStyle = "#fff"; c.font = "14px sans-serif"; c.fillText(NAMES[id] + "  x" + (state.creative ? "∞" : inv.count[id]), cx + 28, cy + 14);
          });
        }
        if (state.showCraft) {
          c.fillStyle = "rgba(0,0,0,0.82)"; c.fillRect(g.width / 2 - 200, 40, 400, 270);
          c.fillStyle = "#fff"; c.font = "15px sans-serif"; c.fillText("TARİFLER  (yukarı/aşağı seç, Enter yap, X kapat)", g.width / 2 - 188, 64);
          var page = state.craftPage();
          state.recipes.slice(page, page + 8).forEach(function (r, n) {
            var ok = state.canCraft(r), at = page + n === state.craftCursor, where = r.where === "table" ? "masa" : r.where === "furnace" ? "fırın" : "";
            if (at) { c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(g.width / 2 - 192, 74 + n * 28, 384, 26); }
            drawIcon(c, r.give[0], g.width / 2 - 190, 76 + n * 28, 22);
            c.fillStyle = ok ? "#a5d6a7" : "#8a8a8a"; c.font = "13px sans-serif";
            c.fillText((n + 1) + ". " + r.name + "  [" + r.need.map(function (q) { return q[1] + " " + NAMES[q[0]]; }).join(" + ") + "] " + (where ? "(" + where + ")" : ""), g.width / 2 - 160, 92 + n * 28);
          });
          c.fillStyle = "#cfd8dc"; c.font = "12px sans-serif"; c.fillText("sayfa " + (page / 8 + 1) + "/" + Math.ceil(state.recipes.length / 8) + "   kömür yakıt: " + (state.fuel || 0) + " eritme hakkı", g.width / 2 - 186, 300);
        }
        if (state.showAch) {
          var done = D.ACH.filter(function (a) { return state.ach[a.id]; }).length;
          c.fillStyle = "rgba(0,0,0,0.85)"; c.fillRect(g.width / 2 - 230, 36, 460, 320);
          c.fillStyle = "#fff"; c.font = "16px sans-serif"; c.fillText("BAŞARIMLAR  " + done + "/" + D.ACH.length + "   (B kapatır)", g.width / 2 - 215, 62);
          D.ACH.forEach(function (a, n) {
            var col = n % 2, row = Math.floor(n / 2), ok = !!state.ach[a.id];
            c.fillStyle = ok ? "#ffd54f" : "#6f6f6f"; c.font = "bold 13px sans-serif"; c.fillText((ok ? "★ " : "☆ ") + a.name, g.width / 2 - 215 + col * 225, 88 + row * 26);
            c.fillStyle = ok ? "#cfd8dc" : "#555"; c.font = "11px sans-serif"; c.fillText(a.desc, g.width / 2 - 197 + col * 225, 101 + row * 26);
          });
        }
        if (state.showHelp) {
          c.fillStyle = "rgba(0,0,0,0.8)"; c.fillRect(g.width / 2 - 190, 50, 380, 250);
          c.fillStyle = "#fff"; c.font = "14px sans-serif";
          ["KONTROLLER", "W A S D  yürü       Boşluk  zıpla       Shift  koş", "Fare ya da oklar  bak (önce sayfaya tıkla)", "Sol tık / F  blok kır        Sağ tık / E  blok koy",
           "Tekerlek / Q / 1-9  blok seç", "I  envanter   X  tarifler (yukarı/aşağı, Enter)   B  başarımlar   C  yaratıcı mod", "Kazarken en iyi aletin kullanılır; masa ve fırın yakında olmalı", "G ya da Boşluk'a iki kez bas  uç (uçma özelliğiyle)", "H  bu yardımı kapat"].forEach(function (line, n) {
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
        if (state.menu.open) drawMenu(c); else drawHud(c);
      } }];
      state.drawHud = drawHud; state.icon = iconOf;

      // ---- the mouse (it looks when the page has the pointer; left click breaks and keeps breaking, right click places, the wheel chooses) ----
      var mouseLeft = false;
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) {
        var canvas = g.canvas;
        canvas.addEventListener("click", function () { if (!state.menu.open && canvas.requestPointerLock && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (e) { /* no lock: keys still work */ } } });
        document.addEventListener("pointerlockchange", function () { if (document.pointerLockElement !== canvas && !state.menu.open && g.current === "play" && state.menuStarted) state.openMenu("pause"); });   // Esc gives the mouse back: the pause menu opens
        document.addEventListener("mousemove", function (e) { if (document.pointerLockElement === canvas && !state.menu.open) state.look(e.movementX * 0.0025, e.movementY * 0.0025); });
        canvas.addEventListener("mousedown", function (e) {
          if (e.button === 0) mouseLeft = true; else if (e.button === 2) state.placeBlock();
        });
        document.addEventListener("mouseup", function (e) { if (e.button === 0) mouseLeft = false; });
        canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
        canvas.addEventListener("wheel", function (e) { e.preventDefault(); if (state.showCraft) state.menuMove(e.deltaY > 0 ? 1 : -1); else state.select(state.slot + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
      }

      var held = {};
      function once(key, fn) { var now = K.key(key); if (now && !held[key]) { held[key] = true; fn(); } else if (!now) held[key] = false; }
      g.scene("play", {
        update: function (game, dt) {
          if (state.menu.open) { state.menuUpdate(dt); return; }
          once("Escape", function () { state.openMenu("pause"); });
          state.step(dt);
          once("e", state.placeBlock); once("q", function () { state.select(state.slot + 1); });
          once("i", function () { state.showInv = !state.showInv; }); once("Tab", function () { state.showInv = !state.showInv; });
          once("c", function () { state.setCreative(!state.creative); }); once("h", function () { state.showHelp = !state.showHelp; });
          once("g", function () { if (state.canFly) state.flying = !state.flying; });
          once("x", function () { state.showCraft = !state.showCraft; });
          once("b", function () { state.showAch = !state.showAch; });
          once("ArrowUp", function () { if (state.showCraft) state.menuMove(-1); }); once("ArrowDown", function () { if (state.showCraft) state.menuMove(1); });
          once("Enter", function () { if (state.showCraft) state.craft(state.craftCursor); });
          for (var n = 1; n <= 9; n++) (function (num) { once(String(num), function () { if (state.showCraft) state.craft(state.craftPage() + num - 1); else state.select(state.windowStart() + num - 1); }); })(n);
          var cur = state.selectedBlock(); if (cur !== state.lastSel) { state.lastSel = cur; state.nameT = 2; } state.nameT -= dt;
          state.mineStep(dt, K.key("f") || mouseLeft);   // holding F or the left button digs
          var ch = state.chunk || { x: 0, z: 0 };
          g.ui.text("hud.info", "parça " + ch.x + "," + ch.z + "   gezdin " + state.hud.explored + "/" + N * N + "   derinlik " + state.hud.depth + (state.flying ? "   UÇUYOR" : ""), 10, 22, { size: 14 });
          g.ui.text("hud.block", "BLOK: " + (state.selectedBlock() ? NAMES[state.selectedBlock()] : "yok") + "   kırdın " + state.hud.broken + "  koydun " + state.hud.placed, 10, 42, { size: 13, color: "#cfd8dc" });
          g.ui.text("hud.keys", "H yardım  I envanter  X tarifler  B başarım", g.width - 220, 22, { size: 12, color: "#cfd8dc" });
          var locked = typeof document !== "undefined" && g.canvas && document.pointerLockElement === g.canvas;
          if (typeof document !== "undefined" && g.canvas && !locked && !state.showCraft && !state.showInv && !state.showHelp) g.ui.text("hud.lock", "Fareyle bakmak için ekrana tıkla", g.width / 2 - 110, 70, { size: 14, color: "#ffe082" });
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
