/* kgame.football.js: yukarıdan görünümlü 2 boyutlu piksel futbol kiti (football). Model yalnızca bir özet yazar:
   K.kit.run({ kit:'football', title:'Mahalle Maçı', theme:'grass', teamSize:5, duration:120, difficulty:3, home:'red', away:'blue', keeper:true, music:'overworld', world:{seed:3}, features:['powershot'] })
   Kit; tek maç kurar: iki takım (kaleci, defans, orta saha, forvet dizilişi takım büyüklüğünden gelir), sahayı (şeritli çim, çizgiler, ağlı kaleler) ve yapay zekâyı (top taşıma, pas, şut, pres, kaleci, kademe) kendisi yazar.
   Resim küçük (320x200 piksel) tuvalde keskin çizilip tam sayı katıyla büyütülür, bulanıklık yok. Berabere biterse altın gol uzatması oynanır.
   Kontroller: W A S D ya da oklar koşar (topa en yakın oyuncuyu sen yönetirsin), Shift sprint, Boşluk şut (basılı tut: güç), E ya da K pas, Q oyuncu değiştir, R yeniden, Esc menü. Özellikler: powershot, sprint.
   Önce kgame.js, kgame.kits.js ve kgame.audio2.js yüklenmiş olmalı. Her şey kodla çizilir (görsel dosya yok). */
