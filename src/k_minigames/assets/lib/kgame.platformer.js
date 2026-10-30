/* kgame.platformer.js: platform oyunu kiti (Mario türü). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'platformer', title:'Kagzy', theme:'sky', music:'overworld', hero:{speed:170, jump:420, lives:3},
               levels:[ ['....', 'P..F', '####'] ], features:['doubleJump'] })
   Kit; seviyeyi (ASCII, bkz. kgame.levels.js), kahramanı (koşma, zıplama, kaçırma payı, kısa/uzun zıplama), düşmanları (ezme),
   altın, blokları, güçlendirmeyi, bayrağı, kamerayı, arayüzü, sesi, ölme ve yeniden başlamayı kendisi kurar.
   Özellikler: doubleJump. Önce kgame.js, sprites, animation, themes, levels, hud, audio2, items, enemies, kits yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var TILE = 32;

  var DEFAULT_LEVEL = [
    "....................",
    "....................",
    "......?.B?B.........",
    "....................",
    "..o...........o.o...",
    "P...E....T.......F..",
    "####################",
    "####################"
  ];

  K.kit.define("platformer", {
    defaults: {
      title: "Platform", theme: "sky", music: "overworld", world: "1-1", width: 640, height: 352, gravity: 1100, time: 300,
      hero: { speed: 170, jump: 430, lives: 3 },
      qblocks: ["coin", "coin", "mushroom"],
      levels: [DEFAULT_LEVEL],
      features: []
    },

    check: function (spec) {
      var errors = [];
      if (!Array.isArray(spec.levels) || !spec.levels.length) return ["levels en az bir seviye (satır listesi) olmalı"];
      spec.levels.forEach(function (rows, i) {
        if (!Array.isArray(rows)) { errors.push("seviye " + (i + 1) + " bir satır listesi olmalı"); return; }
        var lv = K.levels.parse(rows);
        lv.warnings.forEach(function (w) { errors.push("seviye " + (i + 1) + ": " + w); });
        var v = K.levels.validate(lv, { jump: 4, gap: 3 });
        if (!v.ok) errors.push("seviye " + (i + 1) + ": " + v.reason);
      });
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: spec.gravity });
      var theme = K.themes.apply(g, spec.theme);
      var levels = K.levels.set(spec.levels);
      var hero = spec.hero;
      var state = { g: g, spec: spec, theme: theme, levels: levels, level: null, map: null, me: null, tiles: {}, frozen: false,
                    jumpHooks: [], heroHooks: [], invuln: 0, star: 0, qIndex: 0 };
      var hud;

      // ---- screens ----
      var restart = function () {
        hud.score = 0; hud.coins = 0; hud.lives = hero.lives; hud.time = spec.time; hud.over = false; hud.timeUp = false;
        levels.reset(); load(levels.current()); g.go("play");
      };
      K.hud.screen(g, "over", { lines: ["OYUN BİTTİ", "R ile yeniden başla"], keys: { r: restart } });
      K.hud.screen(g, "win", { lines: ["KAZANDIN!", "R ile yeniden oyna"], keys: { r: restart } });

      hud = K.hud.stats(g, { lives: hero.lives, time: spec.time, world: spec.world,
                              onGameOver: function () { K.music.play("gameover"); g.go("over"); },
                              onTimeUp: function () { die(); } });
      state.hud = hud;

      // ---- building a level ----
      function load(lv) {
        g.all().forEach(function (e) { if (e.tag !== "_hud") e.dead = true; });
        state.level = lv; state.map = lv.map; state.tiles = {}; state.frozen = false; state.invuln = 0; state.star = 0;
        hud.time = spec.time; hud.timeUp = false;
        g.cameraBounds = { x0: 0, y0: 0, x1: Math.max(lv.width, g.width), y1: Math.max(lv.height, g.height) };
        lv.cells.forEach(function (c) {
          var key = c.tx + "," + c.ty;
          if (c.kind === "ground") {
            var open = !lv.map.solidAt(c.x + 1, c.y - TILE + 1);
            g.add({ shape: "rect", x: c.x, y: c.y, w: TILE, h: TILE, color: theme.tiles.ground, tag: "tile", texture: K.sprites.get(open ? "grass" : "ground") });
          } else if (c.kind === "brick") state.tiles[key] = K.items.brick(g, c.x, c.y);
          else if (c.kind === "qblock") {
            var list = spec.qblocks, what = list[state.qIndex++ % list.length];
            state.tiles[key] = K.items.qblock(g, c.x, c.y, { contains: what });
          } else if (c.kind === "pipe") {
            var top = !lv.map.solidAt(c.x + 1, c.y - TILE + 1);
            g.add({ shape: "rect", x: c.x, y: c.y, w: TILE, h: TILE, color: theme.tiles.pipe, tag: "tile", texture: K.sprites.get(top ? "pipe.top" : "pipe.body") });
          } else if (c.kind === "coin") K.items.coin(g, c.x, c.y);
          else if (c.kind === "walker") K.enemies.walker(g, c.x, c.y, { map: lv.map });
          else if (c.kind === "flyer") K.enemies.flyer(g, c.x, c.y, { amp: 36 });
          else if (c.kind === "spike") g.add({ shape: "rect", x: c.x + 2, y: c.y + 8, w: 28, h: 24, color: "#aaa", tag: "hazard", texture: K.sprites.get("spike") });
          else if (c.kind === "mushroom" || c.kind === "star") K.items.powerup(g, c.kind, c.x, c.y);
          else if (c.kind === "flag") {
            g.add({ shape: "rect", x: c.x + 13, y: c.y - TILE * 3, w: 6, h: TILE * 4, color: "#ccc", tag: "flag", texture: K.sprites.get("pole") });
            g.add({ shape: "rect", x: c.x + 19, y: c.y - TILE * 3, w: 26, h: 26, color: "#3a3", tag: "flagcloth", texture: K.sprites.get("flag") });
          }
        });
        spawnHero(lv.start || { x: 0, y: 0 });
        g.camera.x = 0; g.camera.y = Math.max(0, lv.height - g.height);
        g.follow(state.me, 0.12);
        if (spec.music) K.music.play(spec.music);
      }

      // ---- the hero ----
      function spawnHero(at) {
        var me = g.add({ shape: "rect", x: at.x + 5, y: at.y, w: 22, h: 30, color: "#d32f2f", tag: "player", gravity: true, xmin: 0 });
        var coyote = 0, buffer = 0, held = false;
        me.onUpdate = function (self, dt) {
          if (state.frozen) return;
          var left = K.key("a") || K.key("ArrowLeft"), right = K.key("d") || K.key("ArrowRight");
          var jump = K.key("w") || K.key("ArrowUp") || K.key(" ");
          var top = hero.speed * (K.key("Shift") ? 1.45 : 1);
          var target = ((right ? 1 : 0) - (left ? 1 : 0)) * top;
          self.vx += (target - self.vx) * Math.min(1, (self.onFloor ? 14 : 7) * dt);
          if (target === 0 && Math.abs(self.vx) < 4) self.vx = 0;
          coyote = self.onFloor ? 0.1 : coyote - dt;
          if (jump && !held) buffer = 0.12; else buffer -= dt;
          if (buffer > 0 && (self.onFloor || coyote > 0)) { self.vy = -hero.jump; buffer = 0; coyote = 0; K.sfx("jump"); }
          else if (buffer > 0 && !self.onFloor) {
            for (var i = 0; i < state.jumpHooks.length; i++) if (state.jumpHooks[i](self)) { buffer = 0; break; }
          }
          if (!jump && held && self.vy < -120) self.vy *= 0.5;   // let go early: a short hop
          held = jump;
          state.heroHooks.forEach(function (h) { h(self, dt); });
        };
        state.anim = K.anim.attach(me, { sprites: { idle: ["hero.idle"], run: ["hero.run1", "hero.run2"], jump: ["hero.jump"], die: ["hero.die"] }, fps: { run: 10 } });
        state.me = me;
      }

      function grow() {
        var me = state.me;
        if (me.big) return;
        me.big = true; me.y -= 12; me.h = 42; me.w = 26;
      }
      function hurt() {
        var me = state.me;
        if (state.frozen || state.invuln > 0 || state.star > 0) return;
        if (me.big) { me.big = false; me.y += 12; me.h = 30; me.w = 22; state.invuln = 1.5; K.sfx("bump"); }
        else die();
      }
      function die() {
        var me = state.me;
        if (state.frozen) return;
        state.frozen = true;
        K.music.stop(); K.sfx("death");
        me.vx = 0; me.vy = -380; me.dying = true; me.xmin = undefined;
        state.anim.play("die");
        K.timer.after(1500, function () {
          if (hud.loseLife() > 0) g.fade({ from: 0, to: 1, ms: 300, onDone: function () { load(state.level); g.fade({ from: 1, to: 0, ms: 300 }); } });
        });
      }
      function finish() {
        if (state.frozen) return;
        state.frozen = true;
        K.music.play("victory"); K.sfx("flag");
        hud.addScore(Math.floor(hud.time) * 10 + 1000);
        K.timer.after(1500, function () {
          var next = levels.next();
          if (!next) { g.fade({ from: 0, to: 1, ms: 300, onDone: function () { g.go("win"); g.fade({ from: 1, to: 0, ms: 300 }); } }); return; }
          g.fade({ from: 0, to: 1, ms: 300, onDone: function () { load(next); g.fade({ from: 1, to: 0, ms: 300 }); } });
        });
      }

      // ---- rules ----
      g.onCollide("player", "coin", function (me, coin) { coin.dead = true; hud.addCoin(); K.sfx("coin"); });
      g.onCollide("player", "powerup", function (me, p) {
        p.dead = true; K.sfx("powerup"); hud.addScore(500);
        if (p.kind === "star") state.star = 8; else grow();
      });
      g.onCollide("player", "enemy", function (me, en) {
        if (state.frozen || en.tag !== "enemy") return;
        if (state.star > 0) { en.dead = true; hud.addScore(200); return; }
        if (en.stompable && me.vy > 0 && me.bottom - en.y < 20) { K.enemies.stomp(g, en); me.vy = -300; hud.addScore(100); }
        else hurt();
      });
      g.onCollide("player", "hazard", function () { hurt(); });
      g.onCollide("player", "flag", function () { finish(); });

      g.scene("play", {
        update: function (game, dt) {
          var me = state.me, map = state.map, lv = state.level;
          if (state.invuln > 0) { state.invuln -= dt; me.hidden = Math.floor(state.invuln * 12) % 2 === 1; if (state.invuln <= 0) me.hidden = false; }
          if (state.star > 0) { state.star -= dt; me.color = Math.floor(state.star * 10) % 2 ? "#ffd23f" : "#d32f2f"; }
          if (me.dying) { if (me.y > lv.height + 200) me.vy = 0; return; }
          var before = me.vy;
          g.collideTiles(me, map);
          g.all().forEach(function (e) { if (e !== me && e.collides) g.collideTiles(e, map); });
          if (before < -30 && me.vy === 0) {   // the head hit something: a block above?
            var tx = Math.floor(me.cx / TILE), ty = Math.floor((me.top - 3) / TILE), tile = state.tiles[tx + "," + ty];
            if (tile) {
              var result = K.items.bump(g, tile, { big: me.big, onCoin: function () { hud.addCoin(); } });
              if (result === "break") { map.set(tx, ty, "."); delete state.tiles[tx + "," + ty]; hud.addScore(50); }
            }
          }
          if (me.y > lv.height + 100) die();
        }
      });

      state.start = function () { load(levels.current()); };
      state.restart = restart;
      state.expose = {
        g: g, hud: hud, spec: spec,
        get me() { return state.me; }, get level() { return state.level; }, get map() { return state.map; }, state: state
      };
      return state;
    }
  });

  // ---- features ----
  K.feature.define("doubleJump", {
    kits: ["platformer"], options: { jumps: 1 },
    apply: function (state, opt) {
      var left = opt.jumps;
      state.jumpHooks.push(function (me) {
        if (left <= 0) return false;
        left--; me.vy = -state.spec.hero.jump * 0.9; K.sfx("jump");
        return true;
      });
      state.heroHooks.push(function (me) { if (me.onFloor) left = opt.jumps; });
    }
  });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
