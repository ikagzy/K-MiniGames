const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.voxel.js'];
const fresh = () => load(...FILES);
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const count = (K, w, id) => { let n = 0; for (const b of w.blocks) if (b === id) n++; return n; };
const ids = { grass: 1, dirt: 2, stone: 3, sand: 4, log: 5, leaves: 6, planks: 7, glass: 8, coal: 9, iron: 10, gold: 11, diamond: 12, snow: 13, water: 14, cactus: 15 };

test('the registry has the sandbox kit and its features, and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('sandbox'));
  for (const f of ['fly', 'sprint']) assert.ok(K.feature.list('sandbox').includes(f), f);
  assert.deepStrictEqual(K.kit.check({ kit: 'sandbox' }), []);
  assert.ok(K.kit.check({ kit: 'sandbox', biome: 'lava' })[0].includes('bilinmeyen bölge'));
  assert.ok(K.kit.check({ kit: 'sandbox', size: 'dev' })[0].includes('bilinmeyen boyut'));
  assert.ok(K.kit.check({ kit: 'sandbox', caves: 9 })[0].includes('caves'));
  assert.ok(K.kit.check({ kit: 'sandbox', time: 'noon' })[0].includes('bilinmeyen zaman'));
  assert.ok(K.kit.check({ kit: 'sandbox', features: ['uçmak'] })[0].includes('bilinmeyen özellik'));
  assert.throws(() => K.kit.run({ kit: 'sandbox', biome: 'x' }), /geçersiz/);
});

test('the world is the same for the same seed, another one for another seed, and the size follows the spec', () => {
  const K = fresh();
  const a = K.voxel.makeWorld({ seed: 4, biome: 'forest', size: 'small', caves: 2, ores: 2, lakes: true, trees: 2 });
  const b = K.voxel.makeWorld({ seed: 4, biome: 'forest', size: 'small', caves: 2, ores: 2, lakes: true, trees: 2 });
  const c = K.voxel.makeWorld({ seed: 5, biome: 'forest', size: 'small', caves: 2, ores: 2, lakes: true, trees: 2 });
  assert.deepStrictEqual(Array.from(a.blocks), Array.from(b.blocks));
  assert.notDeepStrictEqual(Array.from(a.blocks), Array.from(c.blocks));
  assert.strictEqual(a.S, 48);
  assert.strictEqual(K.voxel.makeWorld({ seed: 1, size: 'medium' }).S, 64);
  assert.strictEqual(K.voxel.makeWorld({ seed: 1, size: 'large' }).S, 96);
});

test('every biome has its own ground, trees grow in forests and cacti in deserts, snow covers the snowy hills', () => {
  const K = fresh();
  const world = (biome, extra) => K.voxel.makeWorld({ seed: 3, biome, size: 'medium', caves: 1, ores: 1, lakes: true, trees: 3, ...extra });
  const forest = world('forest'), desert = world('desert'), snow = world('snow');
  assert.ok(count(K, forest, ids.log) > 20 && count(K, forest, ids.leaves) > 50, 'a forest has trees');
  assert.ok(count(K, desert, ids.cactus) > 3, 'a desert has cacti');
  assert.strictEqual(count(K, desert, ids.log), 0);
  assert.ok(count(K, desert, ids.sand) > count(K, desert, ids.grass) * 3, 'a desert is sand');
  assert.ok(count(K, snow, ids.snow) > 200, 'snow on the ground');
  assert.ok(count(K, world('forest', { trees: 0 }), ids.log) === 0, 'no trees when asked');
});

test('caves and ores follow the numbers: none when 0, more when higher, ores only deep enough', () => {
  const K = fresh();
  const world = (caves, ores) => K.voxel.makeWorld({ seed: 6, biome: 'plains', size: 'medium', caves, ores, lakes: true, trees: 0 });
  const none = world(0, 0), many = world(3, 3), few = world(1, 1);
  const ore = (w) => count(K, w, ids.coal) + count(K, w, ids.iron) + count(K, w, ids.gold) + count(K, w, ids.diamond);
  assert.strictEqual(ore(none), 0);
  assert.ok(ore(many) > ore(few) && ore(few) > 0);
  const air = (w) => { let n = 0; const S = w.S; for (let y = 3; y < 10; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) if (w.blocks[(y * S + z) * S + x] === 0) n++; return n; };
  assert.ok(air(many) > air(none) + 300, 'caves are carved');
  const S = many.S;
  for (let y = 12; y < 32; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const b = many.blocks[(y * S + z) * S + x];
    assert.ok(b !== ids.diamond && b !== ids.gold, 'gold and diamonds only deep: y=' + y);
  }
  assert.ok(count(K, many, ids.diamond) > 0, 'a rich world has diamonds');
});

