/* kgame.fighter.js: yandan görünümlü 2 boyutlu piksel dövüş kiti (fighter). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'fighter', title:'Sokak Dövüşü', theme:'street', hero:'brawler', rival:'ninja', color:'red', difficulty:3, rounds:2, time:60, music:'fighter', world:{seed:3}, features:['special'] })
   Kit; iki dövüşçüyü bir sahnede karşılaştırır: yürü, zıpla, yumruk (hızlı), tekme (uzun ve sert), blok, özel hareket (ateş topu, özel çubuğu dolunca), kombo sayacı. Rakibi yapay zekâ oynar (yaklaşır, vurur, bloklar, zıplar, ateş topu atar),
   istersen versus özelliğiyle ikinci oyuncu da klavyeden oynar. Turlar: KO ya da süre bitince canı çok olan turu alır; `rounds` tur kazanan maçı alır. Resim küçük (320x200 piksel) tuvalde keskin çizilir, tam sayı katıyla büyütülür, bulanıklık yok.
   Kontroller (1. oyuncu): A D yürü, W zıpla, J yumruk, K tekme, L blok, U özel; (2. oyuncu, versus): oklar, N yumruk, M tekme, virgül blok, nokta özel; R yeniden, Esc menü. Özellikler: special, versus, rage.
   Önce kgame.js, kgame.kits.js ve kgame.audio2.js yüklenmiş olmalı. Her şey kodla çizilir (görsel dosya yok). */
