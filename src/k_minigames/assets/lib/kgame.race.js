/* kgame.race.js: yukarıdan görünümlü 2 boyutlu piksel araba yarışı kiti (race). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'race', title:'Şehir Yarışı', theme:'city', laps:3, rivals:5, difficulty:3, length:'medium', car:'sport', color:'red', music:'overworld', world:{seed:7}, features:['nitro'] })
   Kit; tohumdan kapalı bir pist üretir (karolar: yol, kenar şeridi, çim, başlangıç çizgisi, kenarda ağaç/bina/kaktüs), pikseller keskin çizilir (küçük bir tuvalde çizilip tam sayı katıyla büyütülür, bulanıklık yok),
   arabalar 16 yöne dönmüş piksel sprite'tır. Rakipler yol noktalarını izler (yanlarından geçer, virajda yavaşlar), tur ve sıralama sayılır, küçük harita vardır.
   Kontroller: Yukarı ya da W gaz, Aşağı ya da S fren/geri, Sol/Sağ ya da A/D direksiyon, Boşluk nitro (nitro özelliğiyle), R yeniden başla, Esc menü. Özellikler: nitro, grip.
   Önce kgame.js, kgame.kits.js ve kgame.audio2.js yüklenmiş olmalı. Her şey kodla çizilir (görsel dosya yok). */
