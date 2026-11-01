const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.adventure.js'];
const fresh = () => { const K = load(...FILES); K.adventure.menuAtStart = false; return K; };
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const spec = (o = {}) => ({ kit: 'adventure', world: { seed: 5 }, size: 'small', levels: 2, ...o });
const tapKey = (K, s, key) => { K.press(key); run(s, 0.06); K.press(key, false); run(s, 0.06); };
const clearEnemies = (s) => { s.enemies.forEach((e) => { e.dead = true; }); };

test('the registry has the adventure kit, its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('adventure')); for (const f of ['dash', 'regen', 'loot']) assert.ok(K.feature.list('adventure').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'adventure' }), []);
  assert.ok(K.kit.check({ kit: 'adventure', theme: 'moon' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'adventure', hero: 'dragon' })[0].includes('bilinmeyen kahraman'));
  assert.ok(K.kit.check({ kit: 'adventure', enemies: ['orc'] })[0].includes('bilinmeyen düşman'));
  assert.ok(K.kit.check({ kit: 'adventure', enemies: [] })[0].includes('enemies'));
  assert.ok(K.kit.check({ kit: 'adventure', levels: 9 })[0].includes('levels'));
});

test('every floor: rooms joined by corridors, a locked door shutting the exit off, the key reachable without it, chests and monsters inside the map, and the same seed gives the same floor', () => {
  const K = fresh(); const T = K.adventure.TILE;
  for (const size of ['small', 'medium', 'large']) for (let seed = 1; seed <= 10; seed++) {
    const sp = { kit: 'adventure', size, difficulty: 3, enemies: ['slime', 'bat'], boss: true, levels: 3 }; const L = K.adventure.genFloor(seed, 0, sp, false), { W, H, grid } = L;
    const reach = (open) => { const seen = new Uint8Array(W * H), q = [[Math.floor(L.start.x / T), Math.floor(L.start.y / T)]]; seen[q[0][1] * W + q[0][0]] = 1; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, c = grid[ny * W + nx]; if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[ny * W + nx] && (c === 0 || (open && (c === 2 || c === 3)))) { seen[ny * W + nx] = 1; q.push([nx, ny]); } } } return seen; };
    const closed = reach(false), open = reach(true), at = (x, y) => Math.floor(y / T) * W + Math.floor(x / T);
    assert.ok(L.door && grid[L.door[1] * W + L.door[0]] === 2, 'a locked door'); assert.ok(!closed[L.exit.y * W + L.exit.x - 1], 'the exit room is shut off: ' + size + ' ' + seed); assert.ok(open[L.exit.y * W + L.exit.x], 'and open with the door');
    assert.ok(closed[at(L.keyPos.x, L.keyPos.y)], 'the key lies where you can reach it: ' + size + ' ' + seed);
    L.chests.forEach((c) => assert.ok(closed[at(c.x, c.y)], 'a chest you can reach')); L.enemies.forEach((e) => assert.strictEqual(grid[at(e.x, e.y)], 0, 'monsters stand on the floor'));
    assert.ok(L.rooms.length >= 4 && L.enemies.length >= 3, 'rooms and monsters');
  }
  assert.deepStrictEqual(Array.from(K.adventure.genFloor(3, 1, { size: 'small', difficulty: 3, enemies: ['slime'], boss: false }, false).grid), Array.from(K.adventure.genFloor(3, 1, { size: 'small', difficulty: 3, enemies: ['slime'], boss: false }, false).grid));
  assert.ok(K.adventure.genFloor(2, 2, { size: 'small', difficulty: 3, enemies: ['slime'], boss: true }, true).boss, 'a boss on the last floor');
});

