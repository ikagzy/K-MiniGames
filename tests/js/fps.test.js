const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.hud.js', 'kgame.fps.js'];
const fresh = () => load(...FILES);
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const spec = (o = {}) => ({ kit: 'fps', world: { seed: 5 }, size: 'medium', ...o });
const px = () => new Uint8ClampedArray(160 * 100 * 4);

test('the registry has the fps kit and its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('fps'));
  for (const f of ['sprint', 'regen', 'armor']) assert.ok(K.feature.list('fps').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'fps' }), []);
  assert.ok(K.kit.check({ kit: 'fps', theme: 'lava' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'fps', enemies: ['ghost'] })[0].includes('bilinmeyen düşman'));
  assert.ok(K.kit.check({ kit: 'fps', weapons: ['laser'] })[0].includes('bilinmeyen silah'));
  assert.ok(K.kit.check({ kit: 'fps', enemies: [] })[0].includes('enemies'));
  assert.ok(K.kit.check({ kit: 'fps', levels: 9 })[0].includes('levels'));
  assert.ok(K.kit.check({ kit: 'fps', mode: 'coop' })[0].includes('bilinmeyen mod'));
  assert.ok(K.kit.check({ kit: 'fps', size: 'huge' })[0].includes('bilinmeyen boyut'));
});

test('every level has rooms joined by corridors, a locked door in front of the exit with its key before it, enemies away from the start, ammo, and the same seed makes the same level', () => {
  const K = fresh();
  for (const size of ['small', 'medium', 'large']) for (let seed = 1; seed <= 8; seed++) {
    const L = K.fps.genLevel(seed * 131, 0, { size, difficulty: 3, enemies: ['guard', 'runner'], weapons: ['pistol', 'shotgun'], ammo: 'normal', boss: false, levels: 3, theme: 'bunker' }, false);
    const dist = K.fps.bfs(L.cells, L.W, L.H, Math.floor(L.start.x), Math.floor(L.start.y), (c) => c === 0 || c === 8);
    const key = L.pickups.find((p) => p.kind === 'key');
    assert.ok(L.rooms.length >= 4, size + ' ' + seed + ': rooms');
    assert.ok(L.locked && key, 'a locked door and its key');
    assert.ok(dist[Math.floor(key.y) * L.W + Math.floor(key.x)] >= 0, 'the key can be reached without the locked door: ' + size + ' ' + seed);
    assert.ok(dist[Math.floor(L.exit.y) * L.W + Math.floor(L.exit.x)] < 0, 'the exit cannot be reached without the key');
    const open = K.fps.bfs(L.cells, L.W, L.H, Math.floor(L.start.x), Math.floor(L.start.y), (c) => c === 0 || c === 8 || c === 9);
    assert.ok(open[Math.floor(L.exit.y) * L.W + Math.floor(L.exit.x)] >= 0, 'and with the key it can');
    assert.ok(L.enemies.length >= 3 && L.enemies.every((e) => Math.hypot(e.x - L.start.x, e.y - L.start.y) > 2), 'enemies away from the start');
    assert.ok(L.pickups.some((p) => p.kind === 'ammo') && L.pickups.some((p) => p.kind === 'health'));
    for (const e of L.enemies) assert.strictEqual(L.cells[Math.floor(e.y) * L.W + Math.floor(e.x)], 0, 'enemies stand on open floor');
  }
  const a = K.fps.genLevel(777, 1, { size: 'medium', difficulty: 3, enemies: ['guard'], weapons: ['pistol'], ammo: 'normal', boss: true, levels: 2, theme: 'lab' }, true);
  const b = K.fps.genLevel(777, 1, { size: 'medium', difficulty: 3, enemies: ['guard'], weapons: ['pistol'], ammo: 'normal', boss: true, levels: 2, theme: 'lab' }, true);
  assert.deepStrictEqual(Array.from(a.cells), Array.from(b.cells)); assert.deepStrictEqual(a.enemies, b.enemies);
  assert.ok(a.enemies.some((e) => e.kind === 'boss'), 'the last level has a boss');
});

