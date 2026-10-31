const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.voxel.js'];
const fresh = () => load(...FILES);
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const ids = { grass: 1, dirt: 2, stone: 3, sand: 4, log: 5, leaves: 6, planks: 7, glass: 8, coal: 9, iron: 10, gold: 11, diamond: 12, snow: 13, water: 14, cactus: 15 };
const world = (K, o = {}) => K.voxel.makeWorld({ seed: 3, biome: 'forest', size: 'medium', caves: 1, ores: 1, lakes: true, trees: 3, ...o });
const around = (w, r = 5) => { w.ensureAround(w.S >> 1, w.S >> 1, r); return w; };   // make the chunks in the middle, to count what they hold

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

test('the world is made of chunks: only the ones near the player exist at first, and the size says how many there can be', () => {
  const K = fresh();
  for (const [size, n] of [['small', 8], ['medium', 16], ['large', 32]]) {
    const w = world(K, { size });
    assert.strictEqual(w.N, n); assert.strictEqual(w.S, n * 16);
    assert.ok(w.loaded() < n * n || n === 8, size + ': not everything is made at the start');
    assert.ok(w.loaded() >= 9, 'the chunks around the spawn are there');
  }
  const w = world(K);
  const before = w.loaded();
  w.get(10, 12, 10);   // a far corner is made when something looks at it
  assert.ok(w.loaded() === before + 1);
  assert.strictEqual(w.get(-1, 5, 5), 3, 'the edge of the world is a wall');
  assert.strictEqual(w.get(5, 5, w.S), 3);
});

test('a chunk is the same whatever order the world was made in, so chunks fit together', () => {
  const K = fresh();
  const a = world(K, { seed: 9 }), b = world(K, { seed: 9 });
  a.get(200, 10, 200); a.get(40, 10, 40); b.get(40, 10, 40); b.get(200, 10, 200);
  for (const [x, z] of [[200, 200], [40, 40], [201, 199], [47, 48]]) for (let y = 0; y < 30; y++) assert.strictEqual(a.get(x, y, z), b.get(x, y, z), x + ',' + y + ',' + z);
  const c = world(K, { seed: 10 });
  let differs = 0;
  for (let x = 100; x < 140; x++) for (let z = 100; z < 140; z++) if (a.heightAt(x, z) !== c.heightAt(x, z)) differs++;
  assert.ok(differs > 200, 'another seed is another world');
  let jump = 0;   // the ground is smooth across the seam between two chunks
  for (let z = 100; z < 160; z++) for (const x of [111, 127, 143]) jump = Math.max(jump, Math.abs(a.heightAt(x, z) - a.heightAt(x + 1, z)));
  assert.ok(jump <= 3, 'no cliffs at chunk borders: ' + jump);
});

test('every biome has its own ground, trees grow in forests and cacti in deserts, snow covers the snowy hills', () => {
  const K = fresh();
  const forest = around(world(K)), desert = around(world(K, { biome: 'desert' })), snow = around(world(K, { biome: 'snow' }));
  assert.ok(forest.count(ids.log) > 20 && forest.count(ids.leaves) > 50, 'a forest has trees');
  assert.ok(desert.count(ids.cactus) > 3, 'a desert has cacti');
  assert.strictEqual(desert.count(ids.log), 0);
  assert.ok(desert.count(ids.sand) > desert.count(ids.grass) * 3, 'a desert is sand');
  assert.ok(snow.count(ids.snow) > 200, 'snow on the ground');
  assert.strictEqual(around(world(K, { trees: 0 })).count(ids.log), 0, 'no trees when asked');
});

