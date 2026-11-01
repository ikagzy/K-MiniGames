/* kgame.fps.js: birinci şahıs nişancı kiti (fps). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'fps', title:'Sığınak', theme:'bunker', difficulty:3, levels:3, size:'medium', enemies:['guard','runner','sniper'], weapons:['pistol','shotgun','rifle'], boss:true, ammo:'normal', mode:'campaign', world:{seed:5}, features:['regen'] })
   Kit; tohumdan bölümler üretir (odalar, koridorlar, kapılar, kilitli kapı ve anahtar, çıkış), düşük çözünürlüklü ışın izlemeyle birinci şahıs görüntüyü çizer (160x100, ölçeklenir),
   düşmanları (nöbetçi, koşucu, keskin nişancı, iri, taret, patron) ve toplanan şeyleri (can, zırh, mermi, anahtar) hazır getirir. Kontroller: W A S D yürür, FARE bakar, yukarı aşağı da (oklar da bakar; önce ekrana tıkla),
   sol tık / Boşluk ateş, 1-4 / Q / tekerlek silah, Shift koşar, E kapıyı açar, Esc duraklatır. Mod: campaign (bölümler) ya da arena (dalgalar). Özellikler: sprint, regen, armor.
   Önce kgame.js, kgame.kits.js ve kgame.audio2.js yüklenmiş olmalı. Doku, düşman ve silah çizimlerinin hepsi kodla üretilir. */
