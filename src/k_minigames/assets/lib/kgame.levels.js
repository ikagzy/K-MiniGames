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
      for (var c = cur[0] - gap - 1; c <= cur[0] + gap + 1; c++) {
        for (var y = 0; y < level.rowsCount; y++) {
          if (!standable(c, y) || seen[key(c, y)]) continue;
          var dx = Math.abs(c - cur[0]), up = cur[1] - y;
          if (up > jump) continue;                  // too high to jump up to
          if (up >= 0 && dx > gap) continue;        // a gap that is too wide to jump over
          if (up < 0 && dx > gap + 1) continue;     // when falling a little more is allowed
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

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