(function (root) {
  var K = root.K;
  var VW = 320, VH = 200, M = 24, PW = 640, PH = 360, GOAL = 80, NET = 16, WW = PW + 2 * M, WH = PH + 2 * M;   // the pitch is PW x PH pixels with a margin of M all round
  var THEMES = {
    grass: { a: [64, 134, 70], b: [58, 124, 64], line: [236, 240, 230], out: [40, 90, 48], tint: null },
    night: { a: [26, 70, 54], b: [22, 62, 48], line: [200, 210, 200], out: [10, 30, 26], tint: "rgba(6,10,40,0.34)" },
    indoor: { a: [176, 138, 90], b: [166, 128, 82], line: [60, 80, 180], out: [90, 70, 50], tint: null },
    street: { a: [100, 102, 110], b: [94, 96, 104], line: [230, 230, 200], out: [60, 60, 66], tint: null }
  };
  var COLORS = { red: [214, 40, 40], blue: [50, 100, 224], yellow: [240, 200, 40], green: [50, 184, 84], white: [236, 236, 240], black: [44, 44, 52], orange: [240, 130, 30], purple: [150, 60, 200] };
  var FEATURES = ["powershot", "sprint"];
  var SPEED = 74, RUN = 1.45, PR = 6;

  function rng(seed) { var a = (seed | 0) + 0x6D2B79F5; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(a, b, c) { var n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; n = (n ^ (n >>> 13)) * 1103515245 | 0; return (((n ^ (n >>> 16)) >>> 0) % 65536) / 65536; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function shade(c, k) { return [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  // ---- the line-up: the places of a team, from its own goal (fx 0) to the other (fx 1), across (fy 0..1) ----
  function formation(n, keeper) {
    var out = [], m = n - (keeper ? 1 : 0), d = m <= 1 ? 0 : Math.round(m * 0.38), f = m <= 2 ? (m >= 1 ? 1 : 0) : Math.max(1, Math.round(m * 0.26)), mid = m - d - f, i;
    if (keeper) out.push({ role: "keeper", fx: 0.02, fy: 0.5 });
    var line = function (count, fx, role) { for (i = 0; i < count; i++) out.push({ role: role, fx: fx, fy: count === 1 ? 0.5 : 0.14 + 0.72 * i / (count - 1) }); };
    line(d, 0.24, "def"); line(mid, 0.46, "mid"); line(f, 0.70, "fwd");
    return out;
  }

  // ---- pixel art made by code ----
  var BODY = ["...hhhh...", "..hhhhhh..", "..ssssss..", "..sskkss..", "...ssss...", ".bbbbbbbb.", "abbbbbbbba", "abbbbbbbba", ".bbbbbbbb.", "..dddddd..", "..dd..dd.."];
  var LEGS = [["..ss..ss..", "..ll..ll..", ".kkk..kkk."], [".ss....ss.", ".ll....ll.", "kkk....kkk"]];
  var BALL = ["..kkkk..", ".kwwwwk.", "kwwkkwwk", "kwkwwkwk", "kwkwwkwk", "kwwkkwwk", ".kwwwwk.", "..kkkk.."];
  function drawRows(c, rows, pal, x, y) { for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) { var cc = pal[rows[j].charAt(i)]; if (cc) { c.fillStyle = rgb(cc); c.fillRect(x + i, y + j, 1, 1); } } }
  function playerSheet(shirt, keeper) {   // two running frames, drawn once for a colour
    var pal = { h: [60, 40, 26], s: [236, 188, 150], k: [30, 30, 36], b: shirt, a: keeper ? [250, 250, 250] : [236, 188, 150], d: shade(shirt, 0.45), l: [236, 236, 240], },
      out = [];
    for (var f = 0; f < 2; f++) { var cv = document.createElement("canvas"); cv.width = 10; cv.height = 14; var c = cv.getContext("2d"); drawRows(c, BODY.concat(LEGS[f]), pal, 0, 0); out.push(cv); }
    return out;
  }
  function circle(c, cx, cy, r) { for (var a = 0; a < 6.2832; a += 0.5 / r) c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }

  K.kit.define("football", {
    defaults: { title: "Futbol", theme: "grass", teamSize: 5, duration: 120, difficulty: 3, home: "red", away: "blue", keeper: true, music: "football", world: { seed: 1 }, width: 640, height: 400, features: [] },

    check: function (spec) {
      var errors = [], ms = spec.musicStyle;
      if (!THEMES[spec.theme]) errors.push("bilinmeyen tema: " + spec.theme + " (var olanlar: " + Object.keys(THEMES).join(", ") + ")");
      if (!COLORS[spec.home]) errors.push("bilinmeyen takım rengi: " + spec.home + " (var olanlar: " + Object.keys(COLORS).join(", ") + ")");
      if (!COLORS[spec.away]) errors.push("bilinmeyen takım rengi: " + spec.away + " (var olanlar: " + Object.keys(COLORS).join(", ") + ")");
      if (typeof spec.teamSize !== "number" || spec.teamSize < 2 || spec.teamSize > 8) errors.push("teamSize 2-8 olmalı");
      if (typeof spec.duration !== "number" || spec.duration < 30 || spec.duration > 600) errors.push("duration 30-600 saniye olmalı");
      if (typeof spec.difficulty !== "number" || spec.difficulty < 1 || spec.difficulty > 5) errors.push("difficulty 1-5 olmalı");
      if (ms && ms.mood !== undefined && K.music.moods.indexOf(ms.mood) < 0) errors.push("bilinmeyen müzik ruh hali: " + ms.mood + " (var olanlar: " + K.music.moods.join(", ") + ")");
      if (ms && ms.tempo !== undefined && ["slow", "medium", "fast"].indexOf(ms.tempo) < 0) errors.push("bilinmeyen müzik temposu: " + ms.tempo + " (slow, medium, fast)");
      return errors;
    },

    build: function (spec) {
      var g = K.game({ width: spec.width, height: spec.height, gravity: 0 });
      var seed = (spec.world && spec.world.seed) || 1, theme = THEMES[spec.theme], rnd = rng(seed * 41 + 7), tune = spec.music, feats = spec.features || [], d = spec.difficulty;
      if (spec.musicStyle) { K.music.define("style", K.music.compose(spec.musicStyle)); tune = "style"; }
      var homeCol = COLORS[spec.home], awayCol = spec.away === spec.home ? COLORS[spec.home === "blue" ? "red" : "blue"] : COLORS[spec.away];
      var state = { g: g, spec: spec, players: [], ball: null, holder: null, score: [0, 0], clock: spec.duration, overtime: false, phase: "kickoff", phaseT: 1.2, finished: false, result: "", me: null, message: "", messageT: 0, charge: 0, charging: false, stamina: 1, kickoffTeam: 0, shots: [0, 0], parts: [] };
      state.menu = { open: K.football.menuAtStart !== false, kind: "main", index: 0, started: false }; state.paused = state.menu.open; state.musicOn = true;
      var maxStamina = feats.indexOf("sprint") >= 0 ? 1.7 : 1;
      state.say = function (t, secs) { state.message = t; state.messageT = secs || 2; };

      // ---- the teams ----
      var shape = formation(spec.teamSize, spec.keeper);
      function basePos(p, shift) {   // a player's place: along the pitch from its own goal, pulled forward when the team attacks and back when it defends
        var fx = clamp(p.fx + shift, 0.02, 0.92), x = p.team === 0 ? M + fx * PW : M + (1 - fx) * PW;
        return { x: x, y: M + p.fy * PH };
      }
      function makeTeam(team) {
        return shape.map(function (s, i) { return { team: team, role: s.role, fx: s.fx, fy: s.fy, x: 0, y: 0, vx: 0, vy: 0, face: team === 0 ? 0 : Math.PI, cd: 0, tackleCd: 0, anim: 0, run: false, speedMul: 0.92 + rnd() * 0.12, id: i }; });
      }
      state.setup = function (kickTeam) {
        state.players.forEach(function (p) { var b = basePos(p, 0); p.x = b.x; p.y = b.y; p.vx = p.vy = 0; p.cd = 0.4; p.face = p.team === 0 ? 0 : Math.PI; });
        // the kicking team's forward stands at the ball
        var kicker = state.players.filter(function (p) { return p.team === kickTeam && p.role !== "keeper"; }).sort(function (a, b) { return b.fx - a.fx; })[0];
        if (kicker) { kicker.x = M + PW / 2 + (kickTeam === 0 ? -9 : 9); kicker.y = M + PH / 2; }
        state.ball = { x: M + PW / 2, y: M + PH / 2, vx: 0, vy: 0, h: 0 }; state.holder = null; state.phase = "kickoff"; state.phaseT = 1.1; state.kickoffTeam = kickTeam; state.kickT = 0;
        state.me = state.players.filter(function (p) { return p.team === 0 && p.role !== "keeper"; }).sort(function (a, b) { return Math.hypot(a.x - state.ball.x, a.y - state.ball.y) - Math.hypot(b.x - state.ball.x, b.y - state.ball.y); })[0] || state.players[0];
      };
      state.reset = function () {
        state.players = makeTeam(0).concat(makeTeam(1)); state.score = [0, 0]; state.clock = spec.duration; state.overtime = false; state.finished = false; state.result = ""; state.messageT = 0; state.charge = 0; state.charging = false; state.stamina = maxStamina; state.shots = [0, 0]; state.parts = [];
        state.setup(0); if (g.current !== "play") g.go("play"); state.say("Başla! Topa git, Boşluk: şut, E: pas", 2.5);
      };
      state.start = function () { state.reset(); if (tune && state.musicOn) K.music.play(tune); };

      // ---- the ball ----
      function kick(p, speed, ang, spin) {
        var b = state.ball; b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed; state.holder = null; p.cd = 0.45; p.face = ang;
        b.x = p.x + Math.cos(ang) * (PR + 3); b.y = p.y + Math.sin(ang) * (PR + 3); K.sfx(speed > 230 ? "fire" : "click");
        if (speed > 200) state.shots[p.team]++;
      }
      state.kick = kick;
      function goalCenter(team) { return { x: team === 0 ? M + PW : M, y: M + PH / 2 }; }   // the goal a team attacks
      function shootAt(p, power) {
        var gc = goalCenter(p.team), toGoal = Math.atan2(gc.y - p.y, gc.x - p.x), face = p.face, ang = face;
        var diff = Math.atan2(Math.sin(toGoal - face), Math.cos(toGoal - face));
        if (Math.abs(diff) < 0.6 && Math.abs(gc.x - p.x) < 260) ang = toGoal + (rnd() - 0.5) * (0.5 - 0.07 * d) * (p.team === 0 ? 0.7 : 1) + (p.team === 1 ? 0 : 0);   // a shot near the line to goal is aimed
        kick(p, 210 + power * 190, ang);
      }
      state.shoot = function (p, power) { if (state.holder !== p) return false; shootAt(p, clamp(power, 0, 1)); return true; };
      function passTo(p) {
        var best = null, bs = -1e9;
        state.players.forEach(function (q) {
          if (q === p || q.team !== p.team) return;
          var dx = q.x - p.x, dy = q.y - p.y, dist = Math.hypot(dx, dy); if (dist < 24 || dist > 240) return;
          var diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - p.face), Math.cos(Math.atan2(dy, dx) - p.face)));
          var open = 1; state.players.forEach(function (o) { if (o.team !== p.team) { var od = Math.hypot(o.x - q.x, o.y - q.y); if (od < 22) open -= 0.5; } });
          var score = -diff * 120 - dist * 0.1 + (p.team === 0 ? q.x - p.x : p.x - q.x) * 0.15 + open * 25; if (p.me && diff > 1.1) return;
          if (score > bs) { bs = score; best = q; }
        });
        if (!best) { kick(p, 170, p.face); return false; }
        best.receiveT = 1.2;
        var lead = Math.hypot(best.vx, best.vy) * 0.25, tx = best.x + best.vx * 0.25, ty = best.y + best.vy * 0.25, dist = Math.hypot(tx - p.x, ty - p.y);
        kick(p, clamp(100 + dist * 1.1, 130, 270), Math.atan2(ty - p.y, tx - p.x)); return true;
      }
      state.pass = function (p) { if (state.holder !== p) return false; return passTo(p); };

      // ---- the players ----
      function steer(p, tx, ty, dt, fast, slowNear) {
        var dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy), sp = SPEED * p.speedMul * (fast ? RUN : 1) * (p.team === 1 ? 0.78 + 0.05 * d : 1);
        if (dist < 2) { p.vx *= 0.6; p.vy *= 0.6; return; }
        if (slowNear && dist < 22) sp *= dist / 22;
        var tvx = dx / dist * sp, tvy = dy / dist * sp; p.vx += (tvx - p.vx) * Math.min(1, dt * 9); p.vy += (tvy - p.vy) * Math.min(1, dt * 9); p.face = Math.atan2(p.vy, p.vx); p.run = fast;
      }
      function ownGoal(team) { return goalCenter(1 - team); }
      function ai(p, dt) {
        var b = state.ball, h = state.holder, mine = h && h.team === p.team, opp = h && h.team !== p.team;
        if (p.role === "keeper") {
          var gx = p.team === 0 ? M + 12 : M + PW - 12, danger = (p.team === 0 ? b.x < M + PW * 0.35 : b.x > M + PW * 0.65), ty = clamp(b.y, M + PH / 2 - GOAL / 2 + 4, M + PH / 2 + GOAL / 2 - 4), tx = gx;
          if (danger && Math.hypot(b.x - p.x, b.y - p.y) < 70 && !mine) { tx = b.x; ty = b.y; }
          if (h === p) { if (p.cd <= 0 && state.phase === "play") { p.holdT = (p.holdT || 0) + dt; if (p.holdT > 0.5) { p.holdT = 0; var out = state.players.filter(function (q) { return q.team === p.team && q.role !== "keeper"; }); var q = out[Math.floor(rnd() * out.length)]; kick(p, 230, Math.atan2(q.y - p.y, q.x - p.x)); } } steer(p, gx, M + PH / 2, dt, false, true); return; }
          steer(p, tx, ty, dt, danger, true); return;
        }
        if (h === p) {   // dribble to the goal, go round those in the way, shoot near it, pass when pressed
          var gc = goalCenter(p.team), dist = Math.hypot(gc.x - p.x, gc.y - p.y), tx2 = gc.x, ty2 = gc.y + (p.fy - 0.5) * 40, push = 0;
          state.players.forEach(function (o) { if (o.team !== p.team) { var dd = Math.hypot(o.x - p.x, o.y - p.y); if (dd < 30) { var side = (o.y - p.y) > 0 ? -1 : 1; ty2 += side * (30 - dd) * 1.6; push++; } } });
          steer(p, tx2, clamp(ty2, M + 12, M + PH - 12), dt, true, false);
          p.thinkT = (p.thinkT || 0) - dt;
          if (p.thinkT <= 0 && p.cd <= 0) {
            p.thinkT = 0.25 + rnd() * 0.25;
            if (dist < 150 + 14 * d && rnd() < 0.5 + 0.08 * d) { shootAt(p, 0.5 + rnd() * 0.5); p.thinkT = 0.7; }
            else if (push && rnd() < 0.5) { passTo(p); p.thinkT = 0.6; }
          }
          return;
        }
        // not holding the ball: the nearest ones go for it, the rest keep their places
        var rank = state.players.filter(function (q) { return q.team === p.team && q.role !== "keeper"; }).sort(function (a, c) { return Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y); }), pos = rank.indexOf(p);
        var chasers = mine ? 0 : opp ? 1 + (d >= 4 ? 1 : 0) : 2;
        if (pos < chasers) { var lead = opp ? 0.15 : 0.25; steer(p, b.x + b.vx * lead, b.y + b.vy * lead, dt, true, false); return; }
        var dirx = p.team === 0 ? 1 : -1;
        if (p.receiveT > 0 && !h) { p.receiveT -= dt; steer(p, b.x + b.vx * 0.3, b.y + b.vy * 0.3, dt, true, false); return; }   // a pass is coming to me
        if (mine && h !== p) {   // my team has the ball: run into the open ahead of the one who carries it, spread across the pitch, away from team mates
          var ahead = p.role === "fwd" ? 100 : p.role === "mid" ? 58 : 18, tx = clamp(h.x + dirx * ahead, M + 24, M + PW - 30), ty = h.y + (M + p.fy * PH - h.y) * 0.8;
          state.players.forEach(function (q) { if (q !== p && q.team === p.team && Math.hypot(q.x - tx, q.y - ty) < 30) { ty += (ty < q.y ? -1 : 1) * 22; } });
          state.players.forEach(function (o) { if (o.team !== p.team && Math.hypot(o.x - tx, o.y - ty) < 22) { ty += (ty < o.y ? -1 : 1) * 20; } });   // not onto a marker
          steer(p, tx, clamp(ty, M + 16, M + PH - 16), dt, p.role !== "def" && Math.hypot(tx - p.x, ty - p.y) > 50, true); return;
        }
        var shift = opp ? -0.08 : 0.04, base = basePos(p, shift), bx = (b.x - M) / PW, pull = (p.team === 0 ? bx : 1 - bx) - 0.5;
        steer(p, base.x + dirx * pull * 70, base.y + (b.y - base.y) * 0.2, dt, false, true);
      }
      function human(p, dt) {
        var up = K.key("ArrowUp") || K.key("w"), down = K.key("ArrowDown") || K.key("s"), left = K.key("ArrowLeft") || K.key("a"), right = K.key("ArrowRight") || K.key("d");
        var mx = (right ? 1 : 0) - (left ? 1 : 0), my = (down ? 1 : 0) - (up ? 1 : 0), run = K.key("Shift") && state.stamina > 0.02;
        var len = Math.hypot(mx, my) || 1, sp = SPEED * 1.05 * (run && (mx || my) ? RUN : 1);
        p.vx += (mx / len * sp - p.vx) * Math.min(1, dt * 12); p.vy += (my / len * sp - p.vy) * Math.min(1, dt * 12);
        if (mx || my) { p.face = Math.atan2(my, mx); p.run = run; }
        if (run && (mx || my)) state.stamina = Math.max(0, state.stamina - dt * 0.34); else state.stamina = Math.min(maxStamina, state.stamina + dt * 0.18);
        var space = K.key(" ");
        if (space && state.holder === p) { state.charging = true; state.charge = Math.min(1, state.charge + dt * (feats.indexOf("powershot") >= 0 ? 1.4 : 3)); }
        else if (state.charging) { state.charging = false; if (state.holder === p) shootAt(p, state.charge); state.charge = 0; }
        else if (!space) state.charge = 0;
        if ((K.key("e") || K.key("k")) && !state.passHeld) { state.passHeld = true; if (state.holder === p) passTo(p); } else if (!K.key("e") && !K.key("k")) state.passHeld = false;
        if (K.key("q") && !state.qHeld) { state.qHeld = true; var mates = state.players.filter(function (q) { return q.team === 0 && q.role !== "keeper" && q !== p; }).sort(function (a, c) { return Math.hypot(a.x - state.ball.x, a.y - state.ball.y) - Math.hypot(c.x - state.ball.x, c.y - state.ball.y); }); if (mates[0]) { state.me = mates[0]; state.switchT = 1.2; } } else if (!K.key("q")) state.qHeld = false;
      }

      // ---- one step ----
      function endMatch() {
        state.finished = true; state.result = state.score[0] > state.score[1] ? "win" : state.score[0] < state.score[1] ? "lose" : "draw"; K.sfx(state.result === "win" ? "coin" : "hit"); K.music.stop();
      }
      state.goal = function (team) {
        state.score[team]++; state.phase = "goal"; state.phaseT = 2.6; state.holder = null; K.sfx("coin"); state.say(team === 0 ? "GOL!" : "GOL... rakipten", 2.4);
        for (var i = 0; i < 24; i++) state.parts.push({ x: state.ball.x, y: state.ball.y, vx: (rnd() - 0.5) * 160, vy: (rnd() - 0.5) * 160, life: 0.9, c: [homeCol, awayCol][team] });
        state.lastScorer = team;
      };
      state.step = function (dt) {
        if (!state.ball || state.paused) return;
        state.messageT = Math.max(0, state.messageT - dt);
        state.parts = state.parts.filter(function (pt) { pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; return pt.life > 0; });
        if (state.finished) return;
        var b = state.ball;
        if (state.phase === "kickoff") { state.phaseT -= dt; if (state.phaseT <= 0) { state.phase = "play"; K.sfx("click"); } }
        if (state.phase === "goal") { state.phaseT -= dt; if (state.phaseT <= 0) { if (state.overtime || (state.clock <= 0 && state.score[0] !== state.score[1])) { endMatch(); return; } state.setup(1 - state.lastScorer); } if (state.phase === "goal") { state.players.forEach(function (p) { p.vx *= 0.9; p.vy *= 0.9; }); return; } }
        var playing = state.phase === "play";
        if (playing && !state.overtime) { state.clock -= dt; if (state.clock <= 0) { state.clock = 0; if (state.score[0] !== state.score[1]) { endMatch(); return; } state.overtime = true; state.say("ALTIN GOL! İlk gol kazanır", 3); } }
        // who plays: the home player nearest the ball, unless you hold it
        state.switchT = Math.max(0, (state.switchT || 0) - dt);
        if (state.holder && state.holder.team === 0 && state.holder.role !== "keeper") state.me = state.holder;   // the keeper plays by itself
        else if (!state.switchT) { var near = state.players.filter(function (q) { return q.team === 0 && q.role !== "keeper"; }).sort(function (a, c) { return Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y); })[0]; if (near && near !== state.me && Math.hypot(near.x - b.x, near.y - b.y) + 12 < Math.hypot(state.me.x - b.x, state.me.y - b.y)) state.me = near; }
        state.players.forEach(function (p) {
          p.cd = Math.max(0, p.cd - dt); p.tackleCd = Math.max(0, p.tackleCd - dt); p.run = false;
          if (p === state.me && !state.autoPlay) human(p, dt); else if (state.phase === "kickoff" && !(p.team === state.kickoffTeam && p.role !== "keeper" && Math.hypot(p.x - b.x, p.y - b.y) < 30)) { var base = basePos(p, 0); steer(p, base.x, base.y, dt, false, true); } else ai(p, dt);
          if (state.phase === "kickoff" && p === state.me) { /* you may walk, the ball waits */ }
          p.x = clamp(p.x + p.vx * dt, M + 4, M + PW - 4); p.y = clamp(p.y + p.vy * dt, M + 4, M + PH - 4); p.anim += dt * (Math.hypot(p.vx, p.vy) / 30);
        });
        // players do not stand inside each other
        for (var i = 0; i < state.players.length; i++) for (var j = i + 1; j < state.players.length; j++) {
          var A = state.players[i], B = state.players[j], dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy);
          if (dist < PR * 1.6 && dist > 0.01) { var push = (PR * 1.6 - dist) / 2; A.x -= dx / dist * push; A.y -= dy / dist * push; B.x += dx / dist * push; B.y += dy / dist * push; }
        }
        // the ball: carried by the player who has it, else it rolls and slows down
        if (state.holder) {
          var h = state.holder; b.x = h.x + Math.cos(h.face) * (PR + 1); b.y = h.y + Math.sin(h.face) * (PR + 1); b.vx = h.vx; b.vy = h.vy;
          if (!playing && state.phase !== "kickoff") state.holder = null;
        } else {
          b.x += b.vx * dt; b.y += b.vy * dt; var fr = Math.exp(-0.85 * dt); b.vx *= fr; b.vy *= fr; if (Math.hypot(b.vx, b.vy) < 4) { b.vx = b.vy = 0; }
          var inMouth = b.y > M + PH / 2 - GOAL / 2 && b.y < M + PH / 2 + GOAL / 2;
          if (b.y < M + 3) { b.y = M + 3; b.vy = Math.abs(b.vy) * 0.8; } if (b.y > M + PH - 3) { b.y = M + PH - 3; b.vy = -Math.abs(b.vy) * 0.8; }
          if (b.x < M) { if (inMouth && state.phase === "play") { if (b.x < M - 3) state.goal(1); else if (b.x < M - NET + 2) { b.x = M - NET + 2; b.vx = Math.abs(b.vx) * 0.2; } } else { b.x = M; b.vx = Math.abs(b.vx) * 0.8; } }
          if (b.x > M + PW) { if (inMouth && state.phase === "play") { if (b.x > M + PW + 3) state.goal(0); else if (b.x > M + PW + NET - 2) { b.x = M + PW + NET - 2; b.vx = -Math.abs(b.vx) * 0.2; } } else { b.x = M + PW; b.vx = -Math.abs(b.vx) * 0.8; } }
          if (state.phase === "goal" || state.phase === "kickoff" && state.holder === null) { /* free ball waits for the whistle */ }
          if (playing || (state.phase === "kickoff" && false)) {
            var speed = Math.hypot(b.vx, b.vy);
            for (var k = 0; k < state.players.length; k++) {   // a player picks the ball up when close enough and it is not flying past too fast
              var q = state.players[k]; if (q.cd > 0) continue; var dd = Math.hypot(q.x - b.x, q.y - b.y);
              if (dd < PR + 3 && (speed < 215 - (q.role === "keeper" ? -80 : 0) + 12 * (q.team === 1 ? d : 0))) { state.holder = q; q.cd = 0; q.holdT = 0; break; }
            }
          }
        }
        if (state.phase === "kickoff" && !state.holder && state.me && Math.hypot(state.me.x - b.x, state.me.y - b.y) < PR + 3 && state.me.team === state.kickoffTeam) { /* the whistle picks it up */ }
        // taking the ball from the one who has it
        if (playing && state.holder) {
          var hh = state.holder;
          state.players.forEach(function (o) {
            if (o.team === hh.team || o.tackleCd > 0 || o.role === "keeper" && Math.hypot(o.x - b.x, o.y - b.y) > 14) return;
            if (Math.hypot(o.x - b.x, o.y - b.y) < PR + 3) { var chance = (o === state.me ? 0.55 : 0.28 + 0.05 * d) * (hh === state.me ? 1.1 - 0.06 * d : 1); o.tackleCd = 0.7; if (rnd() < chance) { state.holder = o; hh.cd = 0.6; o.cd = 0; K.sfx("hit"); } }
          });
        }
        if (state.phase === "kickoff" && state.holder && state.holder.team === state.kickoffTeam) { /* a player has the ball at the centre: play goes on when the whistle has gone */ }
      };

      // ---- the menus ----
      var CONTROLS = ["W A S D ya da oklar  koş      Shift  sprint      Q  oyuncu değiştir", "Boşluk  şut (basılı tut: güç)      E ya da K  pas      R  yeniden başla      Esc  menü", "Topa en yakın oyuncuyu sen yönetirsin. Topu kap, rakip kaleye götür ve gol at."];
      state.openMenu = function (kind) { state.menu.open = true; state.menu.kind = kind; state.menu.index = 0; state.paused = true; };
      state.closeMenu = function () { state.menu.open = false; state.menu.started = true; state.paused = false; };
      state.toggleMusic = function () { state.musicOn = !state.musicOn; if (state.musicOn) { if (tune) K.music.play(tune); } else K.music.stop(); };
      state.menuItems = function () {
        var m = state.menu, music = { label: "Müzik: " + (state.musicOn ? "açık" : "kapalı"), act: state.toggleMusic }, controls = { label: "Kontroller", act: function () { m.back = m.kind; m.kind = "controls"; m.index = 0; } };
        if (m.kind === "main") return [{ label: m.started ? "Devam et" : "Maça başla", act: state.closeMenu }, controls, music];
        return [{ label: "Devam et", act: state.closeMenu }, controls, music, { label: "Baştan başla", act: function () { state.reset(); state.closeMenu(); } }, { label: "Ana menü", act: function () { state.openMenu("main"); } }];
      };
      var tapped = {}, tap = function (k) { var dd = K.key(k), hit = dd && !tapped[k]; tapped[k] = dd; return hit; };
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
        if (tap("ArrowUp") || tap("w")) m.index = (m.index + items.length - 1) % items.length;
        if (tap("ArrowDown") || tap("s")) m.index = (m.index + 1) % items.length;
        if (tap("Enter") || tap(" ")) items[Math.min(m.index, items.length - 1)].act();
        if (tap("Escape") && m.kind === "pause") state.closeMenu();
      };

      // ---- the picture ----
      var bg = null, small = null, sc = null, sheets = {};
      function build() {
        var cv = document.createElement("canvas"); cv.width = WW; cv.height = WH; var c = cv.getContext("2d"), im = c.createImageData(WW, WH), x, y;
        for (y = 0; y < WH; y++) for (x = 0; x < WW; x++) {
          var inside = x >= M && x < M + PW && y >= M && y < M + PH, band = Math.floor((x - M) / 40) % 2, base = inside ? (band ? theme.a : theme.b) : theme.out, n = hash(x, y, 3), k = 0.93 + n * 0.14;
          if (inside && n > 0.96) k = 1.18; var o = (y * WW + x) * 4; im.data[o] = clamp(base[0] * k, 0, 255); im.data[o + 1] = clamp(base[1] * k, 0, 255); im.data[o + 2] = clamp(base[2] * k, 0, 255); im.data[o + 3] = 255;
        }
        c.putImageData(im, 0, 0); c.fillStyle = rgb(theme.line);
        c.fillRect(M, M, PW, 2); c.fillRect(M, M + PH - 2, PW, 2); c.fillRect(M, M, 2, PH); c.fillRect(M + PW - 2, M, 2, PH); c.fillRect(M + PW / 2 - 1, M, 2, PH);
        circle(c, M + PW / 2, M + PH / 2, 44); circle(c, M + PW / 2, M + PH / 2, 43); c.fillRect(M + PW / 2 - 2, M + PH / 2 - 2, 4, 4);
        [0, 1].forEach(function (side) {   // the boxes and the goals with nets
          var gx = side ? M + PW : M, sgn = side ? -1 : 1;
          c.fillStyle = rgb(theme.line); c.fillRect(side ? gx - 90 : gx, M + PH / 2 - 85, 90, 2); c.fillRect(side ? gx - 90 : gx, M + PH / 2 + 83, 90, 2); c.fillRect(side ? gx - 90 : gx + 88, M + PH / 2 - 85, 2, 170);
          c.fillRect(side ? gx - 36 : gx, M + PH / 2 - 42, 36, 2); c.fillRect(side ? gx - 36 : gx, M + PH / 2 + 40, 36, 2); c.fillRect(side ? gx - 36 : gx + 34, M + PH / 2 - 42, 2, 84);
          var nx = side ? gx : gx - NET; c.fillStyle = "rgba(20,20,26,0.55)"; c.fillRect(nx, M + PH / 2 - GOAL / 2, NET, GOAL);
          c.fillStyle = "rgba(235,235,240,0.55)"; for (var yy = 0; yy < GOAL; yy += 4) c.fillRect(nx, M + PH / 2 - GOAL / 2 + yy, NET, 1); for (var xx = 0; xx < NET; xx += 4) c.fillRect(nx + xx, M + PH / 2 - GOAL / 2, 1, GOAL);
          c.fillStyle = "#f4f4f4"; c.fillRect(nx, M + PH / 2 - GOAL / 2 - 2, NET, 2); c.fillRect(nx, M + PH / 2 + GOAL / 2, NET, 2); c.fillRect(side ? nx + NET - 2 : nx, M + PH / 2 - GOAL / 2, 2, GOAL);
        });
        bg = cv; small = document.createElement("canvas"); small.width = VW; small.height = VH; sc = small.getContext("2d");
      }
      function sheetFor(p) { var col = p.role === "keeper" ? (p.team === 0 ? COLORS[spec.home === "yellow" ? "orange" : "yellow"] : COLORS[spec.away === "green" ? "purple" : "green"]) : (p.team === 0 ? homeCol : awayCol), key = col.join(",") + (p.role === "keeper" ? "k" : ""); if (!sheets[key]) sheets[key] = playerSheet(col, p.role === "keeper"); return sheets[key]; }
      var cam = { x: 0, y: 0 };
      function drawWorld(c) {
        var b = state.ball, fx = b.x + (state.holder ? state.holder.vx * 0.3 : b.vx * 0.15), fy = b.y + (state.holder ? state.holder.vy * 0.3 : b.vy * 0.15);
        cam.x += (clamp(fx - VW / 2, 0, WW - VW) - cam.x) * 0.2; cam.y += (clamp(fy - VH / 2, 0, WH - VH) - cam.y) * 0.2;
        var cx = Math.round(cam.x), cy = Math.round(cam.y);
        c.imageSmoothingEnabled = false; c.drawImage(bg, cx, cy, VW, VH, 0, 0, VW, VH);
        c.save(); c.translate(-cx, -cy);
        var list = state.players.slice().sort(function (a, z) { return a.y - z.y; });
        list.forEach(function (p) {
          var sh = sheetFor(p)[Math.floor(p.anim * 2) % 2], px = Math.round(p.x) - 5, py = Math.round(p.y) - 12;
          c.fillStyle = "rgba(0,0,0,0.28)"; c.fillRect(px + 1, py + 11, 8, 3);
          c.drawImage(sh, px, py);
          if (p === state.me) { c.fillStyle = "#fff"; c.fillRect(px + 3, py - 6, 4, 1); c.fillRect(px + 4, py - 5, 2, 1); c.fillStyle = "#ffeb3b"; c.fillRect(px + 4, py - 4, 2, 1); }
        });
        var bx = Math.round(b.x), by = Math.round(b.y); c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(bx - 3, by + 1, 6, 3); drawRows(c, BALL, { k: [30, 30, 34], w: [244, 244, 244] }, bx - 4, by - 5);
        state.parts.forEach(function (pt) { c.fillStyle = rgb(pt.c); c.fillRect(Math.round(pt.x), Math.round(pt.y), 2, 2); });
        c.restore();
        if (theme.tint) { c.fillStyle = theme.tint; c.fillRect(0, 0, VW, VH); }
      }
      function drawHud(c) {
        var W = g.width, H = g.height, mins = Math.floor(state.clock / 60), secs = Math.floor(state.clock % 60);
        c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(W / 2 - 130, 6, 260, 38); c.textAlign = "center"; c.font = "bold 22px sans-serif";
        c.fillStyle = rgb(homeCol); c.fillRect(W / 2 - 124, 12, 8, 26); c.fillStyle = rgb(awayCol); c.fillRect(W / 2 + 116, 12, 8, 26);
        c.fillStyle = "#fff"; c.fillText(state.score[0] + "  -  " + state.score[1], W / 2, 32);
        c.font = "bold 13px sans-serif"; c.fillStyle = "#ffd54f"; c.fillText(state.overtime ? "ALTIN GOL" : mins + ":" + (secs < 10 ? "0" : "") + secs, W / 2, 56); c.textAlign = "left";
        c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(8, H - 26, 130, 18); c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(12, H - 22, 122, 6); c.fillStyle = "#66bb6a"; c.fillRect(12, H - 22, 122 * state.stamina / maxStamina, 6); c.fillStyle = "#fff"; c.font = "9px sans-serif"; c.fillText("SPRINT (Shift)", 14, H - 11);
        if (state.charge > 0) { c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(W / 2 - 62, H - 40, 124, 14); c.fillStyle = state.charge > 0.8 ? "#ff5252" : "#ffb74d"; c.fillRect(W / 2 - 60, H - 38, 120 * state.charge, 10); }
        if (state.messageT > 0) { c.textAlign = "center"; c.fillStyle = "#ffe082"; c.font = "bold 34px sans-serif"; c.fillText(state.message, W / 2, H / 2 - 30); c.textAlign = "left"; }
        if (state.finished) {
          c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(W / 2 - 170, H / 2 - 100, 340, 200); c.textAlign = "center"; c.fillStyle = state.result === "win" ? "#ffd54f" : "#fff"; c.font = "bold 28px sans-serif";
          c.fillText(state.result === "win" ? "KAZANDIN!" : state.result === "lose" ? "KAYBETTİN" : "BERABERE", W / 2, H / 2 - 50);
          c.font = "bold 36px sans-serif"; c.fillText(state.score[0] + " - " + state.score[1], W / 2, H / 2 + 6); c.font = "13px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("şut: " + state.shots[0] + " - " + state.shots[1] + "     R: yeniden oyna", W / 2, H / 2 + 60); c.textAlign = "left";
        }
      }
      function drawMenu(c) {
        var m = state.menu, W = g.width, H = g.height; c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, W, H); c.textAlign = "center";
        c.fillStyle = "#fff"; c.font = "bold 34px sans-serif"; c.fillText(m.kind === "main" ? (spec.title || "Futbol") : m.kind === "controls" ? "Kontroller" : "Duraklatıldı", W / 2, 70);
        if (m.kind === "controls") { c.font = "14px sans-serif"; c.fillStyle = "#e0e0e0"; CONTROLS.forEach(function (t, i) { c.fillText(t, W / 2, 140 + i * 34); }); c.fillStyle = "#ffd54f"; c.fillText("Esc ya da tık: geri", W / 2, H - 40); c.textAlign = "left"; return; }
        var items = state.menuItems();
        items.forEach(function (it, i) { var y = rowY(items.length) + i * 44 - 4, on = i === m.index; c.fillStyle = on ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.08)"; c.fillRect(W / 2 - 150, y, 300, 38); c.strokeStyle = on ? "#ffd54f" : "rgba(255,255,255,0.2)"; c.strokeRect(W / 2 - 150, y, 300, 38); c.fillStyle = on ? "#ffd54f" : "#fff"; c.font = "bold 17px sans-serif"; c.fillText(it.label, W / 2, y + 25); });
        c.font = "12px sans-serif"; c.fillStyle = "#b0bec5"; c.fillText("yukarı/aşağı seç   Enter ya da tık onayla", W / 2, H - 30); c.textAlign = "left";
      }
      g.background = "#000";
      g.layers = [{ speed: 0, draw: function (c) {
        if (typeof document === "undefined" || g.current !== "play" || !state.ball) return;
        if (!bg) build();
        drawWorld(sc); c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, g.width, g.height);
        if (!(state.menu.open && state.menu.kind === "main")) drawHud(c); if (state.menu.open) drawMenu(c);
      } }];
      if (typeof document !== "undefined" && g.canvas && g.canvas.addEventListener) g.canvas.addEventListener("mousedown", function (e) { if (e.button === 0 && state.menu.open) state.menuClick(); });
      g.scene("play", { update: function (game, dt) {
        if (state.menu.open) { state.menuUpdate(); return; }
        if (tap("Escape")) { state.openMenu("pause"); return; }
        if (tap("r")) { state.reset(); return; }
        state.step(dt);
      } });
      state.expose = { g: g, spec: spec, state: state, get p() { return state.me; } };
      return state;
    }
  });

  K.football = { themes: Object.keys(THEMES), colors: Object.keys(COLORS), features: FEATURES, formation: formation, field: { M: M, PW: PW, PH: PH, GOAL: GOAL }, menuAtStart: true };
  K.feature.define("powershot", { kits: ["football"], options: {}, apply: function (s) { s.powershot = true; } });
  K.feature.define("sprint", { kits: ["football"], options: {}, apply: function (s) { s.longSprint = true; } });

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