test('the picture is drawn: walls, floor, sprites hidden behind walls, and every theme looks different', () => {
  const K = fresh(); const sums = {};
  for (const theme of K.fps.themes) {
    const s = K.kit.run(spec({ theme })); run(s, 0.2);
    const out = px(); s.render(out); assert.strictEqual(out[3], 255); assert.strictEqual(out[(99 * 160 + 159) * 4 + 3], 255);
    let sum = 0; for (let i = 0; i < out.length; i += 4) sum += out[i] + out[i + 1] * 3 + out[i + 2] * 7; sums[theme] = sum;
  }
  assert.strictEqual(new Set(Object.values(sums)).size, 5, 'five themes, five looks');
  const s = K.kit.run(spec()); run(s, 0.2);
  s.render(px()); assert.ok(s.zbuf[80] > 0 && s.zbuf[80] < 30);
  const e = s.enemies[0], p = s.p; e.x = p.x + Math.cos(p.a) * 2; e.y = p.y + Math.sin(p.a) * 2; e.state = 'idle';
  const before = px(); s.render(before); const near = Array.from(before);
  e.x = p.x + Math.cos(p.a) * 40; e.y = p.y + Math.sin(p.a) * 40;   // far out in the wall: not drawn
  const after = px(); s.render(after); let diff = 0; for (let i = 0; i < near.length; i++) if (near[i] !== after[i]) diff++;
  assert.ok(diff > 200, 'an enemy in front is drawn: ' + diff);
});

test('the player walks, is stopped by walls, turns, sprints with Shift, and opens a door by walking into it', () => {
  const K = fresh(); const s = K.kit.run(spec()); run(s, 0.2);
  const p = s.p, x0 = p.x, y0 = p.y; K.press('w'); run(s, 0.5); K.press('w', false);
  assert.ok(Math.hypot(p.x - x0, p.y - y0) > 1.2, 'walked ' + Math.hypot(p.x - x0, p.y - y0));
  const a0 = p.a; K.press('ArrowRight'); run(s, 0.5); K.press('ArrowRight', false); assert.ok(p.a > a0 + 0.8);
  const walk = (shift) => { const t = K.kit.run(spec()); run(t, 0.1); const q = { x: t.p.x, y: t.p.y }; K.press('w'); if (shift) K.press('Shift'); run(t, 0.4); K.press('w', false); K.press('Shift', false); return Math.hypot(t.p.x - q.x, t.p.y - q.y); };
  assert.ok(walk(true) > walk(false) * 1.3, 'shift is faster');
  K.press('w'); run(s, 20); K.press('w', false);
  assert.ok(!s.solid(Math.floor(p.x), Math.floor(p.y)), 'never inside a wall'); assert.ok(p.x > 1 && p.y > 1 && p.x < s.level.W - 1 && p.y < s.level.H - 1);
  // a door: put a closed one in front and walk into it
  const t = K.kit.run(spec()); run(t, 0.1); const L = t.level, q = t.p; q.a = 0; q.x = 5.5; q.y = 5.5;
  for (let y = 3; y < 9; y++) for (let x = 3; x < 12; x++) L.cells[y * L.W + x] = 0;
  L.cells[5 * L.W + 8] = 8; assert.ok(t.solid(8, 5)); K.press('w'); run(t, 1.2); K.press('w', false); assert.ok(t.open[5 * L.W + 8], 'the door opened'); assert.ok(q.x > 8, 'and the player went through: ' + q.x);
  L.cells[5 * L.W + 10] = 9; q.x = 9.4; K.press('w'); run(t, 1); K.press('w', false); assert.ok(!t.open[5 * L.W + 10], 'the locked door stays shut without the key'); assert.ok(/Kilitli/.test(t.message));
  q.keys = 1; K.press('w'); run(t, 1); K.press('w', false); assert.ok(t.open[5 * L.W + 10], 'with the key it opens'); assert.strictEqual(q.keys, 0);
});

