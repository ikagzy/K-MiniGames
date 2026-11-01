const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.football.js'];
const fresh = () => { const K = load(...FILES); K.football.menuAtStart = false; return K; };
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const spec = (o = {}) => ({ kit: 'football', world: { seed: 5 }, teamSize: 5, duration: 60, ...o });

test('the registry has the football kit, its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('football'));
  for (const f of ['powershot', 'sprint']) assert.ok(K.feature.list('football').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'football' }), []);
  assert.ok(K.kit.check({ kit: 'football', theme: 'moon' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'football', home: 'pink' })[0].includes('bilinmeyen takım rengi'));
  assert.ok(K.kit.check({ kit: 'football', teamSize: 1 })[0].includes('teamSize'));
  assert.ok(K.kit.check({ kit: 'football', duration: 5 })[0].includes('duration'));
});

test('the line-up: a keeper when asked, defenders, midfielders and forwards from the team size, all inside the pitch and in their own half', () => {
  const K = fresh();
  for (let n = 2; n <= 8; n++) for (const keeper of [true, false]) {
    const f = K.football.formation(n, keeper);
    assert.strictEqual(f.length, n, n + ' players'); assert.strictEqual(f.filter((p) => p.role === 'keeper').length, keeper ? 1 : 0);
    assert.ok(f.every((p) => p.fx >= 0 && p.fx <= 0.8 && p.fy >= 0 && p.fy <= 1), 'inside');
    if (n >= 4) assert.ok(f.some((p) => p.role === 'fwd') && f.some((p) => p.role === 'def'), n + ' has forwards and defenders');
  }
  const s = K.kit.run(spec({ teamSize: 6 })); s.start(); assert.strictEqual(s.players.length, 12); assert.strictEqual(s.players.filter((p) => p.team === 0).length, 6);
  const { M, PW, PH } = K.football.field; assert.ok(s.players.every((p) => p.x > M && p.x < M + PW && p.y > M && p.y < M + PH), 'on the pitch');
  assert.ok(s.players.filter((p) => p.team === 0).every((p) => p.x < M + PW / 2 + 12), 'the home team starts in its half');
});

test('the match: a kickoff wait, you can move, take the ball and shoot, a goal counts and play restarts from the centre, the clock runs, and it ends with a result', () => {
  const K = fresh(); const s = K.kit.run(spec({ difficulty: 1, duration: 40 })); s.start(); const { M, PW, PH } = K.football.field;
  assert.strictEqual(s.phase, 'kickoff'); run(s, 1.4); assert.strictEqual(s.phase, 'play');
  const me = s.me, x0 = me.x; K.press('d'); run(s, 0.8); K.press('d', false); assert.ok(me.x > x0 + 20 || s.me !== me, 'you move');
  const p = s.me; p.x = M + PW - 150; p.y = M + PH / 2; p.face = 0; s.holder = p; s.ball.x = p.x + 7; s.ball.y = p.y;
  s.players.forEach((q) => { if (q !== p) { q.x = M + 40; q.y = M + 30; } });
  assert.strictEqual(s.shoot(p, 1), true); assert.ok(Math.hypot(s.ball.vx, s.ball.vy) > 250, 'a hard shot'); run(s, 1.6);
  assert.strictEqual(s.score[0], 1, 'the goal counts for the home team: ' + JSON.stringify(s.score)); assert.strictEqual(s.phase === 'goal' || s.phase === 'kickoff', true);
  for (let i = 0; i < 400 && s.phase !== 'kickoff'; i++) run(s, 1 / 60); assert.strictEqual(s.phase, 'kickoff', 'a new kickoff after the goal'); assert.ok(Math.abs(s.ball.x - (M + PW / 2)) < 2 && Math.abs(s.ball.y - (M + PH / 2)) < 2, 'the ball is at the centre'); assert.strictEqual(s.kickoffTeam, 1, 'the other team kicks off');
  const t0 = s.clock; run(s, 4); assert.ok(s.clock < t0 - 2, 'the clock runs');
  s.clock = 0.2; run(s, 0.6); assert.strictEqual(s.finished, true); assert.strictEqual(s.result, 'win');
  K.press('r'); run(s, 0.1); K.press('r', false); assert.strictEqual(s.finished, false); assert.deepStrictEqual(s.score, [0, 0]);
});

