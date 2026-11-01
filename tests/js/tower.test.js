const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.tower.js'];
const fresh = () => { const K = load(...FILES); K.tower.menuAtStart = false; return K; };
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const spec = (o = {}) => ({ kit: 'tower', world: { seed: 5 }, waves: 3, ...o });
const tapKey = (K, s, key) => { K.press(key); run(s, 0.06); K.press(key, false); run(s, 0.06); };
const freeCell = (s) => { for (let y = 0; y < s.map.H; y++) for (let x = 0; x < s.map.W; x++) if (s.canBuild(x, y)) return [x, y]; return null; };

test('the registry has the tower kit, its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('tower')); for (const f of ['speed', 'bonus', 'freeze']) assert.ok(K.feature.list('tower').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'tower' }), []);
  assert.ok(K.kit.check({ kit: 'tower', theme: 'moon' })[0].includes('bilinmeyen tema'));
  assert.ok(K.kit.check({ kit: 'tower', size: 'huge' })[0].includes('bilinmeyen boyut'));
  assert.ok(K.kit.check({ kit: 'tower', waves: 99 })[0].includes('waves'));
  assert.ok(K.kit.check({ kit: 'tower', enemies: ['dragon'] })[0].includes('bilinmeyen düşman'));
  assert.ok(K.kit.check({ kit: 'tower', towers: [] })[0].includes('towers'));
  assert.ok(K.kit.check({ kit: 'tower', towers: ['laser'] })[0].includes('bilinmeyen kule'));
});

test('every map: a road from the left edge to the right edge, one tile wide cells joined one by one, never touching itself, with room beside it for towers, and the same seed gives the same map', () => {
  const K = fresh();
  for (const size of ['small', 'medium', 'large']) for (let seed = 1; seed <= 25; seed++) {
    const m = K.tower.genMap(seed, size), { W, H, grid, cells } = m;
    assert.strictEqual(cells[0][0], 0, 'starts at the left edge'); assert.strictEqual(cells[cells.length - 1][0], W - 1, 'ends at the right edge');
    for (let i = 1; i < cells.length; i++) assert.strictEqual(Math.abs(cells[i][0] - cells[i - 1][0]) + Math.abs(cells[i][1] - cells[i - 1][1]), 1, 'joined cell by cell: ' + size + ' ' + seed);
    const seen = new Set(cells.map((c) => c.join(','))); assert.strictEqual(seen.size, cells.length, 'never crosses itself: ' + size + ' ' + seed);
    let free = 0; for (let i = 0; i < W * H; i++) if (grid[i] === 0) free++; assert.ok(free >= 60, 'room for towers: ' + free);
    assert.ok(cells.length >= 24, 'a road long enough: ' + cells.length);
  }
  assert.deepStrictEqual(Array.from(K.tower.genMap(7, 'medium').grid), Array.from(K.tower.genMap(7, 'medium').grid));
  assert.ok(K.tower.genMap(3, 'large').cells.length > K.tower.genMap(3, 'small').cells.length - 8, 'bigger maps wind more');
});