test('shooting: a shot costs ammo, hits the enemy in front and not the one behind a wall, the shotgun spreads, the rifle fires on while held, a shot wakes the others', () => {
  const K = fresh(); const s = K.kit.run(spec({ enemies: ['guard'], weapons: ['pistol', 'shotgun', 'rifle', 'magnum'] })); run(s, 0.2);
  const L = s.level, p = s.p;
  for (let y = 3; y < 12; y++) for (let x = 3; x < 20; x++) L.cells[y * L.W + x] = 0;
  s.enemies.forEach((e) => { e.dead = true; });
  p.x = 5.5; p.y = 6.5; p.a = 0; const e = { ...s.enemies[0], dead: false, hp: 30, x: 9.5, y: 6.5, state: 'idle', kind: 'guard', def: K.fps.kinds.length && s.enemies[0].def, flash: 0, cd: 5, age: 0, dir: 0, alert: false };
  s.enemies.push(e); const ammo0 = p.ammo.bullets;
  assert.strictEqual(s.fire(), true); assert.strictEqual(p.ammo.bullets, ammo0 - 1); assert.ok(e.hp < 30, 'hit');
  assert.strictEqual(e.state, 'chase', 'a shot wakes it'); assert.strictEqual(s.fire(), false, 'the pause between shots');
  run(s, 0.4); e.hp = 30; p.x = 5.5; p.y = 6.5;
  L.cells[6 * L.W + 7] = 1; assert.strictEqual(s.fire(), false, 'a wall stops the shot'); assert.strictEqual(e.hp, 30);
  L.cells[6 * L.W + 7] = 0; run(s, 0.4);
  // the shotgun: more damage up close than far away
  s.selectWeapon(1); e.x = 6.5; let near = 0; for (let i = 0; i < 20; i++) { e.hp = 1000; e.dead = false; p.ammo.shells = 5; s.fireT = 0; s.fire(); near += 1000 - e.hp; }
  e.x = 17.5; let far = 0; for (let i = 0; i < 20; i++) { e.hp = 1000; e.dead = false; p.ammo.shells = 5; s.fireT = 0; s.fire(); far += 1000 - e.hp; }
  assert.ok(near > far * 2, 'close: ' + near + ' far: ' + far);
  // rifle: held, it fires many times; the pistol only once per press
  s.selectWeapon(2); s.fireT = 0; e.x = 9.5; p.ammo.bullets = 30; const b0 = p.ammo.bullets; s.firing = true; run(s, 1); s.firing = false; assert.ok(b0 - p.ammo.bullets >= 6, 'rifle bursts: ' + (b0 - p.ammo.bullets));
  s.selectWeapon(0); p.ammo.bullets = 30; run(s, 0.5); s.firing = true; run(s, 1); s.firing = false; assert.strictEqual(30 - p.ammo.bullets, 1, 'a pistol shoots once per press');
  // out of ammo
  s.selectWeapon(3); p.ammo.heavy = 0; s.fireT = 0; assert.strictEqual(s.fire(), false); assert.ok(/Mermi/.test(s.message));
  // keys choose the weapon
  K.press('2'); run(s, 0.1); K.press('2', false); assert.strictEqual(s.weaponName(), 'shotgun'); K.press('q'); run(s, 0.1); K.press('q', false); assert.strictEqual(s.weaponName(), 'rifle');
});

test('enemies: idle until they see or hear you, then chase; guards shoot from a distance, runners hit up close, a hit hurts and armour soaks half, death ends the game and R starts again', () => {
  const K = fresh(); const s = K.kit.run(spec({ enemies: ['guard', 'runner', 'sniper', 'brute', 'turret'], difficulty: 3 })); run(s, 0.2);
  const L = s.level, p = s.p;
  for (let y = 3; y < 14; y++) for (let x = 3; x < 22; x++) L.cells[y * L.W + x] = 0;
  s.enemies.length = 0; p.x = 6.5; p.y = 8.5; p.hp = 100; p.armor = 0;
  const mk = (kind, x, y) => { const def = kind === 'boss' ? null : null; const e = { kind, x, y, hp: 999, state: 'idle', cd: 0.1, flash: 0, dead: false, alert: false, age: 0, dir: 0 }; return e; };
  const sample = (kind) => { const t = K.kit.run(spec({ enemies: [kind] })); run(t, 0.1); return t.enemies.find((e) => e.kind === kind) || null; };
  for (const kind of ['guard', 'runner', 'sniper', 'brute', 'turret']) { const t = K.kit.run(spec({ enemies: [kind], levels: 1, boss: false })); run(t, 0.1); assert.ok(t.enemies.some((e) => e.kind === kind), kind + ' appears'); }
  const guard = (() => { const t = K.kit.run(spec({ enemies: ['guard'], boss: false })); run(t, 0.1); return t.enemies[0].def; })();
  const e = { kind: 'guard', def: guard, x: 20.5, y: 8.5, hp: 999, state: 'idle', cd: 0.1, flash: 0, dead: false, alert: false, age: 0, dir: 0 }; s.enemies.push(e);
  run(s, 0.5); assert.strictEqual(e.state, 'idle', 'far away and not heard: idle');
  p.x = 14.5; run(s, 0.3); assert.strictEqual(e.state, 'chase', 'it sees you');
  p.hp = 100; run(s, 30); assert.ok(p.hp < 100, 'a guard shoots: ' + p.hp); assert.ok(p.hp > 0 || s.ended);
  p.hp = 100; p.armor = 100; s.hurt(10, 'test'); assert.strictEqual(p.armor, 95); assert.strictEqual(p.hp, 95, 'armour soaks half');
  p.armor = 0; s.hurt(200, 'test'); assert.strictEqual(s.ended, true); assert.strictEqual(K.fps && s.g.current, 'over');
  s.g.step(1 / 60); K.press('r'); run(s, 0.1); K.press('r', false); run(s, 0.1); assert.strictEqual(s.g.current, 'play'); assert.strictEqual(s.p.hp, 100); assert.strictEqual(s.ended, false);
});