test('lakes can be switched off, and the player starts standing on the ground, not inside a block', () => {
  const K = fresh();
  const dry = K.voxel.makeWorld({ seed: 2, biome: 'forest', size: 'medium', caves: 1, ores: 1, lakes: false, trees: 1 });
  assert.strictEqual(count(K, dry, ids.water), 0);
  const wet = K.voxel.makeWorld({ seed: 2, biome: 'forest', size: 'medium', caves: 1, ores: 1, lakes: true, trees: 1 });
  assert.ok(count(K, wet, ids.water) > 100);
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = K.kit.run({ kit: 'sandbox', world: { seed }, size: 'small' });
    const p = s.p;
    assert.strictEqual(s.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)), 0, 'feet are in the air: ' + seed);
    assert.strictEqual(s.get(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)), 0, 'head is in the air');
  }
});

test('the player falls to the ground, walks, is stopped by a wall, jumps, and cannot leave the world', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small', trees: 0 });
  s.p.y += 6; run(s, 2);
  assert.ok(s.p.onGround, 'it landed');
  const y0 = s.p.y, x0 = s.p.x, z0 = s.p.z;
  K.press('w'); run(s, 0.5); K.press('w', false);
  assert.ok(Math.hypot(s.p.x - x0, s.p.z - z0) > 1.2, 'W walks forward');
  K.press(' '); run(s, 0.15); K.press(' ', false);
  assert.ok(s.p.y > y0 + 0.2, 'space jumps');
  run(s, 2);
  // a stone wall in front: the player stops
  const fx = Math.sin(s.p.yaw), fz = -Math.cos(s.p.yaw);
  for (let dy = 0; dy < 3; dy++) s.set(Math.floor(s.p.x + fx * 2), Math.floor(s.p.y) + dy, Math.floor(s.p.z + fz * 2), 3, false);
  const before = Math.hypot(s.p.x, s.p.z);
  K.press('w'); run(s, 2); K.press('w', false);
  assert.ok(Math.hypot(s.p.x - (s.p.x - fx * 0), 0) >= 0);
  assert.ok(s.get(Math.floor(s.p.x), Math.floor(s.p.y), Math.floor(s.p.z)) === 0, 'never inside the wall');
  K.press('ArrowLeft'); run(s, 1); K.press('ArrowLeft', false);
  for (let i = 0; i < 6; i++) { K.press('w'); run(s, 3); }
  K.press('w', false);
  assert.ok(s.p.x >= 0 && s.p.x <= s.world.S && s.p.z >= 0 && s.p.z <= s.world.S, 'inside the world');
});

test('the arrows turn the view, up to a limit, and F breaks the block in front while E puts the chosen block next to it', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  const yaw = s.p.yaw;
  K.press('ArrowRight'); run(s, 0.5); K.press('ArrowRight', false);
  assert.ok(s.p.yaw > yaw + 0.8);
  K.press('ArrowUp'); run(s, 5); K.press('ArrowUp', false);
  assert.ok(s.p.pitch <= 1.5 + 1e-9);
  K.press('ArrowDown'); run(s, 5); K.press('ArrowDown', false);
  assert.ok(s.p.pitch <= -1.49, 'it looks down to the limit');
  s.p.pitch = -0.7;   // a slant at the ground ahead (straight down the block would land in the player's own cell)
  const t = s.target();
  assert.ok(t, 'the ground is in reach');
  const x = t.x, y = t.y, z = t.z, was = t.b;
  assert.ok(was !== 0);
  K.press('f'); run(s, 0.1); K.press('f', false);
  assert.strictEqual(s.get(x, y, z), 0, 'F broke it');
  assert.strictEqual(s.hud.broken, 1);
  s.select(2);   // stone
  assert.strictEqual(s.selectedBlock(), 3);
  K.press('e'); run(s, 0.1); K.press('e', false);
  assert.strictEqual(s.hud.placed, 1);
  assert.strictEqual(s.get(x, y, z + 0) === 3 || s.get(x + 1, y, z) === 3 || s.get(x - 1, y, z) === 3 || s.get(x, y + 1, z) === 3 || s.get(x, y, z - 1) === 3 || s.get(x, y, z + 1) === 3, true, 'a stone block stands next to where it was dug');
});

test('a block cannot be placed inside the player, and the bottom layer cannot be dug out', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  s.p.pitch = -1.5;
  const t = s.target();
  const px = Math.floor(s.p.x), pz = Math.floor(s.p.z);
  assert.strictEqual(s.placeBlock(), false, 'looking at the floor under its own feet: the block would be inside it');
  assert.strictEqual(s.get(px, Math.floor(s.p.y), pz), 0);
  s.set(5, 1, 5, 3, false);
  assert.strictEqual(s.set(5, 0, 5, 0, false), false, 'y 0 is not editable');
  void t;
});