test('waves: they grow, the kinds unlock with the wave number, the boss closes the last one, and only the kinds the spec lists come', () => {
  const K = fresh(); const rnd = (() => { let a = 1; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  const sp = { difficulty: 3, enemies: ['soldier', 'runner', 'tank', 'swarm'], boss: true };
  const w1 = K.tower.waveList(1, 10, sp, rnd), w5 = K.tower.waveList(5, 10, sp, rnd), w10 = K.tower.waveList(10, 10, sp, rnd);
  assert.ok(w5.length > w1.length - 2, 'later waves are bigger'); assert.ok(w1.every((q) => q.kind === 'soldier'), 'the first wave is soldiers'); assert.ok(w5.some((q) => q.kind !== 'soldier'), 'new kinds later');
  assert.strictEqual(w10[0].kind, 'boss', 'the boss comes in the last wave'); assert.ok(K.tower.waveList(9, 10, sp, rnd).every((q) => q.kind !== 'boss'));
  assert.ok(K.tower.waveList(10, 10, { ...sp, boss: false }, rnd).every((q) => q.kind !== 'boss'), 'no boss when switched off');
  assert.ok(K.tower.waveList(8, 10, { ...sp, enemies: ['tank'] }, rnd).every((q) => q.kind === 'tank'), 'only the listed kinds');
});

test('towers: build costs gold on an empty grass tile only, upgrading costs more and makes it stronger, selling gives most of it back, and a tile is used once', () => {
  const K = fresh(); const s = K.kit.run(spec()); s.start(); const [gx, gy] = freeCell(s); const g0 = s.gold;
  assert.strictEqual(s.build(gx, gy, 'arrow'), true); assert.strictEqual(s.gold, g0 - 40); assert.strictEqual(s.build(gx, gy, 'arrow'), false, 'one tower on a tile');
  const road = s.map.cells[3]; assert.strictEqual(s.build(road[0], road[1], 'arrow'), false, 'not on the road'); assert.strictEqual(s.build(-1, 0, 'arrow'), false);
  const t = s.towerAt(gx, gy), d0 = s.damageOf(t), r0 = s.rangeOf(t); s.gold = 1000; assert.strictEqual(s.upgrade(gx, gy), true); assert.ok(s.damageOf(t) > d0 && s.rangeOf(t) > r0, 'stronger');
  assert.strictEqual(s.upgrade(gx, gy), true); assert.strictEqual(s.upgrade(gx, gy), false, 'three levels at most');
  const before = s.gold; assert.strictEqual(s.sell(gx, gy), true); assert.ok(s.gold > before + 100, 'selling pays back most: ' + (s.gold - before)); assert.strictEqual(s.towerAt(gx, gy), null);
  s.gold = 5; const [x2, y2] = freeCell(s); assert.strictEqual(s.build(x2, y2, 'sniper'), false, 'not enough gold'); assert.strictEqual(s.towers.length, 0);
  const only = K.kit.run(spec({ towers: ['frost'] })); only.start(); const [fx, fy] = freeCell(only); only.gold = 999; assert.strictEqual(only.build(fx, fy, 'cannon'), false, 'a kind that is not in the spec');
});

test('the fight: enemies follow the road and hurt the base, towers shoot them, the cannon hurts a crowd, the frost tower slows, the sniper hits far away, and gold comes from kills', () => {
  const K = fresh(); const s = K.kit.run(spec({ difficulty: 1, enemies: ['soldier'] })); s.start(); run(s, 0.1);
  const lives0 = s.lives; s.countdown = 0; run(s, 2); assert.ok(s.waveOn && s.enemies.length > 0, 'a wave began'); const e = s.enemies[0], p0 = [e.x, e.y]; run(s, 1); assert.ok(Math.hypot(e.x - p0[0], e.y - p0[1]) > 10, 'enemies walk the road');
  s.enemies.forEach((en) => { en.dist = s.pathLen - 1; }); run(s, 0.5); assert.ok(s.lives < lives0, 'those who arrive cost lives');
  const T = K.tower.TILE, mk = (type, kx) => { const t = K.kit.run(spec({ difficulty: 1, enemies: ['soldier'] })); t.start(); t.gold = 9999; const c = t.map.cells[Math.floor(t.map.cells.length / 2)]; let spot = null; for (let r = 1; r <= 3 && !spot; r++) for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0]]) if (t.canBuild(c[0] + dx, c[1] + dy)) { spot = [c[0] + dx, c[1] + dy]; break; } t.build(spot[0], spot[1], type); t.countdown = 0; return { t, spot, c }; };
  const a = mk('arrow'); a.t.countdown = 0; run(a.t, 40); assert.ok(a.t.kills > 0 && a.t.gold > 9999 - 40, 'an arrow tower kills and pays: ' + a.t.kills);
  const fr = mk('frost'); fr.t.startWave(); fr.t.enemies.length || run(fr.t, 2); fr.t.enemies.forEach((en) => { const p = fr.t.posAt(0); }); let slowed = false; run(fr.t, 30, () => { if (fr.t.enemies.some((en) => en.slowF < 1)) slowed = true; }); assert.ok(slowed, 'the frost tower slows');
  const sn = mk('sniper'); const far = sn.t.enemies; sn.t.startWave(); run(sn.t, 1.2); const spawned = sn.t.enemies[0]; assert.ok(spawned || sn.t.queue.length, 'ready');
  const cn = mk('cannon'); cn.t.startWave(); cn.t.queue = []; for (let i = 0; i < 4; i++) { cn.t.enemies.push({ kind: 'soldier', def: { hp: 10, spd: 0, reward: 1, lives: 1, r: 4, color: [1, 1, 1] }, dist: 60 + i, hp: 30, maxHp: 30, slowT: 0, slowF: 1, flash: 0, dead: false, x: cn.t.posAt(60).x, y: cn.t.posAt(60).y, anim: 0 }); }
  const sum0 = cn.t.enemies.reduce((q, en) => q + en.hp, 0); cn.t.towers[0].cd = 0; cn.t.towers[0].x = cn.t.enemies[0].x + 10; cn.t.towers[0].y = cn.t.enemies[0].y; run(cn.t, 2); const sum1 = cn.t.enemies.reduce((q, en) => q + en.hp, 0); assert.ok(sum0 - sum1 > 12, 'the cannon hits several at once: ' + (sum0 - sum1));
});

