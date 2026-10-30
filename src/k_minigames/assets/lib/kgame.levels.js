/* kgame.levels.js: ASCII seviyeler. K.levels.parse(satirlar) bir seviye nesnesi verir (hücreler, başlangıç, hedef, katı harita);
   K.levels.validate(seviye, {jump, gap}) seviyenin bitirilebilir olup olmadığını söyler (platform oyunları); K.levels.set([...])
   birden çok seviyeyi sırayla verir. Varsayılan harfler: # zemin, B tuğla, ? soru bloğu, T boru, o altın, E düşman, ^ uçan
   düşman, S diken, M mantar, * yıldız, P başlangıç, F bayrak. Önce kgame.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var L = K.levels = {};

  L.legend = { "#": "ground", B: "brick", "?": "qblock", T: "pipe", o: "coin", E: "walker", "^": "flyer", S: "spike", M: "mushroom",
               "*": "star", P: "start", F: "flag" };
  var SOLID_KINDS = { ground: true, brick: true, qblock: true, pipe: true };

  L.parse = function (rows, legend, tile) {
    legend = legend || L.legend;
    tile = tile || 32;
    var cols = 0, warnings = [];
    rows.forEach(function (r) { cols = Math.max(cols, r.length); });
    var padded = rows.map(function (r) { while (r.length < cols) r += "."; return r; });
    var cells = [], mapRows = [];
    padded.forEach(function (row, ty) {
      var mapRow = "";
      for (var tx = 0; tx < cols; tx++) {
        var ch = row.charAt(tx), kind = legend[ch];
        if (ch !== "." && ch !== " " && !kind) { warnings.push("bilinmeyen karakter '" + ch + "' (satır " + (ty + 1) + ", sütun " + (tx + 1) + ")"); kind = null; }
        if (kind) cells.push({ ch: ch, kind: kind, tx: tx, ty: ty, x: tx * tile, y: ty * tile });
        mapRow += kind && SOLID_KINDS[kind] ? "#" : ".";
      }
      mapRows.push(mapRow);
    });
    var level = {
      rows: padded, cells: cells, tile: tile, cols: cols, rowsCount: rows.length, width: cols * tile, height: rows.length * tile,
      warnings: warnings, map: K.tilemap(mapRows, { "#": "wall" }, tile)
    };
    var first = function (kind) { var c = cells.filter(function (x) { return x.kind === kind; })[0]; return c ? { x: c.x, y: c.y } : null; };
    level.start = first("start");
    level.goal = first("flag");
    level.count = function (kind) { return cells.filter(function (x) { return x.kind === kind; }).length; };
    level.of = function (kind) { return cells.filter(function (x) { return x.kind === kind; }); };
    return level;
  };

  // Can the hero get from the start to the flag? Walking is free; a jump reaches ground up to `jump` tiles higher and up
  // to `gap` tiles sideways (and any distance lower). The test is generous: it finds levels that cannot be finished.
  L.validate = function (level, o) {
    o = o || {};
    var jump = o.jump === undefined ? 4 : o.jump, gap = o.gap === undefined ? 3 : o.gap;
    if (!level.start) return { ok: false, reason: "başlangıç (P) yok" };
    if (!level.goal) return { ok: false, reason: "bayrak (F) yok" };
    var solid = function (tx, ty) { return level.map.solidAt(tx * level.tile + 1, ty * level.tile + 1); };
    var standable = function (tx, ty) { return tx >= 0 && tx < level.cols && ty >= 0 && ty < level.rowsCount && !solid(tx, ty) && ty + 1 < level.rowsCount && solid(tx, ty + 1); };
    var drop = function (tx, ty) { for (var y = ty; y < level.rowsCount; y++) if (standable(tx, y)) return y; return -1; };
    var sx = level.start.x / level.tile, sy = drop(sx, level.start.y / level.tile);
    if (sy < 0) return { ok: false, reason: "başlangıç havada: altında zemin yok" };
    var seen = {}, queue = [[sx, sy]], key = function (a, b) { return a + "," + b; };
    seen[key(sx, sy)] = true;
    var gx = level.goal.x / level.tile, gy = level.goal.y / level.tile, far = Infinity;
    while (queue.length) {
      var cur = queue.shift();
      far = Math.min(far, Math.abs(cur[0] - gx));
      if (Math.abs(cur[0] - gx) <= 1 && Math.abs(cur[1] - gy) <= 1) return { ok: true, reason: "" };
      for (var c = cur[0] - gap - 2; c <= cur[0] + gap + 2; c++) {
        for (var y = 0; y < level.rowsCount; y++) {
          if (!standable(c, y) || seen[key(c, y)]) continue;
          var dx = Math.abs(c - cur[0]), up = cur[1] - y;
          if (up > jump) continue;                  // too high to jump up to
          if (up >= 0 && dx > gap + 1) continue;    // `gap` empty tiles between two edges means a jump of gap + 1 tiles
          if (up < 0 && dx > gap + 2) continue;     // when falling a little more is allowed
          seen[key(c, y)] = true;
          queue.push([c, y]);
        }
      }
    }
    return { ok: false, reason: "bayrağa ulaşılamıyor: boşluk çok geniş ya da platform çok yüksek (en yakın nokta " + far + " karo uzakta; en fazla " + gap + " karo boşluk ve " + jump + " karo yükseklik atlanabilir)" };
  };

  L.set = function (list, legend, tile) {
    var index = 0, parsed = list.map(function (rows) { return L.parse(rows, legend, tile); });
    var at = function () { var lv = parsed[index]; lv.index = index; return lv; };
    return {
      count: parsed.length,
      current: function () { return parsed.length ? at() : null; },
      next: function () { if (index + 1 >= parsed.length) return null; index++; return at(); },
      reset: function () { index = 0; return parsed.length ? at() : null; }
    };
  };

  // ---- a level generator: the model gives numbers, not a picture (small models cannot draw a level) ----
  function rng(seed) {
    var s = (typeof seed === "number" && isFinite(seed) ? Math.floor(seed) : 1) >>> 0 || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi, fallback) {
    v = typeof v === "number" && isFinite(v) ? v : fallback;
    return Math.max(lo, Math.min(hi, v));
  }

  L.defaultLevel = [
    "....................", "....................", "......?.B?B.........", "....................", "..o...........o.o...",
    "P...E....T.......F..", "####################", "####################"
  ];

  // Options (all optional): width 24-160, height 8-14, difficulty 1-5, seed, and densities 0-5 for pits, enemies, blocks,
  // pipes, coins, flyers, spikes (spikes only from difficulty 3). The same options always give the same level, and the level
  // can always be finished: pits are at most 3 tiles, pipes at most 2 high, and there is flat ground between them.
  L.generate = function (o) {
    o = o || {};
    var w = Math.round(clamp(o.width, 24, 160, 60)), h = Math.round(clamp(o.height, 8, 14, 9));
    var diff = Math.round(clamp(o.difficulty, 1, 5, 2)), rnd = rng(o.seed);
    var dens = {};
    ["pits", "enemies", "blocks", "pipes", "coins", "flyers", "spikes"].forEach(function (k) {
      dens[k] = clamp(o[k], 0, 5, k === "flyers" || k === "spikes" ? 0 : 2);
    });
    var g = h - 3, grid = [], r, c, i;
    for (r = 0; r < h; r++) { grid.push([]); for (c = 0; c < w; c++) grid[r].push(r >= g ? "#" : "."); }
    var put = function (x, y, ch) { if (x >= 0 && x < w && y >= 0 && y < h) grid[y][x] = ch; };
    put(1, g - 1, "P");
    put(w - 3, g - 1, "F");
    var end = w - 10, x = 8;
    while (x < end) {
      var roll = rnd(), pitP = dens.pits * 0.04, pipeP = dens.pipes * 0.03, blockP = dens.blocks * 0.05;
      if (roll < pitP && x > 10 && x + 9 < end) {
        var width = 2 + (diff >= 3 && rnd() < 0.5 ? 1 : 0);
        for (c = x; c < x + width; c++) for (r = g; r < h; r++) put(c, r, ".");
        if (dens.coins > 0) for (c = x - 1; c <= x + width; c++) put(c, g - 3, "o");
        x += width + 4;
      } else if (roll < pitP + pipeP && x + 7 < end) {
        var tall = 1 + (rnd() < 0.4 ? 1 : 0);
        for (i = 0; i < tall; i++) put(x, g - 1 - i, "T");
        x += 4;
      } else if (roll < pitP + pipeP + blockP && x + 8 < end) {
        var len = 3 + Math.floor(rnd() * 3);
        for (i = 0; i < len; i++) put(x + i, g - 4, rnd() < 0.35 ? "?" : "B");
        x += len + 2;
      } else {
        var small = rnd(), e = dens.enemies * 0.07, sp = diff >= 3 ? dens.spikes * 0.04 : 0, fl = dens.flyers * 0.04;
        if (small < e) put(x, g - 1, "E");
        else if (small < e + sp) put(x, g - 1, "S");
        else if (small < e + sp + fl) put(x, g - 4, "^");
        else if (rnd() < dens.coins * 0.08) {
          var n = 3 + Math.floor(rnd() * 3);
          for (i = 0; i < n; i++) put(x + i, g - 3, "o");
          x += n;
        }
        x += 1 + Math.floor(rnd() * 2);
      }
    }
    return grid.map(function (row) { return row.join(""); });
  };

  // The level rows of a spec: custom rows if given, else one generated level per `generate` entry, else the default level.
  L.fromSpec = function (spec) {
    if (spec.levels && spec.levels.length) return spec.levels;
    if (spec.generate && spec.generate.length) return spec.generate.map(function (o) { return L.generate(o); });
    return [L.defaultLevel];
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
