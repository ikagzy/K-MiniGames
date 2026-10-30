/* kgame.ai.js: kgame.js için bot / yapay zekâ modülü (v1). Önce kgame.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var ai = K.ai = {};

  // Bir varlığın onUpdate'ine, varsa eskisini bozmadan bir işlev ekler.
  function hook(e, fn) {
    var previous = e.onUpdate;
    e.onUpdate = function (self, dt) { if (previous) previous(self, dt); fn(self, dt); };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  ai.levels = {
    easy: { speed: 120, delay: 0.35, error: 25 },
    normal: { speed: 220, delay: 0.15, error: 10 },
    hard: { speed: 360, delay: 0, error: 0 }
  };

  ai.follow = function (e, target, o) {
    o = o || {};
    var speed = o.speed || 120, stopAt = o.stopAt || 0;
    hook(e, function (me, dt) {
      var dx = target.cx - me.cx, dy = target.cy - me.cy, d = Math.hypot(dx, dy);
      if (d <= stopAt || d === 0) { me.vx = 0; me.vy = 0; return; }
      var v = Math.min(speed, (d - stopAt) / dt);
      me.vx = dx / d * v; me.vy = dy / d * v;
    });
  };

  ai.flee = function (e, from, o) {
    var speed = (o && o.speed) || 120;
    hook(e, function (me) {
      var dx = me.cx - from.cx, dy = me.cy - from.cy, d = Math.hypot(dx, dy) || 1;
      me.vx = dx / d * speed; me.vy = dy / d * speed;
    });
  };

  ai.wander = function (e, o) {
    o = o || {};
    var speed = o.speed || 60, turn = o.turn || 1.5, heading = K.rand(0, Math.PI * 2);
    hook(e, function (me, dt) {
      heading += K.rand(-1, 1) * turn * dt * 3;
      me.vx = Math.cos(heading) * speed; me.vy = Math.sin(heading) * speed;
    });
  };

  ai.patrol = function (e, points, o) {
    var speed = (o && o.speed) || 60, index = points.length > 1 ? 1 : 0, step = 1;
    hook(e, function (me, dt) {
      var p = points[index], dx = p[0] - me.x, dy = p[1] - me.y, d = Math.hypot(dx, dy);
      if (d < 3) {
        if (index + step >= points.length || index + step < 0) step = -step;
        index = clamp(index + step, 0, points.length - 1);
        return;
      }
      var v = Math.min(speed, d / dt);
      me.vx = dx / d * v; me.vy = dy / d * v;
    });
  };

  // Pong / voleybol rakibi: topun konumuna göre kayar. easy: yavaş, gecikmeli ve hatalı; hard: hızlı ve kusursuz.
  ai.paddle = function (e, ball, o) {
    o = o || {};
    var level = ai.levels[o.level] || ai.levels.normal, axis = o.axis === "x" ? "x" : "y";
    var speed = o.speed || level.speed, wait = 0, aim = 0;
    hook(e, function (me, dt) {
      wait -= dt;
      if (wait <= 0) {
        aim = (axis === "y" ? ball.cy : ball.cx) + K.rand(-1, 1) * level.error;
        wait = level.delay;
      }
      var diff = aim - (axis === "y" ? me.cy : me.cx);
      var v = Math.abs(diff) < 4 ? 0 : clamp(diff * 8, -speed, speed);
      if (axis === "y") me.vy = v; else me.vx = v;
    });
    return e;
  };

  ai.fsm = function (e, states, start) {
    var machine = { state: start };
    hook(e, function (me, dt) {
      var fn = states[machine.state];
      var next = fn ? fn(me, dt) : undefined;
      if (typeof next === "string" && states[next]) machine.state = next;
    });
    return machine;
  };

  // grid[satır][sütun]: 0 geçilir, 1 duvar. Yol [sütun, satır] çiftleri, başlangıç ve hedef dahil; yol yoksa null.
  ai.astar = function (grid, from, to) {
    var rows = grid.length, cols = rows ? grid[0].length : 0;
    function key(c, r) { return r * cols + c; }
    function ok(c, r) { return c >= 0 && r >= 0 && c < cols && r < rows && grid[r][c] === 0; }
    if (!ok(from[0], from[1]) || !ok(to[0], to[1])) return null;
    var open = [{ c: from[0], r: from[1], g: 0, f: 0 }], cameFrom = {}, best = {};
    best[key(from[0], from[1])] = 0;
    var heuristic = function (c, r) { return Math.abs(c - to[0]) + Math.abs(r - to[1]); };
    while (open.length) {
      open.sort(function (a, b) { return a.f - b.f; });
      var cur = open.shift();
      if (cur.c === to[0] && cur.r === to[1]) {
        var path = [[cur.c, cur.r]], k = key(cur.c, cur.r);
        while (cameFrom[k] !== undefined) { var prev = cameFrom[k]; path.unshift([prev.c, prev.r]); k = key(prev.c, prev.r); }
        return path;
      }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var c = cur.c + d[0], r = cur.r + d[1];
        if (!ok(c, r)) return;
        var g = cur.g + 1, kk = key(c, r);
        if (best[kk] !== undefined && best[kk] <= g) return;
        best[kk] = g;
        cameFrom[kk] = { c: cur.c, r: cur.r };
        open.push({ c: c, r: r, g: g, f: g + heuristic(c, r) });
      });
    }
    return null;
  };

  // a, b'yi görüyor mu: menzil içinde ve aradaki duvar (varlık listesi) çizgiyi kesmiyor.
  ai.sees = function (a, b, walls, range) {
    var dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy);
    if (range !== undefined && d > range) return false;
    var steps = Math.max(1, Math.ceil(d / 4));
    for (var i = 1; i < steps; i++) {
      var x = a.cx + dx * i / steps, y = a.cy + dy * i / steps;
      for (var w = 0; w < walls.length; w++) {
        var wall = walls[w];
        if (x >= wall.left && x <= wall.right && y >= wall.top && y <= wall.bottom) return false;
      }
    }
    return true;
  };

  ai.swarm = function (list, o) {
    o = o || {};
    var cohesion = o.cohesion === undefined ? 0.3 : o.cohesion, separation = o.separation || 30, speed = o.speed || 80;
    list.forEach(function (e) {
      hook(e, function (me) {
        var cx = 0, cy = 0, n = 0, px = 0, py = 0;
        list.forEach(function (other) {
          if (other === me || other.dead) return;
          cx += other.cx; cy += other.cy; n++;
          var dx = me.cx - other.cx, dy = me.cy - other.cy, d = Math.hypot(dx, dy);
          if (d > 0 && d < separation) { px += dx / d * (separation - d); py += dy / d * (separation - d); }
        });
        if (!n) return;
        var vx = (cx / n - me.cx) * cohesion + px * 4, vy = (cy / n - me.cy) * cohesion + py * 4;
        var v = Math.hypot(vx, vy);
        if (v > speed) { vx = vx / v * speed; vy = vy / v * speed; }
        me.vx = vx; me.vy = vy;
      });
    });
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