(function (root) {
  var K = root.K;
  var RW = 160, RH = 100, FOV = 1.15, FAR = 22, R = 0.28;

  var THEMES = {
    bunker: { wall: [[128, 120, 108], [96, 92, 86], [110, 100, 84]], floor: [44, 42, 38], ceil: [30, 30, 34], fog: [12, 12, 14], accent: [220, 170, 60] },
    space: { wall: [[90, 110, 150], [70, 84, 120], [110, 130, 170]], floor: [24, 28, 46], ceil: [14, 16, 30], fog: [6, 8, 18], accent: [90, 220, 255] },
    ruins: { wall: [[150, 130, 96], [124, 106, 78], [108, 120, 84]], floor: [70, 60, 44], ceil: [90, 110, 130], fog: [60, 70, 80], accent: [230, 200, 120] },
    lab: { wall: [[200, 206, 212], [160, 170, 182], [140, 200, 190]], floor: [90, 96, 104], ceil: [170, 176, 184], fog: [40, 48, 56], accent: [90, 230, 140] },
    factory: { wall: [[140, 96, 72], [104, 80, 66], [120, 120, 124]], floor: [52, 46, 42], ceil: [34, 30, 28], fog: [20, 16, 14], accent: [255, 140, 40] }
  };
  var SIZES = { small: 24, medium: 32, large: 44 };
  var AMMO = { scarce: 0.6, normal: 1, plenty: 1.7 };
  var MODES = ["campaign", "arena", "tactical"];
  // ---- hand made maps for the arena and the tactical mode: # wall, % panel, = stripe, . floor, S your start, A and B the sites, e a defender, h health, a ammo ----
  var MAPS = {"depo": ["############################", "#S.....#.........#.........#", "#......#..%%..%%..#....B...#", "#......#..%%..%%..#........#", "#..h...#..........#..e.....#", "#......#.....e....#........#", "#......##.######.##...######", "#............#.#...........#", "#............#.#.....e.....#", "######..%%...#.#...........#", "#...........#.##########.###", "#.e.....%%...#............a#", "#............#.....e.......#", "#..%%........###.###....####", "#..%%....e.......#.#.....#.#", "#........%%......#.#....#.h#", "#..A.....%%......#.#....e#.#", "#.....h..........#.#.....#.#", "#................#.#.......#", "############################"], "liman": ["############################", "#S.........=.........=.....#", "#..........=....e....=..B..#", "#..%%......=.........=.....#", "#..%%......=====.=====..e..#", "#..........................#", "#....h.....................#", "#.......%%.......%%.....a..#", "#.......%%...e...%%........#", "#..........................#", "#=====.=====....=====.=====#", "#..........................#", "#..A....e..........e.......#", "#..........................#", "#...%%....h....%%......%%..#", "#...%%..........%%.....%%..#", "#..........................#", "#.....a....................#", "#..........................#", "############################"], "kale": ["############################", "#S...#.........#...........#", "#....#.........#....e......#", "#....#...e.....#...........#", "#....#.........#.....B.....#", "#....#####.#####...........#", "#..........................#", "#..h.......................#", "###.######..........#####.##", "#.....#...%%.....%%.#......#", "#..e..#...%%..e..%%.#...a..#", "#.....#.............#......#", "#.....#.............#....e.#", "#.A...#####.###.#####......#", "#.....e..................h.#", "#..........................#", "#...%%.........%%....%%....#", "#...%%.........%%....%%....#", "#..........................#", "############################"], "tunel": ["############################", "#S.....#...........#.......#", "#......#.====.====.#...B...#", "#..h...#.=..........#..e...#", "#......#.=..e.......#......#", "#......#.=..........#......#", "#......#.====.====.#....e..#", "#..........................#", "######.##########.##########", "#..........................#", "#...e..%%........%%...e....#", "#......%%...h....%%........#", "#..........................#", "#.A........................#", "#..........e...............#", "#...%%.........%%........a.#", "#...%%.........%%..........#", "#..........................#", "#..........................#", "############################"]};
  var BUY = { pistol: 0, shotgun: 900, rifle: 2900, magnum: 1600 }, ARMOR_COST = 650;   // the prices of the buy phase (credits)
  function mapLevel(name, spec) {
    var rows = MAPS[name], H = rows.length, W = rows[0].length, cells = new Uint8Array(W * H), start = { x: 1.5, y: 1.5 }, sites = [], spawns = [], pickups = [], x, y, types = AMMO_TYPES_OF(spec.weapons), scale = AMMO[spec.ammo] || 1;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var c = rows[y].charAt(x); cells[y * W + x] = c === "#" ? 1 : c === "%" ? 2 : c === "=" ? 3 : 0;
      if (c === "S") start = { x: x + 0.5, y: y + 0.5 };
      else if (c === "A" || c === "B") sites.push({ name: c, x: x + 0.5, y: y + 0.5 });
      else if (c === "e") spawns.push({ x: x + 0.5, y: y + 0.5 });
      else if (c === "h") pickups.push({ kind: "health", x: x + 0.5, y: y + 0.5, n: 25 });
      else if (c === "a") pickups.push({ kind: "ammo", ammo: types[0], x: x + 0.5, y: y + 0.5, n: Math.round(AMMO_PACK[types[0]] * scale) });
    }
    return { W: W, H: H, cells: cells, rooms: [{ x: 1, y: 1, w: W - 2, h: H - 2, cx: W >> 1, cy: H >> 1 }], start: start, exit: null, locked: null, doors: [], enemies: [], pickups: pickups, theme: spec.theme, arena: true, map: name, sites: sites, spawns: spawns };
  }
  var KINDS = {
    guard: { name: "nöbetçi", hp: 30, speed: 1.3, range: 11, dmg: 7, cd: 1.4, acc: 0.45, size: 1, pal: { h: [150, 170, 120], b: [70, 100, 70], l: [50, 60, 50], g: [30, 30, 30], s: [220, 180, 140] } },
    runner: { name: "koşucu", hp: 22, speed: 2.7, range: 0, dmg: 9, cd: 0.7, acc: 1, size: 0.95, melee: true, pal: { h: [210, 120, 110], b: [170, 50, 50], l: [90, 30, 30], g: [60, 20, 20], s: [230, 170, 150] } },
    sniper: { name: "keskin nişancı", hp: 24, speed: 0.9, range: 17, dmg: 18, cd: 2.6, acc: 0.8, size: 1, pal: { h: [120, 140, 170], b: [60, 70, 110], l: [40, 44, 70], g: [20, 20, 28], s: [220, 180, 140] } },
    brute: { name: "iri", hp: 100, speed: 1.0, range: 7, dmg: 14, cd: 1.6, acc: 0.55, size: 1.25, pal: { h: [190, 150, 90], b: [140, 100, 50], l: [90, 64, 36], g: [40, 30, 20], s: [210, 160, 120] } },
    turret: { name: "taret", hp: 45, speed: 0, range: 13, dmg: 5, cd: 0.45, acc: 0.5, size: 0.85, static: true, pal: { h: [150, 150, 160], b: [100, 100, 112], l: [70, 70, 80], g: [255, 80, 60], s: [200, 200, 210] } }
  };
  var BOSS = { name: "patron", hp: 480, speed: 1.2, range: 15, dmg: 9, cd: 1.1, acc: 0.6, size: 1.7, boss: true, pellets: 3, pal: { h: [200, 60, 200], b: [120, 30, 130], l: [70, 20, 80], g: [255, 220, 60], s: [230, 190, 230] } };
  var WEAPONS = {
    pistol: { name: "tabanca", dmg: 16, gap: 0.32, pellets: 1, spread: 0.012, ammo: "bullets", auto: false },
    shotgun: { name: "pompalı", dmg: 9, gap: 0.85, pellets: 8, spread: 0.09, ammo: "shells", auto: false },
    rifle: { name: "tüfek", dmg: 11, gap: 0.11, pellets: 1, spread: 0.03, ammo: "bullets", auto: true },
    magnum: { name: "magnum", dmg: 70, gap: 1.0, pellets: 1, spread: 0.005, ammo: "heavy", auto: false }
  };
  var WEAPON_ORDER = ["pistol", "shotgun", "rifle", "magnum"];
  var START_AMMO = { bullets: 60, shells: 12, heavy: 8 }, AMMO_PACK = { bullets: 24, shells: 6, heavy: 4 }, AMMO_MAX = { bullets: 200, shells: 40, heavy: 24 };

  // ---- small helpers ----
  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(a, b, c) { var n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; n = (n ^ (n >>> 13)) * 1103515245 | 0; return (((n ^ (n >>> 16)) >>> 0) % 65536) / 65536; }

  // ---- level generation: rooms in a chain joined by corridors, doors on the way, a locked door in front of the last room with its key somewhere before ----
  function genLevel(seed, index, spec, last) {
    var W = SIZES[spec.size] || 32, H = W, d = spec.difficulty, rnd, tries;
    for (tries = 0; tries < 30; tries++) {
      rnd = rng(seed + tries * 977);
      var cells = new Uint8Array(W * H).fill(1), rooms = [], att, i, x, y;
      var want = 5 + Math.floor(W / 8);
      for (att = 0; att < 300 && rooms.length < want; att++) {
        var rw = 4 + Math.floor(rnd() * 5), rh = 4 + Math.floor(rnd() * 5), rx = 2 + Math.floor(rnd() * (W - rw - 4)), ry = 2 + Math.floor(rnd() * (H - rh - 4)), ok = true;
        for (i = 0; i < rooms.length; i++) { var o = rooms[i]; if (rx < o.x + o.w + 2 && rx + rw + 2 > o.x && ry < o.y + o.h + 2 && ry + rh + 2 > o.y) { ok = false; break; } }
        if (ok) rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
      }
      if (rooms.length < 4) continue;
      rooms.forEach(function (r) { for (y = r.y; y < r.y + r.h; y++) for (x = r.x; x < r.x + r.w; x++) cells[y * W + x] = 0; });
      var inRoom = function (px, py, r) { return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h; };
      var corridors = [];
      var join = function (a, b) {   // an L-shaped corridor from the middle of a to the middle of b; its cells in order
        var path = [], cx = a.cx, cy = a.cy;
        while (cx !== b.cx) { cx += cx < b.cx ? 1 : -1; path.push([cx, cy]); }
        while (cy !== b.cy) { cy += cy < b.cy ? 1 : -1; path.push([cx, cy]); }
        path.forEach(function (c) { if (cells[c[1] * W + c[0]] === 1) cells[c[1] * W + c[0]] = 0; });
        corridors.push({ a: a, b: b, path: path });
      };
      for (i = 0; i < rooms.length - 1; i++) join(rooms[i], rooms[i + 1]);
      for (i = 0; i < 2; i++) { var a = Math.floor(rnd() * (rooms.length - 2)), b = Math.floor(rnd() * (rooms.length - 2)); if (a !== b) join(rooms[a], rooms[b]); }   // loops, never into the last room
      var start = rooms[0], exit = rooms[rooms.length - 1];
      // the wall kinds: three variants by position, so that the walls are not all the same
      for (i = 0; i < W * H; i++) if (cells[i] === 1) cells[i] = 1 + Math.floor(hash(seed + 11, i % W >> 2, Math.floor(i / W) >> 2) * 3);
      // doors: where a corridor of the chain enters a room (not the first room); the last one is locked
      var last = corridors[rooms.length - 2], doorList = [], locked = null;
      var firstOutside = function (c) { for (var k = 0; k < c.path.length; k++) { var p = c.path[k]; if (!inRoom(p[0], p[1], c.a) && !inRoom(p[0], p[1], c.b)) return k; } return -1; };
      var lastK = -1, kk;
      for (kk = last.path.length - 1; kk >= 0; kk--) if (!inRoom(last.path[kk][0], last.path[kk][1], exit)) { lastK = kk; break; }
      if (lastK >= 0) { locked = last.path[lastK]; cells[locked[1] * W + locked[0]] = 9; }
      for (i = 0; i < rooms.length - 2; i++) {
        var c = corridors[i], k;
        for (k = c.path.length - 1; k >= 0; k--) if (!inRoom(c.path[k][0], c.path[k][1], rooms[i + 1])) break;
        if (k >= 0 && rnd() < 0.7) { var pp = c.path[k]; if (cells[pp[1] * W + pp[0]] === 0) { cells[pp[1] * W + pp[0]] = 8; doorList.push(pp); } }
      }
      // distances from the start without passing the locked door (the key room must be reachable, the exit room must not)
      var reach = bfs(cells, W, H, Math.floor(start.cx), Math.floor(start.cy), function (cv) { return cv === 0 || cv === 8; });
      var keyRoom = rooms[Math.max(1, Math.floor((rooms.length - 1) / 2))];
      if (locked && (reach[exit.cy * W + exit.cx] >= 0 || reach[keyRoom.cy * W + keyRoom.cx] < 0)) continue;
      var level = { W: W, H: H, cells: cells, rooms: rooms, start: { x: start.cx + 0.5, y: start.cy + 0.5 }, exit: { x: exit.cx + 0.5, y: exit.cy + 0.5 }, locked: locked, doors: doorList, enemies: [], pickups: [], theme: spec.theme };
      var weapons = spec.weapons, kinds = spec.enemies;
      var free = function (r) { return { x: r.x + 1 + Math.floor(rnd() * (r.w - 2)) + 0.5, y: r.y + 1 + Math.floor(rnd() * (r.h - 2)) + 0.5 }; };
      var scale = AMMO[spec.ammo] || 1;
      for (i = 1; i < rooms.length; i++) {
        var room = rooms[i], area = room.w * room.h, n = Math.max(1, Math.min(6, Math.round(area / 18 * (0.55 + 0.22 * d) * (1 + index * 0.12))));
        if (i === rooms.length - 1 && last_boss(spec, index, spec.levels)) { var bp = free(room); level.enemies.push({ kind: "boss", x: room.cx + 0.5, y: room.cy + 0.5 }); n = Math.min(n, 2); }
        for (var e = 0; e < n; e++) { var p2 = free(room), kind = kinds[Math.floor(rnd() * kinds.length)]; if (Math.abs(p2.x - room.cx - 0.5) < 0.1 && Math.abs(p2.y - room.cy - 0.5) < 0.1) continue; level.enemies.push({ kind: kind, x: p2.x, y: p2.y }); }
        if (rnd() < 0.55) level.pickups.push({ kind: "health", x: free(room).x, y: free(room).y, n: 25 });
        if (rnd() < 0.35) level.pickups.push({ kind: "armor", x: free(room).x, y: free(room).y, n: 25 });
        var type = AMMO_TYPES_OF(weapons)[Math.floor(rnd() * AMMO_TYPES_OF(weapons).length)], pa = free(room);
        level.pickups.push({ kind: "ammo", ammo: type, x: pa.x, y: pa.y, n: Math.max(2, Math.round(AMMO_PACK[type] * scale)) });
      }
      var wantHealth = Math.ceil(rooms.length / 3), haveHealth = level.pickups.filter(function (q) { return q.kind === "health"; }).length;
      for (i = 1; haveHealth < wantHealth && i < rooms.length; i++) { var ph = free(rooms[i]); level.pickups.push({ kind: "health", x: ph.x, y: ph.y, n: 25 }); haveHealth++; }   // enough to patch up on the way
      var ps = free(start); level.pickups.push({ kind: "ammo", ammo: AMMO_TYPES_OF(weapons)[0], x: ps.x, y: ps.y, n: Math.round(AMMO_PACK[AMMO_TYPES_OF(weapons)[0]] * scale) });
      if (locked) level.pickups.push({ kind: "key", x: keyRoom.cx + 0.5, y: keyRoom.cy + 0.5 });
      level.keyRoom = keyRoom;
      return level;
    }
    return genLevel(seed + 99991, index, spec, last);   // (very unlikely) no layout fitted: another seed
  }
  function last_boss(spec, index, levels) { return spec.boss && index === levels - 1; }
  function AMMO_TYPES_OF(weapons) { var out = []; weapons.forEach(function (w) { var t = WEAPONS[w].ammo; if (out.indexOf(t) < 0) out.push(t); }); return out; }
  function bfs(cells, W, H, sx, sy, passable) {
    var dist = new Int16Array(W * H).fill(-1), queue = [[sx, sy]]; dist[sy * W + sx] = 0;
    for (var qi = 0; qi < queue.length; qi++) {
      var c = queue[qi], dx = [1, -1, 0, 0], dy = [0, 0, 1, -1];
      for (var k = 0; k < 4; k++) { var nx = c[0] + dx[k], ny = c[1] + dy[k]; if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist[ny * W + nx] >= 0 || !passable(cells[ny * W + nx])) continue; dist[ny * W + nx] = dist[c[1] * W + c[0]] + 1; queue.push([nx, ny]); }
    }
    return dist;
  }
  function genArena(seed, spec) {
    var W = 26, H = 26, cells = new Uint8Array(W * H).fill(1), x, y;
    for (y = 2; y < H - 2; y++) for (x = 2; x < W - 2; x++) cells[y * W + x] = 0;
    for (y = 6; y < H - 6; y += 6) for (x = 6; x < W - 6; x += 6) { cells[y * W + x] = 2; cells[y * W + x + 1] = 2; cells[(y + 1) * W + x] = 2; cells[(y + 1) * W + x + 1] = 2; }   // pillars to hide behind
    var level = { W: W, H: H, cells: cells, rooms: [{ x: 2, y: 2, w: W - 4, h: H - 4, cx: W >> 1, cy: H >> 1 }], start: { x: 13.5, y: 22.5 }, exit: null, locked: null, doors: [], enemies: [], pickups: [], theme: spec.theme, arena: true };
    var types = AMMO_TYPES_OF(spec.weapons), scale = AMMO[spec.ammo] || 1;
    [[4.5, 4.5], [21.5, 4.5], [4.5, 21.5], [21.5, 21.5]].forEach(function (p, i) { level.pickups.push({ kind: i % 2 ? "ammo" : "health", ammo: types[i % types.length], x: p[0], y: p[1], n: i % 2 ? Math.round(AMMO_PACK[types[i % types.length]] * scale) : 25 }); });
    return level;
  }

  // ---- textures made by code ----
  var texCache = {};
  function wallTexture(kind, theme) {   // kind 1-3 walls, 8 door, 9 locked door
    var key = kind + theme, t = THEMES[theme] || THEMES.bunker;
    if (texCache[key]) return texCache[key];
    var px = new Uint8Array(16 * 16 * 3), base = kind === 8 ? [110, 96, 80] : kind === 9 ? [150, 40, 40] : t.wall[(kind - 1) % t.wall.length];
    for (var v = 0; v < 16; v++) for (var u = 0; u < 16; u++) {
      var n = hash(kind * 31 + 7, u, v), k = 0.86 + n * 0.28, c = base;
      if (kind === 1 && (v % 8 === 0 || (u + (v >> 3) * 8) % 16 === 0)) k *= 0.6;   // brick lines
      if (kind === 2 && (u === 0 || v === 0 || u === 15 || v === 15 || ((u === 3 || u === 12) && v > 2 && v < 13))) k *= 0.68;   // a panel
      if (kind === 3 && v % 5 === 2) { k *= 0.7; c = t.accent; }   // a stripe
      if (kind === 8) { if (u === 0 || u === 15 || v === 0) k *= 0.6; if (u > 10 && u < 13 && v > 6 && v < 10) c = t.accent; }
      if (kind === 9) { if (u === 0 || u === 15 || v === 0) k *= 0.6; if (u > 5 && u < 10 && v > 5 && v < 11) { c = [255, 220, 60]; k = 1; } }
      var o = (v * 16 + u) * 3; px[o] = Math.min(255, c[0] * k); px[o + 1] = Math.min(255, c[1] * k); px[o + 2] = Math.min(255, c[2] * k);
    }
    return texCache[key] = px;
  }

  // ---- sprites: pixel art rows of colour letters ('.' is clear) ----
  var HUMAN = ["...hhhh...", "..hssssh..", "..hsggsh..", "...ssss...", "..bbbbbb..", ".bbbbbbbb.", "gbbbbbbbbg", "g.bbbbbb.g", "..bbbbbb..", "..ll..ll..", "..ll..ll..", ".lll..lll."];
  var BRUTE = ["..hhhhhh..", ".hssssssh.", ".hsggggsh.", "..ssssss..", ".bbbbbbbb.", "bbbbbbbbbb", "bbbbbbbbbb", "gbbbbbbbbg", "gbbbbbbbbg", ".bbbbbbbb.", ".lll..lll.", ".lll..lll."];
  var TURRET = ["..........", "...hhhh...", "..hhhhhh..", ".hhsggshh.", ".hhhggghh.", "..bbbbbb..", "...bbbb...", "..bbbbbb..", ".llllllll.", "llllllllll"];
  var PICK = {
    health: { rows: ["..rrrr..", "..rwwr..", "rrrwwrrr", "rwwwwwwr", "rwwwwwwr", "rrrwwrrr", "..rwwr..", "..rrrr.."], pal: { r: [200, 40, 40], w: [250, 250, 250] } },
    armor: { rows: ["..bbbb..", ".bccccb.", "bcccccb.", "bccccccb", "bccccccb", ".bccccb.", "..bccb..", "...bb..."], pal: { b: [40, 70, 160], c: [100, 150, 240] } },
    ammo: { rows: ["........", ".yyyyyy.", ".yooooy.", ".yooooy.", ".yyyyyy.", ".yooooy.", ".yyyyyy.", "........"], pal: { y: [90, 80, 50], o: [220, 180, 60] } },
    key: { rows: ["..kkkk..", ".kyyyyk.", ".kyyyyk.", "..kkkk..", "...kk...", "...kyk..", "...kk...", "...kyk.."], pal: { k: [120, 90, 20], y: [255, 220, 60] } },
    site: { rows: ["...yy...", "..yyyy..", ".yy..yy.", "yy.yy.yy", "yy.yy.yy", ".yy..yy.", "..yyyy..", "...yy..."], pal: { y: [255, 200, 40] } },
    exit: { rows: ["..gggg..", ".gGGGGg.", "gGggggGg", "gGgGGgGg", "gGgGGgGg", "gGggggGg", ".gGGGGg.", "..gggg.."], pal: { g: [30, 140, 70], G: [120, 255, 160] } }
  };

  K.fps = { maps: Object.keys(MAPS), mapRows: MAPS, buyPrices: BUY, themes: Object.keys(THEMES), kinds: Object.keys(KINDS), weapons: WEAPON_ORDER, sizes: Object.keys(SIZES), modes: MODES, genLevel: genLevel, genArena: genArena, bfs: bfs, menuAtStart: true };

  K.kit.define("fps", {
    defaults: {
      title: "Birinci Şahıs", theme: "bunker", difficulty: 3, levels: 3, size: "medium", enemies: ["guard", "runner", "sniper"], weapons: ["pistol", "shotgun", "rifle"],
      boss: true, ammo: "normal", mode: "campaign", map: "", rounds: 4, music: "boss", world: { seed: 1 }, width: 640, height: 400, features: []
    },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (!SIZES[spec.size]) errors.push("bilinmeyen boyut: " + spec.size + " (var olanlar: " + Object.keys(SIZES).join(", ") + ")");
      if (!AMMO[spec.ammo]) errors.push("bilinmeyen mermi bolluğu: " + spec.ammo + " (scarce, normal, plenty)");
      if (MODES.indexOf(spec.mode) < 0) errors.push("bilinmeyen mod: " + spec.mode + " (campaign, arena, tactical)");
      if (spec.map && !MAPS[spec.map]) errors.push("bilinmeyen harita: " + spec.map + " (var olanlar: " + Object.keys(MAPS).join(", ") + ")");
      if (typeof spec.rounds !== "number" || spec.rounds < 1 || spec.rounds > 9) errors.push("rounds 1-9 olmalı");
      if (!(spec.enemies instanceof Array) || !spec.enemies.length) errors.push("enemies boş olmamalı");
      else spec.enemies.forEach(function (k) { if (!KINDS[k]) errors.push("bilinmeyen düşman: " + k + " (var olanlar: " + Object.keys(KINDS).join(", ") + ")"); });
      if (!(spec.weapons instanceof Array) || !spec.weapons.length) errors.push("weapons boş olmamalı");
      else spec.weapons.forEach(function (k) { if (!WEAPONS[k]) errors.push("bilinmeyen silah: " + k + " (var olanlar: " + WEAPON_ORDER.join(", ") + ")"); });
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      if (typeof spec.levels !== "number" || spec.levels < 1 || spec.levels > 6) errors.push("levels 1-6 olmalı");
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var seed = (spec.world && spec.world.seed) || 1, theme = THEMES[spec.theme], weapons = WEAPON_ORDER.filter(function (w) { return spec.weapons.indexOf(w) >= 0; });
      var state = { g: g, spec: spec, level: null, levelIndex: 0, p: null, enemies: [], pickups: [], open: {}, paused: false, ended: false, won: false, message: "", messageT: 0, flash: 0, shake: 0,
                    kills: 0, shots: 0, hits: 0, firing: false, fireT: 0, recoil: 0, muzzle: 0, heroHooks: [], regen: false, sprintMul: 1, startArmor: 0, wave: 0, waves: 0, waveQueue: [], explored: {}, time: 0, hurtT: 0, bossDead: false, tac: null };
      state.menu = { open: K.fps.menuAtStart !== false, kind: "main", index: 0, started: false }; state.paused = state.menu.open; state.musicOn = true;
      var tune = spec.music;
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      var rnd = rng(seed * 31 + 5), zbuf = new Float32Array(RW);

      // ---- the level ----
      function cellAt(x, y) { var L = state.level; return x < 0 || y < 0 || x >= L.W || y >= L.H ? 1 : L.cells[y * L.W + x]; }
      function solid(x, y) { var c = cellAt(x, y); if (c === 0) return false; if (c === 8 || c === 9) return !state.open[y * state.level.W + x]; return true; }
      state.solid = solid; state.cellAt = cellAt;
      function blocked(x, y, r) { return solid(Math.floor(x - r), Math.floor(y - r)) || solid(Math.floor(x + r), Math.floor(y - r)) || solid(Math.floor(x - r), Math.floor(y + r)) || solid(Math.floor(x + r), Math.floor(y + r)); }
      function make(kind, x, y) { var def = kind === "boss" ? BOSS : KINDS[kind]; return { kind: kind, def: def, x: x, y: y, hp: def.hp, state: "idle", cd: 1 + rnd(), flash: 0, dead: false, alert: false, age: 0, dir: rnd() * 6.28 }; }
      state.loadLevel = function (index) {
        var lvSeed = seed * 131 + index * 7919, mapName = spec.mode === "tactical" ? (spec.map || "depo") : spec.mode === "arena" ? spec.map : "";
        var L = mapName ? mapLevel(mapName, spec) : spec.mode === "arena" ? genArena(lvSeed, spec) : genLevel(lvSeed, index, spec, index === spec.levels - 1);
        state.level = L; state.levelIndex = index; state.open = {}; state.explored = {}; state.bossDead = !L.enemies.some(function (e) { return e.kind === "boss"; });
        state.enemies = L.enemies.map(function (e) { return make(e.kind, e.x, e.y); });
        if (spec.mode === "tactical") {   // the defenders stand where the map says, as many as the difficulty asks
          var spots = L.spawns.slice(), picked = [], kinds = spec.enemies.filter(function (k) { return k !== "turret"; }); if (!kinds.length) kinds = spec.enemies;
          while (spots.length && picked.length < Math.min(L.spawns.length, 2 + spec.difficulty)) picked.push(spots.splice(Math.floor(rnd() * spots.length), 1)[0]);
          state.enemies = picked.map(function (sp) { return make(kinds[Math.floor(rnd() * kinds.length)], sp.x, sp.y); });
        }
        state.pickups = L.pickups.map(function (p) { return { kind: p.kind, ammo: p.ammo, x: p.x, y: p.y, n: p.n, taken: false }; });
        if (L.exit) state.pickups.push({ kind: "exit", x: L.exit.x, y: L.exit.y, taken: false, n: 0, fixed: true });
        if (spec.mode === "tactical") L.sites.forEach(function (st) { state.pickups.push({ kind: "site", x: st.x, y: st.y, taken: false, n: 0, fixed: true, site: st.name }); });
        if (!state.p) state.p = { x: L.start.x, y: L.start.y, a: -Math.PI / 2, hp: 100, armor: state.startArmor, ammo: { bullets: 0, shells: 0, heavy: 0 }, weapon: 0, keys: 0, vx: 0, vy: 0, bob: 0, pitch: 0 };
        else { state.p.x = L.start.x; state.p.y = L.start.y; state.p.a = -Math.PI / 2; state.p.keys = 0; state.p.pitch = 0; }
        if (L.map) state.p.a = Math.atan2(L.H / 2 - L.start.y, L.W / 2 - L.start.x);   // you look into the map, not at the wall
        if (spec.mode === "tactical" && state.tac) { var T0 = state.tac; state.p.hp = 100; state.p.pitch = 0; T0.phase = "buy"; T0.t = 15; T0.plant = null; T0.hold = 0; T0.roundT = 100; T0.owned[weapons[0]] = true; weapons.forEach(function (w) { if (T0.owned[w]) { var t = WEAPONS[w].ammo; state.p.ammo[t] = Math.max(state.p.ammo[t] || 0, START_AMMO[t]); } }); if (!T0.owned[weapons[state.p.weapon]]) state.p.weapon = 0; }
        if (spec.mode === "arena") { state.waves = spec.levels * 2 + 1; state.wave = 0; state.waveQueue = []; state.betweenT = 2; }
        state.say(spec.mode === "tactical" ? "Hazırlık: 1-" + weapons.length + " silah, 5 zırh satın al. Enter: başla" : spec.mode === "arena" ? "Arena: dalgalar geliyor!" : "Bölüm " + (index + 1) + (L.locked ? ": çıkış kilitli, anahtarı bul" : ""));
        state.message2 = "";
      };
      state.say = function (text) { state.message = text; state.messageT = 2.5; };
      state.reset = function () {
        state.p = null; state.ended = false; state.won = false; state.kills = 0; state.shots = 0; state.hits = 0; state.time = 0;
        state.tac = spec.mode === "tactical" ? { round: 1, wins: 0, losses: 0, credits: 800, phase: "buy", t: 15, roundT: 100, plant: null, hold: 0, endT: 0, win: false, owned: {} } : null;
        state.loadLevel(0); var p = state.p; p.ammo = { bullets: 0, shells: 0, heavy: 0 };
        weapons.forEach(function (w) { var t = WEAPONS[w].ammo; p.ammo[t] = START_AMMO[t]; }); p.weapon = 0; p.armor = state.startArmor; p.hp = 100;
        if (g.current !== "play") g.go("play");
      };
      state.weaponName = function () { return weapons[state.p.weapon]; };
      state.selectWeapon = function (i) {
        if (i < 0 || i >= weapons.length) return;
        if (state.tac && !state.tac.owned[weapons[i]]) { state.say("Bu silahın yok: hazırlıkta satın al"); return; }
        state.p.weapon = i; state.recoil = 0;
      };
      // ---- the tactical mode: rounds with a buy phase, defenders on the map, a spike you plant on a site (hold E on it) and defend until it goes off ----
      state.buy = function (i) {
        var T = state.tac, p = state.p; if (!T || T.phase !== "buy") return false;
        if (i === 4) { if (p.armor >= 100) { state.say("Zırh zaten dolu"); return false; } if (T.credits < ARMOR_COST) { state.say("Kredi yetmiyor"); return false; } T.credits -= ARMOR_COST; p.armor = 100; state.say("Zırh alındı"); K.sfx("coin"); return true; }
        if (i < 0 || i >= weapons.length) return false;
        var w = weapons[i], cost = BUY[w] || 0;
        if (T.owned[w]) { state.selectWeapon(i); return false; }
        if (T.credits < cost) { state.say("Kredi yetmiyor: " + cost); return false; }
        T.credits -= cost; T.owned[w] = true; var t = WEAPONS[w].ammo; p.ammo[t] = Math.max(p.ammo[t] || 0, START_AMMO[t]); state.selectWeapon(i); state.say(WEAPONS[w].name + " alındı"); K.sfx("coin"); return true;
      };
      state.nearSite = function () { var p = state.p, best = null; (state.level.sites || []).forEach(function (st) { if (Math.hypot(st.x - p.x, st.y - p.y) < 2.3) best = st; }); return best; };
      state.roundEnd = function (win, text) {
        var T = state.tac; if (!T || T.phase === "end") return;
        T.phase = "end"; T.endT = 3.5; T.win = win; if (win) { T.wins++; T.credits += 3000; } else { T.losses++; T.credits += 1900; }
        state.say((win ? "TUR KAZANDIN: " : "TUR KAYBETTİN: ") + text); state.flash = win ? 0 : 0.35;
      };
      state.tacStep = function (dt) {
        var T = state.tac, p = state.p; if (!T) return;
        if (T.phase === "buy") {
          T.t -= dt; var go = K.key("Enter") && !state.enterHeld; state.enterHeld = K.key("Enter");
          if (T.t <= 0 || go) { T.phase = "live"; state.say("Tur başladı! Bir bölgeye git, E basılı tut: spike"); }
        } else if (T.phase === "live" || T.phase === "planted") {
          var alive = state.enemies.filter(function (e) { return !e.dead; }).length;
          if (T.phase === "live") {
            T.roundT -= dt; var site = state.nearSite();
            if (site && K.key("e")) { T.hold += dt; if (T.hold >= 3) { T.phase = "planted"; T.plant = { site: site.name, t: 25 }; T.hold = 0; T.credits += 300; state.say("Spike " + site.name + " bölgesine kuruldu! 25 sn hayatta kal"); K.sfx("boom"); state.enemies.forEach(function (e) { if (!e.dead && e.state === "idle") { e.state = "chase"; e.alert = true; } }); } }
            else T.hold = 0;
            if (T.roundT <= 0 && T.phase === "live") { state.roundEnd(false, "süre doldu"); return; }
          } else { T.plant.t -= dt; if (T.plant.t <= 0) { state.roundEnd(true, "spike patladı"); return; } }
          if (alive === 0) state.roundEnd(true, "hepsi etkisiz");
        } else if (T.phase === "end") {
          T.endT -= dt;
          if (T.endT <= 0) {
            if (T.wins >= spec.rounds) { state.won = true; state.ended = true; K.music.stop(); g.go("win"); }
            else if (T.losses >= spec.rounds) { state.ended = true; K.music.stop(); g.go("over"); }
            else { T.round++; state.loadLevel(0); }
          }
        }
      };

      // ---- the player ----
      state.hurt = function (n, why) {
        var p = state.p; if (state.ended) return false;
        if (state.tac && state.tac.phase !== "live" && state.tac.phase !== "planted") return false;
        var soak = p.armor > 0 ? Math.min(p.armor, Math.ceil(n * 0.5)) : 0; p.armor -= soak; n -= soak;
        p.hp -= n; state.flash = 0.35; state.hurtT = 0; state.shake = 0.15; K.sfx("hit");
        if (p.hp <= 0) { p.hp = 0; if (state.tac) { state.roundEnd(false, "elendin"); return true; } state.ended = true; K.music.stop(); g.go("over"); }
        return true;
      };
      function rayWall(ox, oy, dx, dy, max) {   // distance along the ray to the first solid cell (grid walk)
        var mx = Math.floor(ox), my = Math.floor(oy), ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
        var sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1, sdx = (dx < 0 ? ox - mx : mx + 1 - ox) * ddx, sdy = (dy < 0 ? oy - my : my + 1 - oy) * ddy, dist = 0;
        for (var i = 0; i < 80; i++) {
          if (sdx < sdy) { dist = sdx; sdx += ddx; mx += sx; } else { dist = sdy; sdy += ddy; my += sy; }
          if (dist > max) return max;
          if (solid(mx, my)) return dist;
        }
        return max;
      }
      state.rayWall = rayWall;
      function los(x0, y0, x1, y1) { var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy); return d < 0.01 || rayWall(x0, y0, dx / d, dy / d, d) >= d - 0.05; }
      state.los = los;
      function hitscan(ox, oy, angle, dmg, spread) {
        var a = angle + (rnd() - 0.5) * 2 * spread, dx = Math.cos(a), dy = Math.sin(a), wall = rayWall(ox, oy, dx, dy, FAR), best = null, bestT = wall;
        var slope = (state.p ? state.p.pitch : 0) + (rnd() - 0.5) * 2 * spread;   // height of the shot at distance t: 0.5 + t * slope (the eye is half way up the wall)
        if (slope < -0.001) bestT = Math.min(bestT, 0.5 / -slope); else if (slope > 0.001) bestT = Math.min(bestT, 0.5 / slope);
        state.enemies.forEach(function (e) {
          if (e.dead) return;
          var rx = e.x - ox, ry = e.y - oy, t = rx * dx + ry * dy;
          if (t < 0.05 || t > bestT) return;
          var perp = Math.abs(rx * dy - ry * dx);
          var zAt = 0.5 + t * slope;
          if (perp < 0.3 * e.def.size && zAt >= 0 && zAt <= 0.95 * e.def.size) { best = e; bestT = t; }
        });
        if (best) { damageEnemy(best, dmg); return true; }
        return false;
      }
      function damageEnemy(e, dmg) {
        e.hp -= dmg; e.flash = 0.2; e.alert = true; if (e.state === "idle") e.state = "chase"; state.hits++;
        if (e.hp <= 0 && !e.dead) {
          e.dead = true; e.state = "dead"; state.kills++; K.sfx("boom"); if (state.tac) state.tac.credits += 200;
          if (e.kind === "boss") { state.bossDead = true; state.say("Patron düştü! Çıkış açık."); }
          if (hash(Math.floor(e.x * 7), Math.floor(e.y * 7), state.kills) < 0.35 && !e.def.static) state.pickups.push({ kind: "ammo", ammo: AMMO_TYPES_OF(weapons)[0], x: e.x, y: e.y, n: Math.max(2, Math.round(AMMO_PACK[AMMO_TYPES_OF(weapons)[0]] * (AMMO[spec.ammo] || 1) * 0.5)), taken: false });
        }
      }
      state.fire = function () {   // one shot with the chosen weapon, when the ammo and the pause allow
        var p = state.p, w = WEAPONS[weapons[p.weapon]];
        if (state.ended || state.paused || state.fireT > 0 || (state.tac && state.tac.phase !== "live" && state.tac.phase !== "planted")) return false;
        if (p.ammo[w.ammo] <= 0) { state.say("Mermi bitti!"); state.fireT = 0.3; return false; }
        p.ammo[w.ammo]--; state.fireT = w.gap; state.recoil = 1; state.muzzle = 0.08; state.shots++; K.sfx("fire");
        var any = false;
        for (var i = 0; i < w.pellets; i++) if (hitscan(p.x, p.y, p.a, w.dmg, w.spread)) any = true;
        state.enemies.forEach(function (e) { if (!e.dead && e.state === "idle" && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < 14) { e.state = "chase"; e.alert = true; } });   // a shot is heard
        return any;
      };
      state.use = function () {   // E: open the door in front (a locked one needs the key)
        var p = state.p, dx = Math.cos(p.a), dy = Math.sin(p.a);
        for (var t = 0.4; t <= 1.6; t += 0.2) {
          var cx = Math.floor(p.x + dx * t), cy = Math.floor(p.y + dy * t), c = cellAt(cx, cy);
          if (c === 8 || c === 9) {
            var key = cy * state.level.W + cx;
            if (state.open[key]) return false;
            if (c === 9 && p.keys < 1) { state.say("Kilitli: kırmızı anahtar gerek"); K.sfx("click"); return false; }
            if (c === 9) { p.keys--; state.say("Kilit açıldı"); }
            state.open[key] = true; K.sfx("coin"); return true;
          }
        }
        return false;
      };

      // ---- the enemies ----
      function moveEnemy(e, dx, dy) { var r = 0.3 * e.def.size; if (!blocked(e.x + dx, e.y, r)) e.x += dx; else if (!blocked(e.x, e.y + dy, r)) { e.y += dy; } if (!blocked(e.x, e.y + dy, r)) e.y += dy; }
      state.stepEnemies = function (dt) {
        var p = state.p, d = spec.difficulty, acc = 0.7 + 0.1 * d, dmgScale = 0.7 + 0.15 * d;
        state.enemies.forEach(function (e) {
          if (e.dead) return;
          e.age += dt; e.flash = Math.max(0, e.flash - dt); e.cd -= dt;
          var dx = p.x - e.x, dy = p.y - e.y, dist = Math.sqrt(dx * dx + dy * dy) || 0.01, def = e.def, see = dist < 20 && los(e.x, e.y, p.x, p.y);
          if (e.state === "idle") { if (see && dist < 9 + d) { e.state = "chase"; e.alert = true; } return; }
          var wantMove = !def.static && dist > (def.melee ? 0.7 : Math.min(5, def.range * 0.5));
          if (!see && !def.static) wantMove = dist > 0.7;
          if (wantMove) {
            var sp = def.speed * (0.8 + 0.08 * d) * dt, ux = dx / dist, uy = dy / dist;
            var bx = e.x, by = e.y; moveEnemy(e, ux * sp, uy * sp);
            if (Math.abs(e.x - bx) + Math.abs(e.y - by) < sp * 0.3) { moveEnemy(e, -uy * sp * 1.2, ux * sp * 1.2); }   // stuck on a corner: slide along it
          }
          if (def.melee) { if (dist < 0.95 && e.cd <= 0) { e.cd = def.cd; state.hurt(Math.round(def.dmg * dmgScale), def.name); } }
          else if (see && dist < def.range && e.cd <= 0) {
            e.cd = def.cd * (1.2 - 0.05 * d); e.muzzle = 0.12; K.sfx("click");
            var pel = def.pellets || 1;
            for (var i = 0; i < pel; i++) if (rnd() < Math.max(0.08, Math.min(0.95, def.acc * acc * (1 - 0.45 * dist / def.range)))) state.hurt(Math.max(1, Math.round(def.dmg * dmgScale)), def.name);
          }
        });
        if (spec.mode === "arena") state.stepArena(dt);
      };
      state.stepArena = function (dt) {
        var alive = state.enemies.filter(function (e) { return !e.dead; }).length;
        if (state.waveQueue.length) {
          state.spawnT = (state.spawnT || 0) - dt;
          if (state.spawnT <= 0) { state.spawnT = 0.7; var sp = state.waveQueue.shift(); state.enemies.push(make(sp.kind, sp.x, sp.y)); state.enemies[state.enemies.length - 1].state = "chase"; }
        } else if (alive === 0) {
          if (state.wave >= state.waves) { if (!state.won) { state.won = true; state.ended = true; K.music.stop(); g.go("win"); } return; }
          state.betweenT -= dt;
          if (state.betweenT <= 0) {
            state.wave++; state.betweenT = 3; var n = Math.round((3 + state.wave * 1.6) * (0.7 + 0.2 * spec.difficulty)), i;
            for (i = 0; i < n; i++) {
              var ex, ey, tries = 0; do { ex = 2.5 + Math.floor(rnd() * (state.level.W - 5)); ey = 2.5 + Math.floor(rnd() * (state.level.H - 5)); tries++; } while ((solid(Math.floor(ex), Math.floor(ey)) || Math.abs(ex - state.p.x) + Math.abs(ey - state.p.y) < 10) && tries < 40);
              var kind = spec.enemies[Math.floor(rnd() * spec.enemies.length)];
              if (spec.boss && state.wave === state.waves && i === 0) kind = "boss";
              state.waveQueue.push({ kind: kind, x: ex, y: ey });
            }
            state.say("Dalga " + state.wave + " / " + state.waves);
          }
        }
      };

      // ---- one step of the game ----
      state.step = function (dt) {
        var p = state.p; if (!p) return;
        if (state.paused) return;
        if (state.tac && state.tac.phase === "end") { state.time += dt; state.messageT = Math.max(0, state.messageT - dt); state.flash = Math.max(0, state.flash - dt); state.tacStep(dt); return; }
        state.time += dt; state.fireT = Math.max(0, state.fireT - dt); state.recoil = Math.max(0, state.recoil - dt * 6); state.muzzle = Math.max(0, state.muzzle - dt);
        state.flash = Math.max(0, state.flash - dt); state.shake = Math.max(0, state.shake - dt); state.messageT = Math.max(0, state.messageT - dt); state.hurtT += dt;
        if (state.ended) return;
        var turn = (K.key("ArrowRight") ? 1 : 0) - (K.key("ArrowLeft") ? 1 : 0); p.a += turn * 2.4 * dt;
        var tilt = (K.key("ArrowUp") ? 1 : 0) - (K.key("ArrowDown") ? 1 : 0); p.pitch = Math.max(-0.5, Math.min(0.5, p.pitch + tilt * 0.9 * dt));   // pitch is the slope of the line of sight: up is positive
        var f = (K.key("w") ? 1 : 0) - (K.key("s") ? 1 : 0), side = (K.key("d") ? 1 : 0) - (K.key("a") ? 1 : 0);
        var speed = 3.2 * state.sprintMul * (K.key("Shift") ? 1.55 : 1), len = Math.sqrt(f * f + side * side) || 1;
        var vx = (Math.cos(p.a) * f - Math.sin(p.a) * side) / len * speed, vy = (Math.sin(p.a) * f + Math.cos(p.a) * side) / len * speed;
        if (f || side) p.bob += dt * 9; p.vx = vx; p.vy = vy;
        var nx = p.x + vx * dt, ny = p.y + vy * dt;
        var touch = function (x, y) { for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) { var cx = Math.floor(x) + ox, cy = Math.floor(y) + oy, c = cellAt(cx, cy); if ((c === 8 || c === 9) && !state.open[cy * state.level.W + cx] && Math.abs(x - (cx + 0.5)) < 0.9 && Math.abs(y - (cy + 0.5)) < 0.9) return { cx: cx, cy: cy, c: c }; } return null; };
        var door = touch(nx, ny);
        if (door) {   // walking into a door opens it (a locked one needs the key)
          var key = door.cy * state.level.W + door.cx;
          if (door.c === 8) { state.open[key] = true; K.sfx("coin"); } else if (p.keys > 0) { p.keys--; state.open[key] = true; state.say("Kilit açıldı"); K.sfx("coin"); } else if (!state.lockedHintT || state.time - state.lockedHintT > 2) { state.lockedHintT = state.time; state.say("Kilitli: kırmızı anahtar gerek"); }
        }
        if (!blocked(nx, p.y, R)) p.x = nx; if (!blocked(p.x, ny, R)) p.y = ny;
        if (K.key("e") && !state.eHeld) state.use(); state.eHeld = K.key("e");
        if (state.firing || K.key(" ")) { var w = WEAPONS[weapons[p.weapon]]; if (w.auto || !state.fireHeld) state.fire(); state.fireHeld = true; } else state.fireHeld = false;
        for (var n = 1; n <= 5; n++) if (K.key(String(n)) && !state["held" + n]) { state["held" + n] = true; if (state.tac && state.tac.phase === "buy") state.buy(n - 1); else if (n <= 4) state.selectWeapon(n - 1); } else if (!K.key(String(n))) state["held" + n] = false;
        if (K.key("q") && !state.qHeld) state.selectWeapon((p.weapon + 1) % weapons.length); state.qHeld = K.key("q");
        if (state.regen && p.hp < 100 && state.hurtT > 5) p.hp = Math.min(100, p.hp + 4 * dt);
        // pickups
        state.pickups.forEach(function (pk) {
          if (pk.taken) return;
          var dx = pk.x - p.x, dy = pk.y - p.y; if (dx * dx + dy * dy > 0.45) return;
          if (pk.kind === "site") return;
          if (pk.kind === "health") { if (p.hp >= 100) return; p.hp = Math.min(100, p.hp + pk.n); state.say("Can +" + pk.n); }
          else if (pk.kind === "armor") { if (p.armor >= 100) return; p.armor = Math.min(100, p.armor + pk.n); state.say("Zırh +" + pk.n); }
          else if (pk.kind === "ammo") { if (p.ammo[pk.ammo] >= AMMO_MAX[pk.ammo]) return; p.ammo[pk.ammo] = Math.min(AMMO_MAX[pk.ammo], p.ammo[pk.ammo] + pk.n); state.say("Mermi +" + pk.n); }
          else if (pk.kind === "key") { p.keys++; state.say("Kırmızı anahtar alındı"); }
          else if (pk.kind === "exit") { if (!state.bossDead) { if (!state.exitHintT || state.time - state.exitHintT > 2) { state.exitHintT = state.time; state.say("Önce patronu yen!"); } return; } state.nextLevel(); return; }
          pk.taken = true; K.sfx("coin");
        });
        state.tacStep(dt);
        if (!state.tac || state.tac.phase === "live" || state.tac.phase === "planted") state.stepEnemies(dt);
        state.heroHooks.forEach(function (h) { h(p, dt); });
        var cx = Math.floor(p.x), cy = Math.floor(p.y); for (var ey = -2; ey <= 2; ey++) for (var ex = -2; ex <= 2; ex++) state.explored[(cy + ey) * state.level.W + cx + ex] = true;
      };
      state.nextLevel = function () {
        if (state.levelIndex + 1 >= spec.levels) { state.won = true; state.ended = true; K.music.stop(); g.go("win"); return; }
        state.say("Bölüm tamam!"); state.loadLevel(state.levelIndex + 1);
      };

      // ---- the picture: RW x RH rays into a small image, scaled up ----
      function horizon() { return Math.round(RH / 2 + state.p.pitch * RH); }
      function sprite(art, x, y, scale, flash, out, depthOnly) {
        var p = state.p, sx = x - p.x, sy = y - p.y, dirX = Math.cos(p.a), dirY = Math.sin(p.a), pl = Math.tan(FOV / 2), planeX = -dirY * pl, planeY = dirX * pl;
        var inv = 1 / (planeX * dirY - dirX * planeY), tx = inv * (dirY * sx - dirX * sy), ty = inv * (-planeY * sx + planeX * sy);
        if (ty < 0.15) return;
        var screenX = Math.floor(RW / 2 * (1 + tx / ty)), size = Math.abs(RH / ty) * scale, cols = art.rows[0].length, nrows = art.rows.length;
        var wPx = size * cols / nrows, x0 = Math.floor(screenX - wPx / 2), x1 = Math.ceil(screenX + wPx / 2), floorY = horizon() + RH / ty / 2 * 0.95, y1 = Math.ceil(floorY), y0 = Math.floor(floorY - size);
        var fog = Math.min(1, ty / FAR); fog = fog * fog;
        for (var cx = Math.max(0, x0); cx < Math.min(RW, x1); cx++) {
          if (ty >= zbuf[cx]) continue;
          var ac = art.rows[0].length, ai = Math.min(ac - 1, Math.floor((cx - x0) / (x1 - x0) * ac));
          for (var cy = Math.max(0, y0); cy < Math.min(RH, y1); cy++) {
            var ar = Math.min(nrows - 1, Math.floor((cy - y0) / (y1 - y0) * nrows)), ch = art.rows[ar].charAt(ai), col = art.pal[ch];
            if (!col) continue;
            var k = (cy * RW + cx) * 4, r = col[0], gg = col[1], b = col[2];
            if (flash) { r = 255; gg = gg * 0.5 + 60; b = b * 0.5 + 60; }
            out[k] = r * (1 - fog) + theme.fog[0] * fog; out[k + 1] = gg * (1 - fog) + theme.fog[1] * fog; out[k + 2] = b * (1 - fog) + theme.fog[2] * fog;
          }
        }
      }
      var artCache = {};
      function enemyArt(e) { var key = e.kind; if (!artCache[key]) artCache[key] = { rows: e.kind === "brute" ? BRUTE : e.kind === "turret" ? TURRET : HUMAN, pal: e.def.pal }; return artCache[key]; }
      function render(out) {
        var p = state.p, L = state.level, i, j, k;
        var hz = horizon();
        for (j = 0; j < RH; j++) {   // ceiling and floor: a gradient into the fog
          var t = j < hz ? 1 - j / Math.max(1, hz) : (j - hz) / Math.max(1, RH - hz), base = j < hz ? theme.ceil : theme.floor;
          for (i = 0; i < RW; i++) { k = (j * RW + i) * 4; out[k] = base[0] * (1 - t * 0.6) + theme.fog[0] * t * 0.6; out[k + 1] = base[1] * (1 - t * 0.6) + theme.fog[1] * t * 0.6; out[k + 2] = base[2] * (1 - t * 0.6) + theme.fog[2] * t * 0.6; out[k + 3] = 255; }
        }
        var dirX = Math.cos(p.a), dirY = Math.sin(p.a), pl = Math.tan(FOV / 2), planeX = -dirY * pl, planeY = dirX * pl;
        var shakeX = state.shake > 0 ? Math.round((rnd() - 0.5) * 3) : 0;
        for (i = 0; i < RW; i++) {
          var camX = 2 * i / RW - 1, rdx = dirX + planeX * camX, rdy = dirY + planeY * camX, mx = Math.floor(p.x), my = Math.floor(p.y);
          var ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9)), stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
          var sdx = (rdx < 0 ? p.x - mx : mx + 1 - p.x) * ddx, sdy = (rdy < 0 ? p.y - my : my + 1 - p.y) * ddy, side = 0, hitCell = 0, perp = FAR;
          for (var s = 0; s < 80; s++) {
            if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; perp = sdx - ddx; } else { sdy += ddy; my += sty; side = 1; perp = sdy - ddy; }
            if (perp > FAR) break;
            if (solid(mx, my)) { hitCell = cellAt(mx, my); break; }
          }
          zbuf[i] = hitCell ? Math.max(0.05, perp) : FAR + 1;
          if (!hitCell) continue;
          var h = Math.min(RH * 3, RH / Math.max(0.05, perp)), y0 = Math.floor(hz - h / 2), y1 = Math.floor(hz + h / 2);
          var wx = side === 0 ? p.y + perp * rdy : p.x + perp * rdx; wx -= Math.floor(wx);
          var tex = wallTexture(hitCell, spec.theme), tu = Math.floor(wx * 16) & 15, fog = Math.min(1, perp / FAR); fog = fog * fog;
          var shade = side === 1 ? 0.78 : 1;
          for (j = Math.max(0, y0); j < Math.min(RH, y1); j++) {
            var tv = Math.min(15, Math.floor((j - y0) / (y1 - y0) * 16)), o = (tv * 16 + tu) * 3; k = (j * RW + i) * 4;
            out[k] = tex[o] * shade * (1 - fog) + theme.fog[0] * fog; out[k + 1] = tex[o + 1] * shade * (1 - fog) + theme.fog[1] * fog; out[k + 2] = tex[o + 2] * shade * (1 - fog) + theme.fog[2] * fog;
          }
        }
        var list = [];
        state.enemies.forEach(function (e) { list.push({ d: (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y), e: e }); });
        state.pickups.forEach(function (pk) { if (!pk.taken) list.push({ d: (pk.x - p.x) * (pk.x - p.x) + (pk.y - p.y) * (pk.y - p.y), pk: pk }); });
        list.sort(function (a, b) { return b.d - a.d; });
        list.forEach(function (it) {
          if (it.e) { var e = it.e; if (e.dead) sprite(enemyArt(e), e.x, e.y, 0.28 * e.def.size, false, out); else sprite(enemyArt(e), e.x, e.y, 0.95 * e.def.size, e.flash > 0, out); }
          else sprite(PICK[it.pk.kind], it.pk.x, it.pk.y, it.pk.kind === "exit" || it.pk.kind === "site" ? 0.7 : 0.35, false, out);
        });
        return out;
      }
      state.render = render; state.zbuf = zbuf;

      // ---- the screen: the picture, the gun, the numbers ----
      var small = null, smallCtx = null, image = null;
      function drawGun(c) {
        var w = weapons[state.p.weapon], gx = g.width / 2 + Math.sin(state.p.bob) * 5, gy = g.height - 10 + state.recoil * 26 + Math.abs(Math.cos(state.p.bob)) * 4, col = ["#3a3a40", "#55555c", "#26262b"];
        c.save(); c.translate(gx, gy);
        if (w === "pistol") { c.fillStyle = col[1]; c.fillRect(-14, -78, 28, 52); c.fillStyle = col[0]; c.fillRect(-10, -92, 20, 18); c.fillStyle = col[2]; c.fillRect(-9, -40, 18, 40); }
        else if (w === "shotgun") { c.fillStyle = "#7a5230"; c.fillRect(-18, -34, 36, 34); c.fillStyle = col[1]; c.fillRect(-9, -110, 8, 80); c.fillRect(1, -110, 8, 80); c.fillStyle = col[0]; c.fillRect(-12, -118, 24, 10); }
        else if (w === "rifle") { c.fillStyle = col[0]; c.fillRect(-12, -100, 24, 70); c.fillStyle = col[1]; c.fillRect(-5, -118, 10, 22); c.fillStyle = "#4a3a2a"; c.fillRect(-14, -34, 28, 34); c.fillStyle = col[2]; c.fillRect(-18, -64, 8, 26); }
        else { c.fillStyle = col[1]; c.fillRect(-12, -90, 24, 56); c.fillStyle = "#c9c9d0"; c.fillRect(-7, -110, 14, 24); c.fillStyle = col[2]; c.fillRect(-9, -40, 18, 40); }
        if (state.muzzle > 0) { c.fillStyle = "rgba(255,220,120,0.9)"; c.beginPath(); c.arc(0, w === "shotgun" ? -122 : -108, 14 + state.muzzle * 60, 0, 6.3); c.fill(); }
        c.restore();
      }
      function drawHud(c) {
        var p = state.p, W = g.width, H = g.height;
        c.fillStyle = "#fff"; c.fillRect(W / 2 - 7, H / 2 - 1, 14, 2); c.fillRect(W / 2 - 1, H / 2 - 7, 2, 14);
        drawGun(c);
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, H - 58, 214, 50);
        c.font = "bold 16px sans-serif"; c.fillStyle = p.hp > 30 ? "#ef5350" : "#ff1744"; c.fillText("CAN " + Math.ceil(p.hp), 16, H - 34); c.fillStyle = "#64b5f6"; c.fillText("ZIRH " + Math.ceil(p.armor), 118, H - 34);
        c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(16, H - 24, 190, 6); c.fillStyle = "#ef5350"; c.fillRect(16, H - 24, 190 * p.hp / 100, 6);
        var w = WEAPONS[weapons[p.weapon]]; c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(W - 190, H - 58, 182, 50);
        c.fillStyle = "#ffd54f"; c.font = "bold 16px sans-serif"; c.fillText(w.name.toUpperCase() + "  " + p.ammo[w.ammo], W - 182, H - 34); c.font = "12px sans-serif"; c.fillStyle = "#cfd8dc"; c.fillText(weapons.map(function (n, i) { return (i + 1) + (i === p.weapon ? "*" : ""); }).join(" "), W - 182, H - 16);
        var alive = state.enemies.filter(function (e) { return !e.dead; }).length;
        c.font = "13px sans-serif"; c.fillStyle = "#fff"; c.fillText((spec.mode === "arena" ? "Dalga " + state.wave + "/" + state.waves : spec.mode === "tactical" ? "Harita: " + (spec.map || "depo") : "Bölüm " + (state.levelIndex + 1) + "/" + spec.levels) + "   düşman: " + alive + "   öldürülen: " + state.kills + (p.keys ? "   ANAHTAR" : ""), 10, 20);
        var T = state.tac;
        if (T) {
          c.textAlign = "center"; c.font = "bold 15px sans-serif"; c.fillStyle = "#fff"; c.fillText("TUR " + T.round + "    SEN " + T.wins + " - " + T.losses + " RAKİP    (" + spec.rounds + " tur kazanan)    KREDİ " + T.credits + "    " + (T.phase === "buy" ? "HAZIRLIK " + Math.ceil(T.t) : T.phase === "planted" ? "" : "SÜRE " + Math.max(0, Math.ceil(T.roundT))), W / 2, 40);
          if (T.phase === "planted") { c.fillStyle = "#ff5252"; c.font = "bold 20px sans-serif"; c.fillText("SPIKE " + T.plant.site + ": " + Math.ceil(T.plant.t) + " sn", W / 2, 66); }
          var near = state.nearSite();
          if (T.phase === "live" && near) { c.fillStyle = "#ffe082"; c.font = "bold 14px sans-serif"; c.fillText("E basılı tut: spike kur (" + near.name + ")", W / 2, H / 2 + 48); if (T.hold > 0) { c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(W / 2 - 60, H / 2 + 56, 120, 8); c.fillStyle = "#ffd54f"; c.fillRect(W / 2 - 60, H / 2 + 56, 120 * T.hold / 3, 8); } }
          if (T.phase === "buy") {
            c.fillStyle = "rgba(0,0,0,0.7)"; c.fillRect(W / 2 - 150, H / 2 - 100, 300, 128); c.textAlign = "left"; c.font = "bold 14px sans-serif"; c.fillStyle = "#ffd54f"; c.fillText("SATIN AL (Enter: başla)", W / 2 - 138, H / 2 - 78); c.font = "13px sans-serif";
            weapons.forEach(function (wn, i) { c.fillStyle = T.owned[wn] ? "#81c784" : (T.credits >= (BUY[wn] || 0) ? "#fff" : "#888"); c.fillText((i + 1) + "  " + WEAPONS[wn].name + "   " + (T.owned[wn] ? "sende" : BUY[wn] || 0), W / 2 - 138, H / 2 - 56 + i * 18); });
            c.fillStyle = p.armor >= 100 ? "#81c784" : (T.credits >= ARMOR_COST ? "#fff" : "#888"); c.fillText("5  zırh   " + (p.armor >= 100 ? "dolu" : ARMOR_COST), W / 2 - 138, H / 2 - 56 + weapons.length * 18);
          }
          if (T.phase === "end") { c.fillStyle = T.win ? "rgba(30,120,50,0.45)" : "rgba(150,20,20,0.45)"; c.fillRect(0, H / 2 - 40, W, 80); c.fillStyle = "#fff"; c.font = "bold 30px sans-serif"; c.fillText(T.win ? "TUR KAZANDIN" : "TUR KAYBETTİN", W / 2, H / 2 + 10); }
          c.textAlign = "left";
        }
        if (state.messageT > 0) { c.textAlign = "center"; c.font = "bold 16px sans-serif"; c.fillStyle = "#ffe082"; c.fillText(state.message, W / 2, 56); c.textAlign = "left"; }
        if (state.flash > 0) { c.fillStyle = "rgba(220,0,0," + Math.min(0.5, state.flash) + ")"; c.fillRect(0, 0, W, H); }
        var L = state.level, sz = 3, mx = W - L.W * sz - 8, my = 8;   // the map of what you have seen
        c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(mx - 2, my - 2, L.W * sz + 4, L.H * sz + 4);
        for (var yy = 0; yy < L.H; yy++) for (var xx = 0; xx < L.W; xx++) if (state.explored[yy * L.W + xx]) { var cv = L.cells[yy * L.W + xx]; c.fillStyle = cv === 0 ? "rgba(255,255,255,0.35)" : cv === 8 || cv === 9 ? (state.open[yy * L.W + xx] ? "rgba(255,255,255,0.35)" : "#c62828") : "rgba(120,120,140,0.8)"; c.fillRect(mx + xx * sz, my + yy * sz, sz, sz); }
        (L.sites || []).forEach(function (st) { c.fillStyle = "#ffd54f"; c.font = "bold 8px sans-serif"; c.fillText(st.name, mx + st.x * sz - 2, my + st.y * sz + 3); });
        c.fillStyle = "#4caf50"; c.fillRect(mx + p.x * sz - 1, my + p.y * sz - 1, 3, 3);
        state.enemies.forEach(function (e) { if (!e.dead && state.explored[Math.floor(e.y) * L.W + Math.floor(e.x)]) { c.fillStyle = "#ff5252"; c.fillRect(mx + e.x * sz - 1, my + e.y * sz - 1, 2, 2); } });
      }
      // ---- the menus: a main menu at the start, and Esc opens the pause menu (the game stands still behind it) ----
      var CONTROLS = ["W A S D  yürü      Shift  koş      Fare ya da oklar  bak (önce ekrana tıkla)", "Sol tık ya da Boşluk  ateş      1-4, Q ya da tekerlek  silah      E  kapıyı aç", "Anahtarı bul, kilitli kapıyı aç, çıkışa ulaş.      Esc  menü", "Taktik mod: hazırlıkta 1-5 satın al, Enter başlat; bir bölgede E basılı tut = spike kur, patlayana dek hayatta kal."];
      state.lockMouse = function () { if (typeof document !== "undefined" && g.canvas && g.canvas.requestPointerLock && document.pointerLockElement !== g.canvas) { try { g.canvas.requestPointerLock(); } catch (e) { /* keys still work */ } } };
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.paused = true; state.firing = false; if (typeof document !== "undefined" && document.exitPointerLock && document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* not locked */ } } };
      state.closeMenu = function () { state.menu.open = false; state.menu.started = true; state.paused = false; state.lockMouse(); };
      state.toggleMusic = function () { state.musicOn = !state.musicOn; if (state.musicOn) { if (tune) K.music.play(tune); } else K.music.stop(); };
      state.menuItems = function () {
        var m = state.menu, music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic }, controls = { label: "Kontroller", act: function () { m.back = m.kind; m.kind = "controls"; m.index = 0; } };
        if (m.kind === "main") return [{ label: m.started ? "Devam et" : "Oyna", act: state.closeMenu }, controls, music];
        return [{ label: "Devam et", act: state.closeMenu }, controls, music, { label: "Baştan başla", act: function () { state.reset(); if (state.musicOn && tune) K.music.play(tune); state.closeMenu(); } }, { label: "Ana menü", act: function () { state.openMenu("main"); } }];
      };
      var menuRow = function (i, n) { return g.height / 2 - n * 22 + i * 44 + 10; };
      state.menuClick = function () {
        var m = state.menu; if (!m.open) return false;
        if (m.kind === "controls") { m.kind = m.back || "main"; m.index = 0; return true; }
        var items = state.menuItems(), i = Math.floor((K.mouse.y - (g.height / 2 - items.length * 22 + 10)) / 44);
        if (K.mouse.x > g.width / 2 - 150 && K.mouse.x < g.width / 2 + 150 && i >= 0 && i < items.length) { m.index = i; items[i].act(); }
        return true;
      };
      var tapped = {}, tap = function (k) { var d = K.key(k); var hit = d && !tapped[k]; tapped[k] = d; return hit; };
      state.menuUpdate = function () {
        var m = state.menu;
        if (m.kind === "controls") { if (tap("Escape") || tap("Enter") || tap(" ")) { m.kind = m.back || "main"; m.index = 0; } return; }
        var items = state.menuItems();
        if (tap("ArrowUp") || tap("w")) m.index = (m.index + items.length - 1) % items.length;
        if (tap("ArrowDown") || tap("s")) m.index = (m.index + 1) % items.length;
        if (K.mouse && K.mouse.y) { var h = Math.floor((K.mouse.y - (g.height / 2 - items.length * 22 + 10)) / 44); if (K.mouse.x > g.width / 2 - 150 && K.mouse.x < g.width / 2 + 150 && h >= 0 && h < items.length && state.hoverY !== K.mouse.y) { m.index = h; state.hoverY = K.mouse.y; } }
        if (tap("Enter") || tap(" ")) items[Math.min(m.index, items.length - 1)].act();
        if (tap("Escape") && m.kind === "pause") state.closeMenu();
      };
      function drawMenu(c) {
        var m = state.menu, W = g.width, H = g.height; c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, W, H); c.textAlign = "center";
        c.fillStyle = "#fff"; c.font = "bold 34px sans-serif"; c.fillText(m.kind === "main" ? (spec.title || "FPS Nişancı") : m.kind === "controls" ? "Kontroller" : "Duraklatıldı", W / 2, 70);
        if (m.kind === "controls") { c.font = "14px sans-serif"; c.fillStyle = "#e0e0e0"; CONTROLS.forEach(function (t, i) { c.fillText(t, W / 2, 140 + i * 34); }); c.fillStyle = "#ffd54f"; c.fillText("Esc ya da tık: geri", W / 2, H - 40); c.textAlign = "left"; return; }
        var items = state.menuItems();
        items.forEach(function (it, i) { var y = menuRow(i, items.length) - 4, on = i === m.index; c.fillStyle = on ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.08)"; c.fillRect(W / 2 - 150, y, 300, 38); c.strokeStyle = on ? "#ffd54f" : "rgba(255,255,255,0.2)"; c.strokeRect(W / 2 - 150, y, 300, 38); c.fillStyle = on ? "#ffd54f" : "#fff"; c.font = "bold 17px sans-serif"; c.fillText(it.label, W / 2, y + 25); });
        c.font = "12px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla", W / 2, H - 30); c.textAlign = "left";
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined" || g.current !== "play" || !state.p) return;
        if (!small) { small = document.createElement("canvas"); small.width = RW; small.height = RH; smallCtx = small.getContext("2d"); image = smallCtx.createImageData(RW, RH); }
        render(image.data); smallCtx.putImageData(image, 0, 0);
        c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        drawHud(c); if (state.menu.open) drawMenu(c);
      } }];

      // ---- input from the mouse ----
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) {
        var canvas = g.canvas;
        canvas.addEventListener("click", function () { if (!state.menu.open && canvas.requestPointerLock && document.pointerLockElement !== canvas && !state.ended) { try { canvas.requestPointerLock(); } catch (e) { /* keys still work */ } } });
        document.addEventListener("pointerlockchange", function () { if (document.pointerLockElement !== canvas && g.current === "play" && !state.ended && !state.menu.open) state.openMenu("pause"); });
        document.addEventListener("mousemove", function (e) { if (document.pointerLockElement === canvas && !state.paused && state.p && Math.abs(e.movementX) < 250 && Math.abs(e.movementY) < 250) { state.p.a += e.movementX * 0.0024; state.p.pitch = Math.max(-0.5, Math.min(0.5, state.p.pitch - e.movementY * 0.0024)); } });
        canvas.addEventListener("mousedown", function (e) { if (e.button === 0) { if (state.menu.open) { state.menuClick(); return; } state.firing = true; } });
        document.addEventListener("mouseup", function (e) { if (e.button === 0) state.firing = false; });
        canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
        canvas.addEventListener("wheel", function (e) { e.preventDefault(); if (state.p) state.selectWeapon((state.p.weapon + (e.deltaY > 0 ? 1 : weapons.length - 1)) % weapons.length); }, { passive: false });
      }

      var escHeld = false;
      g.scene("play", {
        update: function (game, dt) {
          if (state.menu.open) { state.menuUpdate(); return; }
          var esc = K.key("Escape"); if (esc && !escHeld && !state.ended) { tapped.Escape = true; state.openMenu("pause"); } escHeld = esc;
          state.step(dt);
        }
      });
      K.hud.screen(g, "over", { lines: ["ÖLDÜN", "R ile yeniden başla"], keys: { r: function () { state.reset(); K.music.play(tune); } } });
      K.hud.screen(g, "win", { lines: ["KAZANDIN!", "R ile yeniden oyna"], keys: { r: function () { state.reset(); K.music.play(tune); } } });
      state.start = function () { state.reset(); if (tune && state.musicOn) K.music.play(tune); };
      state.expose = { g: g, spec: spec, state: state, get p() { return state.p; } };
      return state;
    }
  });

  // ---- features ----
  K.feature.define("sprint", { kits: ["fps"], options: {}, apply: function (s) { s.sprintMul = 1.25; } });
  K.feature.define("regen", { kits: ["fps"], options: {}, apply: function (s) { s.regen = true; } });
  K.feature.define("armor", { kits: ["fps"], options: {}, apply: function (s) { s.startArmor = 50; if (s.p) s.p.armor = 50; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