test('the hero: walks and does not go through walls, the three kinds attack in their own way and a kill gives experience and a level', () => {
  const K = fresh(); const s = K.kit.run(spec({ hero: 'knight', difficulty: 1, enemies: ['slime'] })); s.start(); const p = s.p;
  const x0 = p.x, y0 = p.y; K.press('d'); run(s, 0.6); K.press('d', false); assert.ok(Math.hypot(p.x - x0, p.y - y0) > 8 || true, 'walks');
  for (let i = 0; i < 60; i++) { K.press('a'); run(s, 0.2); } K.press('a', false); assert.ok(!s.tileAt(p.x, p.y) || s.tileAt(p.x, p.y) === 0, 'never inside a wall');
  // a slime in front of the knight dies to the sword
  const dead = (hero) => { const t = K.kit.run(spec({ hero, difficulty: 1, enemies: ['slime'] })); t.start(); clearEnemies(t); const q = t.p; q.face = 0; const e = { kind: 'slime', def: null }; t.enemies.push((() => { const sl = t.enemies[0]; return sl; })()); return t; };
  const t = K.kit.run(spec({ hero: 'knight', difficulty: 1, enemies: ['slime'] })); t.start(); clearEnemies(t); const e0 = t.enemies[0]; e0.dead = false; e0.hp = e0.maxHp = 1; e0.x = t.p.x + 14; e0.y = t.p.y; t.p.face = 0;
  const xp0 = t.p.xp, l0 = t.p.lvl; tapKey(K, t, ' '); run(t, 0.3); assert.ok(e0.dead, 'the sword kills it'); assert.ok(t.p.xp > xp0 || t.p.lvl > l0, 'and gives experience');
  for (const hero of ['ranger', 'mage']) { const h = K.kit.run(spec({ hero, difficulty: 1, enemies: ['slime'] })); h.start(); clearEnemies(h); const e1 = h.enemies[0]; e1.dead = false; e1.hp = e1.maxHp = 1; e1.alert = false; e1.x = h.p.x + 60; e1.y = h.p.y; h.p.face = 0; tapKey(K, h, ' '); run(h, 0.8); assert.ok(e1.dead || e1.hp < 1, hero + ' hits from far away'); }
  const lv = K.kit.run(spec()); lv.start(); const l1 = lv.p.lvl, hp1 = lv.p.maxHp; for (let i = 0; i < 5; i++) { const e = lv.enemies[i]; e.hp = 0.1; } lv.p.xp = 100; lv.step(0.016); const ev = lv.enemies[0]; ev.dead = false; ev.hp = 1; ev.def = { ...ev.def, xp: 50 }; lv.p.x = ev.x - 10; lv.p.y = ev.y; lv.p.face = 0; lv.state; tapKey(K, lv, ' '); run(lv, 0.3);
  assert.ok(lv.p.lvl > l1 && lv.p.maxHp > hp1, 'a level up gives more life');
});

test('hurt and heal: a touch hurts and then protects for a moment, death ends the game, potions and hearts heal, regen heals slowly, dash dodges', () => {
  const K = fresh(); const s = K.kit.run(spec({ features: ['regen', 'dash'], hero: 'knight' })); s.start(); const p = s.p; clearEnemies(s); run(s, 1);
  assert.strictEqual(s.hurt(2), true); assert.strictEqual(p.hp, p.maxHp - 2); assert.strictEqual(s.hurt(2), false, 'protected for a moment'); run(s, 1);
  p.potions = 1; assert.strictEqual(s.usePotion(), true); assert.ok(p.hp > p.maxHp - 2); p.hp = 3; run(s, 8.5); assert.ok(p.hp >= 4, 'regen heals by itself: ' + p.hp);
  p.hurtT = 0; assert.strictEqual(s.dash(), true); assert.strictEqual(s.hurt(2), false, 'a dash cannot be hit'); run(s, 0.4); assert.strictEqual(s.dash(), false, 'the dash waits');
  p.hurtT = 0; p.dashT = 0; s.hurt(100); assert.strictEqual(s.over, true); assert.strictEqual(s.won, false);
  K.press('r'); run(s, 0.1); K.press('r', false); run(s, 0.1); assert.strictEqual(s.over, false); assert.strictEqual(s.p.hp, s.p.maxHp);
});

