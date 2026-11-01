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
  var FARMLAND = 16, CROP1 = 17, CROP3 = 19, SEEDS = 20, WHEAT = 21, BREAD = 23, CROP_SECONDS = 25, BED = 35, LAVA = 37, SAPLING = 38, APPLE = 120, TREE_SECONDS = 40, FENCE = 140, DOOR_LO = 141, DOOR_HI = 142, DOOR_ITEM = 143, LADDER = 149, ENCH_TABLE = 162, CACTUS_ID = 15, HAY = 127, CHEST = 26, SANDSTONE = 29, COBBLE = 27, GOLD_BLOCK = 31, GOLD_INGOT_ID = 43, IRON_INGOT_ID = 42, LAPIS_ORE = 156, REDSTONE_ORE = 157, EMERALD_ORE = 158, PORTAL = 150, OBSIDIAN = 151, LIGHTER = 152, NETHERRACK = 153, GLOWSTONE = 154;
  var TABLE = 24, FURNACE = 25, TORCH = 33, COAL_ITEM = 41;   // (the coal you carry: COAL above is the ore in the ground)   // crops are blocks 17-19 (young to ripe), 20 and up are things you carry
  var BIOMES = { forest: { top: GRASS, trees: 1, amp: 5 }, plains: { top: GRASS, trees: 0.2, amp: 3 }, desert: { top: SAND, trees: 0.6, amp: 4 }, snow: { top: SNOW, trees: 0.5, amp: 6 } };
  var SIZES = { small: 8, medium: 16, large: 32 };   // chunks on a side
  var CH = 16, SY = 32, SEA = 9, RW = 256, RH = 160, REACH = 5, FAR = 36, LOAD = 3;

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
    // ores lie in veins (blobs), at the depths of the 1.8.9 game scaled to a world 32 high: coal and iron nearly everywhere, kızıltaş and gold low,
    // lapis lower, diamonds only at the very bottom next to the lava; the zümrüt (emerald) is single and only under tall hills
    var ORE_VEINS = [[COAL, 5, 1, 2.4, 1, 15], [IRON, 4, 1, 1.9, 1, 13], [REDSTONE_ORE, 2, 1, 1.7, 1, 6], [GOLD, 2, 0.7, 1.5, 1, 8], [LAPIS_ORE, 1, 0.8, 1.6, 2, 9], [DIAMOND, 1, 0.8, 1.4, 1, 5]];
    var isRock = function (b) { return b === STONE || (b >= 121 && b <= 123); };
    function placeVeins(blocks, hm, cx, cz, at) {
      if (ores <= 0) return;
      var rich = 0.5 + ores * 0.5, tallest = 0;
      for (var i = 0; i < hm.length; i++) if (hm[i] > tallest) tallest = hm[i];
      ORE_VEINS.forEach(function (v, vi) {
        var attempts = Math.max(1, Math.round(v[1] * rich * 0.67));
        for (var a = 0; a < attempts; a++) {
          if (hash(seed + 300 + vi, cx, a, cz) > v[2]) continue;
          var lx0 = 3 + Math.floor(hash(seed + 310 + vi, cx, a, cz) * 10), lz0 = 3 + Math.floor(hash(seed + 320 + vi, cz, a, cx) * 10);
          var y0 = v[4] + Math.floor(hash(seed + 330 + vi, cx + a, 7, cz) * (v[5] - v[4] + 1)), r = v[3] * (0.75 + 0.25 * hash(seed + 350 + vi, a, cx, cz));
          for (var dx = -3; dx <= 3; dx++) for (var dy = -3; dy <= 3; dy++) for (var dz = -3; dz <= 3; dz++) {
            if (dx * dx + dy * dy + dz * dz > r * r || hash(seed + 340 + vi, (cx * CH + lx0 + dx) * 3 + dy, dy + 9, cz * CH + lz0 + dz) > 0.82) continue;
            var yy = y0 + dy; if (yy < 1 || yy >= SY) continue;
            var cell = at(lx0 + dx, yy, lz0 + dz);
            if (isRock(blocks[cell])) blocks[cell] = v[0];
          }
        }
      });
      if (tallest >= 14) for (var e = 0; e < 3; e++) {   // emeralds: single blocks inside the rock under tall ground
        if (hash(seed + 360, cx, e, cz) > 0.5) continue;
        var ex = 2 + Math.floor(hash(seed + 361, cx, e, cz) * 12), ez = 2 + Math.floor(hash(seed + 362, cz, e, cx) * 12), top = hm[ez * CH + ex], ey = 4 + Math.floor(hash(seed + 363, cx, e, cz) * Math.max(1, top - 8));
        if (top >= 14 && isRock(blocks[at(ex, ey, ez)])) blocks[at(ex, ey, ez)] = EMERALD_ORE;
      }
    }
    // ---- structures: villages (a well, paths, houses, farms, hay) and desert temples, placed from the seed by regions of 8x8 chunks, so the same world has them again ----
    var REGION = 128, structCache = {}, VILLAGE_R = 27, TEMPLE_R = 14, structuresOn = o.structures !== undefined ? o.structures : K.voxel.structures !== false;   // the tests turn them off, they make the ground uneven to count on
    var HOUSE_SLOTS = [[-18, -11, true], [-10, -11, true], [3, -11, true], [11, -11, true], [-18, 4, false], [-10, 4, false], [3, 4, false], [11, 4, false]];
    function buildVillage(c, rx, rz) {
      var v = { x: c.x, z: c.z, gy: c.gy, houses: [], farms: [], spots: [], desert: o.biome === "desert" };
      HOUSE_SLOTS.forEach(function (sl, i) { if (i < 4 || hash(seed + 540, rx, i, rz) > 0.3) v.houses.push({ x: v.x + sl[0], z: v.z + sl[1], north: sl[2], chest: hash(seed + 541, rx, i, rz) < 0.4 }); });
      [[-16, 13], [6, 13]].forEach(function (f, i) { if (i === 0 || hash(seed + 545, rx, i, rz) > 0.3) v.farms.push({ x: v.x + f[0], z: v.z + f[1] }); });
      v.houses.forEach(function (h) { v.spots.push({ x: h.x + 2, z: h.north ? h.z + 7 : h.z - 2 }); });
      v.spots.push({ x: v.x + 3, z: v.z + 2 }, { x: v.x - 3, z: v.z - 2 });
      return v;
    }
    function villageIn(rx, rz) {
      var key = "v" + rx + "," + rz; if (key in structCache) return structCache[key];
      var v = null;
      if (structuresOn && dim === "over" && o.biome !== "snow" && hash(seed + 500, rx, 0, rz) < 0.8) {
        var best = null, bestScore = 1e9;
        for (var k = 0; k < 6; k++) {
          var vx = rx * REGION + 30 + Math.floor(hash(seed + 501 + k, rx, k, rz) * (REGION - 60)), vz = rz * REGION + 30 + Math.floor(hash(seed + 521 + k, rz, k, rx) * (REGION - 60));
          if (vx < 30 || vz < 30 || vx > S - 30 || vz > S - 30) continue;
          var hs = [surface(vx, vz), surface(vx + 14, vz), surface(vx - 14, vz), surface(vx, vz + 14), surface(vx, vz - 14), surface(vx + 20, vz + 20), surface(vx - 20, vz - 20)];
          var lo = Math.min.apply(null, hs), hi = Math.max.apply(null, hs), score = (hi - lo) + (lo <= SEA ? 8 : 0);
          if (score < bestScore) { bestScore = score; best = { x: vx, z: vz, gy: Math.max(SEA + 1, hs[0]) }; }
        }
        if (best) v = buildVillage(best, rx, rz);
      }
      structCache[key] = v; return v;
    }
    function templeIn(rx, rz) {
      var key = "t" + rx + "," + rz; if (key in structCache) return structCache[key];
      var t = null;
      if (structuresOn && dim === "over" && o.biome === "desert" && hash(seed + 600, rx, 0, rz) < 0.75) {
        var tx = rx * REGION + 22 + Math.floor(hash(seed + 601, rx, 1, rz) * (REGION - 44)), tz = rz * REGION + 22 + Math.floor(hash(seed + 602, rz, 1, rx) * (REGION - 44));
        var v = villageIn(rx, rz);
        if (tx > 22 && tz > 22 && tx < S - 22 && tz < S - 22 && (!v || Math.abs(v.x - tx) + Math.abs(v.z - tz) > 48)) t = { x: tx, z: tz, gy: Math.max(SEA + 1, surface(tx, tz)) };
      }
      structCache[key] = t; return t;
    }
    w.villages = function () { var out = []; for (var rx = 0; rx * REGION < S; rx++) for (var rz = 0; rz * REGION < S; rz++) { var v = villageIn(rx, rz); if (v) out.push(v); } return out; };
    w.temples = function () { var out = []; for (var rx = 0; rx * REGION < S; rx++) for (var rz = 0; rz * REGION < S; rz++) { var t = templeIn(rx, rz); if (t) out.push(t); } return out; };
    function structuresNear(cx, cz, radius) {   // the villages and temples whose area touches the chunk
      var out = { villages: [], temples: [] }, x0 = cx * CH - radius, x1 = cx * CH + CH + radius, z0 = cz * CH - radius, z1 = cz * CH + CH + radius;
      var rxa = Math.max(0, Math.floor(x0 / REGION)), rxb = Math.floor(x1 / REGION), rza = Math.max(0, Math.floor(z0 / REGION)), rzb = Math.floor(z1 / REGION);
      for (var rx = rxa; rx <= rxb; rx++) for (var rz = rza; rz <= rzb; rz++) {
        var v = villageIn(rx, rz), t = templeIn(rx, rz);
        if (v && v.x > x0 - 1 && v.x < x1 + 1 && v.z > z0 - 1 && v.z < z1 + 1) out.villages.push(v);
        if (t && t.x > x0 - 1 && t.x < x1 + 1 && t.z > z0 - 1 && t.z < z1 + 1) out.temples.push(t);
      }
      return out;
    }
    w.inStructure = function (x, z) { var n = structuresNear(x >> 4, z >> 4, VILLAGE_R + 2); return n.villages.some(function (v) { return (x - v.x) * (x - v.x) + (z - v.z) * (z - v.z) <= (VILLAGE_R + 2) * (VILLAGE_R + 2); }) || n.temples.some(function (t) { return Math.abs(x - t.x) <= TEMPLE_R && Math.abs(z - t.z) <= TEMPLE_R; }); };
    w.villageSpots = function (cx, cz) { var out = []; structuresNear(cx, cz, VILLAGE_R + 2).villages.forEach(function (v) { v.spots.forEach(function (sp) { if (sp.x >> 4 === cx && sp.z >> 4 === cz) out.push({ x: sp.x + 0.5, z: sp.z + 0.5, gy: v.gy, id: v.x * 7 + v.z + sp.x }); }); }); return out; };
    function flatten(blocks, hm, cx, cz, at, area, gy, top) {   // the ground of the area is made level at gy
      for (var lx = 0; lx < CH; lx++) for (var lz = 0; lz < CH; lz++) {
        if (!area(cx * CH + lx, cz * CH + lz)) continue;
        var old = hm[lz * CH + lx], y;
        for (y = Math.max(0, Math.min(old, gy) - 3); y <= gy; y++) if (y > old - 1 || blocks[at(lx, y, lz)] === AIR || blocks[at(lx, y, lz)] === WATER) blocks[at(lx, y, lz)] = y === gy ? top : DIRT;
        blocks[at(lx, gy, lz)] = top;
        for (y = gy + 1; y < SY; y++) blocks[at(lx, y, lz)] = AIR;
        hm[lz * CH + lx] = gy;
      }
    }
    function stampStructures(blocks, hm, cx, cz, at) {
      var near = structuresNear(cx, cz, VILLAGE_R + 1);
      var put = function (x, y, z, b) { var lx = x - cx * CH, lz = z - cz * CH; if (lx < 0 || lz < 0 || lx >= CH || lz >= CH || y < 0 || y >= SY) return; blocks[at(lx, y, lz)] = b; };
      near.villages.forEach(function (v) {
        var gy = v.gy, top = v.desert ? SAND : GRASS, wall = v.desert ? SANDSTONE : PLANKS, post = v.desert ? SANDSTONE : LOG, roof = v.desert ? SANDSTONE : PLANKS, i, j, y;
        flatten(blocks, hm, cx, cz, at, function (x, z) { return (x - v.x) * (x - v.x) + (z - v.z) * (z - v.z) <= VILLAGE_R * VILLAGE_R; }, gy, top);
        for (i = -22; i <= 22; i++) for (j = 0; j <= 1; j++) { put(v.x + i, gy, v.z + j, COBBLE); put(v.x + j, gy, v.z + i, COBBLE); }   // the paths
        for (i = -1; i <= 1; i++) for (j = -1; j <= 1; j++) {   // the well
          if (i === 0 && j === 0) { put(v.x, gy, v.z, WATER); put(v.x, gy - 1, v.z, WATER); continue; }
          put(v.x + i, gy, v.z + j, COBBLE); put(v.x + i, gy + 1, v.z + j, i !== 0 && j !== 0 ? FENCE : COBBLE);
          if (i !== 0 && j !== 0) put(v.x + i, gy + 2, v.z + j, FENCE);
        }
        for (i = -1; i <= 1; i++) for (j = -1; j <= 1; j++) put(v.x + i, gy + 3, v.z + j, roof);
        v.houses.forEach(function (h) {
          for (i = 0; i < 6; i++) for (j = 0; j < 6; j++) {
            var edge = i === 0 || i === 5 || j === 0 || j === 5, corner = (i === 0 || i === 5) && (j === 0 || j === 5);
            put(h.x + i, gy, h.z + j, edge ? COBBLE : PLANKS);
            for (y = 1; y <= 3; y++) put(h.x + i, gy + y, h.z + j, corner ? post : edge ? wall : AIR);
            put(h.x + i, gy + 4, h.z + j, roof);
          }
          var dj = h.north ? 5 : 0, wj = h.north ? 0 : 5;
          put(h.x + 2, gy + 1, h.z + dj, DOOR_LO); put(h.x + 2, gy + 2, h.z + dj, DOOR_HI);   // the door on the side of the path
          [2, 3].forEach(function (k) { put(h.x, gy + 2, h.z + k, GLASS); put(h.x + 5, gy + 2, h.z + k, GLASS); });
          put(h.x + 3, gy + 2, h.z + wj, GLASS); put(h.x + 4, gy + 2, h.z + wj, GLASS);
          put(h.x + 4, gy + 1, h.z + (h.north ? 1 : 4), BED); put(h.x + 1, gy + 1, h.z + (h.north ? 1 : 4), TORCH); put(h.x + 1, gy + 1, h.z + (h.north ? 4 : 1), TABLE);
          if (h.chest) put(h.x + 4, gy + 1, h.z + (h.north ? 4 : 1), CHEST);
        });
        v.farms.forEach(function (f) {
          for (i = 0; i < 9; i++) for (j = 0; j < 6; j++) {
            if (j === 2) { put(f.x + i, gy, f.z + j, WATER); continue; }
            put(f.x + i, gy, f.z + j, FARMLAND); put(f.x + i, gy + 1, f.z + j, CROP3);
          }
        });
        [[-4, -13, 2], [-3, -13, 2], [-4, -12, 1], [-6, 12, 2], [-6, 13, 1], [14, 12, 1]].forEach(function (b) { for (y = 1; y <= b[2]; y++) put(v.x + b[0], gy + y, v.z + b[1], HAY); });   // hay bales
        [[-4, -2], [4, 3], [-4, 3], [4, -2]].forEach(function (l) { put(v.x + l[0], gy + 1, v.z + l[1], FENCE); put(v.x + l[0], gy + 2, v.z + l[1], FENCE); put(v.x + l[0], gy + 3, v.z + l[1], TORCH); });
      });
      near.temples.forEach(function (t) {
        var gy = t.gy, i, j, y;
        flatten(blocks, hm, cx, cz, at, function (x, z) { return Math.abs(x - t.x) <= TEMPLE_R && Math.abs(z - t.z) <= TEMPLE_R; }, gy, SAND);
        for (y = 0; y <= 9; y++) for (i = -10 + y; i <= 10 - y; i++) for (j = -10 + y; j <= 10 - y; j++) put(t.x + i, gy + y, t.z + j, SANDSTONE);   // the pyramid
        for (i = -3; i <= 3; i++) for (j = -3; j <= 3; j++) for (y = 1; y <= 4; y++) put(t.x + i, gy + y, t.z + j, AIR);   // the chamber
        for (j = 4; j <= 10; j++) for (i = -1; i <= 1; i++) for (y = 1; y <= 2; y++) put(t.x + i, gy + y, t.z + j, AIR);   // the way in, from the south
        for (i = -3; i <= 3; i++) for (j = -3; j <= 3; j++) put(t.x + i, gy, t.z + j, (i + j) % 2 === 0 ? SANDSTONE : SAND);
        put(t.x, gy, t.z, GOLD_BLOCK);
        [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(function (c) { put(t.x + c[0], gy + 1, t.z + c[1], CHEST); });
        put(t.x, gy + 1, t.z, TORCH);
      });
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
        }
      }
      if (dim === "over") placeVeins(blocks, hm, cx, cz, at);
      if (dim === "over") stampStructures(blocks, hm, cx, cz, at);
      for (lx = 2; lx < CH - 2; lx++) for (lz = 2; lz < CH - 2; lz++) {   // trees stay inside their chunk (leaves reach 2 blocks)
        var gx = cx * CH + lx, gz = cz * CH + lz, ht = hm[lz * CH + lx], ground = blocks[at(lx, ht, lz)];
        if (trees <= 0 || ht <= SEA + 1 || hash(seed + 5, gx, 0, gz) > trees * 0.018 || (dim === "over" && w.inStructure(gx, gz))) continue;
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

  function cutAt(id, u, v) {   // a gap in the picture of a block: what lies behind it shows through (glass inside its frame, holes in leaves, between the stalks of a plant, between the rungs of a ladder)
    if (id === GLASS) return !(u === 0 || v === 0 || u === 15 || v === 15 || (u + v === 7 && u > 1 && u < 6) || (u + v === 9 && u > 1 && u < 5));
    if (id === LEAVES) return hash(6 * 17 + 1, u, 0, v) > 0.8;
    if (id >= 17 && id <= 19) return !((u % 4 === 1 || u % 4 === 2) && (hash(id, u, 0, v) < 0.9));
    if (id === SAPLING) return !(((u - 7.5) * (u - 7.5) / 30 + (v - 8) * (v - 8) / 22 < 1) || ((u === 7 || u === 8) && v >= 11));
    if (id === 149) return !(u < 2 || u > 13 || v % 4 === 1);
    return false;
  }
  var CUT = {}; CUT[GLASS] = CUT[LEAVES] = CUT[CROP1] = CUT[CROP1 + 1] = CUT[CROP3] = CUT[SAPLING] = CUT[149] = true;
  function texture(id, face) {   // face 0 top, 1 side, 2 bottom
    id = D.texId(id);   // a half block or a stair wears the picture of its block
    var key = id * 3 + face;
    if (textures[key]) return textures[key];
    var set = COLORS[id] || [[255, 0, 255]], base = set[Math.min(face, set.length - 1)], px = new Uint8Array(16 * 16 * 3);
    for (var v = 0; v < 16; v++) for (var u = 0; u < 16; u++) {
      var n = hash(id * 17 + face, u, 0, v), c = base, k = 0.86 + n * 0.28;
      if (id === 1 && face === 1 && v < 4) c = COLORS[1][0];
      if (((id >= 9 && id <= 12) || (id >= 156 && id <= 158)) && set.length > 1 && hash(id + 90, u >> 1, 3, v >> 1) > 0.78) c = set[1];
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
      if (id === 27) { var chunk = hash(27, u >> 2, 5, v >> 2); c = [base[0] * (0.7 + chunk * 0.5), base[1] * (0.7 + chunk * 0.5), base[2] * (0.7 + chunk * 0.5)]; if (u % 4 === 0 || v % 4 === 0) k *= 0.72; }   // cobblestone: rough chunks
      if (id === 3 && n > 0.88) k *= 0.72;   // speckled stone
      if (id === 5 && face !== 1) { var ring = Math.max(Math.abs(u - 7.5), Math.abs(v - 7.5)); k *= 0.82 + (Math.floor(ring) % 2) * 0.26; c = [172, 132, 84]; }   // the rings of a log
      if (id === 2 && n > 0.9) k *= 0.8;
      if (id === 4 && n > 0.85) k *= 1.1;
      if (id === 6) k *= 0.8 + n * 0.5;
      if (id === 8) { c = [200, 232, 244]; k = 1; if (u === 0 || v === 0 || u === 15 || v === 15) { c = [225, 245, 255]; k = 1; } }   // glass: a pale frame (its inside is see-through)
      if (id === 33) { if (face === 0) c = [255, 215, 90]; else if (v < 9) { c = hash(33, u, 1, v) > 0.5 ? [255, 210, 70] : [255, 130, 30]; k = 1.1; } else { c = [112, 78, 42]; k = 0.9 + n * 0.2; } }   // a torch: a flame on a stick
      if (id === 35) { if (face === 0) { c = v < 5 ? [240, 240, 240] : [196, 44, 44]; if (v === 5) k *= 0.7; } else if (v > 9) { c = [150, 108, 60]; } else c = [196, 44, 44]; }   // a bed: a pillow, a red blanket and wooden legs
      if (id === 26) { if (face === 1) { c = [160, 112, 54]; if (v >= 6 && v <= 8) { c = [90, 62, 30]; } if (u >= 7 && u <= 8 && v >= 6 && v <= 9) { c = [235, 200, 70]; k = 1.1; } if (u === 0 || u === 15) k *= 0.7; } else { c = [150, 104, 50]; if (u === 0 || v === 0 || u === 15 || v === 15) k *= 0.7; } }   // a chest: a band and a lock
      if (id === 15) { c = [64, 130, 52]; if (u % 4 === 1) k *= 1.2; if (face === 1 && hash(15, u, 1, v) > 0.92) c = [230, 240, 200]; if (u === 0 || u === 15) k *= 0.75; }   // a cactus: stripes and spines
      if (id === 16) { c = [92, 58, 34]; if (face === 0 && u % 4 === 0) k *= 0.7; }   // ploughed soil: furrows
      if (id >= 17 && id <= 19) { c = id === CROP1 ? [96, 172, 60] : id === CROP1 + 1 ? [150, 186, 60] : [228, 198, 74]; k = 0.9 + n * 0.3; }
      if (id === SAPLING) { c = v >= 11 ? [112, 80, 44] : [60, 150, 56]; k = 0.85 + n * 0.3; }
      if (id === 162) { c = face === 0 ? [48, 28, 90] : [60, 36, 110]; if (face === 0 && u > 4 && u < 11 && v > 4 && v < 11) { c = [60, 100, 220]; k = 1.1; } if (u === 0 || v === 0 || u === 15) k *= 0.7; }   // an enchanting table: a dark top with a blue book
      if (id === 141 || id === 142) {   // a door: a dark frame, panels, a handle, a window in the upper half
        var wood = [158, 112, 58], frame = u < 1 || u > 14 || (id === 141 && v > 14) || (id === 142 && v < 1);
        c = frame ? [88, 60, 32] : wood;
        if (!frame && id === 141) { var panel = u > 2 && u < 13 && ((v > 1 && v < 7) || (v > 8 && v < 14)); if (panel) { c = [176, 128, 70]; if (u === 3 || u === 12 || v === 2 || v === 6 || v === 9 || v === 13) k *= 0.68; } if (u >= 11 && u <= 12 && v >= 6 && v <= 7) { c = [240, 210, 90]; k = 1.1; } }
        if (!frame && id === 142) { if (u > 3 && u < 12 && v > 2 && v < 9) { c = (u === 7 || u === 8 || v === 5 || v === 6) ? [88, 60, 32] : [176, 216, 236]; k = 1; } else if (v > 10) { c = [176, 128, 70]; if (v === 11 || u === 3 || u === 12) k *= 0.68; } }
      }
      if (id === 24) {   // a crafting table: a grid on top, a hammer and a saw on the sides, dark boards under it
        c = face === 2 ? [96, 68, 38] : [176, 140, 84];
        if (face === 0) { if (u === 0 || v === 0 || u === 15 || v === 15) { c = [96, 68, 38]; } else if (u === 5 || u === 10 || v === 5 || v === 10) { c = [118, 84, 46]; } }
        else if (face === 1) {
          if (v % 4 === 3) k *= 0.8;
          if (u === 0 || u === 15) k *= 0.72;
          if (u >= 2 && u <= 6 && v >= 3 && v <= 4) c = [150, 150, 158];   // the head of a hammer
          if (u === 4 && v >= 5 && v <= 12) c = [100, 66, 34];   // its handle
          if (u >= 9 && u <= 13 && v >= 4 && v <= 9) c = (u + v) % 2 === 0 ? [214, 214, 222] : [180, 180, 190];   // the blade of a saw
          if (u >= 9 && u <= 13 && v === 10) c = [120, 84, 46];
        }
      }
      if (id === 25 && face === 1 && u > 3 && u < 12 && v > 6 && v < 13) k *= 0.35;   // the furnace mouth
      if (id === 26 && face === 1 && (v === 7 || v === 8)) k *= 0.7;   // the chest band
      px[(v * 16 + u) * 3] = Math.min(255, c[0] * k); px[(v * 16 + u) * 3 + 1] = Math.min(255, c[1] * k); px[(v * 16 + u) * 3 + 2] = Math.min(255, c[2] * k);
    }
    return textures[key] = px;
  }


  var hdCache = {};
  function texHD(id, face) {   // the same picture in 64 x 64: smooth between the pixels, sharpened again, and a fine grain on top, like a texture pack
    var key = id * 3 + face;
    if (hdCache[key]) return hdCache[key];
    var src = texture(id, face), N = 64, tmp = new Float32Array(N * N * 3), out = new Uint8Array(N * N * 3), x, y, c;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {   // bilinear between the centres of the 16 x 16 pixels
      var fx = Math.max(0, Math.min(15, (x + 0.5) / 4 - 0.5)), fy = Math.max(0, Math.min(15, (y + 0.5) / 4 - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(15, x0 + 1), y1 = Math.min(15, y0 + 1), tx = fx - x0, ty = fy - y0;
      for (c = 0; c < 3; c++) {
        var a = src[(y0 * 16 + x0) * 3 + c], b = src[(y0 * 16 + x1) * 3 + c], d = src[(y1 * 16 + x0) * 3 + c], e = src[(y1 * 16 + x1) * 3 + c];
        tmp[(y * N + x) * 3 + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
      }
    }
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {   // sharpen: the pixel minus what lies around it, then a grain of its own
      var grain = 0.93 + hash(id * 131 + face, x, 11, y) * 0.14 + (hash(id * 71 + face, x >> 1, 5, y >> 1) - 0.5) * 0.06;
      for (c = 0; c < 3; c++) {
        var mid = tmp[(y * N + x) * 3 + c], around = 0, cnt = 0;
        for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) { var nx = x + ox, ny = y + oy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && (ox || oy)) { around += tmp[(ny * N + nx) * 3 + c]; cnt++; } }
        var sharp = mid + (mid - around / cnt) * 0.9;
        out[(y * N + x) * 3 + c] = Math.max(0, Math.min(255, sharp * grain));
      }
    }
    return hdCache[key] = out;
  }

  K.voxel = { persistPlayer: true, res: { w: RW, h: RH }, structures: true, keyActions: false, starter: false, menuAtStart: true, cropSeconds: CROP_SECONDS, treeSeconds: TREE_SECONDS, names: NAMES, biomes: Object.keys(BIOMES), sizes: Object.keys(SIZES), makeWorld: makeWorld };

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
        if (b === CHEST && remember && state.initChest) state.initChest(x, y, z);
        if (remember) {
          state.edits.push(meta !== undefined ? [x, y, z, b, meta] : [x, y, z, b]);
          if (state.edits.length > 30000) state.edits.shift();
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
      state.slots = []; for (var si = 0; si < 36; si++) state.slots.push(null);   // the 36 places of the inventory: 0-8 are the bar, 9-35 lie below it; a place holds one kind, up to 64
      state.reconcile = function () {   // the counts say what you hold, the places say where: too many in the places are taken away (the chosen place first), new things go to the first free places (the bar first) and fill stacks up to 64
        var slots = state.slots, sum = {}, i, id, key;
        for (i = 0; i < 36; i++) if (slots[i]) sum[slots[i].id] = (sum[slots[i].id] || 0) + slots[i].n;
        for (key in sum) {
          var extra = sum[key] - (inv.count[key] || 0); if (extra <= 0) continue;
          var order = [state.slot]; for (i = 35; i >= 0; i--) if (i !== state.slot) order.push(i);
          for (var oi = 0; oi < order.length && extra > 0; oi++) { var s0 = slots[order[oi]]; if (s0 && s0.id === +key) { var take = Math.min(extra, s0.n); s0.n -= take; extra -= take; if (s0.n <= 0) slots[order[oi]] = null; } }
        }
        var keys = inv.order.slice(); for (key in inv.count) if (keys.indexOf(+key) < 0) keys.push(+key);   // in the order you got them
        for (var ki = 0; ki < keys.length; ki++) {
          key = keys[ki]; var want = (inv.count[key] || 0) - (sum[key] || 0); id = +key; if (want <= 0) continue;
          for (i = 0; i < 36 && want > 0; i++) if (slots[i] && slots[i].id === id && slots[i].n < 64) { var add = Math.min(want, 64 - slots[i].n); slots[i].n += add; want -= add; }
          for (i = 0; i < 36 && want > 0; i++) if (!slots[i]) { var put = Math.min(want, 64); slots[i] = { id: id, n: put }; want -= put; }
        }
      };
      state.hotbar = function () { state.reconcile(); return state.slots.map(function (c) { return c ? c.id : 0; }); };   // the kind in each of the 36 places (0: empty); the first nine are the bar
      state.selectedBlock = function () { state.reconcile(); var c = state.slots[state.slot]; return c ? c.id : (state.creative ? STONE : 0); };
      state.select = function (i) {
        if (i >= 9 && i < 36) { state.reconcile(); var a = state.slots[i]; state.slots[i] = state.slots[state.slot]; state.slots[state.slot] = a; return; }   // something from below: it comes to the chosen place of the bar
        state.slot = ((i % 9) + 9) % 9;
      };
      state.cycle = function (d) { state.slot = (((state.slot + d) % 9) + 9) % 9; };   // the wheel and Q go round the nine places of the bar
      state.windowStart = function () { return 0; };
      state.setCreative = function (on) {
        state.creative = on;
        if (on) [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, GLASS, SNOW, COAL, IRON, GOLD, DIAMOND, CACTUS].forEach(function (id) { if (inv.order.indexOf(id) < 0) inv.order.push(id); if (!inv.count[id]) inv.count[id] = 1; });
      };
      if (K.voxel.starter) [[STONE, 20], [DIRT, 20], [PLANKS, 20], [GLASS, 8], [LOG, 10], [D.hoeId(0), 1], [SEEDS, 6]].forEach(function (s) { state.addItem(s[0], s[1]); });   // a real game starts with empty hands
      state.ever = {};   // the starter things do not count

      // ---- looking: a ray through the cubes (shared by the picture and by breaking / placing) ----
      var hit = { b: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, t: 0, face: 1, hx: 0, hy: 0, hz: 0 };
      // ---- shaped blocks: the boxes a block fills (inside its own cell, 0 to 1); a fence reaches out to its neighbours, a door turns, stairs face the way you looked ----
      state.meta = pendingMeta;   // facing 0-3 (north, east, south, west) and +4 for an open door, for the blocks that have one
      var metaOf = function (x, y, z) { return state.meta[x + "," + y + "," + z] || 0; };
      state.metaOf = metaOf;
      var isFence = function (b) { return b === FENCE; };
      var SHAPED = function (b) { return (b >= 130 && b <= 139) || b === FENCE || b === DOOR_LO || b === DOOR_HI || (b >= 144 && b <= 149) || b === PORTAL || b === TORCH || b === BED || b === CHEST || b === CACTUS_ID || b === FARMLAND || (b >= CROP1 && b <= CROP3) || b === SAPLING || b === ENCH_TABLE; };
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
        if (b === TORCH) return forBody ? [] : [[0.4, 0, 0.4, 0.6, 0.72, 0.6]];   // a thin post
        if (b === BED) return [[0, 0, 0, 1, forBody ? 0.5 : 0.5625, 1]];   // lower than a block, low enough to step onto
        if (b === CHEST) return [[0.0625, 0, 0.0625, 0.9375, 0.875, 0.9375]];
        if (b === CACTUS_ID) return [[0.0625, 0, 0.0625, 0.9375, 1, 0.9375]];
        if (b === FARMLAND) return [[0, 0, 0, 1, 0.9375, 1]];
        if (b === ENCH_TABLE) return [[0, 0, 0, 1, 0.75, 1]];
        if ((b >= CROP1 && b <= CROP3) || b === SAPLING) { var ph = b === SAPLING ? 0.6 : 0.3 + (b - CROP1) * 0.3; return forBody ? [] : [[0.45, 0, 0, 0.55, ph, 1], [0, 0, 0.45, 1, ph, 0.55]]; }   // plants: two crossing panels
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
      function cast(ox, oy, oz, dx, dy, dz, maxT, skipWater, thin, skip) {   // skip: a cell [x, y, z] the ray starts in and passes without a hit (the see-through block it just went through)
        var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
        var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
        var tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
        var tx = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tdx : 1e30, ty = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tdy : 1e30, tz = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tdz : 1e30;
        var t = 0, nx = 0, ny = 0, nz = 0, steps = 0, first = get(x, y, z);
        while (t <= maxT && steps++ < 200) {
          var b = skip && x === skip[0] && y === skip[1] && z === skip[2] ? AIR : get(x, y, z);
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
      function eye() { return { x: state.p.x, y: state.p.y + 1.6 - (state.sneaking ? 0.28 : 0), z: state.p.z }; }
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
      // a liquid runs into the hole you open: it falls down as far as it can and spreads 3 blocks sideways; water on lava makes stone
      state.flowOf = {};   // a poured liquid is one source and a flow: every flowing cell remembers its source, so taking the source back drains the flow
      var fkey = function (x, y, z) { return state.dim + ":" + x + "," + y + "," + z; };
      state.spreadFluid = function (x, y, z, f, range, budget, track) {   // a liquid fills the cell, falls down as far as it can, and runs over the floor `range` blocks; water meeting lava makes kara kaya
        var left = budget || 90, near = [[1, 0], [-1, 0], [0, 1], [0, -1]], other = f === WATER ? LAVA : WATER;
        var spread = function (cx, cy, cz, r) {
          if (left <= 0 || cy < 1 || get(cx, cy, cz) !== AIR) return; left--;
          var k, mixed = get(cx, cy + 1, cz) === other;
          for (k = 0; k < 4; k++) if (get(cx + near[k][0], cy, cz + near[k][1]) === other) mixed = true;
          if (mixed) { set(cx, cy, cz, OBSIDIAN, true); return; }
          set(cx, cy, cz, f, true); if (track) state.flowOf[fkey(cx, cy, cz)] = typeof track === "string" ? track : fkey(x, y, z);
          if (get(cx, cy - 1, cz) === AIR) { spread(cx, cy - 1, cz, range); return; }
          if (r > 0) for (k = 0; k < 4; k++) spread(cx + near[k][0], cy, cz + near[k][1], r - 1);
        };
        spread(x, y, z, range); return (budget || 90) - left;
      };
      state.flow = function (x, y, z) {   // a liquid runs into a hole you open; what it makes is a flow of the source it came from (and a flow does not spread on by itself, so nothing floods)
        var f = 0, tag = null, wild = false, d = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], i;
        for (i = 0; i < 5; i++) {
          var cx2 = x + d[i][0], cy2 = y + d[i][1], cz2 = z + d[i][2], nb = get(cx2, cy2, cz2);
          if (nb !== LAVA && nb !== WATER) continue;
          if (nb === LAVA) f = LAVA; else if (!f) f = WATER;
          if (nb === f) { var k = fkey(cx2, cy2, cz2); if (state.flowOf[k]) tag = state.flowOf[k]; else { tag = k; wild = true; } }
        }
        if (!f) return 0;
        return state.spreadFluid(x, y, z, f, wild ? (f === LAVA ? 2 : 3) : 0, 90, tag || true);
      };
      state.breakBlock = function () {
        var t = target();
        if (!t || t.y < 1) return false;
        var tx = t.x, ty = t.y, tz = t.z, b = t.b;
        if (b === OBSIDIAN && !state.creative && state.have("pickaxe") < 0) state.say("Kara kaya için kazma gerek: elle kırarsan düşmez.");
        if (b === BED) {   // both halves of a bed go together, and one bed comes back
          var bm = metaOf(tx, ty, tz), bd = [[0, -1], [1, 0], [0, 1], [-1, 0]][bm & 3], bhead = (bm & 4) !== 0, ox = bhead ? tx - bd[0] : tx + bd[0], oz = bhead ? tz - bd[1] : tz + bd[1];
          K.sfx("click"); set(tx, ty, tz, AIR, true);
          if (get(ox, ty, oz) === BED && metaOf(ox, ty, oz) === (bhead ? (bm & 3) : 4 + (bm & 3))) set(ox, ty, oz, AIR, true);
          state.hud.broken++; state.addItem(BED, 1); return true;
        }
        K.sfx(b === DIRT || b === GRASS || b === SAND ? "click" : "hit");
        set(tx, ty, tz, AIR, true); state.flow(tx, ty, tz); state.hud.broken++;   if (XP_FOR[b] && !state.creative) state.addXp(XP_FOR[b]);
        var kindUsed = D.rightTool(b); if (kindUsed) state.useTool(kindUsed);
        if (b === CHEST) state.spillChest(tx, ty, tz);
        if (b === HAY && state.mobs.some(function (m) { return m.type === "villager" && Math.abs(m.x - tx) < 14 && Math.abs(m.z - tz) < 14; })) state.say("Köylü: Samanlarıma dokunma!");
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
      state.buildTestBed = function () {   // a flat test yard next to you: a lava pool, a water pool, a ready kara kaya frame, hay, a table, a furnace, a chest, and the things to try them with
        var q = state.p, ox = Math.floor(q.x), oz = Math.floor(q.z), gy = w.heightAt(ox, oz), x, z, y, a, b;
        for (x = ox - 2; x <= ox + 22; x++) for (z = oz - 8; z <= oz + 8; z++) { if (x < 1 || z < 1 || x >= S - 1 || z >= S - 1) continue; for (y = gy + 1; y <= gy + 8; y++) set(x, y, z, AIR, true); set(x, gy, z, STONE, true); }
        var pool = function (px, kind) { for (x = px; x < px + 5; x++) for (z = oz - 2; z <= oz + 2; z++) { set(x, gy, z, kind, true); set(x, gy - 1, z, kind, true); set(x, gy - 2, z, STONE, true); } };
        pool(ox + 4, LAVA); pool(ox + 11, WATER);
        for (z = oz - 3; z <= oz + 3; z++) for (y = gy + 1; y <= gy + 4; y++) set(ox + 19, y, z, STONE, true);   // a wall to pour a stream down
        for (a = -1; a <= 2; a++) for (b = -1; b <= 3; b++) { var corner = (a === -1 || a === 2) && (b === -1 || b === 3), inside = a >= 0 && a <= 1 && b >= 0 && b <= 2; if (!corner && !inside) set(ox + 5 + a, gy + 1 + b, oz + 6, OBSIDIAN, true); }   // a frame ready for the çakmak
        for (a = 0; a < 3; a++) set(ox + 10 + a, gy + 1, oz - 6, HAY, true);
        set(ox + 1, gy + 1, oz + 4, TABLE, true); set(ox + 2, gy + 1, oz + 4, FURNACE, true); set(ox + 3, gy + 1, oz + 4, CHEST, true); state.initChest(ox + 3, gy + 1, oz + 4);
        var key = function (cxk) { return cxk + "," + (gy + 1) + "," + (oz + 4); }, all = chestAll(), kept = state.slots.filter(Boolean), part, ci = 0;   // your own bag is put away in two chests, the test things take its place
        state.dropCursor(); set(ox + 4, gy + 1, oz + 4, CHEST, true); set(ox + 5, gy + 1, oz + 4, CHEST, true);
        for (ci = 0; ci < 2; ci++) { part = emptySlots(); kept.slice(ci * 27, ci * 27 + 27).forEach(function (c, n) { part[n] = { id: c.id, n: c.n }; }); all[key(ox + 4 + ci)] = part; }
        chestSave(all);
        Object.keys(inv.count).forEach(function (k) { inv.count[k] = 0; }); state.slots.fill(null); inv.order = [];
        var tagTop = fkey(ox + 18, gy + 4, oz); for (y = gy + 1; y <= gy + 4; y++) { set(ox + 18, y, oz, WATER, true); state.flowOf[fkey(ox + 18, y, oz)] = tagTop; }   // a stream down the wall: pour lava beside it
        var give = [[LIGHTER, 1], [163, 3], [164, 1], [165, 1], [D.toolId("pickaxe", 4), 1], [D.toolId("axe", 4), 1], [D.toolId("shovel", 4), 1], [D.toolId("sword", 4), 1], [D.hoeId(4), 1], [33, 16], [OBSIDIAN, 20], [GLASS, 20], [COBBLE, 64], [PLANKS, 64], [LOG, 16], [WHEAT, 9], [SEEDS, 8], [IRON_INGOT_ID, 9], [GOLD_INGOT_ID, 3], [41, 8], [BED, 1], [DOOR_ITEM, 2], [BREAD, 5], [HAY, 3]];
        give.forEach(function (it) { if (it[0]) state.addItem(it[0], it[1]); });
        state.reconcile(); q.x = ox + 0.5; q.z = oz + 0.5; q.y = gy + 1.01; q.vx = q.vy = q.vz = 0; q.yaw = Math.PI / 2; q.pitch = 0;
        state.say("Deneme alanı: eski çantan sandıklarda (masanın yanı). Çantada deneme eşyaları var. Lav ve su havuzu, duvarda su akışı (yanına lav dök), kara kaya çerçevesi (çakmakla yak).");
      };
      state.menuItems = function () {
        var m = state.menu, toggleCreative = { label: "Yaratıcı mod: " + (state.creative ? "açık" : "kapalı"), act: function () { state.setCreative(!state.creative); } };
        var music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic };
        var controls = { label: "Kontroller", act: function () { m.kind = m.kind === "main" ? "controls-main" : "controls-pause"; m.index = 0; } };
        if (m.kind === "main") return [
          { label: state.edits.length || state.hud.broken || state.hud.placed ? "Devam et" : "Oyna", act: state.closeMenu }, controls, toggleCreative, music,
          { label: "Deneme alanı kur", act: function () { state.buildTestBed(); state.closeMenu(); } },
          { label: m.confirm ? "Emin misin? Tekrar seç: dünya sıfırlanır" : "Dünyayı sıfırla (kaydı sil)", act: function () { if (m.confirm) state.resetWorld(); else m.confirm = true; } }];
        return [{ label: "Devam et", act: state.closeMenu }, controls, toggleCreative, music, { label: "Deneme alanı kur", act: function () { state.buildTestBed(); state.closeMenu(); } }, { label: "Ana menü", act: function () { state.openMenu("main"); } }];
      };
      var CONTROL_LINES = ["W A S D  yürü     Boşluk  zıpla     W'ya iki kez bas  koş     Shift  eğil", "Fare ya da oklar  bak (önce ekrana tıkla)", "Sol tık (basılı)  kır ya da vur       Sağ tık  koy / ye / kapıyı aç / uyu",
                           "Tekerlek, Q ya da 1-9  eşya seç       E  envanter ve üretim (2x2 ızgara)", "B  başarımlar       C  yaratıcı mod       H  yardım       Esc  menü", "Uçmak: G ya da Boşluk'a iki kez (uçma özelliğiyle)", "Geçit: 4x5 kara kaya çerçeve (köşesiz), çakmakla içine bak ve sağ tık. Cam çerçeve = Gök Adaları"];
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
        Object.keys(inv.count).forEach(function (k) { var a = D.armorOf(+k), pts = a ? a.points + state.enchLevel(+k, "prot") : 0; if (a && inv.count[k] > 0 && pts > best[a.slot]) best[a.slot] = pts; });
        return best[0] + best[1] + best[2] + best[3];
      };
      state.hurtPlayer = function (n, why) {
        var amount = Math.max(1, Math.round(n * (1 - Math.min(20, state.armorPoints()) * 0.04)));
        if (state.blocking && !state.creative) { amount = Math.max(1, Math.round(amount * 0.35)); K.sfx("click"); state.useTool("sword"); }   // a raised sword takes most of the blow
        return state.hurt(amount, why);
      };   // each armour point takes off 4 percent
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
        if (tier === 3) return;   // a golden tool never breaks
        var unb = state.enchLevel(id, "unb"); if (unb && mr() < unb / (unb + 1)) return;   // a tough tool often does not wear
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
      var HIT = { sword: SWORD, axe: [3, 4, 5, 3, 6], pickaxe: [2, 3, 4, 2, 5], shovel: [1, 2, 3, 1, 4], hoe: [1, 1, 2, 1, 3] };   // every kind of tool hits with its own damage: the axe hits hard, the hoe hardly at all
      state.damageOf = function (id) { var t = D.toolOf(id); return t && HIT[t.kind] ? HIT[t.kind][t.tier] : 1; };
      state.killMob = function (m) {
        m.dead = true; state.kills++; state.addXp(M.TYPES[m.type].kind === "hostile" ? 5 : 1);
        M.drops(m.type, mr).forEach(function (d) { state.addItem(d[0], d[1]); });
      };
      state.attackMob = function (m) {
        if (m.dead || state.attackCd > 0) return false;   // a dead one is not hit again
        state.attackCd = 0.5;
        var held = D.toolOf(state.selectedBlock()), tier = state.have("sword"), kindUsed = held ? held.kind : tier >= 0 ? "sword" : null;
        var dmg = held ? HIT[held.kind][held.tier] + (held.kind === "sword" ? state.enchLevel(state.selectedBlock(), "sharp") : 0) : tier >= 0 ? SWORD[tier] + state.enchLevel(D.toolId("sword", tier), "sharp") : 1, p = state.p, dx = m.x - p.x, dz = m.z - p.z, L = Math.sqrt(dx * dx + dz * dz) || 1;
        m.hp -= dmg; m.flash = 0.25; m.kx = dx / L * 5; m.kz = dz / L * 5; m.vy = 4; if (M.TYPES[m.type].kind === "passive") m.fear = 4;
        K.sfx("hit"); if (kindUsed) state.useTool(kindUsed);
        if (m.hp <= 0) state.killMob(m);
        return true;
      };
      state.spawnHostile = function () {   // at night, on open ground a little way off, never more than six near you
        var hostiles = state.mobs.filter(function (m) { return M.TYPES[m.type].kind === "hostile"; }).length;
        if (state.daylight() >= 0.45 || hostiles >= (state.dim === "nether" ? 8 : 6) || state.mobs.length >= 40) return null;
        var p = state.p, a = mr() * 6.283, d = 14 + mr() * 10, x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
        if (x < 2 || z < 2 || x >= S - 2 || z >= S - 2) return null;
        var h = w.heightAt(x, z);
        if (h <= SEA || get(x, h, z) === WATER || get(x, h + 1, z) !== AIR || get(x, h + 2, z) !== AIR) return null;
        var roll = mr(), type = state.dim === "nether" ? (roll < 0.45 ? "ember" : roll < 0.85 ? "warden" : "bomber") : roll < 0.4 ? "zombie" : roll < 0.65 ? "skeleton" : roll < 0.85 ? "bomber" : "spider";
        var m = M.create(type, x + 0.5, h + 1.01, z + 0.5); state.mobs.push(m); return m;
      };
      state.updateMobs = function (dt) {
        var p = state.p;
        state.attackCd -= dt;
        state.mobs.forEach(function (m) { M.step(m, dt, MW); });
        state.mobs = state.mobs.filter(function (m) {
          if (m.dead) return false;
          var dx = m.x - p.x, dz = m.z - p.z;
          return M.TYPES[m.type].npc || dx * dx + dz * dz < (M.TYPES[m.type].kind === "hostile" ? 48 * 48 : 90 * 90);
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
        w.villageSpots(cx, cz).forEach(function (sp) { state.mobs.push(M.create("villager", sp.x, sp.gy + 1.01, sp.z)); });
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
        m.need = state.creative ? 0 : D.mineTime(t.b, state.have) / (1 + 0.4 * state.toolEnch(t.b, "eff"));
        m.progress += dt;
        if (m.progress >= m.need) { state.breakBlock(); m.key = ""; m.progress = 0; return true; }
        return false;
      };
      state.eat = function (id) {   // food fills the hunger bar, only when it is not full
        var gain = D.FOOD[id];
        if (!gain || state.food >= 20 || (!state.creative && !(inv.count[id] > 0))) return false;
        state.food = Math.min(20, state.food + gain);
        state.heal.left += Math.round(gain * 0.8); state.heal.rate = 0.35 + gain * 0.1;   // the better the food, the more it heals and the faster
        if (!state.creative) inv.count[id]--;
        if (state.slot >= state.hotbar().length) state.slot = Math.max(0, state.hotbar().length - 1);
        K.sfx("coin"); state.stats.eaten++; return true;
      };
      state.placeBlock = function () {
        var bedT = target(); if (bedT && bedT.b === BED) return state.sleep();
        if (bedT && bedT.b === CHEST && !K.key("Shift")) { state.openChestAt(bedT.x, bedT.y, bedT.z); return true; }   // a right click on a chest opens it
        if (bedT && bedT.b === ENCH_TABLE && !K.key("Shift")) { state.enchanting = true; state.enchCursor = 0; return true; }   // a right click on a büyü masası opens its spells
        if (bedT && (bedT.b === TABLE || bedT.b === FURNACE) && !K.key("Shift")) { state.openScreen(bedT.b === TABLE ? "table" : "furnace"); return true; }   // a right click on a table or a furnace opens its recipes (Shift puts a block next to it)
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
        if (id === BED) {   // a bed is two blocks long: the foot where you click, the head the way you look (a single one when there is no room)
          var bx0 = t.x + t.nx, by0 = t.y + t.ny, bz0 = t.z + t.nz, bdirs = [[0, -1], [1, 0], [0, 1], [-1, 0]], bplaced = false;
          if (get(bx0, by0, bz0) !== AIR || !solid(get(bx0, by0 - 1, bz0))) return false;
          for (var bt = 0; bt < 4 && !bplaced; bt++) {
            var bf = (facing() + bt) & 3, hx2 = bx0 + bdirs[bf][0], hz2 = bz0 + bdirs[bf][1];
            if (get(hx2, by0, hz2) === AIR && solid(get(hx2, by0 - 1, hz2))) { set(bx0, by0, bz0, BED, true, bf); set(hx2, by0, hz2, BED, true, 4 + bf); bplaced = true; }
          }
          if (!bplaced) set(bx0, by0, bz0, BED, true, 0);
          K.sfx("click"); state.hud.placed++;
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
        var r = typeof which === "string" ? state.recipes[D.recipeIndex(which)] : which && typeof which === "object" ? which : state.recipes[which];
        if (!r || !state.canCraft(r)) return false;
        if (r.where === "furnace") { if (state.fuel <= 0) { inv.count[COAL_ITEM]--; state.fuel = 8; } state.fuel--; }   // a coal smelts eight
        r.need.forEach(function (n) { inv.count[n[0]] -= n[1]; });
        state.addItem(r.give[0], r.give[1]); K.sfx("coin");
        state.stats.crafted[r.name] = (state.stats.crafted[r.name] || 0) + 1; if (r.where === "furnace") { state.stats.smelted++; state.addXp(1); }
        return true;
      };
      state.stations = function () { return { table: state.near(TABLE, 5), furnace: state.near(FURNACE, 5) }; };
      state.craftList = function () {   // what the menu shows: by hand always, and the recipes of a table or a furnace only while one is near
        var st = state.stations();
        return state.recipes.filter(function (r) { return r.where === "hand" || (r.where === "table" && st.table) || (r.where === "furnace" && st.furnace); });
      };
      state.craftPage = function () { return Math.floor(state.craftCursor / 8) * 8; };
      state.menuMove = function (d) { state.craftCursor = Math.max(0, Math.min(state.craftList().length - 1, state.craftCursor + d)); };
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
      state.phase = 0;
      state.portalStep = function (dt) {
        state.phase += dt;
        var p = state.p, fx = Math.floor(p.x), fz = Math.floor(p.z);
        var cellY = get(fx, Math.floor(p.y + 0.2), fz) === PORTAL ? Math.floor(p.y + 0.2) : get(fx, Math.floor(p.y + 1.2), fz) === PORTAL ? Math.floor(p.y + 1.2) : -1;
        if (cellY < 0) { state.portalT = 0; state.portalLock = false; return; }
        if (state.portalLock) return;
        state.portalT += dt;
        if (state.portalT >= 1.2) { var code = metaOf(fx, cellY, fz) >> 2; state.travel(DIM_BY_CODE[code] || "over"); }
      };

      // ---- eating and blocking: a right click held on food eats it in a moment (and heals faster the better the food), on a sword it raises it as a shield ----
      state.eating = null; state.blocking = false; state.heal = { left: 0, rate: 0, acc: 0 };
      state.rightDown = function () {
        var vm = state.mobTarget ? state.mobTarget() : null;
        if (vm && vm.type === "villager") { state.openTrade(vm); return true; }
        var t = target(), id = state.selectedBlock(), interact = t && (t.b === BED || t.b === TABLE || t.b === FURNACE || t.b === DOOR_LO || t.b === DOOR_HI || (state.interactive && state.interactive(t.b)));
        if (!interact && D.FOOD[id] && state.food < 20 && (state.creative || inv.count[id] > 0)) { state.eating = { id: id, t: 0, bite: 0 }; return true; }
        var tool = D.toolOf(id);
        if (!interact && tool && tool.kind === "sword") { state.blocking = true; return true; }
        if (id >= 163 && id <= 165 && !interact) return state.useBucket(id);
        return state.placeBlock();
      };
      state.useBucket = function (id) {   // an empty bucket scoops a liquid; a full one pours it. Lava poured with water near turns to kara kaya: the speedrun portal cast
        var e = eye(), d = look();
        if (!cast(e.x, e.y, e.z, d.x, d.y, d.z, REACH, false)) return false;
        var h = hit, hx = h.x, hy = h.y, hz = h.z, hb = h.b;
        var swap = function (to) {
          K.sfx("click"); if (state.creative) return;
          var sl = state.slots[state.slot];
          if (sl && sl.id === id && sl.n === 1) { sl.id = to; inv.count[id]--; inv.count[to] = (inv.count[to] || 0) + 1; state.ever[to] = true; if (inv.order.indexOf(to) < 0) inv.order.push(to); }
          else { inv.count[id]--; state.addItem(to, 1); }
          state.reconcile();
        };
        if (id === 163) {
          if (hb !== WATER && hb !== LAVA) return false;
          var src = state.flowOf[fkey(hx, hy, hz)];
          if (src) { var drained = 0; Object.keys(state.flowOf).forEach(function (k) { if (state.flowOf[k] === src) { var m = /^(\w+):(-?\d+),(-?\d+),(-?\d+)$/.exec(k); if (m && m[1] === state.dim && get(+m[2], +m[3], +m[4]) === hb) { set(+m[2], +m[3], +m[4], AIR, true); drained++; } delete state.flowOf[k]; } }); if (drained) { swap(hb === WATER ? 164 : 165); return true; } }
          set(hx, hy, hz, AIR, true); swap(hb === WATER ? 164 : 165); return true;
        }
        var cx = (hb === WATER || hb === LAVA) ? hx : hx + h.nx, cy = (hb === WATER || hb === LAVA) ? hy : hy + h.ny, cz = (hb === WATER || hb === LAVA) ? hz : hz + h.nz, cb = get(cx, cy, cz);
        if ((cb !== AIR && cb !== WATER && cb !== LAVA) || cy < 1) return false;
        var near = function (what) { for (var a = -2; a <= 2; a++) for (var b = -2; b <= 2; b++) for (var c = -2; c <= 2; c++) if ((a || b || c) && get(cx + a, cy + b, cz + c) === what) return true; return false; };
        if (id === 164) {
          if (cb === WATER) return false;
          for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) for (var c = -1; c <= 1; c++) if (get(cx + a, cy + b, cz + c) === LAVA) set(cx + a, cy + b, cz + c, OBSIDIAN, true);
          set(cx, cy, cz, AIR, true); state.spreadFluid(cx, cy, cz, WATER, 4, 90, true);   // the poured water runs: down, and over the floor
        } else if (near(WATER)) set(cx, cy, cz, OBSIDIAN, true);
        else { set(cx, cy, cz, AIR, true); state.spreadFluid(cx, cy, cz, LAVA, 2, 90, true); }
        swap(163); return true;
      };
      state.rightUp = function () { state.eating = null; state.blocking = false; };
      state.useUpdate = function (dt) {
        if (state.menu.open || state.uiOpen()) { state.eating = null; state.blocking = false; return; }
        var e = state.eating;
        if (e) {
          if (state.selectedBlock() !== e.id || state.food >= 20) { state.eating = null; return; }
          e.t += dt; e.bite += dt;
          if (e.bite >= 0.3) { e.bite = 0; K.sfx("click"); }   // a bite every moment
          if (e.t >= 1.6) { state.eat(e.id); state.eating = null; }
        }
        var h = state.heal;
        if (h.left > 0 && state.health < 20) { h.acc += dt * h.rate; while (h.acc >= 1 && h.left > 0 && state.health < 20) { state.health++; h.left--; h.acc--; } }
        else if (state.health >= 20) { h.left = 0; h.acc = 0; }
      };
      // ---- experience and enchanting: ores, creatures and furnaces give experience; at a büyü masası lapis and levels put a spell on a tool, sword or armour ----
      var ENCH_NAMES = { eff: "Verimlilik", unb: "Dayanıklılık", sharp: "Keskinlik", prot: "Koruma" }, ROMAN = ["", "I", "II", "III"], XP_FOR = { 9: 1, 10: 1, 11: 2, 12: 4, 156: 3, 157: 2, 158: 5 };
      var playerKey = baseKey + ".player", savedPlayer; try { savedPlayer = K.save.get(playerKey, null); } catch (e) { savedPlayer = null; }
      state.xp = (savedPlayer && savedPlayer.xp) || 0; state.ench = (savedPlayer && savedPlayer.ench) || {}; state.enchCursor = 0;
      state.savePlayer = function () {   // what you carry, where you stand, how you are: kept with the world (every few seconds, and when the page is left)
        if (K.voxel.persistPlayer === false) return;
        var q = state.p, home = state.dim === "over" ? { x: q.x, y: q.y, z: q.z } : (state.homes && state.homes.over) || null;
        var data = { xp: state.xp, ench: state.ench, inv: inv.count, slots: state.slots, slot: state.slot, health: state.health, food: state.food, air: state.air, time: state.time, creative: state.creative,
                     respawn: state.respawn, wear: state.wear, stats: state.stats, hud: state.hud, ever: state.ever, kills: state.kills, deaths: state.deaths, fuel: state.fuel, flows: state.flowOf };
        if (home) data.p = { x: home.x, y: home.y, z: home.z, yaw: q.yaw, pitch: q.pitch };
        try { K.save.set(playerKey, data); } catch (e) { /* not kept */ }
      };
      if (savedPlayer && K.voxel.persistPlayer !== false) {   // the last visit comes back
        var sp = savedPlayer, k2;
        if (sp.inv) { for (k2 in inv.count) delete inv.count[k2]; for (k2 in sp.inv) inv.count[k2] = sp.inv[k2]; }
        if (sp.slots instanceof Array) { for (var li = 0; li < 36; li++) { var sc = sp.slots[li]; state.slots[li] = sc && sc.id ? { id: +sc.id, n: sc.n | 0 } : null; } }
        if (typeof sp.slot === "number") state.slot = ((sp.slot % 9) + 9) % 9;
        ["health", "food", "air", "time", "kills", "deaths", "fuel"].forEach(function (f) { if (typeof sp[f] === "number") state[f] = sp[f]; });
        if (sp.creative) state.setCreative(true);
        if (sp.flows && typeof sp.flows === "object") state.flowOf = sp.flows;
        if (sp.respawn && typeof sp.respawn.x === "number") state.respawn = sp.respawn;
        if (sp.wear && typeof sp.wear === "object") state.wear = sp.wear;
        if (sp.stats && typeof sp.stats === "object") { state.stats = Object.assign(state.stats, sp.stats); }
        if (sp.hud && typeof sp.hud === "object") state.hud = Object.assign(state.hud, sp.hud);
        if (sp.ever && typeof sp.ever === "object") state.ever = sp.ever;
        if (sp.p && typeof sp.p.x === "number") { w.ensureAround(sp.p.x | 0, sp.p.z | 0, LOAD); state.p.x = sp.p.x; state.p.y = sp.p.y; state.p.z = sp.p.z; state.p.yaw = sp.p.yaw || 0; state.p.pitch = sp.p.pitch || 0; state.p.vy = 0; state.p.peak = state.p.y; }
        if (state.health <= 0) state.health = 20;
      }
      state.levelInfo = function (xp) { var level = 0, need = 5, left = xp === undefined ? state.xp : xp; while (left >= need) { left -= need; level++; need = 5 + level * 3; } return { level: level, into: left, need: need }; };
      state.xpAt = function (level) { var t = 0; for (var i = 0; i < level; i++) t += 5 + i * 3; return t; };
      state.addXp = function (n) { var before = state.levelInfo().level; state.xp += n; if (state.levelInfo().level > before) K.sfx("coin"); state.savePlayer(); };
      state.enchLevel = function (id, key) { var e = state.ench[id]; return (e && e[key]) || 0; };
      state.toolEnch = function (b, key) { var kind = D.rightTool(b); if (!kind || kind === "hoe") return 0; var tier = state.have(kind); return tier < 0 ? 0 : state.enchLevel(D.toolId(kind, tier), key); };
      state.enchantNote = function (id) { var e = state.ench[id]; if (!e) return ""; return "  " + Object.keys(e).filter(function (k) { return e[k] > 0; }).map(function (k) { return ENCH_NAMES[k] + " " + ROMAN[e[k]]; }).join(", "); };
      state.enchantable = function () { return inv.order.filter(function (id) { return inv.count[id] > 0 && (D.toolOf(id) || D.armorOf(id)); }); };
      state.enchantOptions = function (id) { var t = D.toolOf(id); return D.armorOf(id) ? ["prot"] : t && t.kind === "sword" ? ["sharp", "unb"] : ["eff", "unb"]; };
      state.enchant = function (id, tier) {   // tier 1-3 costs that many lapis and levels; a spell of that strength is chosen for the item
        if (!id || tier < 1 || tier > 3 || !(inv.count[id] > 0)) return null;
        if (!state.creative && ((inv.count[159] || 0) < tier || state.levelInfo().level < tier)) { state.say("Yetmiyor: " + tier + " lapis ve " + tier + " seviye gerekir."); return null; }
        var options = state.enchantOptions(id), key = options[Math.floor(mr() * options.length)];
        state.ench[id] = state.ench[id] || {};
        state.ench[id][key] = Math.max(state.ench[id][key] || 0, tier);
        if (!state.creative) { inv.count[159] -= tier; state.xp = state.xpAt(state.levelInfo().level - tier) + 0; }
        K.sfx("coin"); state.savePlayer(); state.say(NAMES[id] + ":" + state.enchantNote(id)); return { key: key, level: state.ench[id][key] };
      };
      state.interactive = function (b) { return b === ENCH_TABLE || b === CHEST; };
      // ---- chests give their loot when broken; villagers trade (right click): wheat, coal and meat for zümrüt, zümrüt for food, tools, lapis and even a diamond ----
      // ---- chests keep what you put in them (27 places, per chest, saved with the world); a chest of a village or a temple has loot in it the first time it is opened ----
      function chestStore() { return (state.dim === "over" ? baseKey : baseKey + "." + state.dim) + ".chests"; }
      function chestAll() { var all; try { all = K.save.get(chestStore(), {}); } catch (e) { all = {}; } return all && typeof all === "object" ? all : {}; }
      function chestSave(all) { try { K.save.set(chestStore(), all); } catch (e) { /* not kept */ } }
      function emptySlots() { var a = []; for (var i = 0; i < 27; i++) a.push(null); return a; }
      function rollChest(x, y, z) {   // the loot of a chest nobody has opened: the same for the same chest
        var slots = emptySlots(), n = 0;
        LOOT.forEach(function (l, li) {
          if (hash(seed + 700 + li, x, y, z) >= l[3]) return;
          var count = l[1] + Math.floor(hash(seed + 720 + li, x, y, z) * (l[2] - l[1] + 1)); if (count <= 0) return;
          var at = Math.floor(hash(seed + 740 + li, x, y, z) * 27); while (slots[at]) at = (at + 1) % 27;
          slots[at] = { id: l[0], n: count }; n++;
        });
        return slots;
      }
      state.chestContents = function (x, y, z) { var all = chestAll(), key = x + "," + y + "," + z; if (!all[key]) { all[key] = rollChest(x, y, z); chestSave(all); } return all[key]; };
      state.initChest = function (x, y, z) { var all = chestAll(); all[x + "," + y + "," + z] = emptySlots(); chestSave(all); };   // a chest you put down is empty
      state.saveChest = function () { var c = state.chestOpen; if (!c) return; var all = chestAll(); all[c.key] = c.slots; chestSave(all); };
      state.openChestAt = function (x, y, z) { state.returnItems(); state.chestOpen = { key: x + "," + y + "," + z, slots: state.chestContents(x, y, z).map(function (c) { return c ? { id: c.id, n: c.n } : null; }) }; state.screen = "chest"; state.showInv = true; };
      state.spillChest = function (x, y, z) {   // a chest that is broken gives what is in it
        var all = chestAll(), key = x + "," + y + "," + z, slots = all[key] || rollChest(x, y, z), got = [];
        slots.forEach(function (c) { if (c) { state.addItem(c.id, c.n); got.push(NAMES[c.id] + " x" + c.n); } });
        delete all[key]; chestSave(all); if (got.length) state.say("Sandıktan: " + got.join(", ")); return got;
      };
      var LOOT = [[GOLD_INGOT_ID, 1, 3, 0.8], [161, 0, 2, 0.5], [BREAD, 1, 3, 0.7], [115, 0, 2, 0.5], [159, 1, 4, 0.4], [IRON_INGOT_ID, 1, 3, 0.6], [44, 1, 1, 0.12]];
      state.openChest = function () { var got = []; LOOT.forEach(function (l) { if (mr() < l[3]) { var n = l[1] + Math.floor(mr() * (l[2] - l[1] + 1)); if (n > 0) { state.addItem(l[0], n); got.push(NAMES[l[0]] + " x" + n); } } }); if (got.length) state.say("Sandıktan: " + got.join(", ")); return got; };
      var PROFESSIONS = ["çiftçi", "demirci", "rahip", "kasap"];
      var OFFERS = {
        "çiftçi": [{ give: [[WHEAT, 18]], get: [[161, 1]] }, { give: [[161, 1]], get: [[BREAD, 5]] }, { give: [[161, 1]], get: [[APPLE, 4]] }, { give: [[SEEDS, 20]], get: [[161, 1]] }],
        "demirci": [{ give: [[COAL_ITEM, 24]], get: [[161, 1]] }, { give: [[161, 4]], get: [[D.toolId("pickaxe", 2), 1]] }, { give: [[161, 5]], get: [[D.toolId("sword", 2), 1]] }, { give: [[161, 9]], get: [[D.armorId(1, 1), 1]] }],
        "rahip": [{ give: [[117, 32]], get: [[161, 1]] }, { give: [[161, 1]], get: [[159, 3]] }, { give: [[161, 3]], get: [[160, 5]] }, { give: [[161, 8]], get: [[44, 1]] }],
        "kasap": [{ give: [[84, 6]], get: [[161, 1]] }, { give: [[110, 10]], get: [[161, 1]] }, { give: [[161, 1]], get: [[83, 4]] }, { give: [[161, 1]], get: [[85, 4]] }]
      };
      state.professionOf = function (m) { return PROFESSIONS[Math.abs(Math.floor(m.x * 3.1 + m.z * 5.3)) % PROFESSIONS.length]; };
      state.openTrade = function (m) { m.profession = m.profession || state.professionOf(m); state.trade = { mob: m, profession: m.profession, offers: OFFERS[m.profession], cursor: 0 }; };
      state.canTrade = function (offer) { return state.creative || offer.give.every(function (g) { return (inv.count[g[0]] || 0) >= g[1]; }); };
      state.doTrade = function (offer) {
        if (!offer || !state.canTrade(offer)) { K.sfx("hit"); return false; }
        if (!state.creative) offer.give.forEach(function (g) { inv.count[g[0]] -= g[1]; });
        offer.get.forEach(function (g) { state.addItem(g[0], g[1]); });
        K.sfx("coin"); state.stats.traded = (state.stats.traded || 0) + 1; return true;
      };
      // ---- the inventory screen with hand crafting, like the game it follows: the mouse picks a stack up (left: all, right: half) and puts it in the 2x2 grid of your pockets
      // (3x3 at a table, a furnace has its own slots); a pattern on the grid shows its result, and clicking the result takes it ----
      state.invScroll = 0; state.screen = "inv"; state.cursor = null; state.cells = []; for (var ci = 0; ci < 9; ci++) state.cells.push(null);
      state.furn = { input: null, fuel: null, out: null, progress: 0, burn: 0 };
      var FUEL = { 41: 8, 5: 2, 7: 1.5, 40: 0.5 };
      state.gridSize = function () { return state.screen === "table" ? 3 : 2; };
      function invLayout() {
        var size = state.screen === "table" ? 3 : state.screen === "furnace" || state.screen === "chest" ? 0 : 2, cell = 40, x0 = Math.floor(g.width / 2 - 190), y0 = 26, topH = size === 3 ? 128 : 92;
        var L = { x0: x0, y0: y0, cell: cell, rows: 3, w: 380, size: size, chest: state.screen === "chest" };
        L.gridY = y0 + 30 + topH + 8; L.barY = L.gridY + 3 * cell + 12; L.h = L.barY + cell + 22 - y0;
        L.cellX = size === 3 ? x0 + 70 : x0 + 190; L.cellY = y0 + 34;
        L.resX = size === 3 ? x0 + 290 : x0 + 318; L.resY = y0 + 34 + (size === 3 ? 38 : 20);
        L.fin = { x: x0 + 110, y: y0 + 36 }; L.ffuel = { x: x0 + 110, y: y0 + 92 }; L.fout = { x: x0 + 270, y: y0 + 62 };
        return L;
      }
      state.invLayout = invLayout;
      state.invHit = function (mx, my) {
        state.reconcile();
        var L = invLayout(), cell = L.cell, i;
        var inside = function (x, y) { return mx >= x && mx < x + cell - 4 && my >= y && my < y + cell - 4; };
        if (L.size) {
          for (i = 0; i < L.size * L.size; i++) if (inside(L.cellX + (i % L.size) * cell, L.cellY + Math.floor(i / L.size) * cell)) return { kind: "cell", index: i };
          if (inside(L.resX, L.resY)) return { kind: "result" };
        } else if (L.chest) {
          for (i = 0; i < 27; i++) if (inside(L.x0 + 10 + (i % 9) * cell, L.cellY + Math.floor(i / 9) * cell)) return { kind: "chest", index: i };
        } else {
          if (inside(L.fin.x, L.fin.y)) return { kind: "fin" }; if (inside(L.ffuel.x, L.ffuel.y)) return { kind: "ffuel" }; if (inside(L.fout.x, L.fout.y)) return { kind: "fout" };
        }
        var col = Math.floor((mx - (L.x0 + 10)) / cell);
        if (col < 0 || col > 8) return null;
        var row = Math.floor((my - L.gridY) / cell);
        if (row >= 0 && row < L.rows) { var gi = 9 + row * 9 + col; return { kind: "slot", index: gi, id: state.slots[gi] && state.slots[gi].id }; }   // an empty place is a place too
        if (my >= L.barY && my < L.barY + cell) return { kind: "slot", index: col, id: state.slots[col] && state.slots[col].id };
        return null;
      };
      function setSlot(i, v) {   // a place gets new content, the counts follow
        var old = state.slots[i];
        if (old) inv.count[old.id] = (inv.count[old.id] || 0) - old.n;
        if (v) { inv.count[v.id] = (inv.count[v.id] || 0) + v.n; state.ever[v.id] = true; }
        state.slots[i] = v;
      }
      function slotClick(slot, button, canPlace) {   // what a click does to one slot with the stack in the hand: the new content of the slot
        var c = state.cursor;
        if (!c) {
          if (!slot) return slot;
          var take = button === 2 ? Math.ceil(slot.n / 2) : slot.n; state.cursor = { id: slot.id, n: take };
          return slot.n - take > 0 ? { id: slot.id, n: slot.n - take } : null;
        }
        if (canPlace && !canPlace(c.id)) return slot;
        var put = button === 2 ? 1 : c.n, rest = c.n - put;
        if (!slot) { state.cursor = rest > 0 ? { id: c.id, n: rest, free: c.free } : null; return { id: c.id, n: put }; }
        if (slot.id === c.id) {   // the same kind: it adds up to a full stack of 64, the rest stays in the hand
          var room = 64 - slot.n, add = Math.min(put, room); if (add <= 0) return slot;
          state.cursor = c.n - add > 0 ? { id: c.id, n: c.n - add, free: c.free } : null; return { id: slot.id, n: slot.n + add };
        }
        state.cursor = { id: slot.id, n: slot.n }; return { id: c.id, n: c.n };   // another kind: they swap
      }
      state.pickFromInventory = function (id, half) {   // the first stack of this kind comes into the hand
        if (state.cursor) return false;
        state.reconcile();
        for (var i = 0; i < 36; i++) if (state.slots[i] && state.slots[i].id === id) { setSlot(i, slotClick(state.slots[i], half ? 2 : 0)); return true; }
        return false;
      };
      state.dropCursor = function () { var c = state.cursor; if (!c) return; if (!c.free) state.addItem(c.id, c.n); state.cursor = null; state.reconcile(); };
      state.returnItems = function () {   // closing the screen: everything in the hand, on the grid and in the furnace goes back to the inventory
        state.dropCursor();
        for (var i = 0; i < 9; i++) if (state.cells[i]) { state.addItem(state.cells[i].id, state.cells[i].n); state.cells[i] = null; }
        ["input", "fuel", "out"].forEach(function (k) { if (state.furn[k]) { state.addItem(state.furn[k].id, state.furn[k].n); state.furn[k] = null; } });
        state.furn.progress = 0;
      };
      state.matchResult = function () { var size = state.gridSize(), ids = []; for (var i = 0; i < size * size; i++) ids.push(state.cells[i] ? state.cells[i].id : 0); return D.matchGrid(ids, size); };
      state.takeResult = function () {
        var m = state.matchResult(), size = state.gridSize(); if (!m) return false;
        var c = state.cursor; if (c && (c.id !== m.give[0] || c.n + m.give[1] > 64)) return false;
        for (var i = 0; i < size * size; i++) if (state.cells[i]) { state.cells[i].n--; if (state.cells[i].n <= 0) state.cells[i] = null; }
        state.cursor = { id: m.give[0], n: (c ? c.n : 0) + m.give[1], free: c && c.free };
        state.stats.crafted[m.name] = (state.stats.crafted[m.name] || 0) + 1; K.sfx("coin"); return true;
      };
      state.smeltOf = function (id) { for (var i = 0; i < D.recipes.length; i++) { var r = D.recipes[i]; if (r.where === "furnace" && r.need[0][0] === id) return r; } return null; };
      state.furnaceUpdate = function (dt) {   // the furnace works while its screen is open: a coal burns eight items, one takes a moment
        var f = state.furn;
        if (!state.showInv || state.screen !== "furnace") return;
        var r = f.input && state.smeltOf(f.input.id);
        if (r && (!f.out || (f.out.id === r.give[0] && f.out.n < 64))) {
          if (f.burn < 1 && f.fuel && FUEL[f.fuel.id]) { f.burn += FUEL[f.fuel.id]; f.fuel.n--; if (f.fuel.n <= 0) f.fuel = null; }
          if (f.burn >= 1) {
            f.progress += dt;
            if (f.progress >= 1.6) { f.progress = 0; f.burn -= 1; f.input.n--; if (f.input.n <= 0) f.input = null; f.out = f.out ? { id: f.out.id, n: f.out.n + r.give[1] } : { id: r.give[0], n: r.give[1] }; state.stats.smelted++; state.addXp(1); K.sfx("click"); }
          } else f.progress = 0;
        } else f.progress = 0;
      };
      state.uiClick = function (button) {   // a mouse button pressed while the inventory screen is open
        if (!state.showInv) return false;
        var hit = state.invHit(K.mouse.x, K.mouse.y);
        if (!hit) { if (state.cursor) { state.dropCursor(); return true; } return false; }   // a click on nothing puts what is in the hand back
        if (hit.kind === "cell") state.cells[hit.index] = slotClick(state.cells[hit.index], button);
        else if (hit.kind === "chest") { state.chestOpen.slots[hit.index] = slotClick(state.chestOpen.slots[hit.index], button); state.saveChest(); }
        else if (hit.kind === "result") state.takeResult();
        else if (hit.kind === "fin") state.furn.input = slotClick(state.furn.input, button, function (id) { return !!state.smeltOf(id); });
        else if (hit.kind === "ffuel") state.furn.fuel = slotClick(state.furn.fuel, button, function (id) { return !!FUEL[id]; });
        else if (hit.kind === "fout") state.furn.out = slotClick(state.furn.out, button, function () { return false; });
        else if (hit.kind === "slot") setSlot(hit.index, slotClick(state.slots[hit.index], button));   // a place of the inventory: take, put, swap, half, one
        state.reconcile(); return true;
      };
      state.hoverSlot = function (num) {   // a number key with the mouse over an item: the item goes to that slot of the bar
        if (!state.showInv || state.cursor) return false;
        var hit = state.invHit(K.mouse.x, K.mouse.y); if (!hit || hit.kind !== "slot" || hit.index === num - 1) return false;
        var a = state.slots[hit.index]; state.slots[hit.index] = state.slots[num - 1]; state.slots[num - 1] = a; return true;   // the place under the mouse and the place of the number change contents
      };
      state.openScreen = function (kind) { state.returnItems(); state.screen = kind; state.showInv = true; };
      // dragging with a stack in the hand: hold the button and run over places; left shares the stack evenly, right puts one in each
      var dragKinds = { slot: 1, cell: 1, chest: 1 };
      var dragGet = function (h) { return h.kind === "slot" ? state.slots[h.index] : h.kind === "cell" ? state.cells[h.index] : state.chestOpen.slots[h.index]; };
      var dragPut = function (h, v) { if (h.kind === "slot") setSlot(h.index, v); else if (h.kind === "cell") state.cells[h.index] = v; else state.chestOpen.slots[h.index] = v; };
      state.dragDown = function (button) {   // true when a drag began (the click itself waits for the button to be let go)
        if (!state.showInv || !state.cursor) return false;
        var hit = state.invHit(K.mouse.x, K.mouse.y); if (!hit || !dragKinds[hit.kind]) return false;
        state.drag = { button: button, list: [hit], x: K.mouse.x, y: K.mouse.y }; return true;
      };
      state.dragUpdate = function () {
        var d = state.drag; if (!d || !state.cursor) return;
        var hit = state.invHit(K.mouse.x, K.mouse.y); if (!hit || !dragKinds[hit.kind]) return;
        for (var i = 0; i < d.list.length; i++) if (d.list[i].kind === hit.kind && d.list[i].index === hit.index) return;
        var c = dragGet(hit); if (c && (c.id !== state.cursor.id || c.n >= 64)) return;
        d.list.push(hit);
      };
      state.dragUp = function () {
        var d = state.drag; state.drag = null; if (!d) return false;
        if (d.list.length < 2 || !state.cursor) { var mx = K.mouse.x, my = K.mouse.y; K.mouse.x = d.x; K.mouse.y = d.y; state.uiClick(d.button); K.mouse.x = mx; K.mouse.y = my; return true; }
        var cur = state.cursor, left = cur.n, k = d.list.length, each = d.button === 2 ? 1 : Math.max(1, Math.floor(cur.n / k));
        for (var i = 0; i < k && left > 0; i++) {
          var h = d.list[i], c = dragGet(h), room = 64 - (c ? c.n : 0), put = Math.min(each, left, room); if (put <= 0) continue;
          dragPut(h, { id: cur.id, n: (c ? c.n : 0) + put }); left -= put;
        }
        state.cursor = left > 0 ? { id: cur.id, n: left, free: cur.free } : null; if (state.chestOpen) state.saveChest(); state.reconcile(); K.sfx("click"); return true;
      };
      state.invUpdate = function () { state.furnaceUpdate(1 / 60); state.dragUpdate(); };
      state.uiOpen = function () { return !!(state.showInv || state.showCraft || state.showAch || state.showHelp || state.trade || state.enchanting); };
      state.closeUi = function () { state.returnItems(); state.saveChest(); state.chestOpen = null; state.showInv = state.showCraft = state.showAch = state.showHelp = false; state.trade = null; state.enchanting = false; state.screen = "inv"; };
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
        state.saveT = (state.saveT || 0) + dt; if (state.saveT >= 4) { state.saveT = 0; state.savePlayer(); }
        state.achT += dt; if (state.achT >= 0.5) { state.achT = 0; state.checkAch(); }
        state.hinted = state.hinted || {};   // the way to another world is told once, when the first piece is in your hands
        if (state.ever[151] && !state.hinted.frame) { state.hinted.frame = true; state.say("Geçit: kara kayadan 4 geniş 5 yüksek çerçeve yap (köşeler boş), içi boş kalsın. Cam çerçeve = Gök Adaları."); }
        else if (state.ever[152] && !state.hinted.lighter) { state.hinted.lighter = true; state.say("Çakmak: çerçeveye bakıp sağ tıkla, geçit açılır. İçine girip bekle."); }
        var inLava = get(Math.floor(p.x), Math.floor(p.y + 0.2), Math.floor(p.z)) === LAVA || get(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) === LAVA;
        if (inLava) { state.lavaT = (state.lavaT || 0) + dt; if (state.lavaT >= 0.5) { state.lavaT = 0; state.hurt(2, "lav"); } } else state.lavaT = 0;
        state.hungerT += dt * (state.running ? 1.8 : 1);
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
        var wNow = K.key("w"), sneak = K.key("Shift") && !flying;   // W twice quickly runs until W is let go (Ctrl would close a browser tab with W), Shift sneaks
        state.clock = (state.clock || 0) + dt;
        if (wNow && !state.wWas) { if (state.clock - (state.lastW === undefined ? -9 : state.lastW) < 0.35) state.running = true; state.lastW = state.clock; }
        if (!wNow || sneak) state.running = false;
        state.wWas = wNow;
        var run = !!state.running && !flying && !sneak && f > 0;
        if (!run) state.running = false;
        state.sneaking = sneak;
        var speed = 4.3 * state.sprintMul * (run ? 1.5 : sneak ? 0.35 : flying ? 1.6 : 1) * (state.blocking || state.eating ? 0.6 : 1);
        var len = Math.sqrt(f * f + r * r) || 1;
        var sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
        var wx = (sin * f + cos * r) / len * speed, wz = (-cos * f + sin * r) / len * speed;
        var inWater = get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === WATER;
        var inLavaStep = get(Math.floor(p.x), Math.floor(p.y + 0.2), Math.floor(p.z)) === LAVA || get(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) === LAVA, liquid = inWater || inLavaStep;
        if (inLavaStep) { wx *= 0.35; wz *= 0.35; } else if (inWater) { wx *= 0.5; wz *= 0.5; }   // lava is thick
        p.vx = wx; p.vz = wz;
        var space = K.key(" ");
        if (space && !spaceHeld) { if (state.canFly && state.time0 - lastSpace < 0.3) state.flying = !state.flying; lastSpace = state.time0; }   // twice quickly: fly on / off
        spaceHeld = space;
        flying = state.canFly && state.flying;
        var ladderHere = get(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === LADDER || get(Math.floor(p.x), Math.floor(p.y + 1.2), Math.floor(p.z)) === LADDER;
        if (flying) { p.vy = ((space ? 1 : 0) - (K.key("Shift") ? 1 : 0)) * 6; }
        else if (ladderHere) { p.vy = ((space || K.key("w") ? 1 : 0) - (K.key("Shift") || K.key("s") ? 1 : 0)) * 3; p.peak = p.y; }   // a ladder is climbed, not fallen
        else {
          p.vy -= (liquid ? 8 : 26) * dt;
          if (liquid) p.vy = Math.max(p.vy, inLavaStep ? -1.6 : -3);   // a liquid slows the fall
          if (liquid && sneak && !space) p.vy = Math.min(p.vy, inLavaStep ? -1.6 : -2.5);   // Shift dives
          if (space && (p.onGround || liquid)) { p.vy = inLavaStep ? 2.6 : inWater ? 3.2 : 8.2; if (liquid && get(Math.floor(p.x), Math.floor(p.y + 1.4), Math.floor(p.z)) === AIR) p.vy = 6.5; p.onGround = false; }   // at the surface Space hops out   // swimming up, also out of lava
        }
        p.peak = (p.onGround || liquid || flying) ? p.y : Math.max(p.peak, p.y);
        var nx = p.x + p.vx * dt;   // a step of up to half a block is climbed without jumping (half blocks, stairs)
        var edge = function (x, z) { return sneak && p.onGround && !collides(x, p.y - 0.3, z); };
        if (!collides(nx, p.y, p.z)) { if (!edge(nx, p.z)) p.x = nx; } else if (p.onGround && !flying && !collides(nx, p.y + 0.55, p.z) && !collides(p.x, p.y + 0.55, p.z)) { p.x = nx; p.y += 0.55; } else if (liquid && !flying && !collides(nx, p.y + 1.6, p.z)) p.vy = Math.max(p.vy, inLavaStep ? 6.5 : 9.5); else if (liquid && !flying) p.vy = Math.max(p.vy, inLavaStep ? 2.6 : 3.2);   // swimming into a bank: climb out
        var nz = p.z + p.vz * dt;
        if (!collides(p.x, p.y, nz)) { if (!edge(p.x, nz)) p.z = nz; } else if (p.onGround && !flying && !collides(p.x, p.y + 0.55, nz) && !collides(p.x, p.y + 0.55, p.z)) { p.z = nz; p.y += 0.55; } else if (liquid && !flying && !collides(p.x, p.y + 1.6, nz)) p.vy = Math.max(p.vy, inLavaStep ? 6.5 : 9.5); else if (liquid && !flying) p.vy = Math.max(p.vy, inLavaStep ? 2.6 : 3.2);
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
          var r = skyR, gg = skyG, bb = skyB, k = (j * RW + i) * 4, ar = 0, ag = 0, ab = 0, trans = 1, layers = 0; state.depth[j * RW + i] = 1e9;
          var got = cast(e.x, e.y, e.z, dx, dy, dz, FAR, false, inWater);
          while (got && layers < 4) {   // see-through things show what is behind them: a portal, water seen from outside, glass, the gaps of leaves, plants and ladders
            var tb = hit.b, pass = false, tint = null, alpha = 0;
            if (tb === PORTAL) { var pv = 0.55 + 0.45 * Math.sin((hit.hx + hit.hz) * 5 + hit.hy * 7 + state.phase * 3); tint = [150 * pv, 60 * pv, 230 * pv]; alpha = 0.5; pass = true; }
            else if (tb === WATER && !inWater) { tint = [36, 96, 186]; alpha = 0.4; pass = true; }
            else if (CUT[tb]) {
              var cu, cv;
              if (hit.face === 1) { cu = hit.nx !== 0 ? hit.hz : hit.hx; cv = 1 - hit.hy; } else { cu = hit.hx; cv = hit.hz; }
              cu = Math.floor((cu - Math.floor(cu)) * 16); cv = Math.floor((cv - Math.floor(cv)) * 16);
              if (cutAt(tb, cu, cv)) { pass = true; if (tb === GLASS) { tint = [190, 226, 240]; alpha = 0.12; } }
            }
            if (!pass) break;
            if (tint) { ar += trans * alpha * tint[0]; ag += trans * alpha * tint[1]; ab += trans * alpha * tint[2]; trans *= 1 - alpha; }
            layers++;
            var skipCell = SHAPED(tb) ? null : [hit.x, hit.y, hit.z];
            got = cast(hit.hx + dx * 0.03, hit.hy + dy * 0.03, hit.hz + dz * 0.03, dx, dy, dz, FAR, false, false, skipCell);
          }
          if (got) {
            state.depth[j * RW + i] = hit.t; var tex = texHD(hit.b, hit.face), u, v;
            if (hit.face === 1) { u = hit.nx !== 0 ? hit.hz : hit.hx; v = 1 - hit.hy; } else { u = hit.hx; v = hit.hz; }
            u = Math.floor((u - Math.floor(u)) * 64); v = Math.floor((v - Math.floor(v)) * 64);
            var o = (v * 64 + u) * 3, sh = shade[hit.face] * (0.25 + 0.75 * light) * (hit.nx !== 0 ? 0.92 : 1), fog = Math.min(1, hit.t / FAR);
            fog = fog * fog * 0.85;
            r = tex[o] * sh * (1 - fog) + skyR * fog; gg = tex[o + 1] * sh * (1 - fog) + skyG * fog; bb = tex[o + 2] * sh * (1 - fog) + skyB * fog;
            if (hit.b === WATER) { r = r * 0.7; gg = gg * 0.8; }
            if (hit.b === LAVA) { r = tex[o]; gg = tex[o + 1]; bb = tex[o + 2]; }   // lava glows, night does not darken it
          } else if (dy < -0.05) { r = 20; gg = 20; bb = 30; }
          if (trans < 1) { r = ar + r * trans; gg = ag + gg * trans; bb = ab + bb * trans; }
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
        if (!state.showInv && !state.showCraft && !state.showAch && !state.showHelp) {   // the thing in your hand, bottom right: it sways when you walk and swings when you dig
          var heldId = state.selectedBlock(), sp = Math.min(1, Math.sqrt(state.p.vx * state.p.vx + state.p.vz * state.p.vz) / 4), digging = state.mining && state.mining.progress > 0;
          var hx = g.width - 290 + Math.sin(state.phase * 7) * 5 * sp, hy = g.height - 150 + Math.abs(Math.cos(state.phase * 7)) * 6 * sp + (digging ? Math.sin(state.phase * 16) * 14 : 0), hs = 104;
          if (state.eating && heldId) {   // eating: the food comes up to the mouth, shrinks bite by bite and crumbs fly
            var ee = state.eating, eat01 = ee.t / 1.6, bob = Math.abs(Math.sin(ee.t * 18)) * 12, size = hs * (1 - 0.45 * eat01);
            drawIcon(c, heldId, g.width / 2 - size / 2 + 40, g.height - 200 + bob + eat01 * 30, size);
            var fc = (COLORS[heldId] || [[200, 160, 80]])[0]; c.fillStyle = "rgb(" + fc[0] + "," + fc[1] + "," + fc[2] + ")";
            for (var cr = 0; cr < 5; cr++) { var seed2 = Math.floor(ee.t * 6) * 7 + cr; c.fillRect(g.width / 2 + 40 + ((seed2 * 37) % 50) - 25, g.height - 150 + ((seed2 * 53) % 40) + (ee.t * 60) % 20, 4, 4); }
            c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(g.width / 2 - 30, g.height / 2 + 36, 60, 5); c.fillStyle = "#a5d6a7"; c.fillRect(g.width / 2 - 30, g.height / 2 + 36, 60 * eat01, 5);
          } else if (state.blocking && heldId) {   // a raised sword: held across in front of you
            c.save(); c.translate(g.width / 2 + 30, g.height - 90); c.rotate(-0.7); drawIcon(c, heldId, -70, -90, 150); c.restore();
          } else if (heldId) drawIcon(c, heldId, hx, hy, hs);
          else { c.fillStyle = "#d9a27a"; c.fillRect(hx + 40, hy + 30, 44, 84); c.fillStyle = "#b8835e"; c.fillRect(hx + 40, hy + 96, 44, 18); }   // an empty hand
        }
        var bar = state.hotbar().slice(0, 9), slot = 38, x0 = g.width / 2 - 9 * slot / 2, y0 = g.height - slot - 8;
        var lv = state.levelInfo();   // the experience bar over the hotbar
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(x0, y0 - 6, 9 * slot, 4); c.fillStyle = "#8bc34a"; c.fillRect(x0, y0 - 6, 9 * slot * lv.into / lv.need, 4);
        if (lv.level > 0) { c.fillStyle = "#c5e1a5"; c.font = "bold 12px sans-serif"; c.textAlign = "center"; c.fillText(String(lv.level), g.width / 2, y0 - 9); c.textAlign = "left"; }
        if (state.mining && state.mining.need > 0 && state.mining.progress > 0) {   // the block being dug
          c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(g.width / 2 - 30, g.height / 2 + 18, 60, 6);
          c.fillStyle = "#ffe082"; c.fillRect(g.width / 2 - 30, g.height / 2 + 18, 60 * Math.min(1, state.mining.progress / state.mining.need), 6);
        }
        for (var i = 0; i < 9; i++) {
          c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(x0 + i * slot, y0, slot - 3, slot - 3);
          c.strokeStyle = i === state.slot ? "#fff" : "rgba(255,255,255,0.3)"; c.lineWidth = i === state.slot ? 3 : 1;
          c.strokeRect(x0 + i * slot, y0, slot - 3, slot - 3);
          if (bar[i]) {
            drawIcon(c, bar[i], x0 + i * slot + 4, y0 + 2, slot - 9);
            c.fillStyle = "#fff"; c.font = "12px sans-serif"; c.fillText(state.creative ? "∞" : (state.slots[i].n > 1 ? String(state.slots[i].n) : ""), x0 + i * slot + 4, y0 + slot - 7);
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
        if (state.showInv) {   // the inventory screen: the pockets' grid or the table's or the furnace's on top, what you hold below, the bar at the bottom
          var L = invLayout(), cellPx = L.cell - 4; state.reconcile();
          c.fillStyle = "rgba(20,20,24,0.95)"; c.fillRect(L.x0, L.y0, L.w, L.h); c.strokeStyle = "#8a8a92"; c.lineWidth = 2; c.strokeRect(L.x0, L.y0, L.w, L.h);
          c.fillStyle = "#fff"; c.font = "bold 15px sans-serif"; c.fillText(state.screen === "table" ? "Üretim masası" : state.screen === "furnace" ? "Fırın" : state.screen === "chest" ? "Sandık" : "Envanter" + (state.creative ? "  (yaratıcı mod)" : ""), L.x0 + 12, L.y0 + 22);
          var slotBox = function (x, y, on) { c.fillStyle = on ? "rgba(255,224,130,0.30)" : "rgba(90,90,98,0.55)"; c.fillRect(x, y, cellPx, cellPx); c.strokeStyle = on ? "#ffe082" : "#2c2c32"; c.lineWidth = on ? 2 : 1; c.strokeRect(x, y, cellPx, cellPx); };
          var stack = function (x, y, id, n, on) {
            slotBox(x, y, on); if (!id) return;
            drawIcon(c, id, x + 4, y + 4, cellPx - 8);
            if (!state.creative && n > 1) { c.fillStyle = "#fff"; c.font = "bold 11px sans-serif"; c.textAlign = "right"; c.fillText(String(n), x + cellPx - 3, y + cellPx - 4); c.textAlign = "left"; }
          };
          var arrow = function (x, y) { c.fillStyle = "#cfd8dc"; c.font = "bold 22px sans-serif"; c.fillText("→", x, y); };
          if (L.chest && state.chestOpen) {
            for (var chi = 0; chi < 27; chi++) { var chs = state.chestOpen.slots[chi]; stack(L.x0 + 10 + (chi % 9) * L.cell, L.cellY + Math.floor(chi / 9) * L.cell, chs && chs.id, chs && chs.n); }
          } else if (L.size) {
            for (var ti = 0; ti < L.size * L.size; ti++) { var tc = state.cells[ti]; stack(L.cellX + (ti % L.size) * L.cell, L.cellY + Math.floor(ti / L.size) * L.cell, tc && tc.id, tc && tc.n); }
            var made = state.matchResult(); arrow(L.resX - 30, L.resY + 26); stack(L.resX, L.resY, made && made.give[0], made && made.give[1], !!made);
            c.fillStyle = "#9a9aa2"; c.font = "11px sans-serif"; c.fillText(L.size === 3 ? "3x3 ızgaraya diz" : "2x2 ızgaraya diz", L.x0 + 12, L.cellY + 16);
          } else {
            var fs = state.furn; stack(L.fin.x, L.fin.y, fs.input && fs.input.id, fs.input && fs.input.n); stack(L.ffuel.x, L.ffuel.y, fs.fuel && fs.fuel.id, fs.fuel && fs.fuel.n); stack(L.fout.x, L.fout.y, fs.out && fs.out.id, fs.out && fs.out.n);
            c.fillStyle = "#9a9aa2"; c.font = "11px sans-serif"; c.fillText("eritilecek", L.fin.x + 44, L.fin.y + 22); c.fillText("yakıt (kömür...)", L.ffuel.x + 44, L.ffuel.y + 22);
            c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(L.fin.x + 56, L.fin.y + 44, 90, 6); c.fillStyle = "#ffab40"; c.fillRect(L.fin.x + 56, L.fin.y + 44, 90 * Math.min(1, fs.progress / 1.6), 6); arrow(L.fout.x - 38, L.fout.y + 26);
          }
          for (var gi = 0; gi < 27; gi++) { var gs = state.slots[9 + gi]; stack(L.x0 + 10 + (gi % 9) * L.cell, L.gridY + Math.floor(gi / 9) * L.cell, gs && gs.id, gs && gs.n); }
          c.fillStyle = "#9a9aa2"; c.font = "11px sans-serif"; c.fillText("Çubuk (1-9)   ", L.x0 + 12, L.barY - 3); c.fillStyle = "#7d7d86"; c.fillText("sol tık: al/koy   sağ tık: yarısı/bir tane   boş yere tık: geri koy   üstündeyken 1-9: çubuğa koy", L.x0 + 12, L.barY + L.cell + 16);
          for (var bi = 0; bi < 9; bi++) { var bs = state.slots[bi]; stack(L.x0 + 10 + bi * L.cell, L.barY, bs && bs.id, bs && bs.n, bi === state.slot); }
          var over = state.invHit(K.mouse.x, K.mouse.y), tipId = 0, tipExtra = "";
          if (over) {
            if (over.kind === "slot" && over.id) { tipId = over.id; tipExtra = state.creative ? "" : "  x" + state.slots[over.index].n; if (D.toolOf(over.id)) tipExtra += "  hasar " + state.damageOf(over.id); }
            else if (over.kind === "cell" && state.cells[over.index]) tipId = state.cells[over.index].id;
            else if (over.kind === "chest" && state.chestOpen && state.chestOpen.slots[over.index]) tipId = state.chestOpen.slots[over.index].id;
            else if (over.kind === "result") { var rm = state.matchResult(); if (rm) tipId = rm.give[0]; }
          }
          if (tipId && !state.cursor) {
            var tip = NAMES[tipId] + tipExtra + (state.enchantNote ? state.enchantNote(tipId) : ""), tw = c.measureText ? c.measureText(tip).width + 14 : 120;
            c.fillStyle = "rgba(10,10,14,0.95)"; c.fillRect(K.mouse.x + 12, K.mouse.y - 4, tw, 22); c.fillStyle = "#fff"; c.font = "12px sans-serif"; c.fillText(tip, K.mouse.x + 19, K.mouse.y + 11);
          }
          if (state.cursor) stack(K.mouse.x - 16, K.mouse.y - 16, state.cursor.id, state.cursor.n, false);   // the stack in the hand follows the mouse
        }
        if (state.trade) {
          var tr = state.trade;
          c.fillStyle = "rgba(30,22,12,0.94)"; c.fillRect(g.width / 2 - 200, 60, 400, 220); c.strokeStyle = "#d7b56d"; c.lineWidth = 2; c.strokeRect(g.width / 2 - 200, 60, 400, 220);
          c.fillStyle = "#ffe0a3"; c.font = "bold 15px sans-serif"; c.fillText("KÖYLÜ  (" + tr.profession + ")", g.width / 2 - 188, 84);
          c.fillStyle = "#cfd8dc"; c.font = "12px sans-serif"; c.fillText("yukarı/aşağı seç, Enter ya da 1-4 takas et, Esc kapat   zümrütün var: " + (inv.count[161] || 0), g.width / 2 - 188, 102);
          tr.offers.forEach(function (of, n) {
            var ok = state.canTrade(of), y = 116 + n * 36;
            if (n === tr.cursor) { c.fillStyle = "rgba(255,224,163,0.16)"; c.fillRect(g.width / 2 - 192, y - 4, 384, 32); }
            var x = g.width / 2 - 188;
            of.give.forEach(function (gv) { drawIcon(c, gv[0], x, y, 22); c.fillStyle = ok ? "#fff" : "#8a8a8a"; c.font = "13px sans-serif"; c.fillText(String(gv[1]), x + 24, y + 16); x += 56; });
            c.fillStyle = ok ? "#ffe0a3" : "#8a8a8a"; c.fillText("→", x, y + 16); x += 24;
            of.get.forEach(function (gt) { drawIcon(c, gt[0], x, y, 22); c.fillStyle = ok ? "#fff" : "#8a8a8a"; c.fillText(String(gt[1]) + "  " + NAMES[gt[0]], x + 24, y + 16); x += 150; });
          });
        }
        if (state.enchanting) {
          var items = state.enchantable(), lvi = state.levelInfo();
          c.fillStyle = "rgba(24,12,40,0.94)"; c.fillRect(g.width / 2 - 200, 40, 400, 290); c.strokeStyle = "#9c6ade"; c.lineWidth = 2; c.strokeRect(g.width / 2 - 200, 40, 400, 290);
          c.fillStyle = "#e1bee7"; c.font = "bold 15px sans-serif"; c.fillText("BÜYÜ MASASI", g.width / 2 - 188, 64);
          c.fillStyle = "#cfd8dc"; c.font = "12px sans-serif"; c.fillText("Seviye: " + lvi.level + "   Lapis: " + (state.creative ? "∞" : inv.count[159] || 0) + "   yukarı/aşağı eşya seç, 1-2-3 büyü yap (n lapis + n seviye), Esc kapat", g.width / 2 - 188, 82);
          if (!items.length) { c.fillStyle = "#9a9aa2"; c.font = "13px sans-serif"; c.fillText("Büyülenecek alet, kılıç ya da zırhın yok.", g.width / 2 - 188, 120); }
          state.enchCursor = Math.min(state.enchCursor, Math.max(0, items.length - 1));
          var first = Math.floor(state.enchCursor / 8) * 8;
          items.slice(first, first + 8).forEach(function (id, n) {
            if (first + n === state.enchCursor) { c.fillStyle = "rgba(225,190,231,0.18)"; c.fillRect(g.width / 2 - 192, 94 + n * 28, 384, 26); }
            drawIcon(c, id, g.width / 2 - 190, 96 + n * 28, 22); c.fillStyle = "#fff"; c.font = "13px sans-serif"; c.fillText(NAMES[id] + state.enchantNote(id), g.width / 2 - 160, 112 + n * 28);
          });
        }
        if (state.showCraft) {
          c.fillStyle = "rgba(0,0,0,0.82)"; c.fillRect(g.width / 2 - 200, 40, 400, 270);
          c.fillStyle = "#fff"; c.font = "15px sans-serif"; c.fillText("TARİFLER  (yukarı/aşağı seç, Enter yap, X kapat)", g.width / 2 - 188, 64);
          var list = state.craftList(), st = state.stations(), page = state.craftPage();
          state.craftCursor = Math.min(state.craftCursor, Math.max(0, list.length - 1)); page = state.craftPage();
          c.fillStyle = "#cfd8dc"; c.font = "12px sans-serif"; c.fillText("El" + (st.table ? " + üretim masası" : "") + (st.furnace ? " + fırın" : "") + (st.table && st.furnace ? "" : "   (masa ya da fırın yanında olunca tarifleri açılır)"), g.width / 2 - 188, 80);
          list.slice(page, page + 8).forEach(function (r, n) {
            var ok = state.canCraft(r), at = page + n === state.craftCursor, where = r.where === "table" ? "masa" : r.where === "furnace" ? "fırın" : "";
            if (at) { c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(g.width / 2 - 192, 74 + n * 28, 384, 26); }
            drawIcon(c, r.give[0], g.width / 2 - 190, 76 + n * 28, 22);
            c.fillStyle = ok ? "#a5d6a7" : "#8a8a8a"; c.font = "13px sans-serif";
            c.fillText((n + 1) + ". " + r.name + "  [" + r.need.map(function (q) { return q[1] + " " + NAMES[q[0]]; }).join(" + ") + "] " + (where ? "(" + where + ")" : ""), g.width / 2 - 160, 92 + n * 28);
          });
          c.fillStyle = "#cfd8dc"; c.font = "12px sans-serif"; c.fillText("sayfa " + (page / 8 + 1) + "/" + Math.ceil(list.length / 8) + "   kömür yakıt: " + (state.fuel || 0) + " eritme hakkı", g.width / 2 - 186, 300);
        }
        if (state.showAch) {
          var done = D.ACH.filter(function (a) { return state.ach[a.id]; }).length;
          c.fillStyle = "rgba(0,0,0,0.88)"; c.fillRect(g.width / 2 - 300, 24, 600, 340);
          c.fillStyle = "#fff"; c.font = "16px sans-serif"; c.fillText("BAŞARIMLAR  " + done + "/" + D.ACH.length + "   (B kapatır)", g.width / 2 - 285, 52);
          D.ACH.forEach(function (a, n) {
            var col = n % 3, row = Math.floor(n / 3), ok = !!state.ach[a.id];   // three columns, so that all of them fit on the screen
            c.fillStyle = ok ? "#ffd54f" : "#6f6f6f"; c.font = "bold 13px sans-serif"; c.fillText((ok ? "★ " : "☆ ") + a.name, g.width / 2 - 285 + col * 196, 80 + row * 30);
            c.fillStyle = ok ? "#cfd8dc" : "#555"; c.font = "11px sans-serif"; c.fillText(a.desc, g.width / 2 - 267 + col * 196, 94 + row * 30);
          });
        }
        if (state.showHelp) {
          c.fillStyle = "rgba(0,0,0,0.8)"; c.fillRect(g.width / 2 - 190, 50, 380, 250);
          c.fillStyle = "#fff"; c.font = "14px sans-serif";
          ["KONTROLLER", "W A S D  yürü     Boşluk  zıpla     W'ya iki kez bas  koş     Shift  eğil", "Fare ya da oklar  bak (önce sayfaya tıkla)", "Sol tık  blok kır / vur        Sağ tık  blok koy / ye / aç",
           "Tekerlek / Q / 1-9  eşya seç", "E  envanter + üretim ızgarası   B  başarımlar   C  yaratıcı mod", "Kazarken en iyi aletin kullanılır; masa ve fırın yakında olmalı", "G ya da Boşluk'a iki kez bas  uç (uçma özelliğiyle)", "H  bu yardımı kapat"].forEach(function (line, n) {
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
        canvas.addEventListener("click", function () { if (!state.menu.open && !state.uiOpen() && canvas.requestPointerLock && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (e) { /* no lock: keys still work */ } } });
        document.addEventListener("pointerlockchange", function () { if (document.pointerLockElement !== canvas && !state.menu.open && !state.uiOpen() && g.current === "play" && state.menuStarted) state.openMenu("pause"); });   // Esc gives the mouse back: the pause menu opens
        document.addEventListener("mousemove", function (e) { if (document.pointerLockElement === canvas && !state.menu.open) if (Math.abs(e.movementX) < 250 && Math.abs(e.movementY) < 250) state.look(e.movementX * 0.0025, e.movementY * 0.0025); });   // a browser now and then reports a huge jump: ignored
        canvas.addEventListener("mousedown", function (e) {
          if (state.menu.open) return;
          if (state.uiOpen()) { if (state.showInv) { var bt = e.button === 2 ? 2 : 0; if (!state.dragDown(bt)) state.uiClick(bt); } return; }
          if (e.button === 0) mouseLeft = true; else if (e.button === 2) state.rightDown();
        });
        document.addEventListener("mouseup", function (e) { if (state.drag) state.dragUp(); if (e.button === 0) mouseLeft = false; else if (e.button === 2) state.rightUp(); });
        canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
        var flush = function () { if (state.savePlayer) state.savePlayer(); };   // leaving the page keeps the game
        document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });
        if (root.addEventListener) { root.addEventListener("pagehide", flush); root.addEventListener("beforeunload", flush); }
        canvas.addEventListener("wheel", function (e) { e.preventDefault(); if (state.showCraft) state.menuMove(e.deltaY > 0 ? 1 : -1); else if (state.showInv) state.invScroll = Math.max(0, state.invScroll + (e.deltaY > 0 ? 1 : -1)); else state.cycle(e.deltaY > 0 ? 1 : -1); }, { passive: false });
      }

      var held = {};
      function once(key, fn) { var now = K.key(key); if (now && !held[key]) { held[key] = true; fn(); } else if (!now) held[key] = false; }
      g.scene("play", {
        update: function (game, dt) {
          if (state.menu.open) { state.menuUpdate(dt); return; }
          state.invUpdate(); state.useUpdate(dt);
          if (state.uiOpen() && typeof document !== "undefined" && document.pointerLockElement && document.exitPointerLock) { try { document.exitPointerLock(); } catch (e) { /* not locked */ } }   // a screen with items needs the mouse
          once("Escape", function () { if (state.uiOpen()) state.closeUi(); else state.openMenu("pause"); });
          state.step(dt);
          if (K.voxel.keyActions) once("e", state.placeBlock); else once("e", function () { if (state.showInv) state.closeUi(); else state.openScreen("inv"); });   // E opens the inventory (F and E as keys for digging and placing are only for the tests)
          once("q", function () { state.cycle(1); });
          once("i", function () { if (state.showInv) state.closeUi(); else state.openScreen("inv"); }); once("Tab", function () { if (state.showInv) state.closeUi(); else state.openScreen("inv"); });
          once("c", function () { state.setCreative(!state.creative); }); once("h", function () { state.showHelp = !state.showHelp; });
          once("g", function () { if (state.canFly) state.flying = !state.flying; });
          once("x", function () { if (state.showInv) state.closeUi(); else state.openScreen("inv"); });
          once("b", function () { state.showAch = !state.showAch; });
          once("ArrowUp", function () { if (state.showCraft) state.menuMove(-1); else if (state.enchanting) state.enchCursor = Math.max(0, state.enchCursor - 1); else if (state.trade) state.trade.cursor = Math.max(0, state.trade.cursor - 1); }); once("ArrowDown", function () { if (state.showCraft) state.menuMove(1); else if (state.enchanting) state.enchCursor = Math.min(Math.max(0, state.enchantable().length - 1), state.enchCursor + 1); else if (state.trade) state.trade.cursor = Math.min(state.trade.offers.length - 1, state.trade.cursor + 1); });
          once("Enter", function () { if (state.showCraft) state.craft(state.craftList()[state.craftCursor]); else if (state.trade) state.doTrade(state.trade.offers[state.trade.cursor]); });
          for (var n = 1; n <= 9; n++) (function (num) { once(String(num), function () { if (state.showInv && state.hoverSlot(num)) return; if (state.showCraft) state.craft(state.craftList()[state.craftPage() + num - 1]); else if (state.enchanting) { if (num <= 3) state.enchant(state.enchantable()[state.enchCursor], num); } else if (state.trade) { if (num <= state.trade.offers.length) { state.trade.cursor = num - 1; state.doTrade(state.trade.offers[num - 1]); } } else state.select(state.windowStart() + num - 1); }); })(n);
          var cur = state.selectedBlock(); if (cur !== state.lastSel) { state.lastSel = cur; state.nameT = 2; } state.nameT -= dt;
          state.mineStep(dt, ((K.voxel.keyActions && K.key("f")) || mouseLeft) && !state.uiOpen());   // holding the left button digs
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