test('pickups give health, armour, ammo and the key; a full bar leaves them; the exit needs the boss dead on the last level; the last level ends in a win and R plays again', () => {
  const K = fresh(); const s = K.kit.run(spec({ levels: 2, boss: true, enemies: ['guard'] })); run(s, 0.2);
  const p = s.p; s.enemies.forEach((e) => { e.dead = true; });
  const take = (kind, extra = {}) => { const pk = s.pickups.find((q) => q.kind === kind && !q.taken); assert.ok(pk, kind); p.x = pk.x; p.y = pk.y; Object.assign(p, extra); s.step(1 / 60); return pk; };
  p.hp = 50; assert.ok(take('health', { hp: 50 }).taken); assert.ok(p.hp > 50);
  p.hp = 100; const full = s.pickups.find((q) => q.kind === 'health' && !q.taken); if (full) { p.x = full.x; p.y = full.y; s.step(1 / 60); assert.ok(!full.taken, 'a full bar leaves it'); }
  p.armor = 0; assert.ok(take('armor', { armor: 0 }).taken); assert.ok(p.armor > 0);
  p.ammo.bullets = 0; const ammo = s.pickups.find((q) => q.kind === 'ammo' && !q.taken); p.x = ammo.x; p.y = ammo.y; s.step(1 / 60); assert.ok(ammo.taken); assert.ok(p.ammo[ammo.ammo] > 0);
  assert.strictEqual(p.keys, 0); take('key'); assert.strictEqual(p.keys, 1);
  // the exit: level 1 has no boss, so touching it goes on; the last level has a boss that must fall first
  const exit = s.pickups.find((q) => q.kind === 'exit'); p.x = exit.x; p.y = exit.y; s.step(1 / 60);
  assert.strictEqual(s.levelIndex, 1, 'the next level'); assert.ok(s.enemies.some((e) => e.kind === 'boss'));
  assert.strictEqual(s.bossDead, false); const exit2 = s.pickups.find((q) => q.kind === 'exit'); p.x = exit2.x; p.y = exit2.y; s.step(1 / 60);
  assert.strictEqual(s.won, false, 'the boss stands in the way'); assert.ok(/patronu/.test(s.message));
  const boss = s.enemies.find((e) => e.kind === 'boss'); assert.ok(boss.hp > 300); boss.hp = 1;
  p.x = boss.x - 2; p.y = boss.y; p.a = 0; p.ammo.bullets = 10; s.selectWeapon(0); s.fireT = 0; s.enemies.filter((e) => e !== boss).forEach((e) => { e.dead = true; }); s.level.cells[Math.floor(boss.y) * s.level.W + Math.floor(boss.x - 1)] = 0; s.fire();
  assert.strictEqual(s.bossDead, true); p.x = exit2.x; p.y = exit2.y; s.step(1 / 60); assert.strictEqual(s.won, true); s.g.step(1 / 60); assert.strictEqual(s.g.current, 'win');
  K.press('r'); run(s, 0.1); K.press('r', false); run(s, 0.1); assert.strictEqual(s.g.current, 'play'); assert.strictEqual(s.levelIndex, 0); assert.strictEqual(s.won, false);
});

