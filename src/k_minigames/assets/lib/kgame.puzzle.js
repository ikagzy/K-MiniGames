/* kgame.puzzle.js: 2 boyutlu piksel bulmaca kiti (puzzle), üç modla. Model yalnızca bir özet yazar:
   K.kit.run({ kit:'puzzle', title:'Şeker Bulmacası', mode:'match', theme:'candy', difficulty:3, size:'medium', goal:0, music:'puzzle', world:{seed:4}, features:['hint'] })
   Modlar: blocks (düşen bloklar: dönder, sıra doldur, çizgi sil), match (üçlü eşleştirme: yan yana iki taşı değiştir, 3+ aynı taş dizisi patlar, zincirleme), memory (hafıza kartları: iki kart aç, eşleşenler kalır).
   Resim küçük (320x200 piksel) tuvalde keskin çizilip tam sayı katıyla büyütülür, bulanıklık yok; bloklar ve taşlar piksel piksel çizilir.
   Kontroller: blocks: oklar/WASD, yukarı ya da X döndür, Z ters döndür, Boşluk hızlı düşür, C tutma (hold özelliği); match: oklar imleci kaydırır, Boşluk/Enter seç ve yer değiştir ya da fare ile iki taşa tıkla;
   memory: oklar ve Boşluk/Enter ya da fare; hepsinde R yeniden, Esc menü. Özellikler: ghost (blocks: düşeceği yeri göster), hold (blocks: parçayı sakla), hint (match: ipucu).
   Önce kgame.js, kgame.kits.js ve kgame.audio2.js yüklenmiş olmalı. Her şey kodla çizilir (görsel dosya yok). */