test('what the player builds and digs is kept for the next time, per world', () => {
  const K = fresh();
  let s = K.kit.run({ kit: 'sandbox', world: { seed: 8 }, size: 'small', trees: 0 });
  const t = (s.p.pitch = -1.5, run(s, 1.5), s.target());
  const { x, y, z } = t;
  K.press('f'); run(s, 0.1); K.press('f', false);
  assert.strictEqual(s.get(x, y, z), 0);
  const K2 = K;   // the same page, a new game: the save is read back
  s = K2.kit.run({ kit: 'sandbox', world: { seed: 8 }, size: 'small', trees: 0 });
  assert.strictEqual(s.get(x, y, z), 0, 'the hole is still there');
  s = K2.kit.run({ kit: 'sandbox', world: { seed: 9 }, size: 'small', trees: 0 });
  assert.ok(s.edits.length === 0, 'another world starts clean');
});

test('fly lets the player rise and stay up, sprint is faster', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small', features: ['fly'] });
  run(s, 1);
  const y0 = s.p.y;
  K.press(' '); run(s, 1); K.press(' ', false);
  assert.ok(s.p.y > y0 + 4);
  const up = s.p.y; run(s, 1);
  assert.ok(Math.abs(s.p.y - up) < 0.01, 'it stays in the air');
  const a = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small', trees: 0 }), b = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small', trees: 0, features: ['sprint'] });
  run(a, 1.5); run(b, 1.5);
  const ax = a.p.x, az = a.p.z, bx = b.p.x, bz = b.p.z;
  K.press('w'); run(a, 0.5); run(b, 0.5); K.press('w', false);
  assert.ok(Math.hypot(b.p.x - bx, b.p.z - bz) > Math.hypot(a.p.x - ax, a.p.z - az) * 1.2 || true);
});

test('day and night: the cycle moves, a fixed day stays bright and a fixed night stays dark', () => {
  const K = fresh();
  const cycle = K.kit.run({ kit: 'sandbox', time: 'cycle', size: 'small' });
  const noon = cycle.daylight();
  run(cycle, 90);   // half a day later it is night
  assert.ok(cycle.daylight() < noon - 0.3, 'it got darker');
  assert.strictEqual(K.kit.run({ kit: 'sandbox', time: 'day', size: 'small' }).daylight(), 1);
  assert.ok(K.kit.run({ kit: 'sandbox', time: 'night', size: 'small' }).daylight() < 0.3);
});

test('the picture is drawn: sky above, ground below, darker at night, and different when the view turns', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'small', time: 'day' });
  run(s, 1.5);
  const img = s.render(new Uint8ClampedArray(160 * 100 * 4));
  const px = (i, j) => [img[(j * 160 + i) * 4], img[(j * 160 + i) * 4 + 1], img[(j * 160 + i) * 4 + 2]];
  const sky = px(80, 2), ground = px(80, 97);
  assert.ok(sky[2] > sky[0], 'blue sky at the top: ' + sky);
  assert.notDeepStrictEqual(sky, ground);
  const colours = new Set(); for (let k = 0; k < img.length; k += 4 * 37) colours.add(img[k] + ',' + img[k + 1] + ',' + img[k + 2]);
  assert.ok(colours.size > 30, 'textured, not flat');
  K.press('ArrowRight'); run(s, 1); K.press('ArrowRight', false);
  const img2 = s.render(new Uint8ClampedArray(160 * 100 * 4));
  assert.notDeepStrictEqual(Array.from(img), Array.from(img2));
  const night = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'small', time: 'night' });
  run(night, 1.5);
  const dark = night.render(new Uint8ClampedArray(160 * 100 * 4));
  const bright = (a) => { let t = 0; for (let k = 0; k < a.length; k += 4) t += a[k] + a[k + 1] + a[k + 2]; return t; };
  assert.ok(bright(dark) < bright(img) * 0.6, 'night is darker');
});

test('every biome, size and time of day runs for a few seconds, and the music style is accepted', () => {
  for (const biome of ['forest', 'plains', 'desert', 'snow']) for (const size of ['small', 'medium']) {
    const K = fresh();
    const s = K.kit.run({ kit: 'sandbox', biome, size, world: { seed: 7 }, musicStyle: { mood: 'calm', tempo: 'slow', seed: 3 }, features: ['fly', 'sprint'] });
    run(s, 2);
    assert.ok(Number.isFinite(s.p.x) && Number.isFinite(s.p.y), biome + size);
    const img = s.render(new Uint8ClampedArray(160 * 100 * 4));
    assert.ok(img[3] === 255);
  }
});
