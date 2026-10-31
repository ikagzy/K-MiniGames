/* kgame.shooter.js: nişancı oyunu kiti (dikey kayan uzay nişancısı). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'shooter', title:'Yıldız Savaşı', theme:'space', difficulty:3, waves:{count:8},
               ship:{lives:3, fire:'double'}, enemies:['drifter','zigzag','shooter'], boss:true, features:['shield','bomb'] })
   Kit; gemiyi (ok/WASD ile hareket, boşlukla ateş), düşman dalgalarını (tohumdan kurulur, zorluk dalga dalga artar), düşman türlerini
   (drifter süzülen, zigzag, shooter ateş eden, kamikaze üstüne atılan, tank), isteğe bağlı patronu, güçlendirmeleri, skoru, canı, sesi,
   müziği ve ölme/kazanma ekranlarını kendisi kurar. Özellikler: shield, bomb, spread, rapid. Önce kgame.js, sprites, themes, hud, audio2, kits. */
(function (root) {
  var K = root.K;
  var KINDS = ["drifter", "zigzag", "shooter", "kamikaze", "tank"];
  var FIRES = ["single", "double", "spread"];
  var THEMES = { space: ["#05060f", "#ffffff", "dot"], night: ["#0b1030", "#cfd8ff", "dot"], sky: ["#5aa9e6", "#ffffff", "cloud"],
                 underwater: ["#0b4f7a", "#9fe3ff", "bubble"], cave: ["#2b2118", "#8a6a4a", "dot"], castle: ["#2a1420", "#ff9d4d", "dot"],
                 forest: ["#16361f", "#7bd88f", "leaf"] };
  var W = 480, H = 640;

  // ---- original pixel art (one letter per colour, '.' is clear) ----
  var S = K.sprites;
  S.define("ship", [".....a.....", "....aba....", "....aba....", "...aabaa...", "..aaabaaa..", ".daaabaaad.", "dd.aabaa.dd", "d..aacaa..d", "....eee....", ".....e....."],
           { a: "#7dd3fc", b: "#e0f2fe", d: "#1e5bd8", c: "#ffd23f", e: "#ff8c42" });
  S.define("foe.drifter", ["...ggggg...", "..gGgggGg..", ".ggggggggg.", "gGgwgggwgGg", ".ggggggggg.", "..gGGGGGg..", "...g...g..."], { g: "#3aa655", G: "#1f6b36", w: "#ffffff" });
  S.define("foe.zigzag", ["p.........p", "pp.......pp", "ppp.ppp.ppp", ".pppwpwppp.", "..ppppppp..", "...p.p.p..."], { p: "#a45bd6", w: "#ffffff" });
  S.define("foe.shooter", ["....rRr....", "...rrRrr...", "..rrrrrrr..", ".rrwrrrwrr.", "rrrrrrrrrrr", ".rr.rRr.rr.", "..r..R..r..", ".....y....."], { r: "#d32f2f", R: "#8e1b1b", w: "#ffffff", y: "#ffd23f" });
  S.define("foe.kamikaze", [".....o.....", "....ooo....", "...ooyoo...", "..ooyyyoo..", "...ooyoo...", "....ooo....", ".....o....."], { o: "#f28c28", y: "#ffd23f" });
  S.define("foe.tank", ["..LLLLLLL..", ".LlllllllL.", "LlllwlwlllL", "LlllllllllL", "LLllLLLllLL", ".LLlLLLlLL.", "..L.....L.."], { L: "#6b6b7a", l: "#a9a9bd", w: "#ffffff" });
  S.define("foe.boss", [".......rrrrrrr.......", "....rrrrrRRRrrrrr....", "..rrrrrrrRRRrrrrrrr..", ".rrrwwrrrrrrrrrwwrrr.", "rrrrrrrrrrrrrrrrrrrrr", "rr.rrrrr.rrr.rrrrr.rr", "r...rrr...r...rrr...r", ".......y.....y......."],
           { r: "#8e24aa", R: "#4a148c", w: "#ffffff", y: "#ffd23f" });
  S.define("pw.power", ["..yyy..", ".yyYyy.", "yyYYYyy", "yyyYyyy", ".yyyyy.", "..yyy.."], { y: "#ffd23f", Y: "#fff59d" });
  S.define("pw.shield", ["..bbb..", ".bBBBb.", "bBwwwBb", "bBwBwBb", ".bBBBb.", "..bbb.."], { b: "#4fc3f7", B: "#0288d1", w: "#e1f5fe" });
  S.define("pw.life", ["..m.m..", ".mmmmm.", "mmmwmmm", ".mmmmm.", "..mmm..", "...m..."], { m: "#e53935", w: "#ffcdd2" });
  S.define("pw.bomb", ["..kkk..", ".kllkk.", "kllkkkk", "kkkkkkk", ".kkkkk.", "..kkk.."], { k: "#37474f", l: "#90a4ae" });
  var SIZE = { ship: [33, 30], drifter: [33, 21], zigzag: [33, 18], shooter: [33, 24], kamikaze: [33, 21], tank: [36, 21], boss: [84, 32] };

  // a small seeded generator, so the same spec always gives the same waves
  function rng(seed) {
    var s = (typeof seed === "number" && isFinite(seed) ? Math.floor(seed) : 1) >>> 0 || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // The waves of a spec: [{ index, spawns: [{t, x, kind, y?}], hp, speed, interval }]. Harder with the difficulty and later in the game.
  function waves(spec) {
    var n = Math.round(clamp((spec.waves && spec.waves.count) || 8, 3, 20)), d = Math.round(clamp(spec.difficulty || 3, 1, 5));
    var kinds = (spec.enemies && spec.enemies.length ? spec.enemies : ["drifter", "zigzag", "shooter"]).filter(function (k) { return KINDS.indexOf(k) >= 0; });
    var rnd = rng(spec.waves && spec.waves.seed !== undefined ? spec.waves.seed : 1), out = [];
    for (var i = 0; i < n; i++) {
      var t = n > 1 ? i / (n - 1) : 0;
      var unlocked = Math.min(kinds.length, 1 + Math.floor(t * kinds.length * 1.2));
      var count = Math.round(clamp(3 + d * 0.8 + t * (d * 0.8 + 1), 3, 12));
      var shape = ["line", "vee", "column", "stream"][Math.floor(rnd() * 4)];
      var spawns = [], x0 = 60 + rnd() * (W - 120);
      for (var j = 0; j < count; j++) {
        var kind = kinds[Math.floor(rnd() * unlocked)], x, at;
        if (shape === "line") { x = 40 + (j + 0.5) * (W - 80) / count; at = 0; }
        else if (shape === "vee") { x = W / 2 + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * 44; at = Math.ceil(j / 2) * 0.35; }
        else if (shape === "column") { x = x0; at = j * 0.55; }
        else { x = W / 2 + Math.sin(j * 0.9) * (W / 2 - 60); at = j * 0.5; }
        spawns.push({ t: at, x: clamp(x, 30, W - 30), kind: kind });
      }
      out.push({ index: i, spawns: spawns, shape: shape, hp: 1 + Math.floor(t * (d / 3)), speed: 1 + 0.1 * (d - 1) + 0.3 * t,
                 interval: Math.max(2, 3.8 - 0.25 * d - 0.6 * t) });
    }
    return out;
  }

  K.shooter = { waves: waves, kinds: KINDS };

  K.kit.define("shooter", {
    defaults: {
      title: "Nişancı", theme: "space", music: "boss", width: W, height: H, difficulty: 3,
      waves: { count: 8 }, ship: { speed: 260, lives: 3, fire: "single" }, enemies: ["drifter", "zigzag", "shooter"], boss: false, features: []
    },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle, ship = spec.ship || {};
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (FIRES.indexOf(ship.fire) < 0) errors.push("bilinmeyen ateş türü: " + ship.fire + " (" + FIRES.join(", ") + ")");
      if (!(spec.enemies instanceof Array) || !spec.enemies.length) errors.push("enemies boş olmamalı");
      else spec.enemies.forEach(function (k) { if (KINDS.indexOf(k) < 0) errors.push("bilinmeyen düşman: " + k + " (var olanlar: " + KINDS.join(", ") + ")"); });
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      var count = spec.waves && spec.waves.count;
      if (typeof count !== "number" || count < 3 || count > 20) errors.push("waves.count 3-20 olmalı");
      if (typeof ship.lives !== "number" || ship.lives < 1 || ship.lives > 9) errors.push("ship.lives 1-9 olmalı");
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var look = THEMES[spec.theme], list = waves(spec), ship = spec.ship, d = spec.difficulty;
      var rnd = rng((spec.waves.seed || 1) + 7919);
      var state = { g: g, spec: spec, waves: list, waveIndex: -1, run: 0, me: null, power: 0, shield: 0, bombs: 0, invuln: 0, cooldown: 0, fireGap: 0.22,
                    queue: [], waveT: 0, between: false, boss: null, bg: 0, ended: false, heroHooks: [] };
      var hud = { score: 0, lives: ship.lives, wave: 0, waveCount: list.length, bombs: 0, shield: 0, over: false };
      var tune = spec.music;
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      state.hud = hud;
      g.background = look[0];
      g.layers = [];
      [0.5, 1.2].forEach(function (speed, layer) {   // two layers of things drifting down, at two speeds
        g.layers.push({ speed: 0, draw: function (c) {
          c.fillStyle = look[1]; c.globalAlpha = layer ? 0.9 : 0.5;
          for (var i = 0; i < 46; i++) {
            var x = (i * 97 + layer * 41) % W, y = (i * 53 + state.bg * speed * 40) % H, s = layer ? 3 : 2;
            if (look[2] === "cloud") c.fillRect(x, y, s * 9, s * 3);
            else if (look[2] === "bubble") { c.beginPath(); c.arc(x, y, s * 1.6, 0, 7); c.stroke(); }
            else if (look[2] === "leaf") c.fillRect(x, y, s * 2, s);
            else c.fillRect(x, y, s, s);
          }
          c.globalAlpha = 1;
        } });
      });

      function refresh() {
        g.ui.text("hud.score", "SKOR " + String(Math.floor(hud.score)).padStart(6, "0"), 10, 22, { size: 16 });
        g.ui.text("hud.wave", "DALGA " + Math.max(1, hud.wave) + "/" + hud.waveCount, 180, 22, { size: 16 });
        g.ui.text("hud.lives", "CAN " + hud.lives, 340, 22, { size: 16, color: "#ff6b6b" });
        g.ui.text("hud.extra", (hud.shield ? "KALKAN " + hud.shield + "  " : "") + (hud.bombs ? "BOMBA " + hud.bombs : ""), 10, 44, { size: 14, color: "#7dd3fc" });
      }
      hud.addScore = function (n) { hud.score += n; refresh(); };
      function toast(text, ms) {
        g.ui.text("hud.toast", text, W / 2 - text.length * 7, 200, { size: 26 });
        var run = state.run;
        K.timer.after(ms || 1200, function () { if (run === state.run) delete g.ui.items["hud.toast"]; });
      }

      // ---- screens ----
      var restart = function () {
        state.run++; state.ended = false; state.waveIndex = -1; state.boss = null; state.power = state.startPower || 0; state.shield = state.startShield || 0;
        state.bombs = state.startBombs || 0; state.invuln = 0; state.between = false; state.queue = [];
        hud.score = 0; hud.lives = ship.lives; hud.over = false; hud.wave = 0; hud.bombs = state.bombs; hud.shield = state.shield;
        g.all().forEach(function (e) { if (e.tag !== "_hud") e.dead = true; });
        spawnShip(); g.go("play"); refresh(); if (tune) K.music.play(tune); next();
      };
      K.hud.screen(g, "over", { lines: ["OYUN BİTTİ", "R ile yeniden başla"], keys: { r: restart } });
      K.hud.screen(g, "win", { lines: ["KAZANDIN!", "R ile yeniden oyna"], keys: { r: restart } });

      // ---- the ship ----
      function spawnShip() {
        var s = SIZE.ship;
        var me = g.add({ shape: "rect", x: W / 2 - s[0] / 2, y: H - 90, w: s[0], h: s[1], tag: "player", color: "#7dd3fc", texture: K.sprites.get("ship") });
        me.onUpdate = function (self, dt) {
          if (state.ended) return;
          var left = K.key("a") || K.key("ArrowLeft"), right = K.key("d") || K.key("ArrowRight");
          var up = K.key("w") || K.key("ArrowUp"), down = K.key("s") || K.key("ArrowDown");
          self.x = clamp(self.x + ((right ? 1 : 0) - (left ? 1 : 0)) * ship.speed * dt, 0, W - self.w);
          self.y = clamp(self.y + ((down ? 1 : 0) - (up ? 1 : 0)) * ship.speed * dt, 80, H - self.h - 6);
          state.cooldown -= dt;
          if (K.key(" ") && state.cooldown <= 0) { fire(self); state.cooldown = state.fireGap; }
          if ((K.key("b") || K.key("Shift")) && state.bombs > 0 && !state.bombHeld) { state.bombHeld = true; bomb(); }
          if (!K.key("b") && !K.key("Shift")) state.bombHeld = false;
          state.heroHooks.forEach(function (h) { h(self, dt); });
        };
        state.me = me;
      }
      function shot(x, y, vx) {
        g.add({ shape: "rect", x: x - 2, y: y, w: 4, h: 12, vx: vx || 0, vy: -540, color: "#ffe066", tag: "pbullet",
                onUpdate: function (e) { if (e.y < -20 || e.x < -20 || e.x > W + 20) e.dead = true; } });
      }
      function fire(me) {
        var x = me.cx, y = me.y;
        K.sfx("click");
        if (state.power === 0) shot(x, y);
        else if (state.power === 1) { shot(x - 9, y); shot(x + 9, y); }
        else { shot(x, y - 4); shot(x - 10, y, -110); shot(x + 10, y, 110); }
      }
      function bomb() {
        state.bombs--; hud.bombs = state.bombs; refresh(); K.sfx("boom"); g.shake(10, 300);
        g.all("ebullet").forEach(function (b) { b.dead = true; });
        g.all("enemy").forEach(function (e) { if (!e.dead) damage(e, 3); });
      }
      function hurt() {
        if (state.invuln > 0 || state.ended) return;
        if (state.shield > 0) { state.shield--; hud.shield = state.shield; state.invuln = 0.8; K.sfx("hit"); refresh(); return; }
        K.sfx("death"); K.particles.burst(g, state.me.cx, state.me.cy, { count: 24, color: "#ffb74d" });
        hud.lives = Math.max(0, hud.lives - 1); state.power = Math.max(0, state.power - 1); state.invuln = 2;
        refresh();
        if (hud.lives === 0) {
          state.ended = true; hud.over = true; K.music.stop();
          K.timer.after(800, function () { K.music.play("gameover"); g.go("over"); });
        }
      }

      // ---- enemies ----
      function dropPowerup(x, y) {
        var pool = ["power", "power", "shield", "shield"];
        if (hud.lives < 5) pool.push("life");
        if (state.bombs < 3 && state.spec.features.indexOf("bomb") >= 0) pool.push("bomb");
        var kind = pool[Math.floor(rnd() * pool.length)];
        g.add({ shape: "rect", x: x - 10, y: y, w: 21, h: 18, vy: 70, tag: "powerup", kind: kind, color: "#ffd23f", texture: K.sprites.get("pw." + kind),
                onUpdate: function (e) { if (e.y > H + 20) e.dead = true; } });
      }
      function kill(e) {
        e.dead = true; K.sfx("boom"); K.particles.burst(g, e.cx, e.cy, { count: e.boss ? 40 : 14, color: e.boss ? "#ce93d8" : "#ffcc80" });
        hud.addScore(e.boss ? 3000 : e.kind === "tank" ? 300 : e.kind === "shooter" ? 200 : 100);
        if (!e.boss && rnd() < 0.12) dropPowerup(e.cx, e.cy);
        if (e.boss) { state.boss = null; K.timer.after(1500, function () { if (!state.ended) win(); }); }
      }
      function damage(e, n) { e.hp -= n; e.flash = 0.08; if (e.hp <= 0 && !e.dead) kill(e); }
      function enemyShot(e, aimed, speed) {
        var me = state.me, vx = 0, vy = speed;
        if (aimed && me) { var dx = me.cx - e.cx, dy = Math.max(60, me.cy - e.cy), len = Math.sqrt(dx * dx + dy * dy); vx = dx / len * speed; vy = dy / len * speed; }
        g.add({ shape: "circle", x: e.cx, y: e.bottom, r: 4, vx: vx, vy: vy, color: "#ff5252", tag: "ebullet",
                onUpdate: function (b) { if (b.y > H + 10 || b.y < -10 || b.x < -10 || b.x > W + 10) b.dead = true; } });
      }
      function spawnEnemy(kind, x, wave) {
        var sz = SIZE[kind], bulletSpeed = Math.min(200, 130 + d * 14), age = 0, baseX = x - sz[0] / 2, fireIn = wave.interval * (0.5 + rnd());
        var hp = (kind === "tank" ? 4 : kind === "shooter" ? 2 : 1) + wave.hp - 1;
        var e = g.add({ shape: "rect", x: baseX, y: -sz[1] - 4, w: sz[0], h: sz[1], tag: "enemy", kind: kind, hp: hp, color: "#d32f2f", texture: K.sprites.get("foe." + kind) });
        e.onUpdate = function (self, dt) {
          if (state.ended) return;
          age += dt; if (self.flash > 0) self.flash -= dt;
          var sp = wave.speed;
          if (kind === "drifter") self.y += 75 * sp * dt;
          else if (kind === "zigzag") { self.y += 80 * sp * dt; self.x = clamp(baseX + Math.sin(age * 2.2) * 70, 0, W - self.w); }
          else if (kind === "tank") { self.y += 38 * sp * dt; fireIn -= dt; if (fireIn <= 0) { fireIn = wave.interval * 1.4; enemyShot(self, false, bulletSpeed * 0.85); } }
          else if (kind === "shooter") {
            var hold = 90 + (baseX % 70);
            if (age < 7 && self.y < hold) self.y += 110 * sp * dt;
            else if (age >= 7) self.y += 120 * dt;   // it leaves, so a wave never waits for it
            else self.x = clamp(baseX + Math.sin(age * 1.1) * 40, 0, W - self.w);
            fireIn -= dt; if (fireIn <= 0 && self.y > 20) { fireIn = wave.interval * (0.8 + rnd() * 0.4); enemyShot(self, rnd() < 0.35, bulletSpeed); }
          } else if (kind === "kamikaze") {
            var me = state.me;
            if (age < 1.2) self.y += 50 * dt;
            else { self.y += 210 * sp * dt; if (me) self.x += clamp(me.cx - self.cx, -1, 1) * 95 * dt; }
          }
          if (self.y > H + 30) self.dead = true;
        };
        return e;
      }
      function spawnBoss() {
        var sz = SIZE.boss, hp = 30 + 10 * d, age = 0, fireIn = 1.5, summonIn = 6;
        var e = g.add({ shape: "rect", x: W / 2 - sz[0] / 2, y: -sz[1], w: sz[0], h: sz[1], tag: "enemy", kind: "boss", boss: true, hp: hp, maxHp: hp, color: "#8e24aa",
                        texture: K.sprites.get("foe.boss") });
        e.onUpdate = function (self, dt) {
          if (state.ended) return;
          age += dt; if (self.flash > 0) self.flash -= dt;
          if (self.y < 70) self.y += 60 * dt;
          else {
            self.x = W / 2 - self.w / 2 + Math.sin(age * 0.9) * (W / 2 - self.w / 2 - 12);
            fireIn -= dt;
            if (fireIn <= 0) {
              fireIn = Math.max(0.9, 1.7 - d * 0.1);
              for (var k = -2; k <= 2; k++) {   // a fan of five
                var b = g.add({ shape: "circle", x: self.cx, y: self.bottom, r: 4, vx: k * 55, vy: 150 + d * 12, color: "#ff5252", tag: "ebullet",
                                onUpdate: function (bb) { if (bb.y > H + 10 || bb.x < -10 || bb.x > W + 10) bb.dead = true; } });
              }
            }
            summonIn -= dt;
            if (summonIn <= 0) { summonIn = 7; spawnEnemy("drifter", self.cx - 30, { speed: 1, interval: 3, hp: 1 }); spawnEnemy("drifter", self.cx + 30, { speed: 1, interval: 3, hp: 1 }); }
          }
          g.ui.bar("hud.boss", self.hp, self.maxHp, 90, 58, 300, { color: "#e040fb" });
          if (self.dead) delete g.ui.items["hud.boss"];
        };
        state.boss = e;
        K.music.play("boss"); toast("PATRON!", 1500);
      }

      // ---- waves ----
      function next() {
        if (state.ended) return;
        var run = state.run;
        state.waveIndex++;
        if (state.waveIndex >= list.length) {
          state.between = false;
          if (spec.boss) spawnBoss(); else K.timer.after(800, function () { if (run === state.run && !state.ended) win(); });
          return;
        }
        var w = list[state.waveIndex];
        hud.wave = state.waveIndex + 1; refresh();
        toast("DALGA " + hud.wave, 1200);
        state.queue = w.spawns.slice().sort(function (a, b) { return a.t - b.t; });
        state.waveT = 0; state.between = false;
      }
      function win() {
        if (state.ended) return;
        state.ended = true; K.music.play("victory");
        hud.addScore(1000 + hud.lives * 500);
        K.timer.after(1200, function () { g.go("win"); });
      }

      // ---- rules ----
      g.onCollide("pbullet", "enemy", function (b, e) { b.dead = true; if (!e.dead) { damage(e, 1); K.sfx("hit"); } });
      g.onCollide("player", "powerup", function (me, p) {
        p.dead = true; K.sfx("powerup"); hud.addScore(50);
        if (p.kind === "power") state.power = Math.min(2, state.power + 1);
        else if (p.kind === "shield") { state.shield = Math.min(2, state.shield + 1); hud.shield = state.shield; }
        else if (p.kind === "life") hud.lives = Math.min(9, hud.lives + 1);
        else if (p.kind === "bomb") { state.bombs = Math.min(3, state.bombs + 1); hud.bombs = state.bombs; }
        refresh();
      });

      g.scene("play", {
        update: function (game, dt) {
          if (state.ended && hud.over) return;
          state.bg += dt;
          var me = state.me;
          if (state.invuln > 0) { state.invuln -= dt; me.hidden = Math.floor(state.invuln * 12) % 2 === 1; if (state.invuln <= 0) me.hidden = false; }
          // the ship's own, smaller hitbox
          var hx = me.cx, hy = me.cy + 2;
          g.all("ebullet").forEach(function (b) {
            if (!b.dead && (b.x - hx) * (b.x - hx) + (b.y - hy) * (b.y - hy) < 100) { b.dead = true; hurt(); }
          });
          g.all("enemy").forEach(function (e) {
            if (!e.dead && Math.abs(e.cx - hx) < e.w / 2 + 6 && Math.abs(e.cy - hy) < e.h / 2 + 6) {
              if (!e.boss) { if (state.invuln <= 0) { kill(e); } }
              hurt();
            }
          });
          if (state.ended) return;
          if (state.waveIndex >= 0 && state.waveIndex < list.length) {
            state.waveT += dt;
            while (state.queue.length && state.queue[0].t <= state.waveT) { var sp = state.queue.shift(); spawnEnemy(sp.kind, sp.x, list[state.waveIndex]); }
            var alive = g.all("enemy").filter(function (e) { return !e.dead; }).length;
            if (!state.queue.length && alive === 0 && !state.between) {
              state.between = true; hud.addScore(200 * (state.waveIndex + 1));
              if (state.waveIndex > 0 && state.waveIndex % 3 === 2 && state.spec.features.indexOf("shield") >= 0) { state.shield = Math.min(2, state.shield + 1); hud.shield = state.shield; refresh(); }
              var run = state.run;
              K.timer.after(1400, function () { if (run === state.run) next(); });
            }
          }
        }
      });

      state.start = function () { restart(); };
      state.restart = restart;
      state.expose = { g: g, hud: hud, spec: spec, waves: list, get me() { return state.me; }, get boss() { return state.boss; }, state: state };
      return state;
    }
  });

  // ---- features ----
  K.feature.define("shield", { kits: ["shooter"], options: {}, apply: function (s) { s.startShield = 1; s.shield = 1; s.hud.shield = 1; } });
  K.feature.define("bomb", { kits: ["shooter"], options: {}, apply: function (s) { s.startBombs = 2; s.bombs = 2; s.hud.bombs = 2; } });
  K.feature.define("spread", { kits: ["shooter"], options: {}, apply: function (s) { s.startPower = 2; s.power = 2; } });
  K.feature.define("rapid", { kits: ["shooter"], options: {}, apply: function (s) { s.fireGap = 0.12; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
