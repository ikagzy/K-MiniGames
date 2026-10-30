/* kgame.themes.js: hazır dünyalar. K.themes.apply(g, 'sky') arka plan rengini ve paralaks katmanlarını (bulut, tepe, yıldız, kaya...)
   ayarlar ve karo renklerini döndürür. Temalar: sky, cave, castle, night, underwater, space, forest. Yeni tema:
   K.themes.define(ad, {bg, tiles, layers:[{speed, draw(ctx, game, ox, oy)}]}). Önce kgame.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var T = K.themes = {};
  var themes = {}, order = [];

  function wrap(v, size) { return ((v % size) + size) % size; }

  function clouds(color, speed, y0) {
    return { speed: speed, draw: function (c, g, ox) {
      c.fillStyle = color;
      for (var i = 0; i < 6; i++) {
        var x = wrap(i * 260 + 40 - ox, g.width + 160) - 80, y = y0 + (i % 3) * 28;
        c.beginPath(); c.arc(x, y, 18, 0, 7); c.arc(x + 22, y - 8, 22, 0, 7); c.arc(x + 46, y, 18, 0, 7); c.fill();
        c.fillRect(x, y, 46, 18);
      }
    } };
  }
  function hills(color, speed, base, height) {
    return { speed: speed, draw: function (c, g, ox) {
      c.fillStyle = color;
      for (var i = 0; i < 5; i++) {
        var x = wrap(i * 220 - ox, g.width + 300) - 150;
        c.beginPath(); c.arc(x + 110, base + 60, height + (i % 2) * 20, Math.PI, 0); c.fill();
      }
    } };
  }
  function stars(color, speed, count) {
    return { speed: speed, draw: function (c, g, ox) {
      c.fillStyle = color;
      for (var i = 0; i < count; i++) {
        var x = wrap(i * 97 - ox, g.width), y = (i * 53) % (g.height - 60);
        c.fillRect(x, y, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2);
      }
    } };
  }
  function rocks(color, speed) {
    return { speed: speed, draw: function (c, g, ox) {
      c.fillStyle = color;
      for (var i = 0; i < 8; i++) {
        var x = wrap(i * 120 - ox, g.width + 120) - 60;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 30, 50 + (i % 3) * 20); c.lineTo(x + 60, 0); c.fill();
        c.beginPath(); c.moveTo(x + 20, g.height); c.lineTo(x + 50, g.height - 40 - (i % 2) * 30); c.lineTo(x + 80, g.height); c.fill();
      }
    } };
  }
  function bubbles(color, speed) {
    return { speed: speed, draw: function (c, g, ox) {
      c.fillStyle = color;
      for (var i = 0; i < 14; i++) {
        var x = wrap(i * 61 - ox, g.width), y = g.height - ((i * 47 + ox * 0.3) % g.height);
        c.beginPath(); c.arc(x, y, 2 + (i % 3), 0, 7); c.fill();
      }
    } };
  }
  function wall(color, line, speed) {
    return { speed: speed, draw: function (c, g, ox) {
      c.fillStyle = color; c.fillRect(0, 0, g.width, g.height);
      c.fillStyle = line;
      for (var row = 0; row < g.height / 24 + 1; row++) {
        c.fillRect(0, row * 24, g.width, 2);
        for (var col = -1; col < g.width / 48 + 2; col++) c.fillRect(wrap(col * 48 + (row % 2) * 24 - ox, g.width + 48) - 24, row * 24, 2, 24);
      }
    } };
  }
  function trees(color, speed) {
    return { speed: speed, draw: function (c, g, ox) {
      c.fillStyle = color;
      for (var i = 0; i < 7; i++) {
        var x = wrap(i * 130 - ox, g.width + 160) - 80, h = 90 + (i % 3) * 25;
        c.fillRect(x + 28, g.height - h, 12, h);
        c.beginPath(); c.arc(x + 34, g.height - h, 34, 0, 7); c.fill();
      }
    } };
  }

  T.define = function (name, def) { if (!themes[name]) order.push(name); themes[name] = def; };
  T.names = function () { return order.slice(); };

  T.define("sky", { bg: "#7cc7ff", tiles: { ground: "#8b5a2b", brick: "#b5651d", block: "#e0a800", pipe: "#2e9a46" },
    layers: [hills("#8fd694", 0.2, 300, 90), hills("#5cb870", 0.35, 330, 70), clouds("#ffffff", 0.15, 50)] });
  T.define("cave", { bg: "#1b1626", tiles: { ground: "#4a3b5c", brick: "#5c4a73", block: "#7a63a0", pipe: "#3b7a5a" },
    layers: [rocks("#2c2340", 0.2), rocks("#3a2f52", 0.4)] });
  T.define("castle", { bg: "#2a1f24", tiles: { ground: "#6b6b75", brick: "#80808c", block: "#b5651d", pipe: "#555" },
    layers: [wall("#30242a", "#241a1f", 0.3)] });
  T.define("night", { bg: "#0b1330", tiles: { ground: "#3b2a1a", brick: "#5a3a1f", block: "#c08a00", pipe: "#1e6b38" },
    layers: [stars("#ffffff", 0.05, 60), hills("#14214d", 0.2, 310, 80), clouds("#2a3a6b", 0.12, 60)] });
  T.define("underwater", { bg: "#0f5c8c", tiles: { ground: "#c9b27a", brick: "#9a8a60", block: "#e0a800", pipe: "#2e9a7a" },
    layers: [bubbles("#bfe8ff", 0.3), rocks("#0b4a72", 0.25)] });
  T.define("space", { bg: "#05020f", tiles: { ground: "#4a4a66", brick: "#5c5c80", block: "#8a5cff", pipe: "#3a8a8a" },
    layers: [stars("#ffffff", 0.05, 90), stars("#9fb4ff", 0.15, 40)] });
  T.define("forest", { bg: "#9fd8a8", tiles: { ground: "#6b4423", brick: "#8a5a2b", block: "#d49a00", pipe: "#2e7a3a" },
    layers: [trees("#2f7a45", 0.25), trees("#3f9a58", 0.45), clouds("#eaffea", 0.1, 40)] });

  T.apply = function (g, name) {
    var key = themes[name] ? name : order[0];
    var theme = themes[key];
    g.background = theme.bg;
    theme.layers.forEach(function (layer) { g.layers.push(layer); });
    return { name: key, bg: theme.bg, tiles: theme.tiles };
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