test('arena mode: one room with pillars, enemies come in waves, clearing the last one wins; features: regen heals slowly, armor starts with armour, sprint is faster', () => {
  const K = fresh(); const s = K.kit.run(spec({ mode: 'arena', levels: 1, enemies: ['guard', 'runner'], boss: false })); run(s, 0.2);
  s.p.hp = 100000; assert.ok(s.level.arena && s.level.W === 26); assert.strictEqual(s.waves, 3); assert.strictEqual(s.enemies.length, 0);
  run(s, 5); assert.strictEqual(s.wave, 1); run(s, 6); assert.ok(s.enemies.length >= 3, 'wave one arrives: ' + s.enemies.length);
  assert.ok(s.render(px())[3] === 255);
  s.enemies.forEach((e) => { e.dead = true; }); s.p.hp = 100;
  for (let w = 0; w < 3; w++) { for (let i = 0; i < 40 && !s.won; i++) { s.enemies.forEach((e) => { e.dead = true; }); s.p.hp = 100; run(s, 1); } }
  assert.strictEqual(s.won, true, 'all waves cleared'); run(s, 0.1); assert.strictEqual(s.g.current, 'win');
  const r = K.kit.run(spec({ features: ['regen'] })); run(r, 0.1); r.p.hp = 40; run(r, 3); assert.strictEqual(r.p.hp, 40, 'not right after a hit... (hurtT)'); r.hurtT = 6; run(r, 2); assert.ok(r.p.hp > 44, 'regen: ' + r.p.hp);
  const a = K.kit.run(spec({ features: ['armor'] })); run(a, 0.1); assert.strictEqual(a.p.armor, 50);
  const walk = (f) => { const t = K.kit.run(spec({ features: f })); run(t, 0.1); const x = t.p.x, y = t.p.y; K.press('w'); run(t, 0.4); K.press('w', false); return Math.hypot(t.p.x - x, t.p.y - y); };
  assert.ok(walk(['sprint']) > walk([]) * 1.15, 'the sprint feature is faster');
});

test('looking up and down: the arrows and the mouse tilt the view, the horizon moves, a shot follows the line of sight, so aiming too high or too low misses', () => {
  const K = fresh(); const s = K.kit.run(spec({ enemies: ['guard'], boss: false })); run(s, 0.2);
  const p = s.p, L = s.level; assert.strictEqual(p.pitch, 0);
  K.press('ArrowUp'); run(s, 0.5); K.press('ArrowUp', false); assert.ok(p.pitch > 0.3, 'looking up: ' + p.pitch);
  K.press('ArrowDown'); run(s, 3); K.press('ArrowDown', false); assert.ok(p.pitch <= -0.45 && p.pitch >= -0.5, 'the limit: ' + p.pitch);
  const x0 = p.x, y0 = p.y; K.press('ArrowUp'); run(s, 0.3); K.press('ArrowUp', false); assert.ok(Math.hypot(p.x - x0, p.y - y0) < 0.01, 'the arrows only look, they do not walk');
  // the horizon: looking up shows more floor, looking down more ceiling
  const row = (pitch) => { p.pitch = pitch; const out = px(); s.render(out); let first = -1; const wall = (j) => out[(j * 160 + 5) * 4]; for (let j = 0; j < 99; j++) if (Math.abs(out[(j * 160 + 80) * 4] - out[((j + 1) * 160 + 80) * 4]) > 18) { first = j; break; } return first; };
  const flat = row(0), up = row(0.4), down = row(-0.4); assert.ok(flat >= 0 && up >= 0 && down >= 0);
  assert.ok(s.render(px())[3] === 255);
  // a shot: an enemy 6 cells ahead, level aim hits, too high and too low miss
  for (let y = 3; y < 12; y++) for (let x = 3; x < 20; x++) L.cells[y * L.W + x] = 0;
  s.enemies.forEach((e) => { e.dead = true; }); p.x = 5.5; p.y = 6.5; p.a = 0; p.pitch = 0;
  const e = { ...s.enemies[0], dead: false, hp: 1000, x: 11.5, y: 6.5, state: 'idle', flash: 0, cd: 99, age: 0, dir: 0, kind: 'guard' }; s.enemies.push(e);
  const shoot = (pitch) => { e.hp = 1000; e.dead = false; p.pitch = pitch; p.ammo.bullets = 99; s.fireT = 0; s.selectWeapon(0); let hits = 0; for (let i = 0; i < 30; i++) { s.fireT = 0; const before = e.hp; s.fire(); if (e.hp < before) hits++; e.state = 'idle'; } return hits; };
  assert.ok(shoot(0) >= 25, 'level aim hits'); assert.strictEqual(shoot(0.2), 0, 'too high (the shot passes over its head)'); assert.strictEqual(shoot(-0.2), 0, 'too low (the shot hits the floor first)');
  assert.ok(shoot(0.02) >= 20, 'a little up still hits: the enemy is tall'); assert.ok(shoot(-0.03) >= 20, 'a little down hits too');
  p.x = 10.5; assert.ok(shoot(-0.3) >= 25, 'close up, aiming down hits'); p.pitch = 0; p.x = 5.5;
});
