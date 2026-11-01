/* kgame.blast.js: 2 boyutlu piksel blok yerleştirme kiti (blast, Block Blast türü). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'blast', title:'Blok Patlat', theme:'candy', size:'medium', difficulty:3, goal:0, music:'blast', world:{seed:5}, features:['hint','undo'] })
   Kit; tahtaya her turda üç parça verir, parçaları sürükleyip boş yerlere koyarsın (döndürme yok); dolan satırlar ve sütunlar patlar, art arda patlatınca kombo çarpanı büyür, tahta bütün boşalırsa büyük ödül. Elindeki üç parçadan hiçbiri sığmazsa oyun biter.
   Resim küçük (320x200 piksel) tuvalde keskin çizilir, tam sayı katıyla büyütülür, bulanıklık yok. Kontroller: fare ile parçayı alttan tahtaya sürükle ya da oklar + 1-3 (parça seç) + Boşluk/Enter (koy); U geri al (undo), H ipucu (hint), R yeniden, Esc menü. Özellikler: hint, undo, bomb.
   Önce kgame.js, kgame.kits.js ve kgame.audio2.js yüklenmiş olmalı. Her şey kodla çizilir (görsel dosya yok). */
(function (root) {
  var K = root.K;
  var VW = 320, VH = 200, BY = 8, TRAY = 140;
  var SIZES = { small: { n: 6, cs: 20 }, medium: { n: 8, cs: 15 }, large: { n: 10, cs: 12 } };
  var THEMES = {
    candy: { bg: [[60, 30, 80], [44, 20, 62]], board: [28, 14, 40], cell: [48, 30, 66], line: [120, 70, 150], pal: [[236, 64, 90], [255, 168, 40], [250, 226, 60], [90, 210, 90], [64, 180, 240], [160, 90, 230], [250, 120, 200]] },
    neon: { bg: [[10, 14, 34], [6, 8, 24]], board: [4, 6, 16], cell: [14, 20, 44], line: [40, 220, 220], pal: [[255, 50, 120], [255, 160, 30], [240, 240, 60], [60, 255, 140], [40, 200, 255], [160, 100, 255], [255, 100, 255]] },
    ocean: { bg: [[20, 70, 110], [16, 58, 96]], board: [10, 36, 62], cell: [22, 64, 96], line: [110, 190, 220], pal: [[240, 100, 90], [250, 190, 70], [250, 240, 140], [90, 220, 160], [90, 190, 250], [150, 130, 240], [240, 150, 210]] },
    night: { bg: [[24, 28, 54], [18, 20, 42]], board: [10, 12, 26], cell: [24, 28, 52], line: [90, 100, 160], pal: [[220, 70, 100], [240, 150, 60], [230, 220, 90], [80, 200, 130], [80, 150, 230], [150, 110, 230], [220, 120, 200]] }
  };
  // the shapes: lists of [x, y] cells, with a weight that grows or shrinks with the difficulty
  var SHAPES = [
    { c: [[0, 0]], w: 3, hard: -2 }, { c: [[0, 0], [1, 0]], w: 4, hard: -1 }, { c: [[0, 0], [0, 1]], w: 4, hard: -1 },
    { c: [[0, 0], [1, 0], [2, 0]], w: 4, hard: 0 }, { c: [[0, 0], [0, 1], [0, 2]], w: 4, hard: 0 },
    { c: [[0, 0], [1, 0], [2, 0], [3, 0]], w: 3, hard: 1 }, { c: [[0, 0], [0, 1], [0, 2], [0, 3]], w: 3, hard: 1 },
    { c: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], w: 2, hard: 2 }, { c: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], w: 2, hard: 2 },
    { c: [[0, 0], [1, 0], [0, 1], [1, 1]], w: 4, hard: 0 }, { c: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], w: 2, hard: 2 },
    { c: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], w: 2, hard: 1 }, { c: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], w: 2, hard: 1 },
    { c: [[0, 0], [0, 1], [1, 1]], w: 3, hard: 0 }, { c: [[1, 0], [0, 1], [1, 1]], w: 3, hard: 0 }, { c: [[0, 0], [1, 0], [0, 1]], w: 3, hard: 0 }, { c: [[0, 0], [1, 0], [1, 1]], w: 3, hard: 0 },
    { c: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], w: 2, hard: 2 }, { c: [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]], w: 2, hard: 2 }, { c: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], w: 2, hard: 2 }, { c: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], w: 2, hard: 2 },
    { c: [[0, 0], [1, 0], [2, 0], [1, 1]], w: 2, hard: 1 }, { c: [[1, 0], [0, 1], [1, 1], [2, 1]], w: 2, hard: 1 }, { c: [[0, 0], [0, 1], [0, 2], [1, 1]], w: 2, hard: 1 }, { c: [[1, 0], [1, 1], [1, 2], [0, 1]], w: 2, hard: 1 },
    { c: [[1, 0], [2, 0], [0, 1], [1, 1]], w: 2, hard: 1 }, { c: [[0, 0], [1, 0], [1, 1], [2, 1]], w: 2, hard: 1 }, { c: [[0, 0], [0, 1], [1, 1], [1, 2]], w: 2, hard: 1 }, { c: [[1, 0], [1, 1], [0, 1], [0, 2]], w: 2, hard: 1 },
    { c: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], w: 1, hard: 2 }
  ];
  var FEATURES = ["hint", "undo", "bomb"];

  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shade(c, k) { return [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function dims(cells) { var w = 0, h = 0; cells.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); }); return { w: w, h: h }; }

  var sprites = {};
  function blockSprite(col, size) {
    var key = col.join(",") + size; if (sprites[key]) return sprites[key];
    var cv = document.createElement("canvas"); cv.width = cv.height = size; var c = cv.getContext("2d"), im = c.createImageData(size, size);
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var k = 1; if (x === 0 || y === 0) k = 1.38; else if (x === size - 1 || y === size - 1) k = 0.6; else if (x === 1 && y === 1) k = 1.55; else if (x + y === size) k = 0.9;
      var o = (y * size + x) * 4, cc = shade(col, k); im.data[o] = cc[0]; im.data[o + 1] = cc[1]; im.data[o + 2] = cc[2]; im.data[o + 3] = 255;
    }
    c.putImageData(im, 0, 0); return sprites[key] = cv;
  }

  K.kit.define("blast", {
    defaults: { title: "Blok Patlat", theme: "candy", size: "medium", difficulty: 3, goal: 0, music: "blast", world: { seed: 1 }, width: 640, height: 400, features: [] },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (!SIZES[spec.size]) errors.push("bilinmeyen boyut: " + spec.size + " (small, medium, large)");
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      if (typeof spec.goal !== "number" || spec.goal < 0 || spec.goal > 100000) errors.push("goal 0-100000 olmalı");
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var seed = (spec.world && spec.world.seed) || 1, theme = THEMES[spec.theme], d = spec.difficulty, tune = spec.music, feats = spec.features || [], N = SIZES[spec.size].n, CS = SIZES[spec.size].cs, rnd = rng(seed * 71 + 11);
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      var BX = Math.round((VW - N * CS) / 2);
      var state = { g: g, spec: spec, N: N, board: [], pieces: [null, null, null], score: 0, best: 0, combo: 0, streak: 0, over: false, won: false, message: "", messageT: 0, time: 0, cx: 0, cy: 0, sel: 0, drag: null, clearing: null, parts: [], hint: null, idle: 0, undoLeft: 0, history: null, hasHint: feats.indexOf("hint") >= 0, hasUndo: feats.indexOf("undo") >= 0, hasBomb: feats.indexOf("bomb") >= 0, moves: 0, lines: 0, shake: 0 };
      state.menu = { open: K.blast.menuAtStart !== false, kind: "main", index: 0, started: false }; state.paused = state.menu.open; state.musicOn = true;
      state.say = function (t, s) { state.message = t; state.messageT = s || 1.4; };
      var bestKey = "blast.best." + (spec.title || "") + "." + spec.size; try { state.best = +K.save.get(bestKey, 0) || 0; } catch (e) { state.best = 0; }

      // ---- the pieces ----
      function pickShape() {
        var total = 0, ws = SHAPES.map(function (s) { var w = Math.max(0.2, s.w + s.hard * (d - 3) * 0.6); total += w; return w; }), r = rnd() * total, i = 0;
        for (; i < ws.length - 1; i++) { r -= ws[i]; if (r <= 0) break; } return SHAPES[i];
      }
      function newPiece() {
        if (state.hasBomb && rnd() < 0.08) return { cells: [[0, 0]], color: [250, 250, 250], bomb: true, w: 1, h: 1 };
        var s = pickShape(), dm = dims(s.c); return { cells: s.c.map(function (c) { return [c[0], c[1]]; }), color: theme.pal[Math.floor(rnd() * theme.pal.length)], bomb: false, w: dm.w, h: dm.h };
      }
      state.canPlace = function (p, gx, gy) {
        if (!p) return false; for (var i = 0; i < p.cells.length; i++) { var x = gx + p.cells[i][0], y = gy + p.cells[i][1]; if (x < 0 || y < 0 || x >= N || y >= N || state.board[y][x]) return false; } return true;
      };
      function anyFit(p) { for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (state.canPlace(p, x, y)) return [x, y]; return null; }
      state.deal = function () {
        for (var tries = 0; tries < 40; tries++) {
          var ps = [newPiece(), newPiece(), newPiece()];
          if (ps.some(function (p) { return anyFit(p); }) || tries === 39) { state.pieces = ps; break; }
        }
        state.sel = 0; state.idle = 0; state.hint = null;
        if (!state.pieces.some(function (p) { return p && anyFit(p); })) finish(false);
      };
      function finish(win) {
        state.over = true; state.won = win; K.music.stop(); K.sfx(win ? "coin" : "hit");
        if (state.score > state.best) { state.best = state.score; try { K.save.set(bestKey, state.best); } catch (e) { /* not kept */ } }
      }
      state.reset = function () {
        state.board = []; for (var y = 0; y < N; y++) state.board.push(new Array(N).fill(0));
        var pre = (d - 1) * Math.round(N / 2), placed = 0, guard = 0;   // a harder game starts with some blocks lying about
        while (placed < pre && guard++ < 200) { var x = Math.floor(rnd() * N), yy = Math.floor(rnd() * N); if (!state.board[yy][x]) { state.board[yy][x] = 1 + Math.floor(rnd() * theme.pal.length); placed++; if (state.board[yy].every(function (v) { return v; })) { state.board[yy][x] = 0; placed--; } } }
        state.score = 0; state.combo = 0; state.streak = 0; state.over = false; state.won = false; state.time = 0; state.clearing = null; state.parts = []; state.drag = null; state.messageT = 0; state.moves = 0; state.lines = 0; state.undoLeft = state.hasUndo ? 3 : 0; state.history = null; state.cx = Math.floor(N / 2) - 1; state.cy = Math.floor(N / 2) - 1;
        state.deal(); if (g.current !== "play") g.go("play");
      };
      state.start = function () { state.reset(); if (tune && state.musicOn) K.music.play(tune); };

      // ---- placing, clearing, scoring ----
      function snapshot() { return { board: state.board.map(function (r) { return r.slice(); }), pieces: state.pieces.map(function (p) { return p && { cells: p.cells, color: p.color, bomb: p.bomb, w: p.w, h: p.h }; }), score: state.score, streak: state.streak, lines: state.lines, moves: state.moves }; }
      state.place = function (slot, gx, gy) {
        var p = state.pieces[slot]; if (state.over || state.clearing || !p || !state.canPlace(p, gx, gy)) return false;
        state.history = snapshot(); var i, cellsAdded = p.cells.length, colorIdx = Math.max(1, theme.pal.indexOf(p.color) + 1);
        if (p.bomb) { for (var by = gy - 1; by <= gy + 1; by++) for (var bx = gx - 1; bx <= gx + 1; bx++) if (bx >= 0 && by >= 0 && bx < N && by < N && state.board[by][bx]) { state.board[by][bx] = 0; state.score += 2; burst(bx, by, [255, 200, 80]); } K.sfx("boom"); state.shake = 0.15; cellsAdded = 1; }
        else for (i = 0; i < p.cells.length; i++) state.board[gy + p.cells[i][1]][gx + p.cells[i][0]] = colorIdx;
        state.pieces[slot] = null; state.score += cellsAdded; state.moves++; K.sfx("click"); state.hint = null; state.idle = 0;
        var rows = [], cols = [], y, x;
        for (y = 0; y < N; y++) if (state.board[y].every(function (v) { return v; })) rows.push(y);
        for (x = 0; x < N; x++) { var full = true; for (y = 0; y < N; y++) if (!state.board[y][x]) { full = false; break; } if (full) cols.push(x); }
        var n = rows.length + cols.length;
        if (n) {
          state.streak++; var mult = 1 + 0.5 * (state.streak - 1), gain = Math.round(10 * n * n * mult); state.score += gain; state.lines += n; state.combo = state.streak;
          state.clearing = { rows: rows, cols: cols, t: 0.3 }; K.sfx("coin"); state.say((n >= 2 ? n + " SATIR! " : "") + (state.streak >= 2 ? "KOMBO x" + state.streak + "  " : "") + "+" + gain, 1.3);
        } else { state.streak = 0; state.combo = 0; afterMove(); }
        return true;
      };
      function burst(x, y, col) { for (var i = 0; i < 4; i++) state.parts.push({ x: BX + x * CS + CS / 2, y: BY + y * CS + CS / 2, vx: (rnd() - 0.5) * 120, vy: (rnd() - 0.5) * 120, life: 0.4, c: col }); }
      function finishClear() {
        var cl = state.clearing, x, y; state.clearing = null;
        cl.rows.forEach(function (r) { for (x = 0; x < N; x++) { if (state.board[r][x]) burst(x, r, theme.pal[state.board[r][x] % theme.pal.length]); state.board[r][x] = 0; } });
        cl.cols.forEach(function (c) { for (y = 0; y < N; y++) { if (state.board[y][c]) burst(c, y, theme.pal[state.board[y][c] % theme.pal.length]); state.board[y][c] = 0; } });
        if (state.board.every(function (r) { return r.every(function (v) { return !v; }); })) { state.score += 100; state.say("TAHTA TEMİZ! +100", 1.8); K.sfx("coin"); }
        afterMove();
      }
      function afterMove() {
        if (spec.goal > 0 && state.score >= spec.goal) { finish(true); return; }
        if (state.score > state.best) state.best = state.score;
        if (state.pieces.every(function (p) { return !p; })) state.deal();
        else if (!state.pieces.some(function (p) { return p && anyFit(p); })) finish(false);
        else if (!state.pieces[state.sel]) state.sel = state.pieces.findIndex(function (p) { return !!p; });
      }
      state.undo = function () {
        if (!state.hasUndo || state.undoLeft <= 0 || !state.history || state.clearing || state.over) return false;
        var h = state.history; state.board = h.board; state.pieces = h.pieces; state.score = h.score; state.streak = h.streak; state.lines = h.lines; state.moves = h.moves; state.history = null; state.undoLeft--; K.sfx("click"); state.say("Geri alındı (" + state.undoLeft + " hak kaldı)"); return true;
      };
      state.findHint = function () {
        for (var s = 0; s < 3; s++) { var p = state.pieces[s]; if (!p) continue; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (state.canPlace(p, x, y)) return { slot: s, x: x, y: y }; } return null;
      };

      // ---- one step ----
      var tapped = {}, tap = function (k) { var dd = K.key(k), hit = dd && !tapped[k]; tapped[k] = dd; return hit; };
      state.step = function (dt) {
        if (!state.board.length || state.paused) return;
        state.messageT = Math.max(0, state.messageT - dt); state.shake = Math.max(0, state.shake - dt);
        state.parts = state.parts.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.life > 0; });
        if (state.over) return;
        state.time += dt; state.idle += dt;
        if (state.clearing) { state.clearing.t -= dt; if (state.clearing.t <= 0) finishClear(); return; }
        if (state.hasHint && state.idle > 8 && !state.hint) state.hint = state.findHint();
      };
      state.keys = function () {
        if (state.over || state.clearing) return;
        if (tap("ArrowLeft") || tap("a")) state.cx = Math.max(0, state.cx - 1); if (tap("ArrowRight") || tap("d")) state.cx = Math.min(N - 1, state.cx + 1); if (tap("ArrowUp") || tap("w")) state.cy = Math.max(0, state.cy - 1); if (tap("ArrowDown") || tap("s")) state.cy = Math.min(N - 1, state.cy + 1);
        for (var i = 0; i < 3; i++) if (tap(String(i + 1)) && state.pieces[i]) state.sel = i;
        if (tap("q") || tap("e")) { for (var k = 1; k <= 3; k++) { var j = (state.sel + (K.key("q") ? -k : k) + 9) % 3; if (state.pieces[j]) { state.sel = j; break; } } }
        if (tap(" ") || tap("Enter")) state.place(state.sel, state.cx, state.cy);
        if (tap("u")) state.undo(); if (tap("h") && state.hasHint) state.hint = state.findHint();
      };
      // ---- the mouse: a piece is taken from the tray and put on the board (or dropped back) ----
      function slotAt(sx, sy) { if (sy < TRAY) return -1; var i = Math.floor((sx - 8) / 100); return i >= 0 && i < 3 && state.pieces[i] ? i : -1; }
      function anchor(p, sx, sy) { return { x: Math.round((sx - BX) / CS - p.w / 2), y: Math.round((sy - BY) / CS - p.h / 2) }; }
      state.mouseDown = function (sx, sy) { if (state.over || state.clearing) return false; var s = slotAt(sx, sy); if (s < 0) return false; state.sel = s; state.drag = { slot: s, x: sx, y: sy }; return true; };
      state.mouseMove = function (sx, sy) {
        if (state.drag) { state.drag.x = sx; state.drag.y = sy; return; }
        var gx = Math.floor((sx - BX) / CS), gy = Math.floor((sy - BY) / CS); if (gx >= 0 && gy >= 0 && gx < N && gy < N) { state.cx = gx; state.cy = gy; }   // the cursor follows the mouse over the board
      };
      state.mouseUp = function (sx, sy) {
        var dg = state.drag; state.drag = null; if (!dg) return false; var p = state.pieces[dg.slot], a = p ? anchor(p, sx, sy) : null;
        if (p && a && sy < TRAY) { if (state.place(dg.slot, a.x, a.y)) return true; state.say("Buraya sığmaz", 0.8); K.sfx("hit"); }
        return false;
      };

      // ---- the menus ----
      var CONTROLS = ["Fare  parçayı alttan tutup tahtaya sürükle, bırak      ya da  oklar imleç, 1-2-3 ya da Q E parça seç, Boşluk/Enter koy", "Dolan satır ve sütun patlar. Art arda patlatırsan kombo çarpanı büyür; tahta bütün boşalırsa +100.", "U  geri al (undo özelliği)      H  ipucu (hint özelliği)      R  yeniden      Esc  menü.   Hiçbir parça sığmazsa oyun biter."];
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.paused = true; state.drag = null; };
      state.closeMenu = function () { state.menu.open = false; state.menu.started = true; state.paused = false; };
      state.toggleMusic = function () { state.musicOn = !state.musicOn; if (state.musicOn) { if (tune) K.music.play(tune); } else K.music.stop(); };
      state.menuItems = function () {
        var m = state.menu, music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic }, controls = { label: "Kontroller", act: function () { m.back = m.kind; m.kind = "controls"; m.index = 0; } };
        if (m.kind === "main") return [{ label: m.started ? "Devam et" : "Oyna", act: state.closeMenu }, controls, music];
        return [{ label: "Devam et", act: state.closeMenu }, controls, music, { label: "Baştan başla", act: function () { state.reset(); state.closeMenu(); } }, { label: "Ana menü", act: function () { state.openMenu("main"); } }];
      };
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
      var small = null, sc = null;
      function drawPiece(c, p, x, y, cs, alpha) {
        var spr = p.bomb ? null : blockSprite(p.color, cs); if (alpha) c.globalAlpha = alpha;
        p.cells.forEach(function (cell) { if (p.bomb) { c.fillStyle = "#fff"; c.fillRect(x + cell[0] * cs + 1, y + cell[1] * cs + 1, cs - 2, cs - 2); c.fillStyle = "#e53935"; c.fillRect(x + cell[0] * cs + 3, y + cell[1] * cs + 3, cs - 6, cs - 6); c.fillStyle = "#222"; c.fillRect(x + cell[0] * cs + Math.floor(cs / 2) - 1, y + cell[1] * cs - 1, 2, 3); } else c.drawImage(spr, x + cell[0] * cs, y + cell[1] * cs); });
        if (alpha) c.globalAlpha = 1;
      }
      function drawWorld(c) {
        var x, y; c.imageSmoothingEnabled = false;
        for (y = 0; y < VH; y += 8) for (x = 0; x < VW; x += 8) { c.fillStyle = rgb(theme.bg[((x + y) >> 3) % 2]); c.fillRect(x, y, 8, 8); }
        var sx = state.shake > 0 ? Math.round((rnd() - 0.5) * 3) : 0, sy = state.shake > 0 ? Math.round((rnd() - 0.5) * 3) : 0; c.save(); c.translate(sx, sy);
        c.fillStyle = rgb(theme.board); c.fillRect(BX - 3, BY - 3, N * CS + 6, N * CS + 6); c.fillStyle = rgb(theme.line); c.fillRect(BX - 4, BY - 4, N * CS + 8, 1); c.fillRect(BX - 4, BY + N * CS + 3, N * CS + 8, 1); c.fillRect(BX - 4, BY - 4, 1, N * CS + 8); c.fillRect(BX + N * CS + 3, BY - 4, 1, N * CS + 8);
        for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
          c.fillStyle = rgb((x + y) % 2 ? theme.cell : shade(theme.cell, 0.85)); c.fillRect(BX + x * CS, BY + y * CS, CS, CS);
          var v = state.board[y][x]; if (v) c.drawImage(blockSprite(theme.pal[(v - 1) % theme.pal.length], CS), BX + x * CS, BY + y * CS);
        }
        // where the dragged piece (or the cursor piece) would land
        var cur = state.drag ? state.pieces[state.drag.slot] : state.pieces[state.sel], at = state.drag ? anchor(cur || { w: 1, h: 1 }, state.drag.x, state.drag.y) : { x: state.cx, y: state.cy };
        if (cur && at && (state.drag ? state.drag.y < TRAY : !state.over)) { var ok = state.canPlace(cur, at.x, at.y); cur.cells.forEach(function (cell) { var gx = at.x + cell[0], gy = at.y + cell[1]; if (gx >= 0 && gy >= 0 && gx < N && gy < N) { c.fillStyle = ok ? "rgba(255,255,255,0.4)" : "rgba(255,60,60,0.35)"; c.fillRect(BX + gx * CS, BY + gy * CS, CS, CS); } }); }
        if (state.hint) { var hp = state.pieces[state.hint.slot]; if (hp) hp.cells.forEach(function (cell) { c.fillStyle = "rgba(120,255,160,0.45)"; c.fillRect(BX + (state.hint.x + cell[0]) * CS, BY + (state.hint.y + cell[1]) * CS, CS, CS); }); }
        if (state.clearing) { var fl = Math.floor(state.clearing.t * 24) % 2; c.fillStyle = fl ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)"; state.clearing.rows.forEach(function (r) { c.fillRect(BX, BY + r * CS, N * CS, CS); }); state.clearing.cols.forEach(function (cc) { c.fillRect(BX + cc * CS, BY, CS, N * CS); }); }
        if (!state.drag && !state.over) { c.fillStyle = "#ffd54f"; var kx = BX + state.cx * CS, ky = BY + state.cy * CS; c.fillRect(kx, ky, 3, 1); c.fillRect(kx, ky, 1, 3); c.fillRect(kx + CS - 3, ky, 3, 1); c.fillRect(kx + CS - 1, ky, 1, 3); c.fillRect(kx, ky + CS - 1, 3, 1); c.fillRect(kx, ky + CS - 3, 1, 3); c.fillRect(kx + CS - 3, ky + CS - 1, 3, 1); c.fillRect(kx + CS - 1, ky + CS - 3, 1, 3); }
        state.parts.forEach(function (p) { c.fillStyle = rgb(p.c); c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); });
        c.restore();
        // the tray
        c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(0, TRAY - 2, VW, VH - TRAY + 2);
        for (var i = 0; i < 3; i++) {
          var p = state.pieces[i], tx = 8 + i * 100; c.fillStyle = state.sel === i && p && !state.over ? "rgba(255,213,79,0.22)" : "rgba(255,255,255,0.06)"; c.fillRect(tx, TRAY + 2, 96, 54);
          if (state.sel === i && p && !state.over) { c.fillStyle = "#ffd54f"; c.fillRect(tx, TRAY + 2, 96, 1); c.fillRect(tx, TRAY + 55, 96, 1); c.fillRect(tx, TRAY + 2, 1, 54); c.fillRect(tx + 95, TRAY + 2, 1, 54); }
          if (p && !(state.drag && state.drag.slot === i)) { var cs2 = Math.min(10, Math.floor(46 / Math.max(p.w, p.h))); drawPiece(c, p, tx + Math.round((96 - p.w * cs2) / 2), TRAY + 4 + Math.round((50 - p.h * cs2) / 2), cs2, p && !anyFit(p) ? 0.35 : 0); }
        }
        if (state.drag && state.pieces[state.drag.slot]) { var dp = state.pieces[state.drag.slot]; drawPiece(c, dp, Math.round(state.drag.x - dp.w * CS / 2), Math.round(state.drag.y - dp.h * CS / 2) - 6, CS, 0.85); }
      }
      function drawHud(c) {
        var W = g.width, H = g.height;
        c.textAlign = "left"; c.font = "bold 13px sans-serif";
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, 8, 130, 66); c.fillStyle = "#ffd54f"; c.fillText("SKOR " + state.score, 14, 25); c.fillStyle = "#fff"; c.fillText("EN İYİ " + Math.max(state.best, state.score), 14, 43); c.font = "12px sans-serif"; c.fillStyle = "#cfd8dc"; c.fillText("satır " + state.lines + "   hamle " + state.moves, 14, 61);
        if (spec.goal > 0) { c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(W - 138, 8, 130, 24); c.fillStyle = "#9be39b"; c.font = "bold 13px sans-serif"; c.fillText("HEDEF " + spec.goal, W - 132, 25); }
        if (state.streak >= 2) { c.fillStyle = "#ff9800"; c.font = "bold 16px sans-serif"; c.fillText("KOMBO x" + state.streak, 14, 94); }
        var extra = []; if (state.hasUndo) extra.push("U geri al (" + state.undoLeft + ")"); if (state.hasHint) extra.push("H ipucu"); c.fillStyle = "rgba(255,255,255,0.7)"; c.font = "11px sans-serif"; extra.forEach(function (t, i) { c.fillText(t, 14, 116 + i * 14); });
        if (state.messageT > 0) { c.textAlign = "center"; c.fillStyle = "#ffe082"; c.font = "bold 20px sans-serif"; c.fillText(state.message, W / 2, 24 + 4); c.textAlign = "left"; }
        if (state.over) {
          c.fillStyle = "rgba(0,0,0,0.74)"; c.fillRect(W / 2 - 150, H / 2 - 80, 300, 160); c.textAlign = "center"; c.fillStyle = state.won ? "#ffd54f" : "#fff"; c.font = "bold 28px sans-serif";
          c.fillText(state.won ? "HEDEFE ULAŞTIN!" : "OYUN BİTTİ", W / 2, H / 2 - 34); c.font = "bold 22px sans-serif"; c.fillText("Skor " + state.score, W / 2, H / 2 + 4); c.font = "14px sans-serif"; c.fillStyle = "#ffd54f"; c.fillText(state.score >= state.best && state.score > 0 ? "YENİ REKOR!" : "En iyi " + state.best, W / 2, H / 2 + 30); c.fillStyle = "#b0bec5"; c.font = "13px sans-serif"; c.fillText("R: yeniden oyna", W / 2, H / 2 + 58); c.textAlign = "left";
        }
      }
      function drawMenu(c) {
        var m = state.menu, W = g.width, H = g.height; c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, W, H); c.textAlign = "center";
        c.fillStyle = "#fff"; c.font = "bold 34px sans-serif"; c.fillText(m.kind === "main" ? (spec.title || "Blok Patlat") : m.kind === "controls" ? "Kontroller" : "Duraklatıldı", W / 2, 70);
        if (m.kind === "controls") { c.font = "12px sans-serif"; c.fillStyle = "#e0e0e0"; CONTROLS.forEach(function (t, i) { c.fillText(t, W / 2, 140 + i * 34); }); c.fillStyle = "#ffd54f"; c.fillText("Esc ya da tık: geri", W / 2, H - 40); c.textAlign = "left"; return; }
        var items = state.menuItems();
        items.forEach(function (it, i) { var y = rowY(items.length) + i * 44 - 4, on = i === m.index; c.fillStyle = on ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.08)"; c.fillRect(W / 2 - 150, y, 300, 38); c.strokeStyle = on ? "#ffd54f" : "rgba(255,255,255,0.2)"; c.strokeRect(W / 2 - 150, y, 300, 38); c.fillStyle = on ? "#ffd54f" : "#fff"; c.font = "bold 17px sans-serif"; c.fillText(it.label, W / 2, y + 25); });
        c.font = "12px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla", W / 2, H - 30); c.textAlign = "left";
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined" || g.current !== "play" || !state.board.length) return;
        if (!small) { small = document.createElement("canvas"); small.width = VW; small.height = VH; sc = small.getContext("2d"); }
        drawWorld(sc); c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        if (!(state.menu.open && state.menu.kind === "main")) drawHud(c); if (state.menu.open) drawMenu(c);
      } }];
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) {
        var pos = function () { return [K.mouse.x * VW / g.width, K.mouse.y * VH / g.height]; };
        g.canvas.addEventListener("mousedown", function (e) { if (e.button !== 0) return; if (state.menu.open) { state.menuClick(); return; } if (!state.paused) { var p = pos(); state.mouseDown(p[0], p[1]); } });
        g.canvas.addEventListener("mousemove", function () { if (!state.menu.open && !state.over) { var p = pos(); state.mouseMove(p[0], p[1]); } });
        document.addEventListener("mouseup", function (e) { if (e.button === 0 && state.drag) { var p = pos(); state.mouseUp(p[0], p[1]); } });
      }
      g.scene("play", { update: function (game, dt) {
        if (state.menu.open) { state.menuUpdate(); return; }
        if (tap("Escape")) { state.openMenu("pause"); return; }
        if (tap("r")) { state.reset(); if (tune && state.musicOn) K.music.play(tune); return; }
        state.keys(); state.step(dt);
      } });
      state.expose = { g: g, spec: spec, state: state, get p() { return state.pieces; } };
      return state;
    }
  });

  K.blast = { themes: Object.keys(THEMES), sizes: Object.keys(SIZES), features: FEATURES, shapes: SHAPES, menuAtStart: true };
  K.feature.define("hint", { kits: ["blast"], options: {}, apply: function (s) { s.hasHint = true; } });
  K.feature.define("undo", { kits: ["blast"], options: {}, apply: function (s) { s.hasUndo = true; s.undoLeft = 3; } });
  K.feature.define("bomb", { kits: ["blast"], options: {}, apply: function (s) { s.hasBomb = true; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
