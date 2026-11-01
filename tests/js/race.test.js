const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.race.js'];
const fresh = () => { const K = load(...FILES); K.race.menuAtStart = false; return K; };
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const spec = (o = {}) => ({ kit: 'race', world: { seed: 5 }, length: 'small', laps: 1, ...o });

test('the registry has the race kit, its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('race'));
  for (const f of ['nitro', 'grip']) assert.ok(K.feature.list('race').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'race' }), []);
  assert.ok(K.kit.check({ kit: 'race', theme: 'moon' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'race', car: 'tank' })[0].includes('bilinmeyen araba'));
  assert.ok(K.kit.check({ kit: 'race', color: 'pink' })[0].includes('bilinmeyen renk'));
  assert.ok(K.kit.check({ kit: 'race', laps: 20 })[0].includes('laps'));
  assert.ok(K.kit.check({ kit: 'race', rivals: 0 })[0].includes('rivals'));
  assert.ok(K.kit.check({ kit: 'race', length: 'huge' })[0].includes('bilinmeyen pist'));
});

test('every track is a closed loop of road: inside the map, points close together, one connected road, a start line and kerbs', () => {
  const K = fresh(); const T = K.race.TILE;
  for (const length of ['small', 'medium', 'large']) for (let seed = 1; seed <= 10; seed++) {
    const tr = K.race.genTrack(seed, length), { W, H, grid, pts, M } = tr;
    assert.ok(M >= 30, length + ' ' + seed + ': enough points ' + M);
    assert.ok(pts.every((p) => p.x > 2 * T && p.x < (W - 2) * T && p.y > 2 * T && p.y < (H - 2) * T), 'inside the map');
    for (let i = 0; i < M; i++) { const a = pts[i], b = pts[(i + 1) % M]; assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 24, 'the loop is closed and even: ' + i); }
    const seen = new Uint8Array(W * H), q = [[Math.floor(pts[0].x / T), Math.floor(pts[0].y / T)]]; seen[q[0][1] * W + q[0][0]] = 1;
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && grid[ny * W + nx] && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push([nx, ny]); } } }
    assert.ok(pts.every((p) => seen[Math.floor(p.y / T) * W + Math.floor(p.x / T)]), 'every point of the line lies on one connected road');
    assert.ok(grid.some((c) => c === 4), 'a start line'); assert.ok(grid.some((c) => c === 2) && grid.some((c) => c === 3), 'kerbs');
    assert.ok(pts.every((p) => grid[Math.floor(p.y / T) * W + Math.floor(p.x / T)] !== 0), 'the line is on the road');
  }
  assert.deepStrictEqual(Array.from(K.race.genTrack(7, 'medium').grid), Array.from(K.race.genTrack(7, 'medium').grid), 'the same seed, the same track');
});

test('the race: a countdown, then gas moves the car, steering turns it, grass slows it, braking stops it, nitro is faster', () => {
  const K = fresh(); const s = K.kit.run(spec({ features: ['nitro'] })); s.start(); const p = s.p;
  assert.strictEqual(s.all.length, 6); assert.ok(s.countdown > 2.9);
  K.press('w'); run(s, 1); assert.strictEqual(p.v, 0, 'the car waits for the start'); run(s, 2.2); K.press('w', false);
  assert.ok(s.countdown <= 0 && s.time >= 0);
  const x0 = p.x, y0 = p.y, a0 = p.a; K.press('w'); run(s, 1.5); assert.ok(Math.hypot(p.x - x0, p.y - y0) > 20 && p.v > 40, 'gas moves it: ' + p.v);
  K.press('d'); run(s, 1); K.press('d', false); assert.ok(Math.abs(p.a - a0) > 0.2, 'steering turns it'); K.press('w', false);
  K.press('s'); run(s, 3); K.press('s', false); assert.ok(p.v <= 1, 'the brake stops it, then it does not roll back for long');
  // top speed on the road against on the grass
  const road = K.kit.run(spec({ world: { seed: 6 } })); road.start(); run(road, 3.2); { const q = road.track.pts[2], far = road.track.pts[Math.floor(road.track.M / 2)]; road.p.x = q.x; road.p.y = q.y; road.p.a = q.a; road.p.vx = road.p.vy = 0; road.racers.forEach((r) => { r.x = far.x; r.y = far.y; r.vx = r.vy = 0; r.top = 0; }); } K.press('w'); run(road, 1); const vRoad = road.p.v; K.press('w', false);
  const grass = K.kit.run(spec({ world: { seed: 6 } })); grass.start(); run(grass, 3.2); const gp = grass.p; let found = null;
  for (let y = 40; y < grass.track.H * 16 && !found; y += 16) for (let x = 40; x < grass.track.W * 16 && !found; x += 16) if (grass.tileAt(x, y) === 0 && grass.tileAt(x + 160, y) === 0) found = [x, y];
  gp.x = found[0]; gp.y = found[1]; gp.a = 0; gp.vx = gp.vy = 0; K.press('w'); run(grass, 2); const vGrass = gp.v; K.press('w', false);
  assert.ok(vGrass < vRoad * 0.75, 'the grass slows: ' + vGrass + ' against ' + vRoad);
  const nit = K.kit.run(spec({ features: ['nitro'], world: { seed: 6 } })); nit.start(); run(nit, 3.2); { const q = nit.track.pts[2], far = nit.track.pts[Math.floor(nit.track.M / 2)]; nit.p.x = q.x; nit.p.y = q.y; nit.p.a = q.a; nit.p.vx = nit.p.vy = 0; nit.racers.forEach((r) => { r.x = far.x; r.y = far.y; r.vx = r.vy = 0; r.top = 0; }); } K.press('w'); K.press(' '); run(nit, 1); K.press('w', false); K.press(' ', false);
  assert.ok(nit.p.v > vRoad * 1.05, 'nitro is faster: ' + nit.p.v + ' against ' + vRoad); assert.ok(nit.p.nitro < 1);
});

