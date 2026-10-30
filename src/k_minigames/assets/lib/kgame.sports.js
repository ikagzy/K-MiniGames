/* kgame.sports.js: kgame.js için spor modülü (v1): voleybol, pong, futbol (üstten), basketbol. Önce kgame.js ve
   kgame.ai.js yüklenmiş olmalı. Top dairedir (x,y merkez); oyuncular ve raketler dikdörtgendir (x,y sol-üst). */
(function (root) {
  var K = root.K;
  var sports = K.sports = { rules: {} };

  function cap(side) { return side === "left" ? "Left" : "Right"; }
  function other(side) { return side === "left" ? "right" : "left"; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  sports.court = function (g, o) {
    o = o || {};
    var type = o.type || "volleyball";
    var heavy = type === "volleyball" || type === "basketball";   // yerçekimli (yandan görünüş)
    var floorY = heavy ? g.height - 40 : g.height;
    var c = {
      g: g, type: type, width: g.width, height: g.height, floorY: floorY, netX: g.width / 2,
      net: o.net === undefined ? type === "volleyball" : o.net, netTop: floorY - (o.netHeight || 140), netW: 6,
      goals: {}, handlers: {}, ball: null, heavy: heavy
    };
    c.sideOf = function (x) { return x < c.netX ? "left" : "right"; };
    c.on = function (name, fn) { (c.handlers[name] = c.handlers[name] || []).push(fn); };
    c.emit = function (name) {
      var args = Array.prototype.slice.call(arguments, 1), list = c.handlers[name] || [];
      list.forEach(function (fn) { fn.apply(null, args); });
      return list.length > 0;
    };
    if (floorY < g.height) g.add({ shape: "rect", x: 0, y: floorY, w: g.width, h: g.height - floorY, color: "#3a6", tag: "floor" });
    if (c.net) g.add({ shape: "rect", x: c.netX - c.netW / 2, y: c.netTop, w: c.netW, h: floorY - c.netTop, color: "#eee", tag: "net" });
    if (type === "football") {
      var gh = g.height * 0.3, gy = (g.height - gh) / 2;
      c.goals.left = { x: 0, y: gy, w: 12, h: gh };
      c.goals.right = { x: g.width - 12, y: gy, w: 12, h: gh };
    } else if (type === "basketball") {
      c.goals.left = { x: 30, y: floorY - 200, w: 50, h: 10 };
      c.goals.right = { x: g.width - 80, y: floorY - 200, w: 50, h: 10 };
    }
    ["left", "right"].forEach(function (side) {
      var goal = c.goals[side];
      if (goal) g.add({ shape: "rect", x: goal.x, y: goal.y, w: goal.w, h: goal.h, color: type === "football" ? "#fff" : "#f80", tag: "goal" });
    });
    g.onCollide("ball", "paddle", function (ball, paddle) { sports.paddleBounce(ball, paddle); });
    return c;
  };

  // Raket topa çarpınca: geri gönderir, biraz hızlandırır ve raketin neresine çarptığına göre yan hız verir (düz gitmez).
  sports.paddleBounce = function (ball, paddle) {
    var dir = ball.cx > paddle.cx ? 1 : -1;
    var offset = clamp((ball.cy - paddle.cy) / (paddle.h / 2), -1, 1);
    ball.vx = dir * Math.min(900, Math.abs(ball.vx) * 1.06 + 20);
    ball.vy = offset * 320 + ball.vy * 0.3;
    ball.x = dir > 0 ? paddle.right + ball.r : paddle.left - ball.r;
    K.sfx("hit");
  };

  function constrain(c, b) {
    var r = b.r, bounce = b.bounce, side = c.sideOf(b.x);
    if (side !== b.side) { b.side = side; b.touches = 0; }
    var type = c.type;
    if (type === "volleyball" || type === "basketball") {
      if (b.x - r < 0) { b.x = r; b.vx = -b.vx * bounce; }
      if (b.x + r > c.width) { b.x = c.width - r; b.vx = -b.vx * bounce; }
      if (b.y - r < 0) { b.y = r; b.vy = -b.vy * bounce; }
      if (c.net) {
        var rect = { x: c.netX - c.netW / 2, y: c.netTop, w: c.netW, h: c.floorY - c.netTop };
        if (K.hit.circleRect(b, rect)) {
          if (b.y < c.netTop && b.vy > 0) { b.y = c.netTop - r; b.vy = -b.vy * bounce; }
          else { b.x = b.x < c.netX ? rect.x - r : rect.x + rect.w + r; b.vx = -b.vx * bounce; }
        }
      }
      if (b.y + r >= c.floorY) {
        b.y = c.floorY - r;
        if (type === "volleyball" && c.emit("floor", b, c.sideOf(b.x))) return;
        b.vy = -b.vy * bounce; b.vx *= 0.98;
        if (Math.abs(b.vy) < 20) b.vy = 0;
      }
      c.emit("step", b);
      return;
    }
    if (b.y - r < 0) { b.y = r; b.vy = -b.vy * bounce; }
    if (b.y + r > c.height) { b.y = c.height - r; b.vy = -b.vy * bounce; }
    ["left", "right"].forEach(function (edge) {
      var left = edge === "left", out = left ? b.x - r < 0 : b.x + r > c.width;
      if (!out) return;
      var goal = c.goals[edge], inMouth = goal && b.y >= goal.y && b.y <= goal.y + goal.h;
      if (type === "pong" && c.emit("out", b, edge)) return;
      if (type === "football" && inMouth && c.emit("goal", b, edge)) return;
      b.x = left ? r : c.width - r; b.vx = -b.vx * bounce;
    });
  }

  sports.ball = function (g, c, o) {
    o = o || {};
    var b = g.add({
      shape: "circle", x: c.heavy ? c.netX - 100 : g.width / 2, y: c.heavy ? c.floorY - 200 : g.height / 2, r: o.radius || 12,
      color: o.color || "#fe5", tag: "ball", bounce: o.bounce === undefined ? 0.85 : o.bounce,
      gravity: o.gravity === undefined ? c.heavy : o.gravity
    });
    b.touches = 0; b.side = c.sideOf(b.x); b.court = c;
    b.onUpdate = function (self) { constrain(c, self); };
    c.ball = b;
    return b;
  };

  // Vuran, topa yeterince yakınsa topu hedefe doğru gönderir (hem x hem y hızı verir, voleybolda hep biraz yukarı).
  sports.hit = function (g, ball, hitter, target, o) {
    o = o || {};
    var side = !ball.court || ball.court.heavy;   // a side view lifts the ball; a top-down game does not
    var power = o.power || 650, reach = o.reach === undefined ? 60 : o.reach, lift = o.lift === undefined ? (side ? 0.35 : 0) : o.lift;
    if (Math.hypot(ball.cx - hitter.cx, ball.cy - hitter.cy) > reach + ball.r) return false;
    var dx = target.x - ball.cx, dy = target.y - ball.cy, len = Math.hypot(dx, dy) || 1;
    ball.vx = dx / len * power;
    ball.vy = dy / len * power;
    if (lift > 0) ball.vy = Math.min(ball.vy, -power * lift);
    ball.touches = (ball.touches || 0) + 1;
    ball.lastHitter = hitter;
    K.sfx("hit");
    if (ball.court) ball.court.emit("touch", ball, ball.court.sideOf(ball.x));
    return true;
  };

  // Fare tuşuna her basışta (basılı tutarken değil) vuran, topa yakınsa topu fare konumuna gönderir.
  sports.hitOnClick = function (g, ball, hitter, o) {
    var seen = K.mouse.clicks;
    return g.add({ shape: "rect", x: -100, y: -100, w: 1, h: 1, hidden: true, tag: "_clicker", onUpdate: function () {
      if (K.mouse.clicks === seen) return;
      seen = K.mouse.clicks;
      sports.hit(g, ball, hitter, K.mouse, o);
    } });
  };

  // Bir bot topa her yaklaştığında (aralarında bekleyerek) onu karşı sahaya gönderir. Hedef: o.target ({x,y} ya da işlev)
  // ya da topun olmadığı sahanın ortası; seviyeye göre hedef şaşar.
  sports.autoHit = function (g, ball, bot, o) {
    o = o || {};
    var level = K.ai.levels[o.level] || K.ai.levels.normal, wait = 0;
    return g.add({ shape: "rect", x: -100, y: -100, w: 1, h: 1, hidden: true, tag: "_autohit", onUpdate: function (self, dt) {
      wait -= dt;
      if (wait > 0) return;
      var c = ball.court, t = typeof o.target === "function" ? o.target() : o.target;
      if (!t) t = { x: c && c.sideOf(bot.cx) === "right" ? c.width * 0.25 : (c ? c.width * 0.75 : g.width / 2), y: c && !c.heavy ? c.height / 2 : 100 };
      var aim = { x: t.x + K.rand(-1, 1) * level.error * 3, y: t.y };
      if (sports.hit(g, ball, bot, aim, { power: o.power || 550, reach: o.reach })) wait = o.cooldown || 0.5;
    } });
  };

  function newState() { return { scoreLeft: 0, scoreRight: 0, winner: null }; }
  function award(g, state, side, to, onPoint) {
    state["score" + cap(side)]++;
    g.addScore(side);
    if (onPoint) onPoint(side, state);
    if (state["score" + cap(side)] >= to) { state.winner = side; g.go("over"); return true; }
    return false;
  }

  sports.rules.volleyball = function (g, c, o) {
    o = o || {};
    var to = o.to || 15, limit = o.touches || 3, state = newState();
    state.server = "left";
    function serve() {
      var b = c.ball;
      b.x = state.server === "left" ? c.width * 0.25 : c.width * 0.75; b.y = c.floorY - 200;
      b.vx = 0; b.vy = 0; b.touches = 0; b.side = c.sideOf(b.x);
    }
    function point(side) {
      if (award(g, state, side, to, o.onPoint)) return;
      state.server = side;
      serve();
    }
    c.on("floor", function (ball, side) { point(other(side)); });
    c.on("touch", function (ball, side) { if (ball.touches > limit) point(other(side)); });
    return state;
  };

  sports.rules.pong = function (g, c, o) {
    o = o || {};
    var to = o.to || 5, state = newState();
    function serve(toward) {
      var b = c.ball, sign = toward === "left" ? -1 : 1;
      b.x = c.width / 2; b.y = c.height / 2;
      b.vx = sign * K.rand(220, 280); b.vy = (K.rand(0, 1) < 0.5 ? -1 : 1) * K.rand(80, 160);
    }
    c.on("out", function (ball, edge) {
      if (!award(g, state, other(edge), to, o.onPoint)) serve(edge);
      return true;
    });
    if (c.ball) serve(K.rand(0, 1) < 0.5 ? "left" : "right");
    return state;
  };

  // Futbol (kale ağzı) ve basketbol (pota): topun girdiği taraf karşı takıma puan yazar; top ortadan yeniden başlar.
  sports.rules.goal = function (g, c, o) {
    o = o || {};
    var to = o.to || 5, state = newState(), cooldown = 0;
    function kickoff() {
      var b = c.ball;
      b.x = c.width / 2; b.y = c.heavy ? c.floorY - 200 : c.height / 2; b.vx = 0; b.vy = 0;
    }
    function scored(edge) {
      if (!award(g, state, other(edge), to, o.onPoint)) kickoff();
    }
    c.on("goal", function (ball, edge) { scored(edge); });
    c.on("step", function (ball) {
      if (cooldown > 0) { cooldown--; return; }
      ["left", "right"].forEach(function (edge) {
        var goal = c.goals[edge];
        if (goal && ball.vy > 0 && K.hit.circleRect(ball, goal) && ball.cx > goal.x && ball.cx < goal.x + goal.w) {
          cooldown = 30;
          scored(edge);
        }
      });
    });
    return state;
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