(function (root) {
  var K = root.K;
  var T = 16, VW = 320, VH = 200;   // a tile is 16 pixels; the picture is 320x200 pixels, scaled up by a whole number
  var SIZES = { small: [48, 36], medium: [64, 48], large: [88, 64] };
  var THEMES = {
    city: { grass: [[84, 120, 78], [76, 112, 72]], road: [[92, 94, 102], [86, 88, 96]], crack: [70, 72, 80], edge: [[230, 230, 230], [200, 50, 50]], line: [236, 236, 220], side: "building", tint: null },
    desert: { grass: [[222, 190, 120], [212, 180, 110]], road: [[110, 104, 100], [104, 98, 94]], crack: [84, 78, 74], edge: [[240, 232, 210], [190, 100, 40]], line: [250, 240, 200], side: "cactus", tint: null },
    forest: { grass: [[40, 118, 52], [34, 108, 46]], road: [[100, 96, 90], [94, 90, 84]], crack: [76, 72, 66], edge: [[232, 232, 232], [60, 90, 200]], line: [236, 236, 214], side: "tree", tint: null },
    night: { grass: [[18, 40, 40], [14, 34, 34]], road: [[46, 48, 60], [42, 44, 56]], crack: [30, 32, 42], edge: [[180, 180, 200], [200, 60, 120]], line: [214, 214, 150], side: "lamp", tint: "rgba(8,10,40,0.38)" }
  };
  var CARS = { sport: { name: "spor", top: 1.0, accel: 1.0, grip: 1.0, off: 0.5 }, muscle: { name: "kas", top: 1.07, accel: 0.9, grip: 0.8, off: 0.45 }, rally: { name: "ralli", top: 0.96, accel: 1.1, grip: 1.3, off: 0.7 } };
  var COLORS = { red: [214, 40, 40], blue: [50, 100, 224], yellow: [240, 200, 40], green: [50, 184, 84] };
  var RIVAL_COLORS = [[240, 130, 30], [150, 60, 200], [40, 190, 190], [232, 232, 232], [210, 90, 150], [96, 96, 110], [130, 205, 60]];
  var FEATURES = ["nitro", "grip"];
  var TOP = 150, ACC = 120, BRAKE = 260;   // pixels per second

  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(a, b, c) { var n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; n = (n ^ (n >>> 13)) * 1103515245 | 0; return (((n ^ (n >>> 16)) >>> 0) % 65536) / 65536; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shade(c, k) { return [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function wrapAng(a) { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; }

  // ---- the track: a closed curve through random points around an ellipse, turned into tiles ----
  function genTrack(seed, length) {
    var sz = SIZES[length] || SIZES.medium, W = sz[0], H = sz[1], tries, rnd, grid, pts;
    for (tries = 0; tries < 20; tries++) {
      rnd = rng(seed * 131 + tries * 977 + 5);
      var n = 9 + Math.floor(rnd() * 4), ctrl = [], i, j;
      var cx = W * T / 2, cy = H * T / 2, rx = (W / 2 - 9) * T, ry = (H / 2 - 9) * T;
      for (i = 0; i < n; i++) { var ang = (i + (rnd() - 0.5) * 0.5) / n * 6.2832, rr = 0.62 + rnd() * 0.38; ctrl.push({ x: cx + Math.cos(ang) * rx * rr, y: cy + Math.sin(ang) * ry * rr }); }
      var sample = [];   // Catmull-Rom through the points
      for (i = 0; i < n; i++) {
        var p0 = ctrl[(i + n - 1) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n], steps = Math.max(6, Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 9));
        for (j = 0; j < steps; j++) {
          var t = j / steps, t2 = t * t, t3 = t2 * t;
          sample.push({ x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3), y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3) });
        }
      }
      pts = [sample[0]]; for (i = 1; i < sample.length; i++) if (Math.hypot(sample[i].x - pts[pts.length - 1].x, sample[i].y - pts[pts.length - 1].y) >= 9) pts.push(sample[i]);
      var M = pts.length; for (i = 0; i < M; i++) { var a = pts[(i + M - 1) % M], b = pts[(i + 1) % M], ang2 = Math.atan2(b.y - a.y, b.x - a.x); pts[i].a = ang2; pts[i].nx = -Math.sin(ang2); pts[i].ny = Math.cos(ang2); }
      var inside = pts.every(function (p) { return p.x > 4 * T && p.x < (W - 4) * T && p.y > 4 * T && p.y < (H - 4) * T; });
      if (!inside) continue;
      grid = new Uint8Array(W * H);   // 0 grass, 1 road, 2 red kerb, 3 white kerb, 4 start line
      var R = 2.6 * T;
      pts.forEach(function (p) { for (var gy = Math.floor((p.y - R) / T); gy <= Math.floor((p.y + R) / T); gy++) for (var gx = Math.floor((p.x - R) / T); gx <= Math.floor((p.x + R) / T); gx++) if (gx >= 0 && gy >= 0 && gx < W && gy < H && Math.hypot((gx + 0.5) * T - p.x, (gy + 0.5) * T - p.y) <= R) grid[gy * W + gx] = 1; });
      var edge = [];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (grid[y * W + x] === 1) { var open = 0; if (x > 0 && !grid[y * W + x - 1]) open++; if (x < W - 1 && !grid[y * W + x + 1]) open++; if (y > 0 && !grid[(y - 1) * W + x]) open++; if (y < H - 1 && !grid[(y + 1) * W + x]) open++; if (open) edge.push([x, y]); }
      edge.forEach(function (e) { grid[e[1] * W + e[0]] = (e[0] + e[1]) % 2 ? 2 : 3; });
      var s0 = pts[0];
      for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) if (grid[yy * W + xx] === 1) { var dx = (xx + 0.5) * T - s0.x, dy = (yy + 0.5) * T - s0.y, along = dx * Math.cos(s0.a) + dy * Math.sin(s0.a), across = -dx * Math.sin(s0.a) + dy * Math.cos(s0.a); if (Math.abs(along) < T * 0.55 && Math.abs(across) < 2.5 * T) grid[yy * W + xx] = 4; }
      return { W: W, H: H, grid: grid, pts: pts, M: pts.length, rnd: rnd };
    }
    throw new Error("pist üretilemedi");
  }

  // ---- pixel art made by code ----
  var CAR_ROWS = [
    "..hh..hh..", ".kbbbbbbk.", ".kbllllbk.", "..bwwwwb..", "..bwwwwb..", "..bdbbdb..", "..bbllbb..", "..bbllbb..", "..bbbbbb..", ".kbbbbbbk.", ".kbdbbdbk.", "..bbbbbb..", "..brrrrb..", "..dkkkkd.."
  ];
  function carSheet(col) {   // 16 turned copies of the car, each turned pixel by pixel (no smoothing)
    var pal = { b: col, d: shade(col, 0.62), l: shade(col, 1.3), w: [170, 210, 240], k: [24, 24, 28], h: [255, 244, 170], r: [255, 60, 50] }, sheets = [], S = 24, i;
    var base = document.createElement("canvas"); base.width = 10; base.height = CAR_ROWS.length; var bc = base.getContext("2d");
    CAR_ROWS.forEach(function (row, y) { for (var x = 0; x < 10; x++) { var cc = pal[row.charAt(x)]; if (cc) { bc.fillStyle = rgb(cc); bc.fillRect(x, y, 1, 1); } } });
    var src = bc.getImageData(0, 0, 10, CAR_ROWS.length).data, sw = 10, sh = CAR_ROWS.length;
    for (i = 0; i < 16; i++) {
      var cv = document.createElement("canvas"); cv.width = cv.height = S; var cx = cv.getContext("2d"), im = cx.createImageData(S, S), ang = i / 16 * 6.2832 + 1.5708, ca = Math.cos(ang), sa = Math.sin(ang);   // the sprite looks up when the angle is -90 degrees
      for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
        var dx = x + 0.5 - S / 2, dy = y + 0.5 - S / 2, ux = ca * dx + sa * dy + sw / 2, uy = -sa * dx + ca * dy + sh / 2, sx = Math.floor(ux), sy = Math.floor(uy);
        if (sx >= 0 && sy >= 0 && sx < sw && sy < sh) { var o = (sy * sw + sx) * 4; if (src[o + 3]) { var d = (y * S + x) * 4; im.data[d] = src[o]; im.data[d + 1] = src[o + 1]; im.data[d + 2] = src[o + 2]; im.data[d + 3] = 255; } }
      }
      cx.putImageData(im, 0, 0); sheets.push(cv);
    }
    return sheets;
  }
  var DECOR = {
    tree: { w: 14, h: 16, rows: ["....gggggg....", "..gggGggggg...", ".gggggGgggggg.", ".ggGgggggGggg.", "gggggggggggggg", "ggGggggggggGgg", ".ggggGggggggg.", ".gggggggGgggg.", "..gggggggggg..", "...gggggggg...", "......tt......", "......tt......", "......tt......", ".....tttt....."], pal: { g: [38, 112, 46], G: [60, 150, 66], t: [92, 62, 34] } },
    cactus: { w: 10, h: 14, rows: ["....gg....", "....gg....", ".g..gg..g.", ".g..gg..g.", ".ggggg..g.", "....ggggg.", "....gg....", "....gg....", "....gg....", "....gg....", "....gg....", "....gg....", "...gggg..."], pal: { g: [48, 132, 62] } },
    building: { w: 20, h: 22, rows: ["bbbbbbbbbbbbbbbbbbbb", "bwwbbwwbbwwbbwwbbwwb", "bwwbbwwbbwwbbwwbbwwb", "bbbbbbbbbbbbbbbbbbbb", "bwwbbwwbbwwbbwwbbwwb", "bwwbbwwbbwwbbwwbbwwb", "bbbbbbbbbbbbbbbbbbbb", "bwwbbwwbbwwbbwwbbwwb", "bwwbbwwbbwwbbwwbbwwb", "bbbbbbbbbbbbbbbbbbbb", "bwwbbwwbbddbbwwbbwwb", "bwwbbwwbbddbbwwbbwwb", "dddddddddddddddddddd"], pal: { b: [128, 134, 150], w: [250, 226, 140], d: [76, 80, 92] } },
    lamp: { w: 8, h: 14, rows: ["..yyyy..", "..yyyy..", "...pp...", "...pp...", "...pp...", "...pp...", "...pp...", "...pp...", "...pp...", "..pppp.."], pal: { y: [255, 240, 170], p: [70, 72, 80] } }
  };
  function drawRows(c, rows, pal, x, y, tone) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) { var cc = pal[rows[j].charAt(i)]; if (cc) { c.fillStyle = rgb(tone ? shade(cc, tone) : cc); c.fillRect(x + i, y + j, 1, 1); } }
  }
  function tileTexture(theme, kind, variant) {   // 16x16, by pixel
    var cv = document.createElement("canvas"); cv.width = cv.height = T; var c = cv.getContext("2d"), im = c.createImageData(T, T);
    for (var v = 0; v < T; v++) for (var u = 0; u < T; u++) {
      var n = hash(kind * 13 + variant, u, v), col;
      if (kind === 0) { col = theme.grass[variant]; var k = 0.9 + n * 0.2; col = shade(col, k); if (n > 0.93) col = shade(theme.grass[variant], 1.3); if (n < 0.05) col = shade(theme.grass[variant], 0.7); }
      else if (kind === 1) { col = theme.road[variant]; col = shade(col, 0.95 + n * 0.1); if (n > 0.97) col = theme.crack; if (v === 7 && u > 2 && u < 9 && hash(variant, u, 99) > 0.6) col = theme.crack; }
      else if (kind === 4) { col = ((u >> 2) + (v >> 2)) % 2 ? [236, 236, 236] : [30, 30, 34]; }
      else { col = theme.edge[kind === 2 ? 1 : 0]; col = shade(col, 0.95 + n * 0.1); if (u === 0 || v === 0) col = shade(col, 0.82); }
      var o = (v * T + u) * 4; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 255;
    }
    c.putImageData(im, 0, 0); return cv;
  }

  K.kit.define("race", {
    defaults: { title: "Yarış", theme: "city", laps: 3, rivals: 5, difficulty: 3, length: "medium", car: "sport", color: "red", music: "race", world: { seed: 1 }, width: 640, height: 400, features: [] },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (!SIZES[spec.length]) errors.push("bilinmeyen pist uzunluğu: " + spec.length + " (small, medium, large)");
      if (!CARS[spec.car]) errors.push("bilinmeyen araba: " + spec.car + " (var olanlar: " + Object.keys(CARS).join(", ") + ")");
      if (!COLORS[spec.color]) errors.push("bilinmeyen renk: " + spec.color + " (var olanlar: " + Object.keys(COLORS).join(", ") + ")");
      if (typeof spec.laps !== "number" || spec.laps < 1 || spec.laps > 9) errors.push("laps 1-9 olmalı");
      if (typeof spec.rivals !== "number" || spec.rivals < 1 || spec.rivals > 7) errors.push("rivals 1-7 olmalı");
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var seed = (spec.world && spec.world.seed) || 1, theme = THEMES[spec.theme], car = CARS[spec.car], tune = spec.music, feats = spec.features || [];
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      var tr = genTrack(seed, spec.length), W = tr.W, H = tr.H, pts = tr.pts, M = tr.M, rnd = rng(seed * 7 + 1);
      var state = { g: g, spec: spec, track: tr, p: null, all: [], racers: [], laps: spec.laps, time: 0, countdown: 3, finished: false, place: 0, finishOrder: [], message: "", messageT: 0, shake: 0, hasNitro: feats.indexOf("nitro") >= 0, grip: feats.indexOf("grip") >= 0 ? 1.35 : 1, parts: [] };
      state.menu = { open: K.race.menuAtStart !== false, kind: "main", index: 0, started: false }; state.paused = state.menu.open; state.musicOn = true;
      function tileAt(x, y) { var gx = Math.floor(x / T), gy = Math.floor(y / T); return gx < 0 || gy < 0 || gx >= W || gy >= H ? 0 : tr.grid[gy * W + gx]; }
      state.tileAt = tileAt;

      // ---- the cars ----
      var total = spec.rivals + 1, myIndex = Math.floor(total / 2);
      function mkCar(i, isPlayer, slot) {
        var s0 = pts[0], row = Math.floor(slot / 2), col = slot % 2 ? 1 : -1, back = 26 + row * 30;
        var base = 0.62 + 0.07 * spec.difficulty;
        return { me: isPlayer, x: s0.x - Math.cos(s0.a) * back + s0.nx * col * 16, y: s0.y - Math.sin(s0.a) * back + s0.ny * col * 16, a: s0.a, vx: 0, vy: 0, v: 0, next: 1, top: isPlayer ? TOP * car.top : TOP * (base + rnd() * 0.1), color: isPlayer ? COLORS[spec.color] : RIVAL_COLORS[i % RIVAL_COLORS.length], finished: false, lane: (rnd() - 0.5) * 2 * 14, name: isPlayer ? "SEN" : "R" + (i + 1), nitro: 1, lap: 0, steerShow: 0, boost: false };
      }
      state.reset = function () {
        state.time = 0; state.countdown = 3; state.finished = false; state.place = 0; state.finishOrder = []; state.message = ""; state.messageT = 0; state.shake = 0; state.parts = [];
        state.racers = []; var rv = 0, slot = total - 1;
        state.all = [];
        for (var k = 0; k < total; k++) { var me = k === myIndex, c = mkCar(rv, me, k); if (me) state.p = c; else { state.racers.push(c); rv++; } state.all.push(c); }
        if (g.current !== "play") g.go("play");
      };
      state.say = function (t) { state.message = t; state.messageT = 2; };
      function progress(c) { var q = pts[c.next % M]; return c.next * 1000 - Math.hypot(q.x - c.x, q.y - c.y); }
      state.rank = function () { var me = state.p, mp = progress(me); return 1 + state.all.filter(function (r) { return r !== me && (r.finished ? (!me.finished || state.finishOrder.indexOf(r) < state.finishOrder.indexOf(me)) : (!me.finished && progress(r) > mp)); }).length; };

      // ---- moving a car: it slides sideways a little, grass slows it, the bends need steering ----
      function drive(c, thr, steer, boost, dt, gripMul, offMul) {
        var fx = Math.cos(c.a), fy = Math.sin(c.a), vf = c.vx * fx + c.vy * fy, vl = -c.vx * fy + c.vy * fx;
        var onGrass = tileAt(c.x, c.y) === 0, top = c.top * (boost ? 1.4 : 1) * (onGrass ? offMul : 1);
        if (thr > 0) { if (vf < top) vf = Math.min(top, vf + ACC * (boost ? 2.4 : 1) * (c.me ? car.accel : 1) * thr * dt); }
        else if (thr < 0) { vf = vf > 0 ? Math.max(0, vf - BRAKE * dt) : Math.max(-top * 0.35, vf - ACC * 0.7 * dt); }
        vf -= vf * (onGrass ? 2.4 : 0.35) * dt; if (vf > top) vf = Math.max(top, vf - BRAKE * 0.5 * dt);
        vl *= Math.exp(-6.5 * gripMul * dt);
        c.a = wrapAng(c.a + steer * 2.7 * clamp(vf / (TOP * 0.35), -1, 1) * dt * (c.me ? car.grip * state.grip : 1));
        fx = Math.cos(c.a); fy = Math.sin(c.a);
        c.vx = fx * vf - fy * vl; c.vy = fy * vf + fx * vl; c.v = vf;
        c.x = clamp(c.x + c.vx * dt, 12, W * T - 12); c.y = clamp(c.y + c.vy * dt, 12, H * T - 12);
        c.steerShow = steer;
      }
      function passWaypoints(c) {
        var q = pts[c.next % M], guard = 0;
        while (Math.hypot(q.x - c.x, q.y - c.y) < 44 && guard++ < 4) { c.next++; q = pts[c.next % M]; }
        var lap = Math.floor((c.next - 1) / M); if (lap > c.lap) { c.lap = lap; if (c.me && lap < state.laps) { K.sfx("coin"); state.say("Tur " + (lap + 1) + " / " + state.laps); } }
        if (!c.finished && c.next - 1 >= state.laps * M) { c.finished = true; state.finishOrder.push(c); if (c.me) { state.finished = true; state.place = state.finishOrder.length; state.say(state.place === 1 ? "BİRİNCİ!" : state.place + ". oldun"); K.sfx(state.place <= 3 ? "coin" : "hit"); } }
      }
      function aiThrottle(c, dt) {
        var tgt = pts[(c.next + 3) % M], ahead = pts[(c.next + 8) % M], tx = tgt.x + tgt.nx * c.lane, ty = tgt.y + tgt.ny * c.lane;
        var want = Math.atan2(ty - c.y, tx - c.x), diff = wrapAng(want - c.a), bend = Math.abs(wrapAng(ahead.a - pts[c.next % M].a));
        var steer = clamp(diff * 2.4, -1, 1), goal = c.top * (1 - clamp(bend * 0.9, 0, 0.45)) * (c.finished ? 0.35 : 1);
        for (var i = 0; i < state.all.length; i++) {   // another car close ahead: lift and move over
          var o = state.all[i]; if (o === c) continue; var dx = o.x - c.x, dy = o.y - c.y, ahead2 = dx * Math.cos(c.a) + dy * Math.sin(c.a), side = -dx * Math.sin(c.a) + dy * Math.cos(c.a);
          if (ahead2 > 0 && ahead2 < 34 && Math.abs(side) < 12) { steer = clamp(steer + (side > 0 ? -0.7 : 0.7), -1, 1); if (o.v < c.v) goal = Math.min(goal, o.v + 10); }
        }
        drive(c, c.v < goal ? 1 : (c.v > goal + 20 ? -0.3 : 0), steer, false, dt, 1, 0.6);
      }
      state.step = function (dt) {
        if (!state.p || state.paused) return;
        state.messageT = Math.max(0, state.messageT - dt); state.shake = Math.max(0, state.shake - dt);
        var p = state.p;
        if (state.countdown > 0) { var before = Math.ceil(state.countdown); state.countdown -= dt; if (Math.ceil(state.countdown) !== before && state.countdown > 0) K.sfx("click"); if (state.countdown <= 0) { state.say("BAŞLA!"); K.sfx("coin"); } return; }
        state.time += dt;
        var up = K.key("ArrowUp") || K.key("w"), down = K.key("ArrowDown") || K.key("s"), left = K.key("ArrowLeft") || K.key("a"), right = K.key("ArrowRight") || K.key("d");
        var boost = state.hasNitro && K.key(" ") && p.nitro > 0 && !state.finished; p.boost = boost;
        if (state.finished) drive(p, 0, 0, false, dt, 1, car.off);
        else drive(p, up ? 1 : down ? -1 : 0, (right ? 1 : 0) - (left ? 1 : 0), boost, dt, 1, car.off);
        if (boost) { p.nitro = Math.max(0, p.nitro - dt * 0.3); state.parts.push({ x: p.x - Math.cos(p.a) * 9, y: p.y - Math.sin(p.a) * 9, life: 0.25, c: "#ffb74d" }); } else if (state.hasNitro) p.nitro = Math.min(1, p.nitro + dt * 0.05);
        if (tileAt(p.x, p.y) === 0 && Math.abs(p.v) > 30) { state.shake = 0.06; if (Math.random() < 0.5) state.parts.push({ x: p.x - Math.cos(p.a) * 8, y: p.y - Math.sin(p.a) * 8, life: 0.35, c: theme.grass[0].map(function (v) { return Math.min(255, v + 30); }) }); }
        for (var i = 0; i < state.racers.length; i++) { aiThrottle(state.racers[i], dt); }
        // cars bump into each other
        for (var a = 0; a < state.all.length; a++) for (var b = a + 1; b < state.all.length; b++) {
          var A = state.all[a], B = state.all[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
          if (d < 12 && d > 0.01) { var push = (12 - d) / 2, nx = dx / d, ny = dy / d; A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push; var rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny; if (rv < 0) { A.vx += nx * rv * 0.6; A.vy += ny * rv * 0.6; B.vx -= nx * rv * 0.6; B.vy -= ny * rv * 0.6; A.vx *= 0.97; A.vy *= 0.97; B.vx *= 0.97; B.vy *= 0.97; if ((A.me || B.me) && -rv > 30) { state.shake = 0.12; K.sfx("hit"); } } }
        }
        for (var q = 0; q < state.all.length; q++) passWaypoints(state.all[q]);
        state.parts = state.parts.filter(function (pt) { pt.life -= dt; return pt.life > 0; });
      };
      state.start = function () { state.reset(); if (tune && state.musicOn) K.music.play(tune); };

      // ---- the menus: a main menu at the start, Esc is the pause menu ----
      var CONTROLS = ["W ya da yukarı  gaz      S ya da aşağı  fren, geri      A D ya da sol sağ  direksiyon", "Boşluk  nitro (nitro özelliği varsa)      R  yeniden başla      Esc  menü", "Yol dışına (çim, kum) çıkma: yavaşlarsın. Turları tamamla, ilk üçe gir."];
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.paused = true; };
      state.closeMenu = function () { state.menu.open = false; state.menu.started = true; state.paused = false; };
      state.toggleMusic = function () { state.musicOn = !state.musicOn; if (state.musicOn) { if (tune) K.music.play(tune); } else K.music.stop(); };
      state.menuItems = function () {
        var m = state.menu, music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic }, controls = { label: "Kontroller", act: function () { m.back = m.kind; m.kind = "controls"; m.index = 0; } };
        if (m.kind === "main") return [{ label: m.started ? "Devam et" : "Yarışa başla", act: state.closeMenu }, controls, music];
        return [{ label: "Devam et", act: state.closeMenu }, controls, music, { label: "Baştan başla", act: function () { state.reset(); state.closeMenu(); } }, { label: "Ana menü", act: function () { state.openMenu("main"); } }];
      };
      var tapped = {}, tap = function (k) { var d = K.key(k), hit = d && !tapped[k]; tapped[k] = d; return hit; };
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

      // ---- the picture: one small canvas of 320x200 pixels drawn crisp, then scaled by a whole number ----
      var bg = null, small = null, sc = null, sheets = {}, mini = null, decor = [];
      function build() {
        var cv = document.createElement("canvas"); cv.width = W * T; cv.height = H * T; var c = cv.getContext("2d");
        var tex = [[0, 1].map(function (v) { return tileTexture(theme, 0, v); }), [0, 1].map(function (v) { return tileTexture(theme, 1, v); }), [tileTexture(theme, 2, 0)], [tileTexture(theme, 3, 0)], [tileTexture(theme, 4, 0)]];
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var k = tr.grid[y * W + x]; c.drawImage(tex[k][(x + y + (k === 1 ? Math.floor(x / 2) : 0)) % tex[k].length], x * T, y * T); }
        var dr = rng(seed * 3 + 9), near = function (gx, gy) { for (var oy = -3; oy <= 3; oy++) for (var ox = -3; ox <= 3; ox++) { var nx = gx + ox, ny = gy + oy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && tr.grid[ny * W + nx]) return true; } return false; };
        var kinds = theme.side === "building" ? ["building", "tree"] : theme.side === "tree" ? ["tree", "tree", "tree"] : [theme.side], list = [];
        for (var tries = 0; tries < 520; tries++) { var gx = 1 + Math.floor(dr() * (W - 2)), gy = 1 + Math.floor(dr() * (H - 2)); if (tr.grid[gy * W + gx] || near(gx, gy)) continue; list.push({ x: gx * T + 2 + Math.floor(dr() * 8), y: gy * T + 6 + Math.floor(dr() * 8), kind: kinds[Math.floor(dr() * kinds.length)], tone: 0.85 + dr() * 0.3 }); }
        list.sort(function (a, b) { return a.y - b.y; });
        list.forEach(function (d) { var spr = DECOR[d.kind]; c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(d.x - 1, d.y + 3, spr.w + 1, 3); drawRows(c, spr.rows, spr.pal, d.x, d.y - spr.h + 4, d.kind === "building" ? 1 : d.tone); });
        if (theme.tint) { /* the night is put over the cars too, see draw */ }
        bg = cv;
        mini = document.createElement("canvas"); mini.width = W; mini.height = H; var mc = mini.getContext("2d"); for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) if (tr.grid[yy * W + xx]) { mc.fillStyle = tr.grid[yy * W + xx] === 4 ? "#fff" : "rgba(230,230,240,0.9)"; mc.fillRect(xx, yy, 1, 1); }
        small = document.createElement("canvas"); small.width = VW; small.height = VH; sc = small.getContext("2d");
      }
      function drawCar(c, car2) {
        var key = car2.color.join(","); if (!sheets[key]) sheets[key] = carSheet(car2.color);
        var idx = (Math.round(wrapAng(car2.a) / 6.2832 * 16) + 16) % 16, sh = sheets[key][idx];
        c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(Math.round(car2.x) - 5, Math.round(car2.y) - 3, 10, 9);
        c.drawImage(sh, Math.round(car2.x) - 12, Math.round(car2.y) - 12);
      }
      function drawWorld(c) {
        var p = state.p, camx = clamp(Math.round(p.x + p.vx * 0.25 - VW / 2), 0, W * T - VW), camy = clamp(Math.round(p.y + p.vy * 0.25 - VH / 2), 0, H * T - VH);
        if (state.shake > 0) { camx += Math.round((Math.random() - 0.5) * 4); camy += Math.round((Math.random() - 0.5) * 4); }
        c.imageSmoothingEnabled = false; c.drawImage(bg, camx, camy, VW, VH, 0, 0, VW, VH);
        c.save(); c.translate(-camx, -camy);
        state.parts.forEach(function (pt) { c.fillStyle = typeof pt.c === "string" ? pt.c : rgb(pt.c); c.fillRect(Math.round(pt.x), Math.round(pt.y), 2, 2); });
        state.all.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (cr) { drawCar(c, cr); });
        c.restore();
        if (theme.tint) { c.fillStyle = theme.tint; c.fillRect(0, 0, VW, VH); state.all.forEach(function (cr) { var hx = Math.round(cr.x - camx + Math.cos(cr.a) * 18), hy = Math.round(cr.y - camy + Math.sin(cr.a) * 18); c.fillStyle = "rgba(255,240,170,0.16)"; c.fillRect(hx - 6, hy - 6, 12, 12); c.fillRect(hx - 3, hy - 3, 6, 6); }); }
        return { x: camx, y: camy };
      }
      function drawHud(c) {
        var Wd = g.width, Hd = g.height, p = state.p, sx = Wd / VW;
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, 8, 150, 70); c.fillStyle = "#fff"; c.font = "bold 15px sans-serif"; c.textAlign = "left";
        c.fillText("SIRA " + state.rank() + " / " + (spec.rivals + 1), 16, 28); c.fillText("TUR " + Math.min(state.laps, p.lap + 1) + " / " + state.laps, 16, 48); c.font = "13px sans-serif"; c.fillText("süre " + state.time.toFixed(1) + " sn", 16, 68);
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(Wd - 150, Hd - 62, 142, 54); c.fillStyle = "#ffd54f"; c.font = "bold 24px sans-serif"; c.textAlign = "right"; c.fillText(Math.round(Math.abs(p.v) / TOP * 180) + " km/s", Wd - 16, Hd - 32); c.textAlign = "left";
        c.fillStyle = "rgba(255,255,255,0.25)"; c.fillRect(Wd - 142, Hd - 22, 126, 8); c.fillStyle = "#4fc3f7"; c.fillRect(Wd - 142, Hd - 22, 126 * clamp(Math.abs(p.v) / (TOP * 1.4), 0, 1), 8);
        if (state.hasNitro) { c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, Hd - 28, 130, 20); c.fillStyle = "#ff9800"; c.fillRect(12, Hd - 24, 122 * p.nitro, 12); c.fillStyle = "#fff"; c.font = "10px sans-serif"; c.fillText("NİTRO (Boşluk)", 16, Hd - 14); }
        var ms = Math.min(2, Math.floor(150 / W)) || 1, mw = W * ms, mh = H * ms, mx = Wd - mw - 8, my = 8;   // the little map
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(mx - 3, my - 3, mw + 6, mh + 6); c.imageSmoothingEnabled = false; c.drawImage(mini, mx, my, mw, mh);
        state.all.forEach(function (cr) { c.fillStyle = cr.me ? "#ffeb3b" : rgb(cr.color); c.fillRect(mx + Math.floor(cr.x / T * ms) - 1, my + Math.floor(cr.y / T * ms) - 1, cr.me ? 4 : 3, cr.me ? 4 : 3); });
        if (state.countdown > 0) { c.textAlign = "center"; c.fillStyle = "#fff"; c.font = "bold 80px sans-serif"; c.fillText(String(Math.ceil(state.countdown)), Wd / 2, Hd / 2); c.textAlign = "left"; }
        else if (state.messageT > 0) { c.textAlign = "center"; c.fillStyle = "#ffe082"; c.font = "bold 34px sans-serif"; c.fillText(state.message, Wd / 2, Hd / 3); c.textAlign = "left"; }
        if (state.finished && Math.abs(p.v) < TOP * 0.05) {
          c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(Wd / 2 - 170, Hd / 2 - 120, 340, 240); c.textAlign = "center"; c.fillStyle = state.place <= 3 ? "#ffd54f" : "#fff"; c.font = "bold 26px sans-serif";
          c.fillText(state.place === 1 ? "KAZANDIN!" : state.place <= 3 ? "PODYUMDASIN" : "YARIŞ BİTTİ", Wd / 2, Hd / 2 - 82);
          c.font = "15px sans-serif"; state.finishOrder.slice(0, 6).forEach(function (r, i) { c.fillStyle = r.me ? "#ffd54f" : "#fff"; c.fillText((i + 1) + ".  " + r.name, Wd / 2, Hd / 2 - 52 + i * 22); });
          c.fillStyle = "#b0bec5"; c.font = "13px sans-serif"; c.fillText("süre " + state.time.toFixed(1) + " sn     R: yeniden", Wd / 2, Hd / 2 + 104); c.textAlign = "left";
        }
      }
      function drawMenu(c) {
        var m = state.menu, Wd = g.width, Hd = g.height; c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, Wd, Hd); c.textAlign = "center";
        c.fillStyle = "#fff"; c.font = "bold 34px sans-serif"; c.fillText(m.kind === "main" ? (spec.title || "Yarış") : m.kind === "controls" ? "Kontroller" : "Duraklatıldı", Wd / 2, 70);
        if (m.kind === "controls") { c.font = "14px sans-serif"; c.fillStyle = "#e0e0e0"; CONTROLS.forEach(function (t, i) { c.fillText(t, Wd / 2, 140 + i * 34); }); c.fillStyle = "#ffd54f"; c.fillText("Esc ya da tık: geri", Wd / 2, Hd - 40); c.textAlign = "left"; return; }
        var items = state.menuItems();
        items.forEach(function (it, i) { var y = rowY(items.length) + i * 44 - 4, on = i === m.index; c.fillStyle = on ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.08)"; c.fillRect(Wd / 2 - 150, y, 300, 38); c.strokeStyle = on ? "#ffd54f" : "rgba(255,255,255,0.2)"; c.strokeRect(Wd / 2 - 150, y, 300, 38); c.fillStyle = on ? "#ffd54f" : "#fff"; c.font = "bold 17px sans-serif"; c.fillText(it.label, Wd / 2, y + 25); });
        c.font = "12px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla", Wd / 2, Hd - 30); c.textAlign = "left";
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined" || g.current !== "play" || !state.p) return;
        if (!bg) build();
        drawWorld(sc); c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);   // crisp: a whole number of screen pixels for each picture pixel
        if (!(state.menu.open && state.menu.kind === "main")) drawHud(c); if (state.menu.open) drawMenu(c);
      } }];
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) {
        g.canvas.addEventListener("mousedown", function (e) { if (e.button === 0 && state.menu.open) state.menuClick(); });
      }
      g.scene("play", { update: function (game, dt) {
        if (state.menu.open) { state.menuUpdate(); return; }
        if (tap("Escape")) { state.openMenu("pause"); return; }
        if (tap("r")) { state.reset(); return; }
        state.step(dt);
      } });
      state.expose = { g: g, spec: spec, state: state, get p() { return state.p; } };
      return state;
    }
  });

  K.race = { themes: Object.keys(THEMES), cars: Object.keys(CARS), colors: Object.keys(COLORS), lengths: Object.keys(SIZES), features: FEATURES, genTrack: genTrack, TILE: T, TOP: TOP, menuAtStart: true };
  K.feature.define("nitro", { kits: ["race"], options: {}, apply: function (s) { s.hasNitro = true; } });
  K.feature.define("grip", { kits: ["race"], options: {}, apply: function (s) { s.grip = 1.35; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