(function (root) {
  var K = root.K;
  var VW = 320, VH = 200;
  var MODES = ["blocks", "match", "memory"];
  var THEMES = {
    candy: { bg: [[60, 30, 80], [44, 20, 62]], board: [28, 14, 40], line: [120, 70, 150], pal: [[236, 64, 90], [255, 168, 40], [250, 226, 60], [90, 210, 90], [64, 180, 240], [160, 90, 230], [250, 120, 200]] },
    neon: { bg: [[10, 14, 34], [6, 8, 24]], board: [4, 6, 16], line: [40, 220, 220], pal: [[255, 50, 120], [255, 160, 30], [240, 240, 60], [60, 255, 140], [40, 200, 255], [160, 100, 255], [255, 100, 255]] },
    forest: { bg: [[34, 76, 52], [28, 64, 44]], board: [16, 38, 28], line: [120, 170, 110], pal: [[210, 70, 60], [230, 150, 50], [230, 210, 80], [100, 190, 80], [80, 170, 210], [150, 110, 200], [210, 130, 160]] },
    night: { bg: [[24, 28, 54], [18, 20, 42]], board: [10, 12, 26], line: [90, 100, 160], pal: [[220, 70, 100], [240, 150, 60], [230, 220, 90], [80, 200, 130], [80, 150, 230], [150, 110, 230], [220, 120, 200]] }
  };
  var SIZES = { small: 0, medium: 1, large: 2 };
  var FEATURES = ["ghost", "hold", "hint"];

  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shade(c, k) { return [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  // ---- blocks: the seven pieces, turned about their centre ----
  var PIECES = { I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]] };
  var NAMES = ["I", "O", "T", "S", "Z", "J", "L"];
  function cellsOf(name, rot) {
    var cells = PIECES[name].map(function (c) { return [c[0], c[1]]; });
    if (name === "O") return cells;
    for (var r = 0; r < ((rot % 4) + 4) % 4; r++) cells = cells.map(function (c) { return name === "I" ? [3 - c[1], c[0]] : [2 - c[1], c[0]]; });
    return cells;
  }

  // ---- pixel art made by code: the blocks and the gems ----
  var sprites = {};
  function blockSprite(col, size) {
    var key = "b" + col.join(",") + size; if (sprites[key]) return sprites[key];
    var cv = document.createElement("canvas"); cv.width = cv.height = size; var c = cv.getContext("2d"), im = c.createImageData(size, size);
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var k = 1; if (x === 0 || y === 0) k = 1.35; else if (x === size - 1 || y === size - 1) k = 0.62; else if (x === 1 && y === 1) k = 1.5; else if ((x + y) % 7 === 0) k = 1.1;
      var o = (y * size + x) * 4, cc = shade(col, k); im.data[o] = cc[0]; im.data[o + 1] = cc[1]; im.data[o + 2] = cc[2]; im.data[o + 3] = 255;
    }
    c.putImageData(im, 0, 0); return sprites[key] = cv;
  }
  var SHAPES = ["circle", "diamond", "square", "triangle", "plus", "heart", "ring"];
  function inside(shape, x, y) {
    var dx = x - 5.5, dy = y - 5.5;
    if (shape === "circle") return dx * dx + dy * dy <= 30;
    if (shape === "ring") return dx * dx + dy * dy <= 30 && dx * dx + dy * dy >= 9;
    if (shape === "diamond") return Math.abs(dx) + Math.abs(dy) <= 6;
    if (shape === "square") return Math.abs(dx) <= 5 && Math.abs(dy) <= 5 && !(Math.abs(dx) > 4 && Math.abs(dy) > 4);
    if (shape === "triangle") return y >= 1 && y <= 10 && Math.abs(dx) <= (y - 0.5) * 0.6;
    if (shape === "plus") return (Math.abs(dx) <= 1.9 && Math.abs(dy) <= 5.5) || (Math.abs(dy) <= 1.9 && Math.abs(dx) <= 5.5);
    var hx = dx / 5.2, hy = -(dy - 0.6) / 5.2; var a = hx * hx + hy * hy - 1; return a * a * a - hx * hx * hy * hy * hy <= 0;
  }
  function gemSprite(shape, col) {
    var key = "g" + shape + col.join(","); if (sprites[key]) return sprites[key];
    var cv = document.createElement("canvas"); cv.width = cv.height = 12; var c = cv.getContext("2d"), im = c.createImageData(12, 12);
    for (var y = 0; y < 12; y++) for (var x = 0; x < 12; x++) {
      if (!inside(shape, x, y)) continue;
      var edge = !inside(shape, x - 1, y) || !inside(shape, x + 1, y) || !inside(shape, x, y - 1) || !inside(shape, x, y + 1), k = 1;
      if (edge) k = 0.6; else if (x + y < 8) k = 1.3; else if (x + y > 14) k = 0.82; if (x === 3 && y === 3 && !edge) k = 1.7;
      var o = (y * 12 + x) * 4, cc = shade(col, k); im.data[o] = cc[0]; im.data[o + 1] = cc[1]; im.data[o + 2] = cc[2]; im.data[o + 3] = 255;
    }
    c.putImageData(im, 0, 0); return sprites[key] = cv;
  }

  K.kit.define("puzzle", {
    defaults: { title: "Bulmaca", mode: "blocks", theme: "candy", difficulty: 3, size: "medium", goal: 0, music: "puzzle", world: { seed: 1 }, width: 640, height: 400, features: [] },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (MODES.indexOf(spec.mode) < 0) errors.push("bilinmeyen mod: " + spec.mode + " (var olanlar: " + MODES.join(", ") + ")");
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (SIZES[spec.size] === undefined) errors.push("bilinmeyen boyut: " + spec.size + " (small, medium, large)");
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      if (typeof spec.goal !== "number" || spec.goal < 0 || spec.goal > 50000) errors.push("goal 0-50000 olmalı");
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var seed = (spec.world && spec.world.seed) || 1, theme = THEMES[spec.theme], d = spec.difficulty, tune = spec.music, feats = spec.features || [], sz = SIZES[spec.size];
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      var state = { g: g, spec: spec, score: 0, over: false, won: false, message: "", messageT: 0, time: 0, mode: spec.mode, game: null, hasGhost: feats.indexOf("ghost") >= 0, hasHold: feats.indexOf("hold") >= 0, hasHint: feats.indexOf("hint") >= 0 };
      state.menu = { open: K.puzzle.menuAtStart !== false, kind: "main", index: 0, started: false }; state.paused = state.menu.open; state.musicOn = true;
      state.say = function (t, s) { state.message = t; state.messageT = s || 1.6; };
      var rnd = rng(seed * 53 + 9), tapped = {}, held = {};
      var tap = function (k) { var dd = K.key(k), hit = dd && !tapped[k]; tapped[k] = dd; return hit; };
      var rep = function (keys, dt, first, again) {   // a key that repeats while held
        var on = keys.some(function (k) { return K.key(k); }), id = keys.join("|");
        if (!on) { held[id] = -1; return false; }
        if (held[id] === undefined || held[id] < 0) { held[id] = first; return true; }
        held[id] -= dt; if (held[id] <= 0) { held[id] = again; return true; } return false;
      };

      // ================= blocks =================
      function blocksGame() {
        var W = 10, H = 20, B = { board: [], piece: null, next: [], bag: [], hold: null, canHold: true, fall: 0, lines: 0, level: 0, clearT: 0, clearRows: [], lock: 0 };
        var base = [0.9, 0.7, 0.52, 0.4, 0.3][d - 1];
        for (var y = 0; y < H; y++) B.board.push(new Array(W).fill(0));
        function draw7() { if (!B.bag.length) { B.bag = NAMES.slice(); for (var i = B.bag.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = B.bag[i]; B.bag[i] = B.bag[j]; B.bag[j] = t; } } return B.bag.pop(); }
        function fits(name, rot, px, py) { var cs = cellsOf(name, rot); for (var i = 0; i < 4; i++) { var x = px + cs[i][0], y = py + cs[i][1]; if (x < 0 || x >= W || y >= H || (y >= 0 && B.board[y][x])) return false; } return true; }
        function spawn(name) { B.piece = { t: name || B.next.shift(), r: 0, x: 3, y: -1 }; while (B.next.length < 3) B.next.push(draw7()); B.canHold = true; B.fall = 0; B.lock = 0; if (!fits(B.piece.t, 0, B.piece.x, B.piece.y)) { B.piece.y = -2; if (!fits(B.piece.t, 0, B.piece.x, B.piece.y)) finish(false); } }
        function finish(win) { state.over = true; state.won = win; K.music.stop(); K.sfx(win ? "coin" : "hit"); }
        B.restart = function () { for (var y = 0; y < H; y++) B.board[y].fill(0); B.next = []; B.bag = []; B.hold = null; B.lines = 0; B.level = 0; B.clearRows = []; state.score = 0; spawn(draw7()); };
        function move(dx, dy) { var p = B.piece; if (fits(p.t, p.r, p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; if (dx) B.lock = 0; return true; } return false; }
        function turn(dir) { var p = B.piece, r = p.r + dir, kicks = [0, -1, 1, -2, 2]; for (var i = 0; i < kicks.length; i++) if (fits(p.t, r, p.x + kicks[i], p.y)) { p.r = r; p.x += kicks[i]; B.lock = 0; K.sfx("click"); return true; } return false; }
        function lockPiece() {
          var p = B.piece, cs = cellsOf(p.t, p.r), idx = NAMES.indexOf(p.t) + 1;
          for (var i = 0; i < 4; i++) { var y = p.y + cs[i][1], x = p.x + cs[i][0]; if (y < 0) { finish(false); return; } B.board[y][x] = idx; }
          var rows = []; for (var yy = 0; yy < H; yy++) if (B.board[yy].every(function (v) { return v > 0; })) rows.push(yy);
          if (rows.length) { B.clearRows = rows; B.clearT = 0.28; K.sfx("coin"); } else { spawn(); K.sfx("click"); }
          B.piece = rows.length ? null : B.piece;
        }
        function finishClear() {
          var rows = B.clearRows; rows.forEach(function (r) { B.board.splice(r, 1); B.board.unshift(new Array(W).fill(0)); });
          B.lines += rows.length; state.score += [0, 100, 300, 500, 800][rows.length] * (B.level + 1); B.level = Math.floor(B.lines / 10); B.clearRows = [];
          if (spec.goal > 0 && state.score >= spec.goal) { finish(true); return; }
          spawn();
        }
        function hardDrop() { var p = B.piece, n = 0; while (move(0, 1)) n++; state.score += n * 2; lockPiece(); }
        B.step = function (dt) {
          if (B.clearRows.length) { B.clearT -= dt; if (B.clearT <= 0) finishClear(); return; }
          var p = B.piece; if (!p) return;
          if (rep(["ArrowLeft", "a"], dt, 0.17, 0.05)) move(-1, 0);
          if (rep(["ArrowRight", "d"], dt, 0.17, 0.05)) move(1, 0);
          if (tap("ArrowUp") || tap("x") || tap("w")) turn(1);
          if (tap("z")) turn(-1);
          if (tap(" ")) { hardDrop(); return; }
          if (state.hasHold && (tap("c") || tap("Shift")) && B.canHold) { var cur = B.piece.t; if (B.hold) { spawn(B.hold); } else spawn(); B.hold = cur; B.canHold = false; return; }
          var interval = Math.max(0.05, base * Math.pow(0.86, B.level)), soft = K.key("ArrowDown") || K.key("s");
          B.fall += dt * (soft ? 14 : 1) / interval;
          while (B.fall >= 1) { B.fall -= 1; if (!move(0, 1)) { B.lock += 1; if (B.lock >= (soft ? 1 : 2)) { lockPiece(); return; } } else { B.lock = 0; if (soft) state.score += 1; } }
        };
        B.draw = function (c) {
          var cell = 8, ox = 120, oy = 20;
          c.fillStyle = rgb(theme.board); c.fillRect(ox - 2, oy - 2, W * cell + 4, H * cell + 4); c.fillStyle = rgb(theme.line); c.fillRect(ox - 3, oy - 3, W * cell + 6, 1); c.fillRect(ox - 3, oy + H * cell + 2, W * cell + 6, 1); c.fillRect(ox - 3, oy - 3, 1, H * cell + 6); c.fillRect(ox + W * cell + 2, oy - 3, 1, H * cell + 6);
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { c.fillStyle = (x + y) % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.0)"; c.fillRect(ox + x * cell, oy + y * cell, cell, cell); if (B.board[y][x]) c.drawImage(blockSprite(theme.pal[(B.board[y][x] - 1) % theme.pal.length], cell), ox + x * cell, oy + y * cell); }
          B.clearRows.forEach(function (r) { c.fillStyle = Math.floor(B.clearT * 24) % 2 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)"; c.fillRect(ox, oy + r * cell, W * cell, cell); });
          var p = B.piece; if (p) {
            var cs = cellsOf(p.t, p.r), col = theme.pal[NAMES.indexOf(p.t) % theme.pal.length], i;
            if (state.hasGhost) { var gy = p.y; while (fits(p.t, p.r, p.x, gy + 1)) gy++; for (i = 0; i < 4; i++) { var gyy = gy + cs[i][1]; if (gyy >= 0) { c.fillStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + ",0.35)"; c.fillRect(ox + (p.x + cs[i][0]) * cell, oy + gyy * cell, cell, cell); } } }
            for (i = 0; i < 4; i++) { var yy = p.y + cs[i][1]; if (yy >= 0) c.drawImage(blockSprite(col, cell), ox + (p.x + cs[i][0]) * cell, oy + yy * cell); }
          }
          var mini = function (name, px, py) { var cs2 = cellsOf(name, 0), col2 = theme.pal[NAMES.indexOf(name) % theme.pal.length]; for (var k = 0; k < 4; k++) c.drawImage(blockSprite(col2, 6), px + cs2[k][0] * 6, py + cs2[k][1] * 6); };
          c.fillStyle = rgb(theme.board); c.fillRect(214, 20, 40, 78); c.fillStyle = rgb(theme.line); c.fillRect(214, 20, 40, 1);
          B.next.slice(0, 3).forEach(function (n, i) { mini(n, 220, 28 + i * 22); });
          if (state.hasHold) { c.fillStyle = rgb(theme.board); c.fillRect(66, 20, 40, 36); c.fillStyle = rgb(theme.line); c.fillRect(66, 20, 40, 1); if (B.hold) mini(B.hold, 72, 28); }
        };
        B.hud = function () { return ["SKOR " + state.score, "SATIR " + B.lines, "SEVİYE " + (B.level + 1)].concat(spec.goal > 0 ? ["HEDEF " + spec.goal] : []); };
        B.click = function () { };
        B.restart();
        return B;
      }

      // ================= match =================
      function matchGame() {
        var N = [6, 8, 9][sz], KINDS = [4, 5, 5, 6, 7][d - 1], M = { grid: [], off: [], phase: "idle", t: 0, cx: 0, cy: 0, sel: null, swapA: null, swapB: null, combo: 0, idle: 0, hint: null, moves: 0, goal: spec.goal > 0 ? spec.goal : Math.round(N * N * 12 * (0.8 + 0.15 * d)), flash: [] };
        var cs = Math.floor(160 / N);
        function at(x, y) { return x < 0 || y < 0 || x >= N || y >= N ? -1 : M.grid[y][x]; }
        function findMatches() {
          var out = {}, x, y, k, len;
          for (y = 0; y < N; y++) for (x = 0; x < N; x++) { var v = at(x, y); if (v < 0) continue; len = 1; while (at(x + len, y) === v) len++; if (len >= 3) for (k = 0; k < len; k++) out[(x + k) + "," + y] = [x + k, y]; len = 1; while (at(x, y + len) === v) len++; if (len >= 3) for (k = 0; k < len; k++) out[x + "," + (y + k)] = [x, y + k]; }
          return Object.keys(out).map(function (key) { return out[key]; });
        }
        function validMove() {
          for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) for (var dir = 0; dir < 2; dir++) {
            var nx = x + (dir ? 0 : 1), ny = y + (dir ? 1 : 0); if (nx >= N || ny >= N) continue;
            swapCells(x, y, nx, ny); var ok = findMatches().length > 0; swapCells(x, y, nx, ny); if (ok) return [x, y, nx, ny];
          }
          return null;
        }
        function swapCells(x1, y1, x2, y2) { var t = M.grid[y1][x1]; M.grid[y1][x1] = M.grid[y2][x2]; M.grid[y2][x2] = t; }
        function fill() { for (var y = 0; y < N; y++) { M.grid[y] = []; M.off[y] = []; for (var x = 0; x < N; x++) { var v; do { v = Math.floor(rnd() * KINDS); } while ((x >= 2 && M.grid[y][x - 1] === v && M.grid[y][x - 2] === v) || (y >= 2 && M.grid[y - 1][x] === v && M.grid[y - 2][x] === v)); M.grid[y][x] = v; M.off[y][x] = 0; } } if (!validMove()) fill(); }
        M.restart = function () { fill(); M.phase = "idle"; M.sel = null; M.combo = 0; M.idle = 0; M.hint = null; M.cx = M.cy = 0; state.score = 0; M.moves = [30, 26, 22, 18, 15][d - 1] + (sz - 1) * 4; };
        function tryMove(x1, y1, x2, y2) {
          if (M.phase !== "idle" || Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) return false;
          M.swapA = [x1, y1]; M.swapB = [x2, y2]; M.phase = "swap"; M.t = 0.14; M.hint = null; M.idle = 0; K.sfx("click"); return true;
        }
        function clearMatches() {
          var ms = findMatches(); if (!ms.length) { M.combo = 0; M.phase = "idle"; if (state.score >= M.goal) { state.over = true; state.won = true; K.music.stop(); K.sfx("coin"); } else if (M.moves <= 0) { state.over = true; state.won = false; K.music.stop(); K.sfx("hit"); } else if (!validMove()) { state.say("Hamle kalmadı, taşlar karıştı"); fill(); } return; }
          M.combo++; state.score += ms.length * 10 * M.combo; M.flash = ms; M.phase = "clear"; M.t = 0.22; K.sfx(M.combo > 1 ? "coin" : "click");
        }
        function dropAndFill() {
          for (var x = 0; x < N; x++) { var write = N - 1, y; for (y = N - 1; y >= 0; y--) if (M.grid[y][x] >= 0) { if (write !== y) { M.grid[write][x] = M.grid[y][x]; M.off[write][x] = -(write - y) * cs; M.grid[y][x] = -1; } write--; } for (y = write; y >= 0; y--) { M.grid[y][x] = Math.floor(rnd() * KINDS); M.off[y][x] = -(write + 1) * cs; } }
          M.phase = "fall";
        }
        M.step = function (dt) {
          if (M.phase === "swap") { M.t -= dt; if (M.t <= 0) { var a = M.swapA, b = M.swapB; swapCells(a[0], a[1], b[0], b[1]); if (findMatches().length) { M.moves--; M.sel = null; clearMatches(); } else { M.phase = "back"; M.t = 0.14; } } return; }
          if (M.phase === "back") { M.t -= dt; if (M.t <= 0) { var a2 = M.swapA, b2 = M.swapB; swapCells(a2[0], a2[1], b2[0], b2[1]); M.phase = "idle"; M.sel = null; K.sfx("hit"); } return; }
          if (M.phase === "clear") { M.t -= dt; if (M.t <= 0) { M.flash.forEach(function (p) { M.grid[p[1]][p[0]] = -1; }); M.flash = []; dropAndFill(); } return; }
          if (M.phase === "fall") { var moving = false; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (M.off[y][x] < 0) { M.off[y][x] = Math.min(0, M.off[y][x] + 220 * dt); if (M.off[y][x] < 0) moving = true; } if (!moving) clearMatches(); return; }
          if (rep(["ArrowLeft", "a"], dt, 0.2, 0.09)) M.cx = Math.max(0, M.cx - 1);
          if (rep(["ArrowRight", "d"], dt, 0.2, 0.09)) M.cx = Math.min(N - 1, M.cx + 1);
          if (rep(["ArrowUp", "w"], dt, 0.2, 0.09)) M.cy = Math.max(0, M.cy - 1);
          if (rep(["ArrowDown", "s"], dt, 0.2, 0.09)) M.cy = Math.min(N - 1, M.cy + 1);
          if (tap(" ") || tap("Enter")) pick(M.cx, M.cy);
          M.idle += dt; if (state.hasHint && M.idle > 6 && !M.hint) M.hint = validMove();
        };
        function pick(x, y) {
          if (M.phase !== "idle") return;
          if (!M.sel) { M.sel = [x, y]; K.sfx("click"); return; }
          if (M.sel[0] === x && M.sel[1] === y) { M.sel = null; return; }
          if (!tryMove(M.sel[0], M.sel[1], x, y)) { M.sel = [x, y]; K.sfx("click"); }
        }
        M.click = function (sx, sy) { var gx = Math.floor((sx - (VW / 2 - N * cs / 2)) / cs), gy = Math.floor((sy - 20) / cs); if (gx >= 0 && gy >= 0 && gx < N && gy < N) { M.cx = gx; M.cy = gy; pick(gx, gy); } };
        M.draw = function (c) {
          var ox = Math.round(VW / 2 - N * cs / 2), oy = 20;
          c.fillStyle = rgb(theme.board); c.fillRect(ox - 3, oy - 3, N * cs + 6, N * cs + 6); c.fillStyle = rgb(theme.line); c.fillRect(ox - 4, oy - 4, N * cs + 8, 1); c.fillRect(ox - 4, oy + N * cs + 3, N * cs + 8, 1); c.fillRect(ox - 4, oy - 4, 1, N * cs + 8); c.fillRect(ox + N * cs + 3, oy - 4, 1, N * cs + 8);
          for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
            c.fillStyle = (x + y) % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)"; c.fillRect(ox + x * cs, oy + y * cs, cs, cs);
            var v = M.grid[y][x]; if (v < 0) continue; var px = ox + x * cs, py = oy + y * cs + Math.round(M.off[y][x]);
            if (M.phase === "swap" || M.phase === "back") { var prog = 1 - clamp(M.t / 0.14, 0, 1), sa = M.swapA, sb = M.swapB; if (x === sa[0] && y === sa[1]) { px += (sb[0] - sa[0]) * cs * prog; py += (sb[1] - sa[1]) * cs * prog; } else if (x === sb[0] && y === sb[1]) { px += (sa[0] - sb[0]) * cs * prog; py += (sa[1] - sb[1]) * cs * prog; } }
            var flashing = M.flash.some(function (p) { return p[0] === x && p[1] === y; });
            if (flashing && Math.floor(M.t * 30) % 2) { c.fillStyle = "#fff"; c.fillRect(px + 1, py + 1, cs - 2, cs - 2); } else c.drawImage(gemSprite(SHAPES[v % SHAPES.length], theme.pal[v % theme.pal.length]), Math.round(px + (cs - 12) / 2), Math.round(py + (cs - 12) / 2));
          }
          if (M.hint) { c.fillStyle = "rgba(255,255,255,0.45)"; [[M.hint[0], M.hint[1]], [M.hint[2], M.hint[3]]].forEach(function (p) { c.fillRect(ox + p[0] * cs, oy + p[1] * cs, cs, 2); c.fillRect(ox + p[0] * cs, oy + p[1] * cs + cs - 2, cs, 2); }); }
          if (M.sel) { c.fillStyle = "#fff"; var sx = ox + M.sel[0] * cs, sy = oy + M.sel[1] * cs; c.fillRect(sx, sy, cs, 1); c.fillRect(sx, sy + cs - 1, cs, 1); c.fillRect(sx, sy, 1, cs); c.fillRect(sx + cs - 1, sy, 1, cs); }
          c.fillStyle = "#ffd54f"; var kx = ox + M.cx * cs, ky = oy + M.cy * cs; c.fillRect(kx, ky, 3, 1); c.fillRect(kx, ky, 1, 3); c.fillRect(kx + cs - 3, ky, 3, 1); c.fillRect(kx + cs - 1, ky, 1, 3); c.fillRect(kx, ky + cs - 1, 3, 1); c.fillRect(kx, ky + cs - 3, 1, 3); c.fillRect(kx + cs - 3, ky + cs - 1, 3, 1); c.fillRect(kx + cs - 1, ky + cs - 3, 1, 3);
        };
        M.hud = function () { return ["SKOR " + state.score + " / " + M.goal, "HAMLE " + M.moves].concat(M.combo > 1 ? ["ZİNCİR x" + M.combo] : []); };
        M.restart();
        return M;
      }

      // ================= memory =================
      function memoryGame() {
        var cols = [4, 4, 6][sz], rows = [3, 4, 4][sz], pairs = cols * rows / 2, cw = Math.min(34, Math.floor(280 / cols)), ch = Math.min(30, Math.floor(160 / rows)), Mm = { cards: [], open: [], moves: 0, wait: 0, cx: 0, cy: 0, peek: 0, start: 0 };
        var limit = spec.goal > 0 ? spec.goal : 0;
        Mm.restart = function () {
          var ids = []; for (var i = 0; i < pairs; i++) ids.push(i, i);
          for (var j = ids.length - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)), t = ids[j]; ids[j] = ids[k]; ids[k] = t; }
          Mm.cards = ids.map(function (id) { return { id: id, up: false, done: false }; }); Mm.open = []; Mm.moves = 0; Mm.wait = 0; Mm.cx = Mm.cy = 0; Mm.peek = d <= 2 ? 2.4 - 0.4 * d : 0; state.score = 0;
        };
        function flip(i) {
          var c = Mm.cards[i]; if (!c || c.up || c.done || Mm.wait > 0 || Mm.peek > 0 || Mm.open.length >= 2) return;
          c.up = true; Mm.open.push(i); K.sfx("click");
          if (Mm.open.length === 2) {
            Mm.moves++; var a = Mm.cards[Mm.open[0]], b = Mm.cards[Mm.open[1]];
            if (a.id === b.id) { a.done = b.done = true; Mm.open = []; state.score += 100; K.sfx("coin"); if (Mm.cards.every(function (q) { return q.done; })) { state.score += Math.max(0, 300 - Mm.moves * 10); state.over = true; state.won = true; K.music.stop(); } }
            else Mm.wait = 0.8 - 0.1 * d;
            if (limit > 0 && Mm.moves >= limit && !state.over && !Mm.cards.every(function (q) { return q.done; })) Mm.limitHit = true;
          }
        }
        Mm.step = function (dt) {
          if (Mm.peek > 0) { Mm.peek -= dt; return; }
          if (Mm.wait > 0) { Mm.wait -= dt; if (Mm.wait <= 0) { Mm.open.forEach(function (i) { Mm.cards[i].up = false; }); Mm.open = []; if (Mm.limitHit) { state.over = true; state.won = false; K.music.stop(); K.sfx("hit"); } } return; }
          if (rep(["ArrowLeft", "a"], dt, 0.2, 0.09)) Mm.cx = Math.max(0, Mm.cx - 1);
          if (rep(["ArrowRight", "d"], dt, 0.2, 0.09)) Mm.cx = Math.min(cols - 1, Mm.cx + 1);
          if (rep(["ArrowUp", "w"], dt, 0.2, 0.09)) Mm.cy = Math.max(0, Mm.cy - 1);
          if (rep(["ArrowDown", "s"], dt, 0.2, 0.09)) Mm.cy = Math.min(rows - 1, Mm.cy + 1);
          if (tap(" ") || tap("Enter")) flip(Mm.cy * cols + Mm.cx);
        };
        Mm.click = function (sx, sy) { var ox = Math.round(VW / 2 - cols * cw / 2), gx = Math.floor((sx - ox) / cw), gy = Math.floor((sy - 20) / ch); if (gx >= 0 && gy >= 0 && gx < cols && gy < rows) { Mm.cx = gx; Mm.cy = gy; flip(gy * cols + gx); } };
        Mm.draw = function (c) {
          var ox = Math.round(VW / 2 - cols * cw / 2), oy = 20;
          for (var i = 0; i < Mm.cards.length; i++) {
            var card = Mm.cards[i], x = ox + (i % cols) * cw, y = oy + Math.floor(i / cols) * ch, show = card.up || card.done || Mm.peek > 0;
            c.fillStyle = show ? (card.done ? "rgba(255,255,255,0.18)" : "rgb(244,240,226)") : rgb(theme.line); c.fillRect(x + 1, y + 1, cw - 2, ch - 2);
            c.fillStyle = show ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.35)"; c.fillRect(x + 1, y + ch - 3, cw - 2, 2); c.fillRect(x + cw - 3, y + 1, 2, ch - 2); c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(x + 1, y + 1, cw - 2, 1);
            if (show) c.drawImage(gemSprite(SHAPES[card.id % SHAPES.length], theme.pal[Math.floor(card.id / SHAPES.length + card.id) % theme.pal.length]), Math.round(x + (cw - 12) / 2), Math.round(y + (ch - 12) / 2));
            else { c.fillStyle = "rgba(255,255,255,0.25)"; c.fillRect(x + 6, y + 6, cw - 12, 1); c.fillRect(x + 6, y + ch - 7, cw - 12, 1); c.fillRect(x + 6, y + 6, 1, ch - 12); c.fillRect(x + cw - 7, y + 6, 1, ch - 12); c.fillRect(x + Math.floor(cw / 2) - 1, y + Math.floor(ch / 2) - 1, 3, 3); }
          }
          c.fillStyle = "#ffd54f"; var kx = ox + Mm.cx * cw, ky = oy + Mm.cy * ch; c.fillRect(kx, ky, cw, 1); c.fillRect(kx, ky + ch - 1, cw, 1); c.fillRect(kx, ky, 1, ch); c.fillRect(kx + cw - 1, ky, 1, ch);
        };
        Mm.hud = function () { return ["SKOR " + state.score, "HAMLE " + Mm.moves + (limit ? " / " + limit : ""), "ÇİFT " + Mm.cards.filter(function (q) { return q.done; }).length / 2 + " / " + pairs]; };
        Mm.restart();
        return Mm;
      }

      state.reset = function () {
        state.over = false; state.won = false; state.score = 0; state.time = 0; state.messageT = 0;
        state.game = spec.mode === "match" ? matchGame() : spec.mode === "memory" ? memoryGame() : blocksGame();
        if (g.current !== "play") g.go("play");
      };
      state.start = function () { state.reset(); if (tune && state.musicOn) K.music.play(tune); };
      state.step = function (dt) {
        if (!state.game || state.paused) return;
        state.messageT = Math.max(0, state.messageT - dt);
        if (state.over) return;
        state.time += dt; state.game.step(dt);
      };

      // ---- the menus ----
      var CONTROLS = { blocks: ["Oklar ya da A D  sağa sola      Aşağı  hızlı indir      Yukarı ya da X  döndür      Z  ters döndür", "Boşluk  hemen düşür      C ya da Shift  parçayı sakla (hold)      R  yeniden      Esc  menü", "Satırı doldur, satır silinsin. Parçalar tepeye ulaşırsa oyun biter."],
        match: ["Oklar  imleci kaydır      Boşluk ya da Enter  seç, ikinci taşa gelince yer değiştir      ya da fareyle iki taşa tıkla", "Yan yana 3 ya da daha fazla aynı taş patlar, zincirleme puan artar.      R  yeniden      Esc  menü", "Hamlen bitmeden hedef puana ulaş."],
        memory: ["Oklar  imleci kaydır      Boşluk ya da Enter ya da fare  kartı aç", "İki aynı kartı bul, eşleşenler açık kalır.      R  yeniden      Esc  menü", "Az hamlede bitirirsen daha çok puan."] };
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.paused = true; };
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
      function drawBackground(c) {
        for (var y = 0; y < VH; y += 8) for (var x = 0; x < VW; x += 8) { c.fillStyle = rgb(theme.bg[((x + y) >> 3) % 2]); c.fillRect(x, y, 8, 8); }
        c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(0, 0, VW, 14); c.fillRect(0, VH - 8, VW, 8);
      }
      function drawHud(c) {
        var W = g.width, H = g.height; c.font = "bold 14px sans-serif"; c.textAlign = "left";
        var lines = state.game.hud(); lines.forEach(function (t, i) { c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, 8 + i * 22, 118, 20); c.fillStyle = i === 0 ? "#ffd54f" : "#fff"; c.fillText(t, 14, 23 + i * 22); });
        c.fillStyle = "rgba(255,255,255,0.7)"; c.font = "11px sans-serif"; c.textAlign = "right"; c.fillText(spec.title || "", W - 10, H - 8); c.textAlign = "left";
        if (state.messageT > 0) { c.textAlign = "center"; c.fillStyle = "#ffe082"; c.font = "bold 20px sans-serif"; c.fillText(state.message, W / 2, 24); c.textAlign = "left"; }
        if (state.over) {
          c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(W / 2 - 150, H / 2 - 80, 300, 160); c.textAlign = "center"; c.fillStyle = state.won ? "#ffd54f" : "#fff"; c.font = "bold 28px sans-serif";
          c.fillText(state.won ? "KAZANDIN!" : "OYUN BİTTİ", W / 2, H / 2 - 34); c.font = "bold 22px sans-serif"; c.fillText("Skor " + state.score, W / 2, H / 2 + 8); c.font = "13px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("R: yeniden oyna", W / 2, H / 2 + 52); c.textAlign = "left";
        }
      }
      function drawMenu(c) {
        var m = state.menu, W = g.width, H = g.height; c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, W, H); c.textAlign = "center";
        c.fillStyle = "#fff"; c.font = "bold 34px sans-serif"; c.fillText(m.kind === "main" ? (spec.title || "Bulmaca") : m.kind === "controls" ? "Kontroller" : "Duraklatıldı", W / 2, 70);
        if (m.kind === "controls") { c.font = "13px sans-serif"; c.fillStyle = "#e0e0e0"; CONTROLS[spec.mode].forEach(function (t, i) { c.fillText(t, W / 2, 140 + i * 34); }); c.fillStyle = "#ffd54f"; c.fillText("Esc ya da tık: geri", W / 2, H - 40); c.textAlign = "left"; return; }
        var items = state.menuItems();
        items.forEach(function (it, i) { var y = rowY(items.length) + i * 44 - 4, on = i === m.index; c.fillStyle = on ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.08)"; c.fillRect(W / 2 - 150, y, 300, 38); c.strokeStyle = on ? "#ffd54f" : "rgba(255,255,255,0.2)"; c.strokeRect(W / 2 - 150, y, 300, 38); c.fillStyle = on ? "#ffd54f" : "#fff"; c.font = "bold 17px sans-serif"; c.fillText(it.label, W / 2, y + 25); });
        c.font = "12px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla", W / 2, H - 30); c.textAlign = "left";
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined" || g.current !== "play" || !state.game) return;
        if (!small) { small = document.createElement("canvas"); small.width = VW; small.height = VH; sc = small.getContext("2d"); }
        sc.imageSmoothingEnabled = false; drawBackground(sc); state.game.draw(sc); c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        if (!(state.menu.open && state.menu.kind === "main")) drawHud(c); if (state.menu.open) drawMenu(c);
      } }];
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) {
        g.canvas.addEventListener("mousedown", function (e) {
          if (e.button !== 0) return; if (state.menu.open) { state.menuClick(); return; }
          if (state.game && !state.over && !state.paused) state.game.click(K.mouse.x * VW / g.width, K.mouse.y * VH / g.height);
        });
      }
      g.scene("play", { update: function (game, dt) {
        if (state.menu.open) { state.menuUpdate(); return; }
        if (tap("Escape")) { state.openMenu("pause"); return; }
        if (tap("r")) { state.reset(); if (tune && state.musicOn) K.music.play(tune); return; }
        state.step(dt);
      } });
      state.expose = { g: g, spec: spec, state: state, get p() { return state.game; } };
      return state;
    }
  });

  K.puzzle = { modes: MODES, themes: Object.keys(THEMES), sizes: Object.keys(SIZES), features: FEATURES, pieces: PIECES, cellsOf: cellsOf, menuAtStart: true };
  K.feature.define("ghost", { kits: ["puzzle"], options: {}, apply: function (s) { s.hasGhost = true; } });
  K.feature.define("hold", { kits: ["puzzle"], options: {}, apply: function (s) { s.hasHold = true; } });
  K.feature.define("hint", { kits: ["puzzle"], options: {}, apply: function (s) { s.hasHint = true; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