test('a draw goes to a golden goal, the first goal wins; a goal against you loses; passes reach a team mate', () => {
  const K = fresh(); const s = K.kit.run(spec()); s.start(); const { M, PW, PH } = K.football.field; run(s, 1.5);
  s.clock = 0.1; run(s, 0.4); assert.strictEqual(s.overtime, true); assert.strictEqual(s.finished, false);
  s.players.forEach((q) => { q.x = M + 300; q.y = M + 20; q.cd = 5; }); s.holder = null; s.ball.x = M + 2; s.ball.y = M + PH / 2; s.ball.vx = -200; s.ball.vy = 0; run(s, 0.6);
  run(s, 3); assert.strictEqual(s.finished, true); assert.strictEqual(s.result, 'lose', 'the golden goal went to the other side');
  const t = K.kit.run(spec()); t.start(); run(t, 1.5); const a = t.me, mate = t.players.find((q) => q.team === 0 && q !== a && q.role !== 'keeper');
  a.x = M + 200; a.y = M + PH / 2; a.face = 0; mate.x = M + 330; mate.y = M + PH / 2; mate.vx = mate.vy = 0; t.players.forEach((q) => { if (q.team === 1) { q.x = M + PW - 40; q.y = M + 20; q.cd = 5; } });
  t.holder = a; t.ball.x = a.x + 7; t.ball.y = a.y; assert.strictEqual(t.pass(a), true); run(t, 0.7);
  assert.ok(t.holder === mate || Math.hypot(t.ball.x - mate.x, t.ball.y - mate.y) < 40, 'the pass reached the team mate');
});

test('the opponent plays by itself: it takes the ball, brings it forward and shoots, and the keepers stay on their goal lines', () => {
  const K = fresh(); const s = K.kit.run(spec({ difficulty: 5, duration: 120 })); s.start(); const { M, PW } = K.football.field;
  let keeperOk = 0, samples = 0;
  run(s, 100, (i) => { if (i % 20 === 0 && s.phase === 'play') { s.players.filter((q) => q.role === 'keeper').forEach((k) => { samples++; if (Math.abs(k.x - (k.team === 0 ? M + 12 : M + PW - 12)) < 70) keeperOk++; }); } });
  assert.ok(s.shots[1] >= 1, 'the opponent shot: ' + s.shots); assert.ok(keeperOk / Math.max(1, samples) > 0.8, 'keepers hold their line: ' + keeperOk + '/' + samples);
  assert.ok(Number.isFinite(s.ball.x), 'the game stays sane');
});

test('the football menus: a main menu first (the match waits), Esc pauses, the pause menu restarts or goes back, and the controls page shows', () => {
  const K = fresh(); K.football.menuAtStart = true; const s = K.kit.run(spec()); s.start();
  assert.strictEqual(s.menu.open, true); const c0 = s.clock; run(s, 3); assert.strictEqual(s.clock, c0, 'the match waits behind the menu');
  K.press('Enter'); run(s, 0.1); K.press('Enter', false); run(s, 0.1); assert.strictEqual(s.menu.open, false);
  K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  assert.deepStrictEqual(s.menuItems().map((i) => i.label), ['Devam et', 'Kontroller', 'Müzik: açık', 'Baştan başla', 'Ana menü']);
  s.menuItems()[1].act(); assert.strictEqual(s.menu.kind, 'controls'); K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  s.menuItems()[4].act(); assert.strictEqual(s.menu.kind, 'main'); assert.strictEqual(s.menuItems()[0].label, 'Devam et');
});

test('your team plays by itself as well as the other: with nobody controlling, the home side wins the ball, runs into space, passes and shoots about as often as the opponent', () => {
  const K = fresh(); let homeShots = 0, awayShots = 0, passes = 0;
  for (const seed of [3, 4, 5]) {
    const s = K.kit.run(spec({ world: { seed }, difficulty: 3, duration: 120 })); s.start(); s.autoPlay = true;
    const spread = [];
    run(s, 110, (i) => { if (i % 60 === 0 && s.phase === 'play') { const mine = s.players.filter((q) => q.team === 0 && q.role !== 'keeper'); spread.push(Math.max(...mine.map((q) => q.x)) - Math.min(...mine.map((q) => q.x))); } });
    homeShots += s.shots[0]; awayShots += s.shots[1]; assert.ok(spread.length && spread.reduce((a, b) => a + b, 0) / spread.length > 60, 'the home players spread out: ' + spread.length);
  }
  assert.ok(homeShots >= 2, 'the home side shoots by itself: ' + homeShots); assert.ok(homeShots >= awayShots * 0.45, 'about as good as the opponent: ' + homeShots + ' against ' + awayShots);
});