test('caves and ores follow the numbers: none when 0, more when higher, ores only deep enough', () => {
  const K = fresh();
  const make = (caves, ores) => around(world(K, { seed: 6, biome: 'plains', caves, ores, trees: 0 }), 6);
  const none = make(0, 0), many = make(3, 3), few = make(1, 1);
  const ore = (w) => w.count(ids.coal) + w.count(ids.iron) + w.count(ids.gold) + w.count(ids.diamond);
  assert.strictEqual(ore(none), 0);
  assert.ok(ore(many) > ore(few) && ore(few) > 0);
  const air = (w) => { let n = 0; for (let y = 3; y < 10; y++) for (let z = 40; z < 216; z++) for (let x = 40; x < 216; x++) if (w.get(x, y, z) === 0) n++; return n; };
  assert.ok(air(many) > air(none) + 300, 'caves are carved');
  for (let y = 12; y < 32; y++) for (let z = 100; z < 160; z++) for (let x = 100; x < 160; x++) {
    const b = many.get(x, y, z);
    assert.ok(b !== ids.diamond && b !== ids.gold, 'gold and diamonds only deep: y=' + y);
  }
  assert.ok(many.count(ids.diamond) > 0, 'a rich world has diamonds');
});

test('lakes can be switched off, and the player starts standing on the ground, not inside a block', () => {
  const K = fresh();
  assert.strictEqual(around(world(K, { lakes: false }), 6).count(ids.water), 0);
  assert.ok(around(world(K, { seed: 2 }), 6).count(ids.water) > 100);
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = K.kit.run({ kit: 'sandbox', world: { seed }, size: 'small' });
    const p = s.p;
    assert.strictEqual(s.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)), 0, 'feet are in the air: ' + seed);
    assert.strictEqual(s.get(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)), 0, 'head is in the air');
  }
});

test('walking makes the chunks ahead, remembers the ones you visited, and the map counts them', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'medium', trees: 0, time: 'day' });
  run(s, 1.5);
  const loaded = s.world.loaded(), explored = s.hud.explored;
  assert.ok(explored >= 1 && s.chunk);
  s.p.x += 48; s.p.y += 12;   // a few chunks east
  run(s, 3);
  assert.ok(s.world.loaded() > loaded, 'new chunks appeared');
  assert.ok(s.hud.explored > explored, 'the new chunk is on the map');
  assert.ok(Object.keys(s.visited).length === s.hud.explored);
  K.press('w'); run(s, 1); K.press('w', false);
  assert.ok(Number.isFinite(s.p.x) && Number.isFinite(s.p.y));
});

test('the player falls to the ground, walks, is stopped by a wall, jumps, and cannot leave the world', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small', trees: 0 });
  s.p.y += 6; run(s, 2);
  assert.ok(s.p.onGround, 'it landed');
  const y0 = s.p.y, x0 = s.p.x, z0 = s.p.z;
  K.press('w'); run(s, 0.5); K.press('w', false);
  assert.ok(Math.hypot(s.p.x - x0, s.p.z - z0) > 1.2, 'W walks forward');
  const y1 = s.p.y;   // the ground may have sloped down while walking
  K.press(' '); run(s, 0.15); K.press(' ', false);
  assert.ok(s.p.y > y1 + 0.2 && y0 > 0, 'space jumps');
  run(s, 2);
  const fx = Math.sin(s.p.yaw), fz = -Math.cos(s.p.yaw);
  for (let dy = 0; dy < 3; dy++) s.set(Math.floor(s.p.x + fx * 2), Math.floor(s.p.y) + dy, Math.floor(s.p.z + fz * 2), 3, false);
  K.press('w'); run(s, 2); K.press('w', false);
  assert.ok([0, 14].includes(s.get(Math.floor(s.p.x), Math.floor(s.p.y), Math.floor(s.p.z))), 'never inside a solid block (water is fine)');
  for (let i = 0; i < 4; i++) { K.press('ArrowLeft'); run(s, 1); K.press('ArrowLeft', false); K.press('w'); run(s, 25); }
  K.press('w', false);
  assert.ok(s.p.x >= 0 && s.p.x <= s.world.S && s.p.z >= 0 && s.p.z <= s.world.S, 'inside the world');
});