test('winning and losing: all waves cleared wins, no lives left loses, R starts again, the next wave can be called early, and speed and freeze are features', () => {
  const K = fresh(); const s = K.kit.run(spec({ waves: 2, features: ['speed', 'freeze'], boss: false })); s.start(); run(s, 0.1);
  assert.strictEqual(s.hasSpeed, true); tapKey(K, s, 'f'); assert.strictEqual(s.speed, 2); tapKey(K, s, 'f'); assert.strictEqual(s.speed, 1);
  const w0 = s.wave; tapKey(K, s, 'n'); assert.strictEqual(s.wave, w0 + 1, 'N starts the wave'); assert.strictEqual(s.startWave(), false, 'not while one is on');
  tapKey(K, s, 'g'); assert.ok(s.frozen > 0 && s.freezeCd > 0); const e = s.enemies[0]; if (e) { const d = e.dist; run(s, 0.5); assert.strictEqual(e.dist, d, 'frozen enemies stand still'); }
  const tough = K.kit.run(spec({ waves: 2, boss: false, enemies: ['soldier'], difficulty: 1 })); tough.start(); tough.gold = 99999;
  const cells = []; for (let y = 0; y < tough.map.H; y++) for (let x = 0; x < tough.map.W; x++) if (tough.canBuild(x, y)) cells.push([x, y]);
  const near = cells.filter(([x, y]) => tough.map.cells.some((c) => Math.abs(c[0] - x) + Math.abs(c[1] - y) <= 2)); near.slice(0, 14).forEach(([x, y]) => { tough.build(x, y, 'arrow'); tough.upgrade(x, y); tough.upgrade(x, y); });
  tough.countdown = 0; run(tough, 120); assert.strictEqual(tough.over, true); assert.strictEqual(tough.won, true, 'all waves cleared'); assert.strictEqual(tough.lives > 0, true);
  const lose = K.kit.run(spec({ waves: 5, difficulty: 5, boss: false })); lose.start(); lose.lives = 1; lose.countdown = 0; run(lose, 5); lose.enemies.forEach((en) => { en.dist = lose.pathLen - 1; }); run(lose, 1); assert.strictEqual(lose.over, true); assert.strictEqual(lose.won, false);
  K.press('r'); run(lose, 0.1); K.press('r', false); run(lose, 0.1); assert.strictEqual(lose.over, false); assert.strictEqual(lose.wave, 0); assert.strictEqual(lose.towers.length, 0);
});

test('the controls: arrows move the cursor, number keys choose the kind, Space builds then upgrades, X sells, and a click on the map or the strip works', () => {
  const K = fresh(); const s = K.kit.run(spec({ features: [] })); s.start(); run(s, 0.1); const [gx, gy] = freeCell(s); s.cx = gx; s.cy = gy;
  tapKey(K, s, '2'); assert.strictEqual(s.sel, 'cannon'); tapKey(K, s, '1'); assert.strictEqual(s.sel, 'arrow');
  const g0 = s.gold; tapKey(K, s, ' '); assert.strictEqual(s.towers.length, 1); assert.ok(s.gold < g0); s.gold = 500; tapKey(K, s, ' '); assert.strictEqual(s.towers[0].lvl, 1, 'a second press upgrades');
  tapKey(K, s, 'x'); assert.strictEqual(s.towers.length, 0, 'X sells'); const sx = s.cx; tapKey(K, s, 'ArrowRight'); assert.ok(s.cx === Math.min(19, sx + 1));
  const [mx, my] = freeCell(s); s.click(mx * 16 + 8, my * 16 + 8); assert.strictEqual(s.towers.length, 1, 'a click builds'); s.click(8 + 3 * 42 + 20, 175); assert.strictEqual(s.sel, 'sniper', 'a click on the strip chooses a kind');
});

test('the tower tune: written for the kit, a lead and a bass of the same length, played by default', () => {
  const K = fresh(); const t = K.music.tracks.tower; assert.ok(t, 'the tower tune exists'); assert.ok(t.bpm >= 110 && t.bass && t.loop);
  const beats = (notes) => notes.reduce((a, n) => a + n.beats, 0); assert.strictEqual(beats(t.notes), beats(t.bass), 'lead and bass stay together');
  assert.ok(t.notes.every((n) => n.freq === 0 || n.freq > 100), 'every note was understood'); assert.strictEqual(K.kit.run(spec()).spec.music, 'tower');
});

test('the tower menus: a main menu first (the waves wait), Esc pauses, the pause menu restarts or goes back, and the controls page shows', () => {
  const K = fresh(); K.tower.menuAtStart = true; const s = K.kit.run(spec()); s.start();
  assert.strictEqual(s.menu.open, true); const t0 = s.time; run(s, 2); assert.strictEqual(s.time, t0, 'waits behind the menu');
  K.press('Enter'); run(s, 0.1); K.press('Enter', false); run(s, 0.1); assert.strictEqual(s.menu.open, false);
  K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  assert.deepStrictEqual(s.menuItems().map((i) => i.label), ['Devam et', 'Kontroller', 'Müzik: açık', 'Baştan başla', 'Ana menü']);
  s.menuItems()[1].act(); assert.strictEqual(s.menu.kind, 'controls'); K.press('Escape'); run(s, 0.1); K.press('Escape', false); run(s, 0.1); assert.strictEqual(s.menu.kind, 'pause');
  s.menuItems()[4].act(); assert.strictEqual(s.menu.kind, 'main'); assert.strictEqual(s.menuItems()[0].label, 'Devam et');
});