test('the rivals drive the track by themselves: they stay on the road, finish the laps, and the finishing order is kept', () => {
  const K = fresh(); const s = K.kit.run(spec({ rivals: 5, difficulty: 5, laps: 1 })); s.start();
  let samples = 0, onRoad = 0; run(s, 3.2);
  run(s, 140, (i) => { if (i % 30 === 0) s.racers.forEach((r) => { samples++; if (s.tileAt(r.x, r.y) !== 0) onRoad++; }); });
  assert.ok(onRoad / samples > 0.9, 'the rivals stay on the road: ' + onRoad + '/' + samples);
  assert.ok(s.finishOrder.length >= 4, 'most rivals finished a lap in two minutes: ' + s.finishOrder.length);
  assert.ok(s.finishOrder.every((r) => !r.me));
  assert.ok(s.rank() >= s.finishOrder.length + 1, 'those who finished are ahead of you');
});

test('finishing: the lap count, the place, the podium and the restart', () => {
  const K = fresh(); const s = K.kit.run(spec({ rivals: 3, laps: 2 })); s.start(); run(s, 3.2);
  const M = s.track.M, p = s.p; p.next = M + 1; p.x = s.track.pts[0].x; p.y = s.track.pts[0].y; run(s, 0.1); assert.strictEqual(p.lap, 1, 'the second lap began'); assert.strictEqual(s.finished, false);
  p.next = 2 * M + 1; p.x = s.track.pts[0].x; p.y = s.track.pts[0].y; run(s, 0.1); assert.strictEqual(s.finished, true); assert.strictEqual(s.place, 1, 'first across the line'); assert.ok(s.finishOrder[0].me);
  const t = s.time; K.press('r'); run(s, 0.1); K.press('r', false); assert.strictEqual(s.finished, false); assert.ok(s.countdown > 2, 'R restarts'); assert.ok(s.time < t);
});

test('the race menus: a main menu first (the cars wait), Esc pauses, the pause menu restarts or goes back, and the controls page shows', () => {
  const K = fresh(); K.race.menuAtStart = true; const s = K.kit.run(spec()); s.start();
  assert.strictEqual(s.menu.open, true); run(s, 4); assert.ok(s.countdown > 2.9, 'the start waits behind the menu');
  K.press('Enter'); run(s, 0.1); K.press('Enter', false); run(s, 0.1); assert.strictEqual(s.menu.open, false);
  K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  assert.deepStrictEqual(s.menuItems().map((i) => i.label), ['Devam et', 'Kontroller', 'Müzik: açık', 'Baştan başla', 'Ana menü']);
  s.menuItems()[1].act(); assert.strictEqual(s.menu.kind, 'controls'); K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  s.menuItems()[4].act(); assert.strictEqual(s.menu.kind, 'main'); assert.strictEqual(s.menuItems()[0].label, 'Devam et');
});

test('the racing tune: written for the kit, fast, a lead and a bass of the same length so they stay together, and the kit plays it by default', () => {
  const K = fresh(); const t = K.music.tracks.race; assert.ok(t, 'the race tune exists');
  assert.ok(t.bpm >= 150, 'energetic: ' + t.bpm); assert.ok(t.bass && t.loop);
  const beats = (notes) => notes.reduce((a, n) => a + n.beats, 0); assert.strictEqual(beats(t.notes), beats(t.bass), 'lead and bass are the same length');
  assert.strictEqual(K.kit.defaults ? 1 : 1, 1);
  const s = K.kit.run(spec()); assert.strictEqual(s.spec.music, 'race');
});

test('every car starts on the road: the grid follows the road backwards from the line, for every kind of track and every number of rivals', () => {
  const K = fresh();
  for (const length of ['small', 'medium', 'large']) for (let seed = 1; seed <= 30; seed++) for (const rivals of [1, 3, 7]) {
    const s = K.kit.run(spec({ world: { seed }, length, rivals })); s.start();
    s.all.forEach((c) => assert.notStrictEqual(s.tileAt(c.x, c.y), 0, length + ' ' + seed + ' ' + rivals + ': a car on the grass at the start'));
  }
});
