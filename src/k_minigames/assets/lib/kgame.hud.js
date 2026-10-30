/* kgame.hud.js: oyun arayüzü. K.hud.stats(g, {lives, time, world, onGameOver, onTimeUp}) skor, altın, can, süre ve dünya yazılarını
   tutar ve günceller; hud.addScore(n), hud.addCoin() (100 altın = 1 can), hud.loseLife(), hud.toast(metin, ms). K.hud.screen(g,
   ad, {lines, keys:{Enter: fn}}) bir tuş bekleyen ekran (başlık, oyun bitti, kazandın). Önce kgame.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var H = K.hud = {};

  function pad(n, width) { var s = String(Math.floor(n)); while (s.length < width) s = "0" + s; return s; }

  H.stats = function (g, o) {
    o = o || {};
    var hud = { score: 0, coins: 0, lives: o.lives === undefined ? 3 : o.lives, time: o.time || 0, world: o.world || "1-1", over: false, timeUp: false };
    var refresh = function () {
      g.ui.text("hud.score", "SKOR " + pad(hud.score, 6), 12, 24, { size: 18 });
      g.ui.text("hud.coins", "ALTIN x" + pad(hud.coins, 2), 170, 24, { size: 18, color: "#ffd23f" });
      g.ui.text("hud.world", "DÜNYA " + hud.world, 310, 24, { size: 18 });
      if (hud.time > 0 || o.time) g.ui.text("hud.time", "SÜRE " + pad(Math.max(0, hud.time), 3), 440, 24, { size: 18 });
      g.ui.text("hud.lives", "CAN " + hud.lives, 560, 24, { size: 18, color: "#ff6b6b" });
    };
    hud.addScore = function (n) { hud.score += n; refresh(); };
    hud.addCoin = function () {
      hud.coins++;
      hud.score += 100;
      if (hud.coins >= 100) { hud.coins = 0; hud.lives++; K.sfx("oneup"); }
      refresh();
    };
    hud.loseLife = function () {
      hud.lives = Math.max(0, hud.lives - 1);
      refresh();
      if (hud.lives === 0 && !hud.over) { hud.over = true; if (o.onGameOver) o.onGameOver(); }
      return hud.lives;
    };
    hud.toast = function (text, ms) {
      g.ui.text("hud.toast", text, g.width / 2 - text.length * 6, 90, { size: 22, color: "#fff" });
      var id = ++toastId;
      K.timer.after(ms || 1500, function () { if (id === toastId) delete g.ui.items["hud.toast"]; });
    };
    var toastId = 0;
    hud.tick = function (dt) {
      if (o.time && !hud.timeUp) {
        hud.time -= dt;
        if (hud.time <= 0) { hud.time = 0; hud.timeUp = true; if (o.onTimeUp) o.onTimeUp(); }
      }
      refresh();
    };
    g.add({ shape: "rect", x: -100, y: -100, w: 1, h: 1, hidden: true, tag: "_hud", onUpdate: function (self, dt) { hud.tick(dt); } });
    refresh();
    return hud;
  };

  // A screen of lines of text that waits for a key (for example the title, game over and win screens).
  H.screen = function (g, name, o) {
    var down = {};
    g.scene(name, {
      draw: function (game, c) {
        c.fillStyle = o.background || "rgba(0,0,0,0.65)"; c.fillRect(0, 0, g.width, g.height);
        c.fillStyle = "#fff";
        (o.lines || []).forEach(function (line, i) {
          c.font = (i === 0 ? 40 : 20) + "px sans-serif";
          c.fillText(line, g.width / 2 - line.length * (i === 0 ? 10 : 5), g.height / 2 - 20 + i * 36);
        });
      },
      update: function () {
        for (var key in (o.keys || {})) {
          var now = K.key(key);
          if (now && !down[key]) { down[key] = true; o.keys[key](); }
          else if (!now) down[key] = false;
        }
      }
    });
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