test('the mouse and the arrows turn the view up to a limit, and F or E break and place next to the block in front', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  const yaw = s.p.yaw;
  K.press('ArrowRight'); run(s, 0.5); K.press('ArrowRight', false);
  assert.ok(s.p.yaw > yaw + 0.8);
  s.look(0.5, 0); assert.ok(s.p.yaw > yaw + 1.2, 'the mouse turns it');
  s.look(0, -9); assert.ok(s.p.pitch <= 1.5 + 1e-9, 'looking up has a limit');
  s.look(0, 99); assert.ok(s.p.pitch >= -1.5 - 1e-9, 'and so does looking down');
  s.p.pitch = -0.7;
  const t = s.target();
  assert.ok(t, 'the ground is in reach');
  const x = t.x, y = t.y, z = t.z;
  K.press('f'); run(s, 0.1); K.press('f', false);
  assert.strictEqual(s.get(x, y, z), 0, 'F broke it');
  assert.strictEqual(s.hud.broken, 1);
  K.press('e'); run(s, 0.1); K.press('e', false);
  assert.strictEqual(s.hud.placed, 1);
  const next = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => s.get(x + a, y + b, z + c) === s.selectedBlock());
  assert.ok(next || s.get(x, y, z) !== 0, 'the chosen block stands where the target was');
});

test('the inventory: what you break is yours, placing uses it up, you cannot place what you do not have, the wheel chooses, creative is endless', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  assert.deepStrictEqual(s.hotbar().slice(0, 3), [3, 2, 7], 'a few starter blocks: stone, dirt, planks');
  s.p.pitch = -0.7;
  const t = s.target(); const gets = t.b === 1 ? 2 : t.b;   // breaking grass gives dirt
  const had = s.inv.count[gets] || 0;
  K.press('f'); run(s, 0.1); K.press('f', false);
  assert.strictEqual(s.inv.count[gets], had + 1, 'the block was added to the inventory');
  s.select(0);
  assert.strictEqual(s.selectedBlock(), 3);
  const stone = s.inv.count[3];
  K.press('e'); run(s, 0.1); K.press('e', false);
  assert.strictEqual(s.inv.count[3], stone - 1, 'placing took one');
  s.inv.count[3] = 0;   // out of stone
  assert.ok(!s.hotbar().includes(3), 'an empty kind leaves the bar');
  s.select(0);
  const stand = s.selectedBlock();
  s.select(s.hotbar().length - 1); s.select(s.slot + 1); assert.strictEqual(s.slot, 0, 'the wheel goes round');
  s.inv.count[stand] = 0; s.inv.count[2] = 0; s.inv.count[7] = 0; s.inv.count[8] = 0; s.inv.count[5] = 0;
  assert.strictEqual(s.placeBlock(), false, 'nothing to place');
  K.press('c'); run(s, 0.1); K.press('c', false);
  assert.strictEqual(s.creative, true);
  assert.ok(s.hotbar().length >= 9, 'creative fills the bar');
  const before = s.inv.count[s.selectedBlock()];
  s.p.yaw += 1.2; s.p.pitch = -0.7; run(s, 0.1);
  s.placeBlock();
  assert.strictEqual(s.inv.count[s.selectedBlock()], before, 'creative blocks are never used up');
});

test('a block cannot be placed inside the player, and the bottom layer cannot be dug out', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  s.p.pitch = -1.5;
  assert.strictEqual(s.placeBlock(), false, 'straight down the block would be inside the player');
  assert.strictEqual(s.get(Math.floor(s.p.x), Math.floor(s.p.y), Math.floor(s.p.z)), 0);
  s.set(5, 1, 5, 3, false);
  assert.strictEqual(s.set(5, 0, 5, 0, false), false, 'y 0 is not editable');
});