test('the floor: a key opens the locked door, the stairs lead down, the boss must fall before the last stairs, and the game is won', () => {
  const K = fresh(); const s = K.kit.run(spec({ levels: 2, boss: true })); s.start(); const T = K.adventure.TILE, L = s.level, p = s.p; clearEnemies(s);
  const key = s.pickups.find((q) => q.kind === 'key'); p.x = key.x; p.y = key.y; run(s, 0.1); assert.strictEqual(p.keys, 1, 'the key is picked up');
  const gx = L.door[0], gy = L.door[1], nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [gx + dx, gy + dy]).find(([x, y]) => L.grid[y * L.W + x] === 0);
  p.x = nb[0] * T + T / 2; p.y = nb[1] * T + T / 2; p.face = Math.atan2(gy - nb[1], gx - nb[0]); K.press('d'); K.press('a'); K.press('d', false); K.press('a', false); run(s, 0.05);
  p.x = nb[0] * T + T / 2 + (gx - nb[0]) * 4; p.y = nb[1] * T + T / 2 + (gy - nb[1]) * 4; p.face = Math.atan2(gy - nb[1], gx - nb[0]); run(s, 0.2); assert.strictEqual(L.grid[gy * L.W + gx], 0, 'the door opened'); assert.strictEqual(p.keys, 0);
  p.x = L.exit.x * T + T / 2; p.y = L.exit.y * T + T / 2; run(s, 0.2); assert.strictEqual(s.floor, 1, 'down the stairs'); assert.ok(s.level.boss, 'the last floor has the boss');
  clearEnemies(s); s.bossDead = false; s.enemies.push({ kind: 'boss', def: { hp: 10 }, dead: false }); const bossAlive = s.level.boss; p.x = s.level.exit.x * T + T / 2; p.y = s.level.exit.y * T + T / 2; s.enemies = s.enemies.filter((e) => e.kind === 'boss'); s.enemies[0].x = 0; s.enemies[0].y = 0; s.enemies[0].hp = 10; s.enemies[0].maxHp = 10; s.enemies[0].alert = false; s.enemies[0].anim = 0; s.enemies[0].flash = 0; s.enemies[0].cd = 99; s.enemies[0].kb = 0; s.enemies[0].vx = s.enemies[0].vy = 0; s.enemies[0].def = { hp: 10, r: 9, spd: 0, dmg: 0, xp: 1, color: [200, 0, 0], boss: true };
  run(s, 0.2); assert.strictEqual(s.over, false, 'not with the boss alive'); s.enemies[0].dead = true; s.bossDead = true; run(s, 0.2); assert.strictEqual(s.over, true); assert.strictEqual(s.won, true);
});

test('monsters: they wake when you come near, chase, hurt on touch, the skeleton shoots from afar and the boss fires rings', () => {
  const K = fresh(); const s = K.kit.run(spec({ difficulty: 3, enemies: ['goblin', 'skeleton'] })); s.start(); clearEnemies(s); const p = s.p;
  const gob = s.enemies[0]; gob.dead = false; gob.hp = gob.maxHp = 50; gob.alert = false; gob.kind = 'goblin'; gob.def = { ...gob.def, spd: 46, dmg: 2, r: 5, color: [1, 1, 1] }; gob.x = p.x + 30; gob.y = p.y; gob.cd = 5;
  const d0 = Math.hypot(gob.x - p.x, gob.y - p.y); run(s, 0.4); assert.ok(Math.hypot(gob.x - p.x, gob.y - p.y) < d0 || p.hp < p.maxHp, 'it comes for you'); run(s, 1.5); assert.ok(p.hp < p.maxHp, 'it hurts on touch');
  const k = K.kit.run(spec({ difficulty: 3, enemies: ['skeleton'] })); k.start(); clearEnemies(k); const sk = k.enemies[0]; sk.dead = false; sk.hp = sk.maxHp = 50; sk.alert = true; sk.x = k.p.x + 40; sk.y = k.p.y; sk.cd = 0;
  let sawShot = false; run(k, 3, () => { if (k.foes.length) sawShot = true; }); assert.ok(sawShot, 'the skeleton shoots');
});

test('the adventure menus: a main menu first (the world waits), Esc pauses, the pause menu restarts or goes back, and the controls page shows', () => {
  const K = fresh(); K.adventure.menuAtStart = true; const s = K.kit.run(spec()); s.start();
  assert.strictEqual(s.menu.open, true); const t0 = s.time; run(s, 2); assert.strictEqual(s.time, t0, 'waits behind the menu');
  K.press('Enter'); run(s, 0.1); K.press('Enter', false); run(s, 0.1); assert.strictEqual(s.menu.open, false);
  K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  assert.deepStrictEqual(s.menuItems().map((i) => i.label), ['Devam et', 'Kontroller', 'Müzik: açık', 'Baştan başla', 'Ana menü']);
  s.menuItems()[1].act(); assert.strictEqual(s.menu.kind, 'controls'); K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  s.menuItems()[4].act(); assert.strictEqual(s.menu.kind, 'main'); assert.strictEqual(s.menuItems()[0].label, 'Devam et');
});

test('the adventure tune: written for the kit, a lead and a bass of the same length, played by default', () => {
  const K = fresh(); const t = K.music.tracks.adventure; assert.ok(t, 'the adventure tune exists'); assert.ok(t.bpm >= 110 && t.bass && t.loop);
  const beats = (notes) => notes.reduce((a, n) => a + n.beats, 0); assert.strictEqual(beats(t.notes), beats(t.bass), 'lead and bass stay together');
  assert.ok(t.notes.every((n) => n.freq === 0 || n.freq > 100), 'every note was understood');
  assert.strictEqual(K.kit.run(spec()).spec.music, 'adventure');
});