(function (root) {
  var K = root.K;
  var VW = 320, VH = 200, FLOOR = 168, LEFT = 18, RIGHT = 302;
  var THEMES = {
    dojo: { sky: [[44, 30, 56], [74, 44, 70], [120, 70, 84]], far: [58, 40, 70], near: [90, 56, 60], floor: [[138, 96, 62], [124, 84, 54]], line: [90, 60, 40], deco: "lanterns" },
    street: { sky: [[30, 40, 80], [54, 70, 120], [96, 120, 170]], far: [44, 52, 84], near: [66, 74, 110], floor: [[96, 100, 112], [86, 90, 102]], line: [60, 64, 76], deco: "buildings" },
    temple: { sky: [[250, 170, 110], [250, 200, 140], [252, 226, 176]], far: [200, 140, 100], near: [150, 100, 80], floor: [[186, 160, 120], [172, 146, 108]], line: [130, 106, 76], deco: "pillars" },
    volcano: { sky: [[40, 10, 10], [90, 24, 16], [170, 56, 24]], far: [60, 20, 18], near: [96, 36, 24], floor: [[78, 56, 54], [68, 48, 46]], line: [48, 32, 32], deco: "lava" }
  };
  var TYPES = {
    brawler: { name: "dövüşçü", hp: 100, spd: 62, dmg: 1, reach: 0, jump: 150, hair: [60, 40, 26], band: true },
    ninja: { name: "ninja", hp: 85, spd: 82, dmg: 0.9, reach: 2, jump: 175, hair: [24, 24, 30], mask: true },
    sumo: { name: "koca", hp: 125, spd: 46, dmg: 1.3, reach: 3, jump: 125, hair: [30, 24, 20], wide: true }
  };
  var COLORS = { red: [214, 48, 48], blue: [56, 108, 226], yellow: [238, 200, 48], green: [54, 180, 90] };
  var MOVES = {
    punch: { start: 0.06, active: 0.08, rec: 0.12, dmg: 5, reach: 17, stun: 0.22, kb: 36, meter: 6, y: -24 },
    kick: { start: 0.12, active: 0.1, rec: 0.2, dmg: 9, reach: 25, stun: 0.3, kb: 64, meter: 9, y: -10 }
  };
  var FEATURES = ["special", "versus", "rage"];

  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(a, b, c) { var n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; n = (n ^ (n >>> 13)) * 1103515245 | 0; return (((n ^ (n >>> 16)) >>> 0) % 65536) / 65536; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shade(c, k) { return [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  K.kit.define("fighter", {
    defaults: { title: "Dövüş", theme: "street", hero: "brawler", rival: "ninja", color: "red", difficulty: 3, rounds: 2, time: 60, music: "fighter", world: { seed: 1 }, width: 640, height: 400, features: [] },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (!TYPES[spec.hero]) errors.push("bilinmeyen dövüşçü: " + spec.hero + " (var olanlar: " + Object.keys(TYPES).join(", ") + ")");
      if (!TYPES[spec.rival]) errors.push("bilinmeyen rakip: " + spec.rival + " (var olanlar: " + Object.keys(TYPES).join(", ") + ")");
      if (!COLORS[spec.color]) errors.push("bilinmeyen renk: " + spec.color + " (var olanlar: " + Object.keys(COLORS).join(", ") + ")");
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      if (typeof spec.rounds !== "number" || spec.rounds < 1 || spec.rounds > 5) errors.push("rounds 1-5 olmalı");
      if (typeof spec.time !== "number" || spec.time < 20 || spec.time > 99) errors.push("time 20-99 saniye olmalı");
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var seed = (spec.world && spec.world.seed) || 1, theme = THEMES[spec.theme], d = spec.difficulty, tune = spec.music, feats = spec.features || [], rnd = rng(seed * 97 + 3);
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      var heroCol = COLORS[spec.color], rivalCol = spec.color === "red" ? COLORS.blue : spec.hero === spec.rival && spec.color === "blue" ? COLORS.red : spec.color === "yellow" || spec.color === "green" ? COLORS.red : COLORS.green;
      var state = { g: g, spec: spec, f: [], fire: [], parts: [], round: 1, wins: [0, 0], need: spec.rounds, phase: "intro", phaseT: 1.6, clock: spec.time, over: false, won: false, message: "", messageT: 0, time: 0, shake: 0, flash: 0, hasSpecial: feats.indexOf("special") >= 0, hasVersus: feats.indexOf("versus") >= 0, hasRage: feats.indexOf("rage") >= 0, slow: 0 };
      state.menu = { open: K.fighter.menuAtStart !== false, kind: "main", index: 0, started: false }; state.paused = state.menu.open; state.musicOn = true;
      state.say = function (t, s) { state.message = t; state.messageT = s || 1.6; };
      function fighter(side, type, color) { var def = TYPES[type]; return { side: side, type: type, def: def, color: color, x: side === 0 ? 100 : 220, y: FLOOR, vx: 0, vy: 0, face: side === 0 ? 1 : -1, hp: def.hp, maxHp: def.hp, meter: 0, st: "idle", t: 0, move: null, hit: false, stun: 0, block: false, combo: 0, comboT: 0, anim: 0, ai: { cd: 0.5, think: 0, block: 0, plan: "approach" }, grounded: true }; }
      state.setupRound = function () {
        var a = state.f[0], b = state.f[1];
        [a, b].forEach(function (f, i) { f.x = i === 0 ? 100 : 220; f.y = FLOOR; f.vx = f.vy = 0; f.face = i === 0 ? 1 : -1; f.hp = f.maxHp; f.meter = 0; f.st = "idle"; f.t = 0; f.move = null; f.hit = false; f.stun = 0; f.block = false; f.combo = 0; f.comboT = 0; f.grounded = true; f.ai.cd = 0.6; f.ai.block = 0; });
        state.fire = []; state.clock = spec.time; state.phase = "intro"; state.phaseT = 1.6; state.slow = 0; state.say("ROUND " + state.round, 1.4);
      };
      state.reset = function () {
        state.f = [fighter(0, spec.hero, heroCol), fighter(1, spec.rival, rivalCol)]; state.wins = [0, 0]; state.round = 1; state.over = false; state.won = false; state.time = 0; state.parts = []; state.messageT = 0;
        state.setupRound(); if (g.current !== "play") g.go("play");
      };
      state.start = function () { state.reset(); if (tune && state.musicOn) K.music.play(tune); };

      // ---- the fighting ----
      function other(f) { return state.f[1 - f.side]; }
      state.canAct = function (f) { return f.st === "idle" || f.st === "walk" || f.st === "block"; };
      state.attack = function (f, kind) {
        var m = MOVES[kind]; if (!m || !state.canAct(f) || state.phase !== "fight") return false;
        f.st = "attack"; f.move = kind; f.t = 0; f.hit = false; f.block = false; if (f.grounded) f.vx = 0; K.sfx("click"); return true;
      };
      state.special = function (f) {
        if (!state.hasSpecial || !state.canAct(f) || f.meter < 50 || state.phase !== "fight") return false;
        f.meter -= 50; f.st = "attack"; f.move = "special"; f.t = 0; f.hit = true; f.vx = 0; K.sfx("fire");
        state.fire.push({ x: f.x + f.face * 14, y: f.y - 24, vx: f.face * 150, owner: f.side, life: 2.2, dmg: 12 * f.def.dmg }); return true;
      };
      function hurtbox(f) { var w = f.def.wide ? 9 : 7; return { x0: f.x - w, x1: f.x + w, y0: f.y - 36, y1: f.y }; }
      state.damage = function (att, def, dmg, stun, kb, strike) {
        if (def.st === "ko") return false;
        var blocked = def.st === "block";
        var scale = 1; if (att.combo > 0 && att.comboT > 0) scale += 0.08 * Math.min(att.combo, 6); if (state.hasRage && att.hp < att.maxHp * 0.25) scale *= 1.3;
        var amount = Math.max(1, Math.round(dmg * att.def.dmg * (blocked ? 0.2 : scale)));
        def.hp -= amount; att.meter = Math.min(100, att.meter + (strike ? strike.meter : 8)); def.meter = Math.min(100, def.meter + 4);
        if (blocked) { def.vx = att.face * kb * 0.4; K.sfx("hit"); state.parts.push({ x: def.x + att.face * -8, y: def.y - 22, vx: att.face * 20, vy: -20, life: 0.2, c: [200, 220, 255] }); }
        else {
          att.combo = (att.comboT > 0 ? att.combo : 0) + 1; att.comboT = 1; def.combo = 0; def.st = "hit"; def.t = 0; def.stun = stun; def.move = null; def.block = false; def.vx = att.face * kb; if (!def.grounded) def.vy = -40;
          state.shake = 0.12; K.sfx("boom"); for (var i = 0; i < 6; i++) state.parts.push({ x: def.x, y: def.y - 24, vx: (rnd() - 0.5) * 90 + att.face * 40, vy: (rnd() - 0.8) * 70, life: 0.3, c: [255, 240, 160] });
          if (att.combo >= 3) state.say(att.combo + " HIT!", 0.9);
        }
        if (def.hp <= 0) { def.hp = 0; ko(def, att); }
        return !blocked;
      };
      function ko(def, att) {
        def.st = "ko"; def.t = 0; def.vx = att.face * 80; def.vy = -90; def.grounded = false; state.phase = "ko"; state.phaseT = 2.4; state.slow = 1.2; state.flash = 0.25; state.wins[att.side]++; K.sfx("boom");
      }
      function endByTime() {
        var a = state.f[0], b = state.f[1]; if (state.phase !== "fight") return; var win = a.hp === b.hp ? (rnd() < 0.5 ? a : b) : a.hp > b.hp ? a : b;
        state.wins[win.side]++; state.phase = "ko"; state.phaseT = 2.4; state.say("SÜRE BİTTİ", 1.8); K.sfx("hit");
      }
      function nextRound() {
        if (state.wins[0] >= state.need || state.wins[1] >= state.need) { state.over = true; state.won = state.wins[0] >= state.need; K.music.stop(); K.sfx(state.won ? "coin" : "hit"); return; }
        state.round++; state.setupRound();
      }

      // ---- inputs ----
      var tapped = {}, tap = function (k) { var dd = K.key(k), hit = dd && !tapped[k]; tapped[k] = dd; return hit; };
      function keyOf(side) {
        return side === 0 ? { left: ["a"], right: ["d"], up: ["w"], punch: "j", kick: "k", block: ["l"], special: "u" } : { left: ["ArrowLeft"], right: ["ArrowRight"], up: ["ArrowUp"], punch: "n", kick: "m", block: [","], special: "." };
      }
      function human(f, dt) {
        var k = keyOf(f.side), left = k.left.some(function (x) { return K.key(x); }), right = k.right.some(function (x) { return K.key(x); }), up = k.up.some(function (x) { return K.key(x); }), blk = k.block.some(function (x) { return K.key(x); });
        control(f, (right ? 1 : 0) - (left ? 1 : 0), up, blk, dt);
        if (tap(k.punch)) state.attack(f, "punch"); if (tap(k.kick)) state.attack(f, "kick"); if (tap(k.special)) state.special(f);
      }
      function control(f, dir, jump, blk, dt) {
        if (state.canAct(f)) {
          f.block = blk && f.grounded; f.st = f.block ? "block" : dir ? "walk" : "idle";
          if (f.grounded) { f.vx = f.block ? 0 : dir * f.def.spd; if (jump && !f.block) { f.vy = -f.def.jump; f.grounded = false; f.st = "jump"; } }
          else f.vx = dir * f.def.spd * 0.8;
        }
      }

      // ---- the opponent ----
      function think(f, dt) {
        var foe = other(f), dx = foe.x - f.x, dist = Math.abs(dx), ai = f.ai, skill = d, reach = 26 + f.def.reach;
        ai.cd -= dt; ai.block = Math.max(0, ai.block - dt);
        if (f.ai.off) { if (state.canAct(f)) control(f, 0, false, f.ai.hold === "block", dt); return; }   // (the tests hold it still)
        if (!state.canAct(f)) return;
        var dir = 0, jump = false, blk = false;
        var threat = foe.st === "attack" && foe.move !== "special" && dist < 40, fire = state.fire.some(function (b) { return b.owner !== f.side && Math.abs(b.x - f.x) < 60; });
        if ((threat || fire) && ai.block <= 0 && rnd() < 0.25 + 0.14 * skill) ai.block = 0.35 + rnd() * 0.3;
        if (ai.block > 0) blk = true;
        else if (dist > reach - 4) { dir = Math.sign(dx) * (rnd() < 0.15 ? 0 : 1); if (dist > 90 && state.hasSpecial && f.meter >= 50 && ai.cd <= 0 && rnd() < 0.5) { state.special(f); ai.cd = 1.2; return; } if (dist > 70 && rnd() < 0.004 * skill) jump = true; }
        else {
          if (dist < reach - 14) dir = -Math.sign(dx) * (rnd() < 0.4 ? 1 : 0);
          if (ai.cd <= 0) { ai.cd = Math.max(0.18, 1.1 - 0.17 * skill) + rnd() * 0.5; if (foe.st === "hit" || foe.st === "ko") ai.cd *= 0.5; var kind = rnd() < 0.55 ? "punch" : "kick"; if (dist > 20 + f.def.reach && kind === "punch") kind = "kick"; f.face = Math.sign(dx) || f.face; if (rnd() < 0.55 + 0.08 * skill) { control(f, 0, false, false, dt); state.attack(f, kind); return; } }
          else if (rnd() < 0.01) blk = true;
        }
        control(f, dir, jump, blk, dt);
      }

      // ---- one step ----
      function stepFighter(f, dt) {
        var foe = other(f); f.anim += dt; f.comboT = Math.max(0, f.comboT - dt); if (f.comboT <= 0) f.combo = 0;
        if (f.st === "ko") { f.vy += 420 * dt; f.x += f.vx * dt; f.y = Math.min(FLOOR, f.y + f.vy * dt); if (f.y >= FLOOR) { f.y = FLOOR; f.vx *= 0.8; f.grounded = true; } f.x = clamp(f.x, LEFT, RIGHT); return; }
        if (f.st === "hit") { f.stun -= dt; f.x += f.vx * dt; f.vx *= Math.pow(0.02, dt); if (f.stun <= 0) { f.st = "idle"; f.vx = 0; } }
        else if (f.st === "attack") {
          f.t += dt; var m = f.move === "special" ? { start: 0.1, active: 0, rec: 0.3 } : MOVES[f.move];
          if (f.move !== "special" && f.t >= m.start && f.t < m.start + m.active && !f.hit) {
            var reach = m.reach + f.def.reach, hb = hurtbox(foe), x0 = f.face > 0 ? f.x : f.x - reach - 6, x1 = f.face > 0 ? f.x + reach + 6 : f.x, y = f.y + m.y;
            if (x1 >= hb.x0 && x0 <= hb.x1 && y - 5 <= hb.y1 && y + 5 >= hb.y0) { f.hit = true; state.damage(f, foe, m.dmg, m.stun, m.kb, m); }
          }
          if (f.t >= m.start + m.active + m.rec) { f.st = "idle"; f.move = null; }
          if (f.grounded) f.vx *= 0.8;
        }
        if (!f.grounded) { f.vy += 520 * dt; f.y += f.vy * dt; if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; f.grounded = true; if (f.st === "jump") f.st = "idle"; } }
        f.x = clamp(f.x + (f.st === "hit" ? 0 : f.vx * dt), LEFT, RIGHT);
        if (f.st !== "attack" && f.st !== "hit" && f.grounded) { f.face = foe.x >= f.x ? 1 : -1; }
        var gap = 12; if (Math.abs(f.x - foe.x) < gap && f.grounded && foe.grounded) { var push = (gap - Math.abs(f.x - foe.x)) / 2 + 0.2; f.x -= Math.sign(foe.x - f.x || 1) * push; f.x = clamp(f.x, LEFT, RIGHT); }
      }
      state.step = function (dt) {
        if (!state.f.length || state.paused) return;
        state.messageT = Math.max(0, state.messageT - dt); state.shake = Math.max(0, state.shake - dt); state.flash = Math.max(0, state.flash - dt);
        state.parts = state.parts.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.life > 0; });
        if (state.over) return;
        if (state.slow > 0) { state.slow -= dt; dt *= 0.35; }
        state.time += dt;
        if (state.phase === "intro") { state.phaseT -= dt; state.f.forEach(function (f) { f.anim += dt; }); if (state.phaseT <= 0) { state.phase = "fight"; state.say("DÖVÜŞ!", 0.9); K.sfx("coin"); } return; }
        if (state.phase === "ko") { state.phaseT -= dt; state.f.forEach(function (f) { stepFighter(f, dt); }); if (state.phaseT <= 0) nextRound(); return; }
        state.clock -= dt; if (state.clock <= 0) { state.clock = 0; endByTime(); }
        human(state.f[0], dt); if (state.hasVersus) human(state.f[1], dt); else think(state.f[1], dt);
        state.f.forEach(function (f) { stepFighter(f, dt); });
        state.fire.forEach(function (b) {
          b.x += b.vx * dt; b.life -= dt; var tgt = state.f[1 - b.owner], hb = hurtbox(tgt);
          if (b.x >= hb.x0 - 3 && b.x <= hb.x1 + 3 && b.y >= hb.y0 && b.y <= hb.y1 && tgt.st !== "ko") { b.life = 0; state.damage(state.f[b.owner], tgt, b.dmg, 0.4, 90, { meter: 4 }); }
          if (b.x < 0 || b.x > VW) b.life = 0;
        });
        state.fire = state.fire.filter(function (b) { return b.life > 0; });
      };

      // ---- the menus ----
      var CONTROLS = ["A D  yürü      W  zıpla      J  yumruk      K  tekme      L  blok (basılı tut)      U  özel hareket (özel çubuğu yarıdan çoksa, special özelliği)", "İkinci oyuncu (versus): oklar yürü ve zıpla      N yumruk      M tekme      virgül blok      nokta özel", "R  yeniden başla      Esc  menü.   Rakibin canını bitir ya da süre bitince canı çok olan turu alır."];
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.paused = true; };
      state.closeMenu = function () { state.menu.open = false; state.menu.started = true; state.paused = false; };
      state.toggleMusic = function () { state.musicOn = !state.musicOn; if (state.musicOn) { if (tune) K.music.play(tune); } else K.music.stop(); };
      state.menuItems = function () {
        var m = state.menu, music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic }, controls = { label: "Kontroller", act: function () { m.back = m.kind; m.kind = "controls"; m.index = 0; } };
        if (m.kind === "main") return [{ label: m.started ? "Devam et" : "Dövüşe başla", act: state.closeMenu }, controls, music];
        return [{ label: "Devam et", act: state.closeMenu }, controls, music, { label: "Baştan başla", act: function () { state.reset(); state.closeMenu(); } }, { label: "Ana menü", act: function () { state.openMenu("main"); } }];
      };
      var rowY = function (n) { return g.height / 2 - n * 22 + 10; };
      state.menuClick = function () {
        var m = state.menu; if (!m.open) return false;
        if (m.kind === "controls") { m.kind = m.back || "main"; m.index = 0; return true; }
        var items = state.menuItems(), i = Math.floor((K.mouse.y - rowY(items.length)) / 44);
        if (K.mouse.x > g.width / 2 - 150 && K.mouse.x < g.width / 2 + 150 && i >= 0 && i < items.length) { m.index = i; items[i].act(); }
        return true;
      };
      state.menuUpdate = function () {
        var m = state.menu;
        if (m.kind === "controls") { if (tap("Escape") || tap("Enter") || tap(" ")) { m.kind = m.back || "main"; m.index = 0; } return; }
        var items = state.menuItems();
        if (K.mouse && K.mouse.y) { var hv = Math.floor((K.mouse.y - rowY(items.length)) / 44); if (K.mouse.x > g.width / 2 - 150 && K.mouse.x < g.width / 2 + 150 && hv >= 0 && hv < items.length && state.hoverY !== K.mouse.y) { m.index = hv; state.hoverY = K.mouse.y; } }   // the mouse chooses a row
        if (tap("ArrowUp") || tap("w")) m.index = (m.index + items.length - 1) % items.length;
        if (tap("ArrowDown") || tap("s")) m.index = (m.index + 1) % items.length;
        if (tap("Enter") || tap(" ")) items[Math.min(m.index, items.length - 1)].act();
        if (tap("Escape") && m.kind === "pause") state.closeMenu();
      };

      // ---- the picture ----
      var small = null, sc = null, bg = null;
      function buildBg() {
        var cv = document.createElement("canvas"); cv.width = VW; cv.height = VH; var c = cv.getContext("2d"), y, x;
        for (y = 0; y < FLOOR; y++) { var k = y / FLOOR, band = k < 0.45 ? 0 : k < 0.75 ? 1 : 2; c.fillStyle = rgb(theme.sky[band]); c.fillRect(0, y, VW, 1); if (y % 4 === 0 && band > 0) { c.fillStyle = rgb(shade(theme.sky[band], 1.05)); c.fillRect(0, y, VW, 1); } }
        var r2 = rng(seed * 7 + 1);
        for (x = 0; x < VW; x += 8) { var h = 30 + Math.floor(r2() * 34); c.fillStyle = rgb(theme.far); c.fillRect(x, FLOOR - 40 - h, 8, h + 8); }
        if (theme.deco === "buildings") for (x = 6; x < VW; x += 36) { var bh = 50 + Math.floor(r2() * 40); c.fillStyle = rgb(theme.near); c.fillRect(x, FLOOR - bh, 28, bh); c.fillStyle = "rgba(255,230,140,0.7)"; for (var wy = FLOOR - bh + 6; wy < FLOOR - 8; wy += 10) for (var wx = x + 4; wx < x + 24; wx += 8) if (hash(wx, wy, seed) > 0.4) c.fillRect(wx, wy, 3, 4); }
        else if (theme.deco === "pillars") for (x = 14; x < VW; x += 58) { c.fillStyle = rgb(theme.near); c.fillRect(x, FLOOR - 92, 12, 92); c.fillStyle = rgb(shade(theme.near, 1.2)); c.fillRect(x - 3, FLOOR - 96, 18, 6); c.fillRect(x - 3, FLOOR - 4, 18, 4); }
        else if (theme.deco === "lanterns") for (x = 30; x < VW; x += 70) { c.fillStyle = "#3a2418"; c.fillRect(x + 4, 0, 1, 40 + (x % 3) * 8); c.fillStyle = "#e8503a"; c.fillRect(x, 40 + (x % 3) * 8, 9, 12); c.fillStyle = "#ffd070"; c.fillRect(x + 2, 44 + (x % 3) * 8, 5, 4); }
        else { for (x = 0; x < VW; x += 10) { c.fillStyle = hash(x, 3, seed) > 0.5 ? "#ff8a2a" : "#ffb040"; c.fillRect(x, FLOOR - 10 - Math.floor(hash(x, 1, seed) * 8), 10, 20); } }
        for (y = FLOOR; y < VH; y++) for (x = 0; x < VW; x += 16) { c.fillStyle = rgb(theme.floor[((x >> 4) + ((y - FLOOR) >> 3)) % 2]); c.fillRect(x, y, 16, 1); }
        c.fillStyle = rgb(theme.line); c.fillRect(0, FLOOR, VW, 2); for (x = 0; x < VW; x += 32) c.fillRect(x, FLOOR + 2, 1, VH - FLOOR);
        bg = cv; small = document.createElement("canvas"); small.width = VW; small.height = VH; sc = small.getContext("2d");
      }
      function R(c, f, x, y, w, h, col) { var px = f.face > 0 ? Math.round(f.x + x) : Math.round(f.x - x - w); c.fillStyle = rgb(col); c.fillRect(px, Math.round(f.y + y), w, h); }
      function drawFighter(c, f) {
        var def = f.def, skin = [236, 190, 150], shirt = f.color, pants = shade(f.color, 0.45), dark = [30, 26, 34], flash = f.st === "hit" && Math.floor(f.t * 30) % 2, w = def.wide ? 8 : 6, sw = def.wide ? 9 : 7;
        c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(Math.round(f.x - 9), FLOOR + 1, 18, 3);
        if (flash) { shirt = [255, 255, 255]; skin = [255, 255, 255]; pants = [230, 230, 230]; }
        if (f.st === "ko") {
          var gy = f.grounded ? -6 : -18; R(c, f, -16, gy, 22, 6, shirt); R(c, f, 6, gy - 1, 8, 8, skin); R(c, f, -22, gy + 1, 8, 5, pants); R(c, f, 8, gy + 2, 3, 2, dark); return;
        }
        var walk = f.st === "walk" ? Math.floor(f.anim * 8) % 2 : 0, bob = f.st === "idle" ? Math.floor(f.anim * 3) % 2 : 0, lean = f.st === "hit" ? -3 : f.st === "attack" && f.move === "kick" ? -2 : 0, air = !f.grounded;
        var hy = -36 + bob;
        R(c, f, -sw + lean, -16 + (air ? -2 : 0), 5, 16 + (air ? -8 : 0), pants); R(c, f, 2 + lean + (walk ? 2 : 0), -16 + (air ? -2 : 0), 5, 16 + (air ? -8 : 0), pants);   // legs
        if (f.st === "attack" && f.move === "kick") { var kk = f.t < 0.12 ? 8 : 22 + def.reach; R(c, f, 2, -12, kk, 5, pants); R(c, f, 2 + kk, -13, 5, 7, dark); }
        else { R(c, f, -sw + lean, -2, 6, 2, dark); R(c, f, 2 + lean + (walk ? 2 : 0), -2, 6, 2, dark); }
        R(c, f, -sw + lean, -30 + bob, sw * 2, 15, shirt); R(c, f, -sw + lean, -17 + bob, sw * 2, 2, shade(shirt, 0.6));   // body and belt
        R(c, f, -w + 1 + lean, hy + bob * 0, w * 2 - 2, 8, skin);   // head
        R(c, f, -w + 1 + lean, hy, w * 2 - 2, 3, def.hair); if (def.band) R(c, f, -w + 1 + lean, hy + 3, w * 2 - 2, 2, [240, 240, 240]); if (def.mask) R(c, f, -w + 1 + lean, hy + 4, w * 2 - 2, 4, [40, 40, 52]);
        R(c, f, 1 + lean, hy + 4, 2, 2, def.mask ? [255, 255, 255] : dark);   // an eye
        if (f.st === "attack" && f.move === "punch") { var pr = f.t < 0.06 ? 6 : 16 + def.reach; R(c, f, 4, -28, pr, 4, skin); R(c, f, 4 + pr, -29, 5, 6, f.color); }
        else if (f.st === "block") { R(c, f, 4, -34, 4, 18, skin); R(c, f, 8, -36, 3, 22, [200, 220, 255]); }
        else if (f.st === "attack" && f.move === "special") { R(c, f, 4, -28, 10, 4, skin); R(c, f, 14, -30, 6, 8, [255, 160, 60]); }
        else if (f.st === "kick") { }
        else { R(c, f, 4 + lean, -27, 6, 4, skin); R(c, f, 8 + lean, -28, 4, 6, f.color); R(c, f, -sw - 3 + lean, -26, 4, 8, skin); }
      }
      function drawWorld(c) {
        var sx = state.shake > 0 ? Math.round((rnd() - 0.5) * 4) : 0, sy = state.shake > 0 ? Math.round((rnd() - 0.5) * 3) : 0;
        c.imageSmoothingEnabled = false; c.save(); c.translate(sx, sy); c.drawImage(bg, 0, 0);
        state.f.slice().sort(function (a, b) { return (a.st === "ko" ? -1 : 0) - (b.st === "ko" ? -1 : 0); }).forEach(function (f) { drawFighter(c, f); });
        state.fire.forEach(function (b) { c.fillStyle = "#ffb040"; c.fillRect(Math.round(b.x) - 3, Math.round(b.y) - 3, 7, 7); c.fillStyle = "#fff0a0"; c.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3); c.fillStyle = "rgba(255,140,40,0.6)"; c.fillRect(Math.round(b.x) - 9 * Math.sign(b.vx) - 2, Math.round(b.y) - 2, 5, 5); });
        state.parts.forEach(function (p) { c.fillStyle = rgb(p.c); c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); });
        c.restore(); if (state.flash > 0) { c.fillStyle = "rgba(255,255,255," + Math.min(0.5, state.flash * 2) + ")"; c.fillRect(0, 0, VW, VH); }
      }
      function drawHud(c) {
        var W = g.width, H = g.height, a = state.f[0], b = state.f[1], bw = W / 2 - 60;
        var bar = function (x, f, rev) { c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x, 10, bw, 18); c.fillStyle = "#3a1018"; c.fillRect(x + 3, 13, bw - 6, 12); var wdt = Math.round((bw - 6) * f.hp / f.maxHp); c.fillStyle = f.hp > f.maxHp * 0.3 ? "#f0c030" : "#e83a3a"; c.fillRect(rev ? x + bw - 3 - wdt : x + 3, 13, wdt, 12); if (state.hasSpecial) { c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(x, 30, bw * 0.6, 8); c.fillStyle = f.meter >= 50 ? "#4fc3f7" : "#2a6a8a"; var mw = Math.round((bw * 0.6 - 4) * f.meter / 100); c.fillRect(rev ? x + bw - 2 - mw - (bw * 0.4) : x + 2, 32, mw, 4); } };
        bar(14, a, false); bar(W - 14 - bw, b, true);
        c.textAlign = "center"; c.fillStyle = "#fff"; c.font = "bold 22px sans-serif"; c.fillText(String(Math.ceil(state.clock)), W / 2, 30);
        c.font = "bold 12px sans-serif"; c.fillText(state.wins[0] + " - " + state.wins[1], W / 2, 46); c.textAlign = "left"; c.font = "bold 11px sans-serif"; c.fillStyle = "#fff"; c.fillText(a.def.name.toUpperCase() + (state.hasVersus ? " (1)" : ""), 18, 50); c.textAlign = "right"; c.fillText(b.def.name.toUpperCase() + (state.hasVersus ? " (2)" : ""), W - 18, 50); c.textAlign = "left";
        if (a.combo >= 2 && a.comboT > 0) { c.fillStyle = "#ffd54f"; c.font = "bold 18px sans-serif"; c.fillText(a.combo + " KOMBO", 18, 80); }
        if (state.messageT > 0) { c.textAlign = "center"; c.fillStyle = "#ffe082"; c.font = "bold 34px sans-serif"; c.fillText(state.message, W / 2, H / 2 - 20); c.textAlign = "left"; }
        if (state.phase === "ko" && state.f.some(function (f) { return f.st === "ko"; })) { c.textAlign = "center"; c.fillStyle = "#ff5252"; c.font = "bold 56px sans-serif"; c.fillText("K.O.", W / 2, H / 2); c.textAlign = "left"; }
        if (state.over) {
          c.fillStyle = "rgba(0,0,0,0.74)"; c.fillRect(W / 2 - 150, H / 2 - 80, 300, 160); c.textAlign = "center"; c.fillStyle = state.won ? "#ffd54f" : "#fff"; c.font = "bold 28px sans-serif";
          c.fillText(state.hasVersus ? (state.won ? "1. OYUNCU KAZANDI" : "2. OYUNCU KAZANDI") : (state.won ? "KAZANDIN!" : "KAYBETTİN"), W / 2, H / 2 - 30); c.font = "bold 24px sans-serif"; c.fillStyle = "#fff"; c.fillText(state.wins[0] + " - " + state.wins[1], W / 2, H / 2 + 10); c.fillStyle = "#b0bec5"; c.font = "13px sans-serif"; c.fillText("R: yeniden dövüş", W / 2, H / 2 + 54); c.textAlign = "left";
        }
      }
      function drawMenu(c) {
        var m = state.menu, W = g.width, H = g.height; c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, W, H); c.textAlign = "center";
        c.fillStyle = "#fff"; c.font = "bold 34px sans-serif"; c.fillText(m.kind === "main" ? (spec.title || "Dövüş") : m.kind === "controls" ? "Kontroller" : "Duraklatıldı", W / 2, 70);
        if (m.kind === "controls") { c.font = "12px sans-serif"; c.fillStyle = "#e0e0e0"; CONTROLS.forEach(function (t, i) { c.fillText(t, W / 2, 140 + i * 34); }); c.fillStyle = "#ffd54f"; c.fillText("Esc ya da tık: geri", W / 2, H - 40); c.textAlign = "left"; return; }
        var items = state.menuItems();
        items.forEach(function (it, i) { var y = rowY(items.length) + i * 44 - 4, on = i === m.index; c.fillStyle = on ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.08)"; c.fillRect(W / 2 - 150, y, 300, 38); c.strokeStyle = on ? "#ffd54f" : "rgba(255,255,255,0.2)"; c.strokeRect(W / 2 - 150, y, 300, 38); c.fillStyle = on ? "#ffd54f" : "#fff"; c.font = "bold 17px sans-serif"; c.fillText(it.label, W / 2, y + 25); });
        c.font = "12px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla", W / 2, H - 30); c.textAlign = "left";
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined" || g.current !== "play" || !state.f.length) return;
        if (!bg) buildBg();
        drawWorld(sc); c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        if (!(state.menu.open && state.menu.kind === "main")) drawHud(c); if (state.menu.open) drawMenu(c);
      } }];
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) g.canvas.addEventListener("mousedown", function (e) { if (e.button === 0 && state.menu.open) state.menuClick(); });
      g.scene("play", { update: function (game, dt) {
        if (state.menu.open) { state.menuUpdate(); return; }
        if (tap("Escape")) { state.openMenu("pause"); return; }
        if (tap("r")) { state.reset(); if (tune && state.musicOn) K.music.play(tune); return; }
        state.step(dt);
      } });
      state.expose = { g: g, spec: spec, state: state, get p() { return state.f[0]; } };
      return state;
    }
  });

  K.fighter = { themes: Object.keys(THEMES), types: Object.keys(TYPES), colors: Object.keys(COLORS), features: FEATURES, moves: MOVES, menuAtStart: true };
  K.feature.define("special", { kits: ["fighter"], options: {}, apply: function (s) { s.hasSpecial = true; } });
  K.feature.define("versus", { kits: ["fighter"], options: {}, apply: function (s) { s.hasVersus = true; } });
  K.feature.define("rage", { kits: ["fighter"], options: {}, apply: function (s) { s.hasRage = true; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