test('what the player builds and digs is kept for the next time, per world, even in a chunk that is made later', () => {
  const K = fresh();
  let s = K.kit.run({ kit: 'sandbox', world: { seed: 8 }, size: 'small', trees: 0 });
  s.p.pitch = -0.7; run(s, 1.5);
  const { x, y, z } = s.target();
  K.press('f'); run(s, 0.1); K.press('f', false);
  assert.strictEqual(s.get(x, y, z), 0);
  s.set(5, 20, 5, 7, true);   // a far corner nobody has made yet
  s = K.kit.run({ kit: 'sandbox', world: { seed: 8 }, size: 'small', trees: 0 });
  assert.strictEqual(s.get(x, y, z), 0, 'the hole is still there');
  assert.strictEqual(s.get(5, 20, 5), 7, 'the block in the far chunk appears when that chunk is made');
  s = K.kit.run({ kit: 'sandbox', world: { seed: 9 }, size: 'small', trees: 0 });
  assert.strictEqual(s.edits.length, 0, 'another world starts clean');
});

test('fly: it is off until you turn it on with G or a double tap of space, then you rise and stay; sprint and shift are faster', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small', features: ['fly'] });
  run(s, 1);
  const y0 = s.p.y;
  K.press(' '); run(s, 1); K.press(' ', false);
  assert.ok(s.p.y < y0 + 3 && !s.flying, 'without turning it on, space only jumps');
  run(s, 2);
  K.press('g'); run(s, 0.1); K.press('g', false);
  assert.strictEqual(s.flying, true);
  const y1 = s.p.y;
  K.press(' '); run(s, 1); K.press(' ', false);
  assert.ok(s.p.y > y1 + 4);
  const up = s.p.y; run(s, 1);
  assert.ok(Math.abs(s.p.y - up) < 0.01, 'it stays in the air');
  const plain = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small' });
  K.press('g'); run(plain, 0.1); K.press('g', false);
  assert.strictEqual(plain.flying, false, 'no fly feature, no flying');
  const walk = (spec, shift) => {
    const t = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small', trees: 0, ...spec });
    run(t, 1.5); const x = t.p.x, z = t.p.z;
    K.press('w'); if (shift) K.press('Shift'); run(t, 0.4); K.press('w', false); K.press('Shift', false);
    return Math.hypot(t.p.x - x, t.p.z - z);
  };
  assert.ok(walk({ features: ['sprint'] }) > walk({}) * 1.2, 'the sprint feature is faster');
  assert.ok(walk({}, true) > walk({}) * 1.3, 'shift is faster');
});

test('day and night: the cycle moves, a fixed day stays bright and a fixed night stays dark', () => {
  const K = fresh();
  const cycle = K.kit.run({ kit: 'sandbox', time: 'cycle', size: 'small' });
  const noon = cycle.daylight();
  run(cycle, 90);
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
  assert.notDeepStrictEqual(Array.from(img), Array.from(s.render(new Uint8ClampedArray(160 * 100 * 4))));
  const night = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'small', time: 'night' });
  run(night, 1.5);
  const dark = night.render(new Uint8ClampedArray(160 * 100 * 4));
  const bright = (a) => { let t = 0; for (let k = 0; k < a.length; k += 4) t += a[k] + a[k + 1] + a[k + 2]; return t; };
  assert.ok(bright(dark) < bright(img) * 0.6, 'night is darker');
});

test('the hotbar, inventory, help and map draw without a screen error, whatever is open', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'medium' });
  run(s, 1.5);
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); }), set: (t, k, v) => { t[k] = v; return true; } });
  s.drawHud(ctx);
  s.showInv = true; s.showHelp = true; s.setCreative(true);
  s.drawHud(ctx);
  assert.ok(calls.filter((c) => c === 'fillRect').length > 40 && calls.includes('fillText'));
});

test('every biome, size and time of day runs for a few seconds, and the music style is accepted', () => {
  for (const biome of ['forest', 'plains', 'desert', 'snow']) for (const size of ['small', 'medium', 'large']) {
    const K = fresh();
    const s = K.kit.run({ kit: 'sandbox', biome, size, world: { seed: 7 }, musicStyle: { mood: 'calm', tempo: 'slow', seed: 3 }, features: ['fly', 'sprint'] });
    run(s, 2);
    assert.ok(Number.isFinite(s.p.x) && Number.isFinite(s.p.y), biome + size);
    assert.ok(s.render(new Uint8ClampedArray(160 * 100 * 4))[3] === 255);
  }
});
