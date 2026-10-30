/* kgame.js: K-MiniGames oyun kütüphanesi çekirdeği (v1). DOM olmadan da yüklenir (testler Node'da çalışır).
   Konum kuralı: dikdörtgenin x,y'si SOL-ÜST köşesidir; dairenin x,y'si MERKEZİdir. */
(function (root) {
  var K = root.K = root.K || {};
  K.version = "1";
  var hasDom = typeof document !== "undefined";

  // ---------- rastgele ----------
  var seedState = 1;
  function next() {
    seedState = (seedState + 0x6D2B79F5) >>> 0;
    var t = seedState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  K.seed = function (n) { seedState = (Math.floor(n) >>> 0) || 1; };
  K.seed(Math.random() * 4294967296);
  K.rand = function (a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + next() * (b - a);
  };
  K.pick = function (list) { return list[Math.floor(next() * list.length)]; };

  // ---------- girdi ----------
  var keys = {};
  var KEY_NAMES = { space: " ", left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" };
  function norm(name) {
    var low = String(name).toLowerCase();
    if (KEY_NAMES[low]) return KEY_NAMES[low];
    return name.length === 1 ? low : name;
  }
  K.key = function (name) { return !!keys[norm(name)]; };
  K.press = function (name, down) { keys[norm(name)] = down !== false; };
  K.mouse = { x: 0, y: 0, down: false };
  K.setMouse = function (x, y, down) {
    K.mouse.x = x; K.mouse.y = y;
    if (down !== undefined) K.mouse.down = !!down;
  };
  if (hasDom) {
    document.addEventListener("keydown", function (e) {
      keys[norm(e.key)] = true;
      if (e.key === " " || e.key.indexOf("Arrow") === 0) e.preventDefault();
    });
    document.addEventListener("keyup", function (e) { keys[norm(e.key)] = false; });
    window.addEventListener("blur", function () { keys = {}; });
  }

  // ---------- çarpışma ----------
  function isCircle(o) { return o.shape === "circle" || (o.r !== undefined && o.w === undefined); }
  K.hit = {
    rectRect: function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
    circleCircle: function (a, b) {
      var dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r;
      return dx * dx + dy * dy < rr * rr;
    },
    circleRect: function (c, r) {
      var nx = Math.max(r.x, Math.min(c.x, r.x + r.w)), ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
      var dx = c.x - nx, dy = c.y - ny;
      return dx * dx + dy * dy < c.r * c.r;
    }
  };
  K.overlap = function (a, b) {
    var ca = isCircle(a), cb = isCircle(b);
    if (ca && cb) return K.hit.circleCircle(a, b);
    if (ca) return K.hit.circleRect(a, b);
    if (cb) return K.hit.circleRect(b, a);
    return K.hit.rectRect(a, b);
  };

  var SOLID = { wall: true, solid: true, ground: true, block: true };
  K.tilemap = function (rows, legend, tile) {
    tile = tile || 32;
    legend = legend || {};
    var cols = 0;
    rows.forEach(function (row) { cols = Math.max(cols, row.length); });
    var map = {
      rows: rows, tile: tile, width: cols * tile, height: rows.length * tile,
      charAt: function (tx, ty) { var row = rows[ty]; return row ? row.charAt(tx) : ""; },
      solidAt: function (px, py) {
        var ch = map.charAt(Math.floor(px / tile), Math.floor(py / tile));
        return !!ch && SOLID[legend[ch]] === true;
      },
      addTo: function (g, o) {   // every solid tile as an entity (tag "tile") so it is drawn
        var made = [];
        rows.forEach(function (row, ty) {
          for (var tx = 0; tx < row.length; tx++) {
            if (SOLID[legend[row.charAt(tx)]] === true) made.push(g.add({ shape: "rect", x: tx * tile, y: ty * tile, w: tile, h: tile, color: (o && o.color) || "#765", tag: "tile", texture: o && o.texture }));
          }
        });
        return made;
      },
      spawn: function (ch) {
        var found = [];
        rows.forEach(function (row, ty) {
          for (var tx = 0; tx < row.length; tx++) if (row.charAt(tx) === ch) found.push({ x: tx * tile, y: ty * tile });
        });
        return found;
      }
    };
    return map;
  };

  // ---------- zamanlayıcılar ve geçişler ----------
  var timers = [], tweens = [], timerId = 0;
  K.timer = {
    after: function (ms, fn) { timers.push({ id: ++timerId, left: ms, interval: 0, fn: fn }); return timerId; },
    every: function (ms, fn) { timers.push({ id: ++timerId, left: ms, interval: ms, fn: fn }); return timerId; },
    clear: function (id) { timers = timers.filter(function (t) { return t.id !== id; }); },
    tick: function (dt) {
      var ms = dt * 1000;
      timers.slice().forEach(function (t) {
        if (timers.indexOf(t) < 0) return;
        t.left -= ms;
        while (t.left <= 0) {
          t.fn();
          if (!t.interval) { K.timer.clear(t.id); return; }
          t.left += t.interval;
        }
      });
      tweens.slice().forEach(function (tw) {
        tw.elapsed += ms;
        var p = Math.min(1, tw.elapsed / tw.ms), e = tw.ease(p);
        for (var k in tw.to) tw.obj[k] = p >= 1 ? tw.to[k] : tw.from[k] + (tw.to[k] - tw.from[k]) * e;
        if (p >= 1) tweens.splice(tweens.indexOf(tw), 1);
      });
    }
  };
  var EASE = {
    linear: function (p) { return p; },
    "in": function (p) { return p * p; },
    out: function (p) { return 1 - (1 - p) * (1 - p); },
    inout: function (p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  };
  K.tween = function (obj, to, ms, ease) {
    var from = {};
    for (var k in to) from[k] = obj[k];
    tweens.push({ obj: obj, from: from, to: to, ms: Math.max(1, ms), elapsed: 0, ease: EASE[ease] || EASE.linear });
  };

  // ---------- kayıt, durum ----------
  var memory = {};
  K.save = {
    set: function (key, value) {
      try { root.localStorage.setItem("kgame:" + key, JSON.stringify(value)); } catch (e) { memory[key] = value; }
    },
    get: function (key, fallback) {
      try {
        var raw = root.localStorage.getItem("kgame:" + key);
        if (raw !== null) return JSON.parse(raw);
      } catch (e) { /* localStorage yok ya da kapalı */ }
      return key in memory ? memory[key] : fallback;
    }
  };
  var exposedState = null;
  K.expose = function (obj) { exposedState = obj; root.__game = obj; return obj; };
  K.exposed = function () { return exposedState; };

  // ---------- ses ----------
  var audio;
  function audioContext() {
    if (audio === undefined) {
      try { audio = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { audio = null; }
    }
    return audio;
  }
  var SFX = { jump: [380, 620, 0.12, "square"], hit: [220, 110, 0.1, "sawtooth"], coin: [880, 1320, 0.12, "square"],
              boom: [160, 40, 0.35, "sawtooth"], click: [600, 600, 0.04, "square"] };
  K.sfx = function (name) {
    var ctx = audioContext(), p = SFX[name] || SFX.click;
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime;
      osc.type = p[3];
      osc.frequency.setValueAtTime(p[0], t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, p[1]), t + p[2]);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + p[2]);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + p[2]);
    } catch (e) { /* sessiz kal */ }
  };

  // ---------- üretilen dokular ----------
  var TEXTURES = { brick: ["#a5442f", "#6e2a1d"], grass: ["#4c9a3a", "#336b26"], stone: ["#8a8a8a", "#5e5e5e"],
                   wood: ["#a0713b", "#6b4a26"], water: ["#3a78c9", "#2a5a9e"], sky: ["#8ec9f0", "#bfe3f7"] };
  K.texture = {
    make: function (name, size) {
      size = size || 32;
      var colors = TEXTURES[name] || TEXTURES.stone;
      var out = { name: name, size: size, canvas: null };
      if (!hasDom) return out;
      var c = document.createElement("canvas");
      c.width = c.height = size;
      var x = c.getContext("2d");
      x.fillStyle = colors[0]; x.fillRect(0, 0, size, size);
      x.fillStyle = colors[1];
      var step = Math.max(2, Math.floor(size / 4));
      for (var i = 0; i < size; i += step) {
        if (name === "brick") { x.fillRect(0, i, size, 1); x.fillRect((i / step) % 2 ? step : step * 2, i, 1, step); }
        else if (name === "grass") x.fillRect(i, size - 1 - ((i * 7) % step), 1, 2);
        else if (name === "water" || name === "sky") x.fillRect(0, i, size, 1);
        else for (var j = 0; j < size; j += step) if ((i + j) % (step * 2) === 0) x.fillRect(i, j, 2, 2);
      }
      out.canvas = c;
      return out;
    }
  };

  // ---------- oyun ----------
  function Game(opts) {
    var g = this;
    g.width = opts.width || 800;
    g.height = opts.height || 450;
    g.gravity = opts.gravity || 0;
    g.background = opts.background || "#111";
    g.entities = [];
    g.rules = [];
    g.scores = {};
    g.sceneMap = {};
    g.current = "play";
    g.camera = { x: 0, y: 0, zoom: 1 };
    g.ui = { items: {}, text: null, bar: null };
    g.running = false;
    g._follow = null;
    g._shake = { power: 0, left: 0, x: 0, y: 0 };
    g.canvas = opts.canvas || null;
    g.ctx = null;
    if (!g.canvas && hasDom && !opts.headless) {
      g.canvas = document.querySelector("canvas");
      if (!g.canvas) { g.canvas = document.createElement("canvas"); document.body.appendChild(g.canvas); }
    }
    if (g.canvas) {
      g.canvas.width = g.width; g.canvas.height = g.height;
      g.ctx = g.canvas.getContext("2d");
      var at = function (e, down) {
        var r = g.canvas.getBoundingClientRect();
        K.setMouse((e.clientX - r.left) * (g.width / (r.width || g.width)) / g.camera.zoom + g.camera.x,
                   (e.clientY - r.top) * (g.height / (r.height || g.height)) / g.camera.zoom + g.camera.y, down);
      };
      g.canvas.addEventListener("mousemove", function (e) { at(e); });
      g.canvas.addEventListener("mousedown", function (e) { at(e, true); });
      g.canvas.addEventListener("mouseup", function (e) { at(e, false); });
    }
    g.ui.text = function (id, text, x, y, opt) {
      g.ui.items[id] = { kind: "text", text: text, x: x, y: y, color: (opt && opt.color) || "#fff", size: (opt && opt.size) || 20 };
    };
    g.ui.bar = function (id, value, max, x, y, w, opt) {
      g.ui.items[id] = { kind: "bar", value: value, max: max, x: x, y: y, w: w, color: (opt && opt.color) || "#4c4" };
    };
  }

  function makeEntity(g, spec) {
    var e = {};
    for (var k in spec) e[k] = spec[k];
    e.shape = e.shape || "rect";
    e.x = e.x || 0; e.y = e.y || 0; e.vx = e.vx || 0; e.vy = e.vy || 0;
    if (e.shape === "circle") { e.r = e.r || 10; e.w = e.h = e.r * 2; }
    else { e.w = e.w === undefined ? 20 : e.w; e.h = e.h === undefined ? 20 : e.h; }
    e.color = e.color || "#fff";
    e.bounce = e.bounce || 0; e.friction = e.friction || 0;
    Object.defineProperties(e, {
      left: { get: function () { return isCircle(e) ? e.x - e.r : e.x; } },
      right: { get: function () { return isCircle(e) ? e.x + e.r : e.x + e.w; } },
      top: { get: function () { return isCircle(e) ? e.y - e.r : e.y; } },
      bottom: { get: function () { return isCircle(e) ? e.y + e.r : e.y + e.h; } },
      cx: { get: function () { return isCircle(e) ? e.x : e.x + e.w / 2; } },
      cy: { get: function () { return isCircle(e) ? e.y : e.y + e.h / 2; } }
    });
    return e;
  }

  Game.prototype.add = function (spec) { var e = makeEntity(this, spec || {}); this.entities.push(e); return e; };
  Game.prototype.remove = function (e) { e.dead = true; };
  Game.prototype.all = function (tag) {
    return this.entities.filter(function (e) { return !e.dead && (tag === undefined || e.tag === tag); });
  };
  Game.prototype.onCollide = function (a, b, fn) { this.rules.push({ a: a, b: b, fn: fn, active: {} }); };
  Game.prototype.scene = function (name, handlers) { this.sceneMap[name] = handlers || {}; };
  Game.prototype.go = function (name) {
    this.current = name;
    var sc = this.sceneMap[name];
    if (sc && sc.enter) sc.enter(this);
  };
  Game.prototype.score = function (name) { return this.scores[name] || 0; };
  Game.prototype.addScore = function (name, n) { this.scores[name] = this.score(name) + (n === undefined ? 1 : n); return this.scores[name]; };
  Game.prototype.follow = function (e, lerp) { this._follow = { e: e, lerp: lerp === undefined ? 0.1 : lerp }; };
  Game.prototype.shake = function (power, ms) { this._shake.power = power; this._shake.left = ms; };
  Game.prototype.shakeOffset = function () { return { x: this._shake.x, y: this._shake.y }; };

  function members(g, who) {
    if (typeof who === "string") return g.all(who);
    return who && !who.dead ? [who] : [];
  }
  function runRules(g) {
    g.rules.forEach(function (rule) {
      var seen = {};
      members(g, rule.a).forEach(function (a) {
        members(g, rule.b).forEach(function (b) {
          if (a === b) return;
          var key = g.entities.indexOf(a) + ":" + g.entities.indexOf(b);
          if (!K.overlap(a, b)) return;
          seen[key] = true;
          if (!rule.active[key]) { rule.active[key] = true; rule.fn(a, b); }
        });
      });
      for (var key in rule.active) if (!seen[key]) delete rule.active[key];
    });
  }

  function control(e, dt) {
    var left, right, up, down;
    if (e.controls === "wasd") { left = K.key("a"); right = K.key("d"); up = K.key("w"); down = K.key("s"); }
    else if (e.controls === "arrows") { left = K.key("ArrowLeft"); right = K.key("ArrowRight"); up = K.key("ArrowUp"); down = K.key("ArrowDown"); }
    else return;
    var speed = e.speed === undefined ? 200 : e.speed;
    e.vx = e.axis === "y" ? 0 : ((right ? 1 : 0) - (left ? 1 : 0)) * speed;
    if (e.axis === "x") { if (e.jump && e.gravity && up && e.onFloor) e.vy = -e.jump; }
    else if (!e.gravity) e.vy = ((down ? 1 : 0) - (up ? 1 : 0)) * speed;
    else if (e.jump && up && e.onFloor) e.vy = -e.jump;   // jump: from the floor only
  }

  function physics(g, e, dt) {
    if (e.onUpdate) e.onUpdate(e, dt);
    if (e.life !== undefined) { e.life -= dt * 1000; if (e.life <= 0) { e.dead = true; return; } }
    control(e, dt);
    if (e.gravity) e.vy += (e.gravity === true ? g.gravity : e.gravity) * dt;
    if (e.friction) { var f = Math.min(1, e.friction * dt); e.vx -= e.vx * f; if (!e.gravity) e.vy -= e.vy * f; }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.xmin !== undefined && e.x < e.xmin) e.x = e.xmin;
    if (e.xmax !== undefined && e.x > e.xmax) e.x = e.xmax;
    e.onFloor = false;   // set again below when it is standing; control() reads the value of the step before
    if (e.bounds) {
      var circle = isCircle(e), ox = circle ? e.r : 0, oy = ox;
      var maxX = g.width - (circle ? e.r : e.w), maxY = g.height - (circle ? e.r : e.h);
      if (e.x < ox) { e.x = ox; e.vx = -e.vx * e.bounce; }
      else if (e.x > maxX) { e.x = maxX; e.vx = -e.vx * e.bounce; }
      if (e.y < oy) { e.y = oy; e.vy = -e.vy * e.bounce; }
      else if (e.y > maxY) { e.y = maxY; e.vy = -e.vy * e.bounce; e.onFloor = true; }
    }
    if (e.floor !== undefined && e.bottom >= e.floor) {   // floor: a floor line of this entity's own (the court's floor)
      e.y = isCircle(e) ? e.floor - e.r : e.floor - e.h;
      if (e.vy > 0) e.vy = -e.vy * e.bounce;
      e.onFloor = true;
    }
  }

  Game.prototype.step = function (dt) {
    var g = this, sc = g.sceneMap[g.current];
    if (g.current === "play") {
      g.entities.slice().forEach(function (e) { if (!e.dead) physics(g, e, dt); });
      runRules(g);
      g.entities = g.entities.filter(function (e) { return !e.dead; });
    }
    K.timer.tick(dt);
    if (sc && sc.update) sc.update(g, dt);
    if (g._follow) {
      var f = g._follow, z = g.camera.zoom;
      g.camera.x += (f.e.cx - g.width / z / 2 - g.camera.x) * f.lerp;
      g.camera.y += (f.e.cy - g.height / z / 2 - g.camera.y) * f.lerp;
    }
    var s = g._shake;
    if (s.left > 0) {
      s.left -= dt * 1000;
      s.x = s.left > 0 ? (next() * 2 - 1) * s.power || 0.001 : 0;
      s.y = s.left > 0 ? (next() * 2 - 1) * s.power || 0.001 : 0;
    } else { s.x = 0; s.y = 0; }
  };

  Game.prototype.draw = function () {
    var g = this, c = g.ctx;
    if (!c) return;
    c.save();
    c.fillStyle = g.background; c.fillRect(0, 0, g.width, g.height);
    c.scale(g.camera.zoom, g.camera.zoom);
    c.translate(-g.camera.x + g._shake.x, -g.camera.y + g._shake.y);
    g.entities.forEach(function (e) {
      if (e.hidden) return;
      c.fillStyle = e.color;
      if (e.shape === "circle") { c.beginPath(); c.arc(e.x, e.y, e.r, 0, Math.PI * 2); c.fill(); }
      else if (e.shape === "text") { c.font = (e.size || 20) + "px sans-serif"; c.fillText(e.text || "", e.x, e.y); }
      else if (e.texture && e.texture.canvas) c.drawImage(e.texture.canvas, e.x, e.y, e.w, e.h);
      else c.fillRect(e.x, e.y, e.w, e.h);
    });
    c.restore();
    var sc = g.sceneMap[g.current];
    if (sc && sc.draw) sc.draw(g, c);
    for (var id in g.ui.items) {
      var it = g.ui.items[id];
      c.fillStyle = it.color;
      if (it.kind === "text") { c.font = it.size + "px sans-serif"; c.fillText(it.text, it.x, it.y); }
      else { c.strokeStyle = "#fff"; c.strokeRect(it.x, it.y, it.w, 10); c.fillRect(it.x, it.y, it.w * Math.max(0, Math.min(1, it.value / it.max)), 10); }
    }
  };

  Game.prototype.run = function () {
    var g = this, last = null, acc = 0;
    g.running = true;
    if (typeof requestAnimationFrame === "undefined") return;
    function frame(t) {
      if (!g.running) return;
      if (last === null) last = t;
      acc += Math.min(0.1, (t - last) / 1000);
      last = t;
      while (acc >= 1 / 60) { g.step(1 / 60); acc -= 1 / 60; }
      g.draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
  Game.prototype.stop = function () { this.running = false; };

  Game.prototype.collideTiles = function (e, map) {
    var t = map.tile, x0 = Math.floor(e.left / t), x1 = Math.floor((e.right - 0.001) / t);
    var y0 = Math.floor(e.top / t), y1 = Math.floor((e.bottom - 0.001) / t);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        if (!map.solidAt(tx * t + 1, ty * t + 1)) continue;
        var px = Math.min(e.right, (tx + 1) * t) - Math.max(e.left, tx * t);
        var py = Math.min(e.bottom, (ty + 1) * t) - Math.max(e.top, ty * t);
        if (px <= 0 || py <= 0) continue;
        if (px < py) {
          var offX = e.cx < tx * t + t / 2 ? -px : px;
          e.x += offX; e.vx = 0;
        } else {
          var offY = e.cy < ty * t + t / 2 ? -py : py;
          e.y += offY; e.vy = 0;
          if (offY < 0) e.onFloor = true;
        }
      }
    }
  };

  K.game = function (opts) { return new Game(opts || {}); };

  // ---------- parçacıklar ----------
  K.particles = {
    burst: function (g, x, y, o) {
      o = o || {};
      var count = o.count === undefined ? 12 : o.count;
      for (var i = 0; i < count; i++) {
        var a = next() * Math.PI * 2, s = (o.speed || 120) * (0.4 + next() * 0.6);
        g.add({ shape: "rect", x: x, y: y, w: 3, h: 3, color: o.color || "#fd6", vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: o.life || 500, tag: "particle" });
      }
    }
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
