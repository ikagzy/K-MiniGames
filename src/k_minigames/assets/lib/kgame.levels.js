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

  // Every level has a style (option `style` 0-4, else drawn from the seed) so levels differ in kind, not only in where things sit:
  // 0 plain, 1 stairs (up and down), 2 pits (more and wider gaps, fewer blocks), 3 gauntlet (enemies in pairs), 4 sky (blocks at several heights).
  L.STYLES = 5;

  // Options (all optional): width 24-160, height 8-14, difficulty 1-5, seed, style 0-4, and densities 0-5 for pits, enemies, blocks,
  // pipes, coins, flyers, spikes (spikes only from difficulty 3). The same options always give the same level, and the level
  // can always be finished: pits are at most 3 tiles, pipes at most 2 high, and there is flat ground between them.
  L.generate = function (o) {
    o = o || {};
    var w = Math.round(clamp(o.width, 24, 160, 60)), h = Math.round(clamp(o.height, 8, 14, 9));
    var diff = Math.round(clamp(o.difficulty, 1, 5, 2)), rnd = rng(o.seed);
    var style = o.style === undefined || o.style === null ? Math.floor(rnd() * L.STYLES) : Math.abs(Math.round(clamp(o.style, 0, L.STYLES - 1, 0)));
    var dens = {};
    ["pits", "enemies", "blocks", "pipes", "coins", "flyers", "spikes"].forEach(function (k) {
      dens[k] = clamp(o[k], 0, 5, k === "flyers" || k === "spikes" ? 0 : 2);
    });
    var g = h - 3, grid = [], r, c, i;
    for (r = 0; r < h; r++) { grid.push([]); for (c = 0; c < w; c++) grid[r].push(r >= g ? "#" : "."); }
    var put = function (x, y, ch) { if (x >= 0 && x < w && y >= 0 && y < h) grid[y][x] = ch; };
    put(1, g - 1, "P");
    put(w - 3, g - 1, "F");
    var hillDone = false;
    var hill = function () {   // a plateau (the ground 1-2 tiles higher for a stretch) or steps up and down; the way up is never more than 2 tiles
      hillDone = true;
      if (rnd() < 0.5) {
        var rise = 1 + (rnd() < 0.4 ? 1 : 0), run = 6 + Math.floor(rnd() * 5);
        for (c = x; c < x + run; c++) for (i = 1; i <= rise; i++) put(c, g - i, "#");
        if (dens.coins > 0) for (c = x + 1; c < x + run - 1; c += 2) put(c, g - rise - 2, "o");
        if (dens.enemies > 0 && rnd() < 0.6) put(x + Math.floor(run / 2), g - rise - 1, "E");
        x += run + 3;
      } else {
        var up = 2 + (rnd() < 0.5 ? 1 : 0);
        for (c = 1; c <= up; c++) for (i = 1; i <= c; i++) { put(x + c - 1, g - i, "#"); put(x + 2 * up + 1 - c, g - i, "#"); }
        for (i = 1; i <= up; i++) { put(x + up, g - i, "#"); put(x + up + 1, g - i, "#"); }
        x += 2 * up + 4;
      }
    };
    var end = w - 10, x = 8;
    while (x < end) {
      var roll = rnd(), pitP = dens.pits * 0.04 * (style === 2 ? 1.8 : 1), pipeP = dens.pipes * 0.03 * (style === 4 ? 0.4 : 1);
      var blockP = dens.blocks * 0.05 * (style === 2 ? 0.5 : style === 4 ? 1.8 : 1), stairP = style === 1 ? 0.25 : 0.01;
      if (style === 1 && !hillDone && x >= 12 && x + 14 < end) {
        hill();   // a hills level always has at least one
      } else if (roll < pitP && x > 10 && x + 9 < end) {
        var width = 2 + (diff >= 3 && rnd() < (style === 2 ? 0.8 : 0.5) ? 1 : 0);
        for (c = x; c < x + width; c++) for (r = g; r < h; r++) put(c, r, ".");
        if (dens.coins > 0) for (c = x - 1; c <= x + width; c++) put(c, g - 3, "o");
        x += width + 4;
      } else if (roll < pitP + pipeP && x + 7 < end) {
        var tall = 1 + (rnd() < 0.4 ? 1 : 0);
        for (i = 0; i < tall; i++) put(x, g - 1 - i, "T");
        x += 4;
      } else if (roll < pitP + pipeP + blockP && x + 8 < end) {
        var len = 3 + Math.floor(rnd() * 3), top = style === 4 ? g - 3 - Math.floor(rnd() * 2) : g - 4;
        for (i = 0; i < len; i++) put(x + i, top, rnd() < 0.35 ? "?" : "B");
        x += len + 2;
      } else if (roll < pitP + pipeP + blockP + stairP && x + 14 < end) {
        hill();
      } else {
        var small = rnd(), e = dens.enemies * 0.07, sp = diff >= 3 ? dens.spikes * 0.04 : 0, fl = dens.flyers * 0.04;
        if (small < e) {
          put(x, g - 1, "E");
          if (style === 3 && x + 3 < end && rnd() < 0.6) { put(x + 2, g - 1, "E"); x += 2; }
        }
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

  // A campaign of many levels from a few numbers (a small model writes these, not twenty levels): `count` 2-20, the difficulty
  // climbs from `from` to `to`, the levels grow up to half as long and the enemies, pits and flyers grow with it.
  L.campaign = function (c) {
    c = c || {};
    var n = Math.round(clamp(c.count, 2, 20, 6)), from = Math.round(clamp(c.from, 1, 5, 1)), to = Math.round(clamp(c.to, 1, 5, 4));
    var width = clamp(c.width, 24, 160, 60), seed = Math.floor(clamp(c.seed, 0, 9999, 1)), out = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var jit = function (k) { return (seed * 7 + i * 13 + k * 5) % 3 - 1; };   // -1, 0 or 1: levels of the same difficulty still differ
      out.push({ seed: (seed + i * 37) % 10000, style: (seed + i * 2) % L.STYLES, difficulty: Math.round(from + (to - from) * t),
                 width: Math.round(Math.min(160, width * (1 + 0.5 * t) * (1 + 0.08 * jit(0)))),
                 enemies: Math.max(0, 1 + Math.round(t * 3) + jit(1)), pits: Math.max(0, 1 + Math.round(t * 3) + jit(2)), flyers: Math.max(0, Math.round(t * 3) + jit(3)),
                 coins: 3 + jit(4), blocks: 2 + jit(5), pipes: 2 + jit(6) });
    }
    return out;
  };

  // The level rows of a spec: custom rows if given, else a campaign, else one generated level per `generate` entry, else the default level.
  L.fromSpec = function (spec) {
    if (spec.levels && spec.levels.length) return spec.levels;
    if (spec.campaign) return L.campaign(spec.campaign).map(function (o) { return L.generate(o); });
    if (spec.generate && spec.generate.length) return spec.generate.map(function (o) { return L.generate(o); });
    return [L.defaultLevel];
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
