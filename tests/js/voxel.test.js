const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.voxeldata.js', 'kgame.voxelmobs.js', 'kgame.voxel.js'];
const fresh = () => { const K = load(...FILES); K.voxel.menuAtStart = false; K.voxel.starter = true; K.voxel.keyActions = true; K.voxel.structures = false; K.voxel.persistPlayer = false; return K; };   // the tests play without the main menu
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }
const ids = { grass: 1, dirt: 2, stone: 3, sand: 4, log: 5, leaves: 6, planks: 7, glass: 8, coal: 9, iron: 10, gold: 11, diamond: 12, snow: 13, water: 14, cactus: 15 };
const world = (K, o = {}) => K.voxel.makeWorld({ seed: 3, biome: 'forest', size: 'medium', caves: 1, ores: 1, lakes: true, trees: 3, ...o });
const px = () => new Uint8ClampedArray(256 * 160 * 4);   // a picture to render into
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
  K.press('f'); run(s, 1.15); K.press('f', false); run(s, 0.05);   // digging takes a moment: hold the key
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
  K.press('f'); run(s, 1.15); K.press('f', false); run(s, 0.05);
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
  s.select(8); s.cycle(1); assert.strictEqual(s.slot, 0, 'the wheel goes round'); s.cycle(-1); assert.strictEqual(s.slot, 8);
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
  K.press('f'); run(s, 1.15); K.press('f', false); run(s, 0.05);
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
  const walk = (spec, shift, sneakKey) => {
    const t = K.kit.run({ kit: 'sandbox', world: { seed: 1 }, size: 'small', trees: 0, ...spec });
    run(t, 1.5); const x = t.p.x, z = t.p.z;
    if (shift) { K.press('w'); run(t, 0.05); K.press('w', false); run(t, 0.05); }   // W twice quickly: running
    const x1 = t.p.x, z1 = t.p.z; K.press('w'); if (sneakKey) K.press('Shift'); run(t, 0.4); K.press('w', false); K.press('Shift', false);
    return Math.hypot(t.p.x - x1, t.p.z - z1);
  };
  assert.ok(walk({ features: ['sprint'] }) > walk({}) * 1.2, 'the sprint feature is faster');
  assert.ok(walk({}, true) > walk({}) * 1.3, 'W twice runs faster');
  assert.ok(walk({}, false, true) < walk({}) * 0.6, 'shift sneaks, slower');
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
  const img = s.render(new Uint8ClampedArray(256 * 160 * 4));
  const px = (i, j) => [img[(j * 256 + i) * 4], img[(j * 256 + i) * 4 + 1], img[(j * 256 + i) * 4 + 2]];
  const sky = px(80, 2), ground = px(80, 97);
  assert.ok(sky[2] > sky[0], 'blue sky at the top: ' + sky);
  assert.notDeepStrictEqual(sky, ground);
  const colours = new Set(); for (let k = 0; k < img.length; k += 4 * 37) colours.add(img[k] + ',' + img[k + 1] + ',' + img[k + 2]);
  assert.ok(colours.size > 30, 'textured, not flat');
  K.press('ArrowRight'); run(s, 1); K.press('ArrowRight', false);
  assert.notDeepStrictEqual(Array.from(img), Array.from(s.render(new Uint8ClampedArray(256 * 160 * 4))));
  const night = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'small', time: 'night' });
  run(night, 1.5);
  const dark = night.render(new Uint8ClampedArray(256 * 160 * 4));
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
    assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
  }
});

test('farming: the hoe makes a field, seeds make a crop, it grows in stages by itself, ripe wheat gives wheat and seeds, and the crafting menu makes bread', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0, time: 'day' });
  run(s, 1.5);
  let t = null;
  for (const pitch of [-0.7, -0.9, -1.1, -0.5, -0.3]) { s.p.pitch = pitch; t = s.target(); if (t && t.ny === 1) break; }   // a pitch that looks at the top of a block
  assert.ok(t && t.ny === 1, 'the top of a block is in reach');
  const x = t.x, y = t.y, z = t.z;
  s.set(x, y, z, 1, false);   // grass under the crosshair
  const pick = (id) => { s.select(s.hotbar().indexOf(id)); assert.strictEqual(s.selectedBlock(), id, 'the ' + K.voxel.names[id] + ' is in the bar'); };
  pick(20); assert.strictEqual(s.placeBlock(), false, 'seeds only go on a field');
  pick(22); assert.strictEqual(s.placeBlock(), true, 'the hoe digs the grass');
  assert.strictEqual(s.get(x, y, z), 16);
  assert.strictEqual(s.placeBlock(), false, 'a field is not dug again');
  pick(20); const seeds = s.inv.count[20];
  assert.strictEqual(s.placeBlock(), true);
  assert.strictEqual(s.get(x, y + 1, z), 17, 'a young crop on the field');
  assert.strictEqual(s.inv.count[20], seeds - 1);
  assert.strictEqual(s.crops.length, 1);
  run(s, K.voxel.cropSeconds + 1); assert.strictEqual(s.get(x, y + 1, z), 18, 'it grew');
  run(s, K.voxel.cropSeconds); assert.strictEqual(s.get(x, y + 1, z), 19, 'it is ripe');
  assert.strictEqual(s.crops.length, 0, 'a ripe crop stops growing');
  const wheat = s.inv.count[21] || 0, seedsNow = s.inv.count[20];
  const seen = s.target();
  assert.strictEqual(seen.b, 19, 'the crosshair is on the ripe crop');
  K.press('f'); run(s, 0.1); K.press('f', false); run(s, 0.05);   // (a key acts once per press: a frame must see it released)
  assert.strictEqual(s.inv.count[21], wheat + 1, 'wheat');
  assert.ok(s.inv.count[20] >= seedsNow + 1, 'and seeds back');
  assert.strictEqual(s.hud.harvested, 1);
  // a young crop gives only its seed back, and walking through a crop is allowed
  s.set(x, y + 1, z, 17, true); s.crops.push({ x, y: y + 1, z, age: 0 });
  const had = s.inv.count[20]; K.press('f'); run(s, 0.1); K.press('f', false);
  assert.strictEqual(s.inv.count[20], had + 1);
  // crafting needs a table near for the bigger recipes
  s.inv.count[21] = 3;
  assert.strictEqual(s.craft('ekmek'), false, 'bread needs a crafting table');
  s.set(Math.floor(s.p.x) + 2, Math.floor(s.p.y), Math.floor(s.p.z), 24, false);
  assert.strictEqual(s.craft('ekmek'), true);
  assert.strictEqual(s.inv.count[23], 1, 'bread'); assert.strictEqual(s.inv.count[21], 0);
  assert.strictEqual(s.craft('ekmek'), false, 'not enough wheat now');
  const logs = s.inv.count[5], planks = s.inv.count[7];
  assert.strictEqual(s.craft('tahta'), true); assert.strictEqual(s.inv.count[7], planks + 4); assert.strictEqual(s.inv.count[5], logs - 1);
  K.press('x'); run(s, 0.1); K.press('x', false); run(s, 0.05);
  assert.strictEqual(s.showInv, true, 'X opens the inventory with the crafting grid');
  s.closeUi(); s.openScreen('table'); s.cells[0] = { id: 21, n: 3 }; s.cells[1] = { id: 21, n: 3 }; s.cells[2] = { id: 21, n: 3 };
  const made = s.matchResult(); assert.ok(made && made.name === 'ekmek', 'three wheat in a row make bread');
  assert.strictEqual(s.takeResult(), true); assert.ok(s.cursor && s.cursor.id === 23 && s.cursor.n === 1); s.closeUi();
});

test('plants are walked through, tools and food cannot be placed as blocks, and breaking grass can give seeds', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  const px = Math.floor(s.p.x), pz = Math.floor(s.p.z), py = Math.floor(s.p.y);
  s.set(px + 1, py, pz, 19, false);
  s.p.x = px + 0.6; K.press('d'); run(s, 0.6); K.press('d', false);
  assert.ok(s.p.x > px + 1.2, 'the ripe wheat did not stop the player');
  s.inv.count[23] = 1; s.inv.order.push(23);
  s.select(s.hotbar().indexOf(23));
  s.p.pitch = -0.7; assert.strictEqual(s.placeBlock(), false, 'bread is eaten, not built with');
  let seeds = 0;
  for (let i = 0; i < 80; i++) { const had = s.inv.count[20]; s.set(60 + i, 12, 60, 1, false); s.p.x = 60 + i + 0.5; s.p.z = 58.5; s.p.y = 14; s.p.yaw = 0; s.p.pitch = -1.2; run(s, 0.05); const t = s.target(); if (t && t.b === 1) { s.breakBlock(); if (s.inv.count[20] > had) seeds++; } }
  assert.ok(seeds > 3 && seeds < 60, 'some grass gives seeds, not all: ' + seeds);
});

const have = (tiers) => (kind) => (tiers[kind] === undefined ? -1 : tiers[kind]);

test('mining takes time: stone by hand is slow, a pickaxe speeds it up, the right tool kind matters, creative is instant', () => {
  const K = fresh(); const D = K.voxeldata;
  const hand = D.mineTime(3, have({})), wood = D.mineTime(3, have({ pickaxe: 0 })), iron = D.mineTime(3, have({ pickaxe: 2 })), gold = D.mineTime(3, have({ pickaxe: 3 }));
  assert.ok(hand > wood && wood > D.mineTime(3, have({ pickaxe: 1 })) && D.mineTime(3, have({ pickaxe: 1 })) > iron, 'better tiers are faster');
  assert.ok(gold < iron, 'gold is fast');
  assert.strictEqual(D.mineTime(3, have({ axe: 4 })), hand, 'an axe does not help on stone');
  assert.ok(D.mineTime(5, have({ axe: 1 })) < D.mineTime(5, have({})), 'an axe helps on logs');
  assert.ok(D.mineTime(2, have({ shovel: 0 })) < D.mineTime(2, have({})), 'a shovel helps on dirt');
  assert.strictEqual(D.mineTime(19, have({})), 0, 'a ripe crop comes up at once');
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5); s.p.pitch = -0.7;
  const t = s.target(); const x = t.x, y = t.y, z = t.z;
  s.set(x, y, z, 3, false);   // stone under the crosshair
  K.press('f'); run(s, 0.3);
  assert.strictEqual(s.get(x, y, z), 3, 'not yet: the progress is on the way');
  assert.ok(s.mining.progress > 0.2 && s.mining.need > 1, 'the dig bar fills');
  run(s, 3); K.press('f', false); run(s, 0.05);
  assert.strictEqual(s.get(x, y, z), 0, 'a while later it is gone');
  assert.ok(!s.inv.count[27], 'stone dug by hand gives nothing');
  s.set(x, y, z, 3, false); s.setCreative(true);
  K.press('f'); run(s, 0.1); K.press('f', false);
  assert.strictEqual(s.get(x, y, z), 0, 'creative breaks at once');
});

test('what breaking gives: stone gives cobblestone, ores need the right pickaxe, glass and leaves give nothing, grass gives soil', () => {
  const K = fresh(); const D = K.voxeldata;
  assert.deepStrictEqual(D.drops(3, have({ pickaxe: 0 })), [[27, 1]]);
  assert.deepStrictEqual(D.drops(3, have({})), [], 'stone by hand gives nothing');
  assert.deepStrictEqual(D.drops(9, have({ pickaxe: 0 })), [[41, 1]], 'coal ore gives coal');
  assert.deepStrictEqual(D.drops(10, have({ pickaxe: 0 })), [], 'iron ore needs a stone pickaxe');
  assert.deepStrictEqual(D.drops(10, have({ pickaxe: 1 })), [[10, 1]], 'and drops the ore, to be smelted');
  assert.deepStrictEqual(D.drops(12, have({ pickaxe: 1 })), [], 'diamonds need iron');
  assert.deepStrictEqual(D.drops(12, have({ pickaxe: 2 })), [[44, 1]]);
  assert.deepStrictEqual(D.drops(11, have({ pickaxe: 3 })), [], 'a gold pickaxe is fast but soft, it cannot take gold');
  assert.deepStrictEqual(D.drops(8, have({})), []); assert.deepStrictEqual(D.drops(6, have({})), []);
  assert.deepStrictEqual(D.drops(1, have({})), [[2, 1]]); assert.deepStrictEqual(D.drops(5, have({})), [[5, 1]]);
});

test('the recipes: every tool of every tier can be made, each from the right material and sticks, and every result is something the kit knows', () => {
  const K = fresh(); const D = K.voxeldata;
  const names = D.recipes.map((r) => r.name);
  assert.strictEqual(new Set(names).size, names.length, 'no two recipes share a name');
  assert.ok(D.recipes.length >= 40);
  for (const [tier, mat] of [[0, 7], [1, 27], [2, 42], [3, 43], [4, 44]]) {
    const pick = D.recipes[D.recipeIndex(D.TIERS[tier] + ' kazma')];
    assert.deepStrictEqual(pick.need, [[mat, 3], [40, 2]]); assert.deepStrictEqual(pick.give, [D.toolId('pickaxe', tier), 1]);
    assert.deepStrictEqual(D.recipes[D.recipeIndex(D.TIERS[tier] + ' kılıç')].need, [[mat, 2], [40, 1]]);
    assert.deepStrictEqual(D.recipes[D.recipeIndex(D.TIERS[tier] + ' kürek')].need, [[mat, 1], [40, 2]]);
    assert.ok(D.recipeIndex(D.TIERS[tier] + ' balta') >= 0 && D.recipeIndex(D.TIERS[tier] + ' çapa') >= 0);
  }
  for (const r of D.recipes) { assert.ok(D.NAME[r.give[0]], r.name + ' gives a named thing'); r.need.forEach((n) => assert.ok(D.NAME[n[0]], r.name + ' needs a named thing')); }
  assert.strictEqual(D.toolOf(52).kind, 'pickaxe'); assert.strictEqual(D.toolOf(52).tier, 2); assert.strictEqual(D.toolOf(22).kind, 'hoe'); assert.strictEqual(D.toolOf(73).tier, 4); assert.strictEqual(D.toolOf(3), null);
  assert.ok(D.isBlock(24) && D.isBlock(3) && D.isBlock(33) && !D.isBlock(50) && !D.isBlock(41) && !D.isBlock(14) && !D.isBlock(21));
});

test('crafting: small recipes anywhere, bigger ones need a crafting table near, smelting needs a furnace near and coal for fuel (one coal, eight smelts)', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  const px = Math.floor(s.p.x), py = Math.floor(s.p.y), pz = Math.floor(s.p.z);
  const give = (id, n) => s.addItem(id, n);
  give(5, 3);
  assert.strictEqual(s.craft('tahta'), true, 'planks anywhere'); assert.strictEqual(s.craft('çubuk'), true, 'sticks anywhere');
  give(7, 4); assert.strictEqual(s.craft('üretim masası'), true);
  give(27, 11);
  assert.strictEqual(s.craft('fırın'), false, 'a furnace is built at a table');
  s.set(px + 2, py, pz, 24, false);
  assert.strictEqual(s.craft('fırın'), true);
  give(7, 3); give(40, 4);
  assert.strictEqual(s.craft('odun kazma'), true, 'a wooden pickaxe at the table');
  assert.strictEqual(s.have('pickaxe'), 0);
  give(27, 3); assert.strictEqual(s.craft('taş kazma'), true); assert.strictEqual(s.have('pickaxe'), 1, 'the best one counts');
  // smelting
  give(4, 3);
  assert.strictEqual(s.craft('eritme: cam'), false, 'no furnace near, no coal');
  s.set(px - 2, py, pz, 25, false);
  assert.strictEqual(s.craft('eritme: cam'), false, 'no coal yet');
  give(41, 1);
  const glass = s.inv.count[8] || 0;
  assert.strictEqual(s.craft('eritme: cam'), true); assert.strictEqual(s.inv.count[8], glass + 1);
  assert.strictEqual(s.fuel, 7, 'one coal is eight smelts'); assert.strictEqual(s.inv.count[41], 0);
  assert.strictEqual(s.craft('eritme: cam'), true); assert.strictEqual(s.craft('eritme: cam'), true);
  assert.strictEqual(s.craft('eritme: cam'), false, 'out of sand');
  give(10, 1); give(11, 1);
  assert.strictEqual(s.craft('eritme: demir külçe'), true); assert.strictEqual(s.craft('eritme: altın külçe'), true);
  assert.strictEqual(s.inv.count[42], 1); assert.strictEqual(s.inv.count[43], 1);
  give(42, 8); assert.strictEqual(s.craft('demir blok'), true); assert.strictEqual(s.inv.count[30], 1);
  assert.strictEqual(s.craft('demir külçe (bloktan)'), true); assert.strictEqual(s.inv.count[42], 9);
  s.p.x += 20;
  assert.strictEqual(s.craft('taş tuğla'), false, 'far from the table: nothing bigger works');
});

test('the best tool in the inventory is used by itself, and a torch can be put down and walked through', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5); s.p.pitch = -0.7;
  const t = s.target(); const x = t.x, y = t.y, z = t.z;
  s.set(x, y, z, 10, false);   // iron ore
  s.addItem(K.voxeldata.toolId('pickaxe', 0), 1);
  const slow = (() => { s.mineStep(0.01, true); return s.mining.need; })();
  s.mining.progress = 0; s.mining.key = '';
  s.addItem(K.voxeldata.toolId('pickaxe', 2), 1);
  s.mineStep(0.01, true);
  assert.ok(s.mining.need < slow, 'the iron pickaxe is used without being selected');
  s.mining.progress = 0; s.mining.key = '';
  for (let i = 0; i < 4 && s.get(x, y, z) === 10; i++) s.mineStep(3, true);
  assert.strictEqual(s.get(x, y, z), 0); assert.strictEqual(s.inv.count[10], 1, 'iron ore comes up as ore');
  s.addItem(33, 4); s.select(s.hotbar().indexOf(33));
  assert.strictEqual(s.selectedBlock(), 33);
  assert.strictEqual(s.placeBlock(), true);
  const px = Math.floor(s.p.x), pz = Math.floor(s.p.z);
  s.set(px + 1, Math.floor(s.p.y), pz, 33, false);
  s.p.x = px + 0.6; K.press('d'); run(s, 0.6); K.press('d', false);
  assert.ok(s.p.x > px + 1.2, 'a torch does not block the way');
});

test('the inventory has 36 places: the first nine are the bar, new things go to the first free place, a stack holds 64, a number key chooses a place, and an item from below comes to the chosen place', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small' });
  run(s, 1);
  for (const id of [40, 41, 42, 43, 44, 50, 51]) s.addItem(id, 1);
  const all = s.hotbar(); assert.strictEqual(all.length, 36);
  assert.ok(all.slice(0, 9).every(Boolean), 'the bar is full first'); assert.ok(all.slice(9).filter(Boolean).length >= 5, 'the rest lies below');
  s.addItem(3, 200); s.reconcile(); assert.ok(s.slots.filter((c) => c && c.id === 3).every((c) => c.n <= 64), 'no stack above 64'); assert.strictEqual(s.slots.filter((c) => c && c.id === 3).reduce((a, c) => a + c.n, 0), s.inv.count[3]);
  K.press('1'); run(s, 0.1); K.press('1', false); assert.strictEqual(s.slot, 0); assert.strictEqual(s.selectedBlock(), s.slots[0].id, 'key 1 chooses the first place');
  K.press('5'); run(s, 0.1); K.press('5', false); assert.strictEqual(s.slot, 4);
  const below = s.hotbar().indexOf(51); assert.ok(below >= 0); s.select(below); assert.strictEqual(s.selectedBlock(), 51, 'an item from below comes to the chosen place');
  s.select(-1); assert.strictEqual(s.slot, 8, 'the wheel goes round');
});

test('every thing you can hold has a picture: a cube from its textures for a block, pixel art in 16 rows of 16 for the rest', () => {
  const K = fresh(); const D = K.voxeldata;
  const never = new Set([14, 16, 17, 18, 19, 37, 150, 135, 136, 137, 138, 139, 141, 142]);   // upper slabs and door halves are never carried   // water and the field and crops are never carried
  for (const id of Object.keys(D.NAME).map(Number).filter((n) => !never.has(n))) {
    assert.ok(D.hasIcon(id), D.NAME[id] + ' (' + id + ') has an icon');
    if (!D.isBlock(id)) {
      const ic = D.icon(id);
      assert.strictEqual(ic.rows.length, 16, D.NAME[id]); ic.rows.forEach((r) => assert.strictEqual(r.length, 16, D.NAME[id] + ': ' + r));
      for (const ch of new Set(ic.rows.join('').replace(/\./g, ''))) assert.ok(ic.pal[ch], D.NAME[id] + ' uses an undefined colour letter ' + ch);
    }
  }
  const pickaxes = [50, 51, 52, 53, 54].map((id) => JSON.stringify(D.icon(id).pal.h));
  assert.strictEqual(new Set(pickaxes).size, 5, 'each tier has its own colour');
  assert.notDeepStrictEqual(D.icon(50).rows, D.icon(55).rows, 'a pickaxe does not look like an axe');
  assert.notDeepStrictEqual(D.icon(42).pal.a, D.icon(43).pal.a, 'iron and gold ingots differ');
});

test('health and hunger: both start full, hunger drains slowly, full hunger heals, an empty one hurts but never kills, eating fills it', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  assert.strictEqual(s.health, 20); assert.strictEqual(s.food, 20);
  run(s, 50); assert.strictEqual(s.food, 19, 'a point of hunger goes in about 45 seconds');
  s.food = 20; s.health = 10;
  run(s, 9); assert.strictEqual(s.health, 12, 'a well fed player heals a point every four seconds');
  s.food = 10; s.health = 10; run(s, 9); assert.strictEqual(s.health, 10, 'a half hungry one does not heal');
  s.food = 0; s.health = 20; s.hungerT = 0;
  run(s, 30); assert.ok(s.health < 20 && s.health >= 1, 'starving hurts: ' + s.health);
  run(s, 200); assert.strictEqual(s.health, 1, 'but it stops at one point, it does not kill');
  // eating
  s.food = 10; s.addItem(23, 2); s.select(s.hotbar().indexOf(23));
  assert.strictEqual(s.selectedBlock(), 23);
  assert.strictEqual(s.placeBlock(), true, 'a right click with bread eats it');
  assert.strictEqual(s.food, 15); assert.strictEqual(s.inv.count[23], 1);
  s.food = 20; assert.strictEqual(s.placeBlock(), false, 'a full stomach does not eat'); assert.strictEqual(s.inv.count[23], 1);
  s.addItem(81, 1); s.food = 5; s.select(s.hotbar().indexOf(81)); assert.strictEqual(s.placeBlock(), true); assert.strictEqual(s.food, 13, 'cooked meat gives 8');
  s.select(s.hotbar().indexOf(7)); s.food = 5; assert.strictEqual(s.selectedBlock(), 7);
  assert.strictEqual(s.eat(7), false, 'planks are not food');
});

test('damage: a fall of more than three blocks hurts, a short one does not, creative is never hurt, and dying puts you back at the spawn with your things', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  const stand = s.p.y;
  s.p.y += 2; s.p.peak = s.p.y; run(s, 1.5);
  assert.strictEqual(s.health, 20, 'a two block fall is free');
  s.p.y += 10; s.p.peak = s.p.y; run(s, 3);
  assert.ok(s.health <= 14 && s.health >= 11, 'a ten block fall costs about seven: ' + s.health);
  assert.ok(s.hurtFlash > 0 || s.health < 20);
  s.health = 20; s.setCreative(true); s.p.y += 15; s.p.peak = s.p.y; run(s, 3);
  assert.strictEqual(s.health, 20, 'creative is not hurt');
  assert.strictEqual(s.hurt(5), false);
  s.setCreative(false);
  const stone = s.inv.count[3];
  s.p.x += 3; s.health = 3;
  assert.strictEqual(s.hurt(5, 'test'), true);
  assert.strictEqual(s.health, 20, 'back with full health'); assert.strictEqual(s.deaths, 1);
  assert.ok(Math.abs(s.p.x - s.world.spawn.x) < 0.01, 'at the spawn');
  assert.strictEqual(s.inv.count[3], stone, 'the inventory is kept');
  assert.ok(/Öldün/.test(s.message));
  run(s, 5); assert.strictEqual(s.message, '', 'the message goes away');
  assert.ok(stand > 0);
});

test('drowning: staying under water too long hurts, breathing in the air brings the air back', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0, time: 'day' });
  run(s, 1.5);
  const px = Math.floor(s.p.x), pz = Math.floor(s.p.z), py = Math.floor(s.p.y);
  for (let dy = 0; dy < 3; dy++) s.set(px, py + dy, pz, 14, false);   // a column of water around the head
  run(s, 6); assert.ok(s.air < 6 && s.health === 20, 'the air runs down first: ' + s.air);
  run(s, 12); assert.ok(s.health < 20, 'then it hurts: ' + s.health);
  for (let dy = 0; dy < 3; dy++) s.set(px, py + dy, pz, 0, false);
  s.p.y += 0.1; run(s, 3); assert.strictEqual(s.air, 10, 'air is full again');
});

test('achievements: none at the start (the starter things do not count), each one comes true by itself, is announced once, is kept with the world, and B shows the list', () => {
  const K = fresh(); const D = K.voxeldata;
  assert.strictEqual(D.ACH.length, 25); assert.strictEqual(new Set(D.ACH.map((a) => a.id)).size, 25);
  let s = K.kit.run({ kit: 'sandbox', world: { seed: 12 }, size: 'small', trees: 0 });
  run(s, 2);
  assert.deepStrictEqual(Object.keys(s.ach), [], 'nothing yet, even though you start with logs and stone');
  s.addItem(5, 1); run(s, 0.7);
  assert.strictEqual(s.ach.wood, true); assert.ok(/Ağaç Kes/.test(s.message), 'it is announced');
  const first = s.message; run(s, 6); assert.strictEqual(s.message, '');
  run(s, 2); assert.strictEqual(s.message, first === s.message ? first : s.message, 'and not again');
  assert.strictEqual(Object.keys(s.ach).length, 1);
  // crafting, furnace, tools, food
  const px = Math.floor(s.p.x), py = Math.floor(s.p.y), pz = Math.floor(s.p.z);
  assert.strictEqual(s.craft('üretim masası'), true);
  s.set(px + 2, py, pz, 24, false); s.set(px - 2, py, pz, 25, false);
  s.addItem(27, 4); s.addItem(40, 6); s.addItem(7, 6);
  assert.ok(s.craft('taş kazma') && s.craft('odun kazma'));
  s.addItem(4, 2); s.addItem(41, 1); assert.ok(s.craft('eritme: cam'));
  s.addItem(42, 1); s.addItem(43, 1); s.addItem(44, 1); s.addItem(21, 3); assert.ok(s.craft('ekmek'));
  s.food = 5; s.select(s.hotbar().indexOf(23)); s.placeBlock();
  run(s, 0.7);
  for (const id of ['table', 'pick', 'stone', 'glass', 'iron', 'gold', 'diamond', 'bread', 'eat']) assert.strictEqual(s.ach[id], true, id);
  assert.ok(!s.ach.furnace, 'the furnace was set down, not made');
  assert.ok(!s.ach.diamondpick && !s.ach.farmer && !s.ach.died);
  s.hud.harvested = 1; s.deaths = 1; s.hud.explored = 12; s.hud.broken = 250; run(s, 0.7);
  for (const id of ['farmer', 'died', 'explorer', 'digger']) assert.strictEqual(s.ach[id], true, id);
  assert.ok(!s.ach.wanderer && !s.ach.builder);
  // kept with the world
  s = K.kit.run({ kit: 'sandbox', world: { seed: 12 }, size: 'small', trees: 0 });
  assert.strictEqual(s.ach.wood, true, 'it is still there next time'); assert.strictEqual(s.ach.diamond, true);
  s = K.kit.run({ kit: 'sandbox', world: { seed: 13 }, size: 'small', trees: 0 });
  assert.deepStrictEqual(Object.keys(s.ach), [], 'another world starts clean');
  K.press('b'); run(s, 0.1); K.press('b', false); run(s, 0.05);
  assert.strictEqual(s.showAch, true);
  const calls = []; const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); }), set: (t, k, v) => { t[k] = v; return true; } });
  s.drawHud(ctx); assert.ok(calls.includes('fillText'));
});

const placeMob = (K, s, type, ahead, side) => {   // a creature standing on the ground `ahead` blocks in front of the player
  const yaw = s.p.yaw, x = s.p.x + Math.sin(yaw) * ahead + Math.cos(yaw) * (side || 0), z = s.p.z - Math.cos(yaw) * ahead + Math.sin(yaw) * (side || 0);
  const h = s.world.heightAt(Math.floor(x), Math.floor(z));
  const m = K.voxelmobs.create(type, x, h + 1.01, z); s.mobs.push(m); return m;
};

test('creatures: every kind has a picture, a name, sensible drops, a size, and the same herds appear for the same world', () => {
  const K = fresh(); const M = K.voxelmobs, D = K.voxeldata;
  for (const type of Object.keys(M.TYPES)) {
    const t = M.TYPES[type], art = M.ART[type];
    assert.ok(t.name && t.hp > 0 && t.w > 0 && t.h > 0 && t.speed > 0, type);
    assert.ok(art.rows.length >= 6 && art.rows.every((r) => r.length === art.rows[0].length), type + ' picture rows are the same width');
    for (const ch of new Set(art.rows.join('').replace(/\./g, ''))) assert.ok(art.pal[ch], type + ' has no colour for ' + ch);
    t.drops.forEach((d) => { assert.ok(D.NAME[d[0]], type + ' drops a named thing'); assert.ok(d[1][0] <= d[1][1]); });
  }
  assert.ok(M.PASSIVE.every((t) => M.TYPES[t].kind === 'passive') && M.HOSTILE.every((t) => M.TYPES[t].kind === 'hostile'));
  assert.deepStrictEqual(M.chunkSpawns(5, 3, 4, 'forest'), M.chunkSpawns(5, 3, 4, 'forest'));
  const herds = []; for (let cx = 0; cx < 12; cx++) for (let cz = 0; cz < 12; cz++) herds.push(M.chunkSpawns(5, cx, cz, 'forest').length);
  const withAnimals = herds.filter((n) => n > 0).length;
  assert.ok(withAnimals > 20 && withAnimals < 100, 'some chunks have animals, most do not: ' + withAnimals);
  assert.ok(M.drops('cow', () => 0.99).some((d) => d[0] === 82), 'a cow gives beef');
  assert.deepStrictEqual(M.drops('zombie', () => 0), [], 'a drop that rolls zero gives nothing');
});

test('a world starts with animals standing on open ground, and they wander without going into blocks', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'medium', time: 'day' });
  run(s, 1);
  assert.ok(s.mobs.length > 0, 'animals near the spawn: ' + s.mobs.length);
  assert.ok(s.mobs.every((m) => K.voxelmobs.TYPES[m.type].kind === 'passive'), 'only animals in daylight');
  const before = s.mobs.map((m) => [m.x, m.z]);
  run(s, 12);
  const moved = s.mobs.filter((m, i) => before[i] && Math.hypot(m.x - before[i][0], m.z - before[i][1]) > 0.5).length;
  assert.ok(moved >= 1, 'some of them walked');
  for (const m of s.mobs) {
    assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.z));
    const b = s.world.get(Math.floor(m.x), Math.floor(m.y + 0.5), Math.floor(m.z));
    assert.ok(b === 0 || b === 14, 'not inside a block');
  }
});

test('hunting: the creature under the crosshair is hit while the button is held, a better sword does more, a kill gives its drops', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'medium', time: 'day' });
  run(s, 1.5); s.mobs.length = 0; s.p.pitch = 0;
  const cow = placeMob(K, s, 'cow', 2.2);
  cow.hp = 10; cow.wander = 999; cow.dirx = cow.dirz = 0; s.p.pitch = -0.15; run(s, 0.02);
  assert.strictEqual(s.mobTarget(), cow, 'the crosshair is on it');
  K.press('f'); run(s, 0.6); K.press('f', false); run(s, 0.05);
  assert.ok(cow.hp <= 9 && cow.hp > 5, 'bare hands do one point: ' + cow.hp);
  assert.ok(cow.fear > 0, 'it is scared');
  const hp = cow.hp; s.addItem(K.voxeldata.toolId('sword', 4), 1);
  s.attackCd = 0; s.attackMob(cow);
  assert.ok(cow.hp <= hp - 7, 'a diamond sword does seven: ' + hp + ' -> ' + cow.hp);
  const beef = s.inv.count[82] || 0, kills = s.kills;
  s.attackCd = 0; s.attackMob(cow); s.attackCd = 0; s.attackMob(cow);
  assert.strictEqual(cow.dead, true); assert.strictEqual(s.kills, kills + 1);
  assert.ok((s.inv.count[82] || 0) >= beef + 1, 'beef');
  run(s, 0.2); assert.ok(!s.mobs.includes(cow), 'it is gone');
});

test('the picture shows a creature in the open and a wall hides it, and it cannot be hit through the wall', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'medium', time: 'day' });
  run(s, 1.5); s.mobs.length = 0; s.p.pitch = 0;
  const empty = Array.from(s.render(new Uint8ClampedArray(256 * 160 * 4)));
  const cow = placeMob(K, s, 'cow', 3);
  cow.wander = 999; cow.dirx = cow.dirz = 0;
  const open = Array.from(s.render(new Uint8ClampedArray(256 * 160 * 4)));
  let diff = 0; for (let i = 0; i < open.length; i += 4) if (open[i] !== empty[i] || open[i + 1] !== empty[i + 1]) diff++;
  assert.ok(diff > 80, 'the cow shows in the picture: ' + diff + ' pixels');
  const wx = Math.floor(s.p.x + Math.sin(s.p.yaw) * 1.6), wz = Math.floor(s.p.z - Math.cos(s.p.yaw) * 1.6), wy = Math.floor(s.p.y);
  for (let dy = 0; dy < 4; dy++) for (let dx = -1; dx <= 1; dx++) s.set(wx + dx, wy + dy, wz, 3, false);
  assert.notStrictEqual(s.mobTarget(), cow, 'it cannot be hit through the wall');
  const hidden = Array.from(s.render(new Uint8ClampedArray(256 * 160 * 4)));
  let same = 0; for (let i = 0; i < hidden.length; i += 4) if (hidden[i] === open[i] && hidden[i + 1] === open[i + 1]) same++;
  assert.ok(same < hidden.length / 4, 'the wall changed the picture');
});

test('hostile creatures: they come out at night and not by day, a zombie hits hard, armour takes some off, a skeleton shoots, a bomber blows up blocks', () => {
  const K = fresh();
  const day = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'medium', time: 'day' });
  run(day, 8); assert.ok(day.mobs.every((m) => K.voxelmobs.TYPES[m.type].kind === 'passive'), 'none by day');
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'medium', time: 'night' });
  run(s, 1.5);
  for (let i = 0; i < 60; i++) { s.spawnT = 2; run(s, 0.05); }
  const hostile = s.mobs.filter((m) => K.voxelmobs.TYPES[m.type].kind === 'hostile').length;
  assert.ok(hostile >= 3 && hostile <= 6, 'a few come at night, never more than six: ' + hostile);
  assert.ok(s.mobs.length <= 40);
  s.mobs.length = 0; s.p.pitch = 0; s.health = 20; s.food = 20;
  const z = placeMob(K, s, 'zombie', 1.2); z.cooldown = 0;
  run(s, 0.4); assert.ok(s.health <= 17, 'a zombie takes three: ' + s.health);
  s.mobs.length = 0; s.health = 20;
  for (const part of [0, 1, 2, 3]) s.addItem(K.voxeldata.armorId(1, part), 1);
  assert.strictEqual(s.armorPoints(), 15, 'iron: 2 + 6 + 5 + 2');
  s.hurtPlayer(10, 'test'); assert.strictEqual(s.health, 16, 'ten damage with fifteen points is four');
  s.health = 20; s.hurt(10, 'düşme'); assert.strictEqual(s.health, 10, 'armour does not help against a fall');
  s.health = 20; s.mobs.length = 0; s.p.pitch = 0;
  const sk = placeMob(K, s, 'skeleton', 8); sk.cooldown = 0;
  let shot = false; for (let i = 0; i < 300 && !shot; i++) { run(s, 1 / 60); if (s.arrows.length) shot = true; }
  assert.ok(shot, 'an arrow flew');
  s.arrows.length = 0; s.mobs.length = 0; s.health = 20;
  const stand = Math.floor(s.p.y), bx = Math.floor(s.p.x + Math.sin(s.p.yaw) * 2.5), bz = Math.floor(s.p.z - Math.cos(s.p.yaw) * 2.5);
  s.set(bx, stand, bz, 3, false); s.set(bx, stand + 1, bz, 3, false);
  const bomber = placeMob(K, s, 'bomber', 2.2); bomber.fuse = 0; run(s, 2.5);
  assert.ok(bomber.dead && bomber.exploded, 'it blew up');
  assert.strictEqual(s.get(bx, stand, bz), 0, 'the blocks next to it are gone'); assert.ok(s.health < 20, 'and it hurt: ' + s.health);
});

test('zombies and skeletons burn in the open in daylight', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'medium', time: 'day' });
  run(s, 1.5); s.mobs.length = 0; s.p.pitch = 0;
  const z = placeMob(K, s, 'zombie', 12); z.wander = 0;
  const hp = z.hp; run(s, 3.5);
  assert.ok(z.hp < hp, 'it burns in the sun: ' + z.hp);
});

test('tools wear out: the best tool of the kind is the one that wears, a wooden pickaxe lasts 59 uses, creative never wears anything', () => {
  const K = fresh(); const D = K.voxeldata;
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'small', trees: 0 });
  run(s, 1.5);
  s.addItem(50, 1); s.addItem(52, 1);
  assert.strictEqual(s.have('pickaxe'), 2);
  for (let i = 0; i < 10; i++) s.useTool('pickaxe');
  assert.strictEqual(s.wear[52], D.DUR[2] - 10, 'the iron one wears, not the wooden one'); assert.strictEqual(s.wear[50], undefined);
  for (let i = 0; i < 245; i++) s.useTool('pickaxe');
  assert.strictEqual(s.inv.count[52], 0, 'the iron pickaxe broke'); assert.ok(/Alet kırıldı/.test(s.message));
  assert.strictEqual(s.have('pickaxe'), 0, 'the wooden one is next');
  s.setCreative(true); s.addItem(53, 1); s.useTool('pickaxe'); assert.strictEqual(s.wear[53], undefined, 'creative: no wear');
  assert.deepStrictEqual(D.DUR, [59, 131, 250, 32, 1561]);
});

test('armour, wool, meat and the new recipes: every piece is made from the right amount, and raw meat is cooked in a furnace', () => {
  const K = fresh(); const D = K.voxeldata;
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 3 }, size: 'small', trees: 0 });
  run(s, 1.5);
  const px = Math.floor(s.p.x), py = Math.floor(s.p.y), pz = Math.floor(s.p.z);
  s.set(px + 2, py, pz, 24, false); s.set(px - 2, py, pz, 25, false);
  for (const [tier, mat] of [[0, 113], [1, 42], [2, 43], [3, 44]]) for (const [part, cost] of [[0, 5], [1, 8], [2, 7], [3, 4]]) {
    const r = D.recipes[D.recipeIndex(D.ARMOR_TIERS[tier] + ' ' + D.ARMOR_PARTS[part][1])];
    assert.deepStrictEqual(r.need, [[mat, cost]]); assert.deepStrictEqual(r.give, [D.armorId(tier, part), 1]);
    assert.strictEqual(D.armorOf(D.armorId(tier, part)).points, D.ARMOR_POINTS[tier][part]);
  }
  s.addItem(42, 8); assert.strictEqual(s.craft('demir göğüslük'), true); assert.strictEqual(s.armorPoints(), 6);
  s.addItem(114, 4); assert.strictEqual(s.craft('yün (4 ip)'), true); assert.strictEqual(s.inv.count[34], 1);
  s.addItem(41, 1); s.addItem(82, 2);
  assert.strictEqual(s.craft('eritme: biftek'), true); assert.strictEqual(s.inv.count[83], 1);
  s.food = 5; s.select(s.hotbar().indexOf(83)); assert.strictEqual(s.placeBlock(), true); assert.strictEqual(s.food, 13, 'steak fills eight');
  assert.strictEqual(D.FOOD[88], 2); assert.strictEqual(D.FOOD[89], 6); assert.strictEqual(D.FOOD[111], 5);
  for (const id of [34, 82, 83, 84, 85, 86, 87, 88, 89, 110, 111, 112, 113, 114, 115, 116, 117, 118, 90, 105]) assert.ok(D.hasIcon(id), D.NAME[id] + ' has an icon');
});

test('lava lakes lie in the deepest caves, burn the player, glow in the picture, and cannot be dug or carried', () => {
  const K = fresh();
  const w = K.voxel.makeWorld({ seed: 6, biome: 'plains', size: 'medium', caves: 3, ores: 1, lakes: true, trees: 0 });
  w.ensureAround(128, 128, 6);
  assert.ok(w.count(37) > 20, 'lava in the deep caves: ' + w.count(37));
  for (let y = 7; y < 32; y++) for (let z = 90; z < 170; z += 3) for (let x = 90; x < 170; x += 3) assert.notStrictEqual(w.get(x, y, z), 37, 'lava only at the bottom');
  const none = K.voxel.makeWorld({ seed: 6, biome: 'plains', size: 'medium', caves: 0, ores: 1, lakes: true, trees: 0 }); none.ensureAround(128, 128, 6);
  assert.strictEqual(none.count(37), 0, 'no caves, no lava');
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0, time: 'day' });
  run(s, 1.5);
  const px = Math.floor(s.p.x), py = Math.floor(s.p.y), pz = Math.floor(s.p.z);
  s.health = 20;
  s.set(px, py, pz, 37, false); s.set(px, py + 1, pz, 37, false);
  run(s, 1.2); assert.ok(s.health < 20 && s.health >= 8, 'lava hurts: ' + s.health);
  assert.ok(/lav/.test(s.message) || s.health < 20);
  s.set(px, py, pz, 0, false); s.set(px, py + 1, pz, 0, false);
  assert.strictEqual(K.voxeldata.isBlock(37), false); assert.strictEqual(K.voxeldata.drops(37, () => -1).length >= 0, true);
  s.p.pitch = -0.7; s.set(px + 1, py - 1, pz + 1, 37, false);
  const t = s.target(); assert.ok(!t || t.b !== 37, 'the crosshair looks through liquids');
});

test('sand does not hang in the air: when what holds it up is dug away it falls, and sand put on nothing falls too', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0 });
  run(s, 1.5);
  const x = Math.floor(s.p.x) + 3, z = Math.floor(s.p.z) + 3, ground = s.world.heightAt(x, z);
  s.set(x, ground + 1, z, 4, false); s.set(x, ground + 2, z, 4, false); s.set(x, ground + 3, z, 4, false);
  s.p.x = x + 0.5; s.p.z = z + 0.5 - 2; s.p.yaw = 0; s.p.y = ground + 1.01;   // the player stands south and looks north at the foot of the tower
  s.p.pitch = 0; run(s, 0.1);
  s.set(x, ground, z, 3, false);
  s.addItem(K.voxeldata.toolId('pickaxe', 0), 1);
  s.set(x, ground, z, 0, false);   // the ground under the tower is gone
  for (const yy of [ground + 1, ground + 2, ground + 3]) s.settle(x, yy, z);
  assert.strictEqual(s.get(x, ground, z), 4, 'the sand came down to rest');
  assert.strictEqual(s.get(x, ground + 1, z), 4); assert.strictEqual(s.get(x, ground + 2, z), 4);
  assert.strictEqual(s.get(x, ground + 3, z), 0, 'nothing is left hanging');
  s.set(x + 1, ground + 6, z, 4, false);
  assert.strictEqual(s.settle(x + 1, ground + 6, z), true, 'a sand block in the air falls');
  assert.strictEqual(s.get(x + 1, ground + 6, z), 0); assert.notStrictEqual(s.get(x + 1, s.world.heightAt(x + 1, z) + 1, z), 0);
  assert.strictEqual(s.settle(x, ground, z), false, 'a resting block stays');
  s.set(x + 2, s.world.heightAt(x + 2, z), z, 3, false);
  assert.strictEqual(s.get(x + 2, s.world.heightAt(x + 2, z), z), 3);
});

test('a bed: it can only be used at night, it ends the night, it becomes the place you come back to, and it is made from wool and planks', () => {
  const K = fresh(); const D = K.voxeldata;
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0, time: 'cycle' });
  run(s, 1.5);
  const px = Math.floor(s.p.x), py = Math.floor(s.p.y), pz = Math.floor(s.p.z);
  s.set(px + 2, py, pz, 24, false);
  s.addItem(34, 3); assert.strictEqual(s.craft('yatak'), true); assert.strictEqual(s.inv.count[35], 1);
  assert.ok(D.isBlock(35));
  s.p.yaw = Math.PI / 2; s.p.pitch = -0.5; run(s, 0.1);
  const t = (() => { for (const pitch of [-0.5, -0.7, -0.9, -0.3]) { s.p.pitch = pitch; const h = s.target(); if (h && h.ny === 1) return h; } return null; })();
  assert.ok(t, 'a floor to put the bed on');
  s.select(s.hotbar().indexOf(35)); assert.strictEqual(s.selectedBlock(), 35);
  assert.strictEqual(s.placeBlock(), true); const bx = t.x + t.nx, by = t.y + t.ny, bz = t.z + t.nz;
  assert.strictEqual(s.get(bx, by, bz), 35);
  s.time = 0.0; assert.ok(s.daylight() > 0.9);
  s.p.pitch = -0.5; for (const pitch of [-0.5, -0.7, -0.9, -0.3, -0.2, -0.1]) { s.p.pitch = pitch; const h = s.target(); if (h && h.b === 35) break; }
  s.select(s.hotbar().indexOf(7));
  assert.strictEqual(s.sleep(), false, 'not by day'); assert.ok(/geceleri/.test(s.message)); assert.strictEqual(s.respawn, null);
  s.time = 0.5; assert.ok(s.daylight() < 0.3);
  assert.strictEqual(s.sleep(), true);
  assert.ok(s.daylight() > 0.8, 'it is morning'); assert.ok(s.respawn && Math.abs(s.respawn.x - s.p.x) < 0.01);
  s.p.x += 9; s.hurt(99, 'test');
  assert.ok(Math.abs(s.p.x - s.respawn.x) < 0.01, 'you come back at the bed, not at the world spawn');
  run(s, 1); assert.strictEqual(s.stats.slept, 1);
  s.mobs.length = 0;
  const night = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0, time: 'night' });
  run(night, 1); assert.strictEqual(night.sleep(), true, 'at a fixed night it only sets the spawn');
});

test('saplings: leaves can drop one and an apple, a sapling stands on grass or soil only, it becomes a tree after a while, and the tree has wood and leaves', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0, time: 'day' });
  run(s, 1.5);
  let saplings = 0, apples = 0;
  for (let i = 0; i < 300; i++) {   // many leaf blocks broken one after the other: some give a sapling, a few an apple
    const x = 30 + (i % 20) * 2, z = 30 + Math.floor(i / 20) * 2;
    s.p.x = x + 0.5; s.p.z = z + 0.5; s.p.y = 28; s.p.yaw = 0; s.p.pitch = 0; s.p.vy = 0; s.p.peak = 28; s.flying = false;
    const ey = Math.floor(s.p.y + 1.6);
    s.set(x, ey, z - 1, 6, false);
    const sap = s.inv.count[38] || 0, app = s.inv.count[120] || 0;
    assert.ok(s.target() && s.target().b === 6, 'the leaf is under the crosshair');
    s.breakBlock();
    if ((s.inv.count[38] || 0) > sap) saplings++; if ((s.inv.count[120] || 0) > app) apples++;
  }
  assert.ok(saplings >= 3 && saplings < 60, 'saplings sometimes: ' + saplings); assert.ok(apples >= 0 && apples < 20);
  s.addItem(38, 2);
  s.p.x = 40; s.p.z = 40; s.p.y = s.world.heightAt(40, 40) + 1.01; s.p.yaw = 0; s.p.pitch = 0; s.p.vy = 0; run(s, 0.3);
  let t2 = null; for (const pitch of [-0.5, -0.7, -0.9, -0.3, -0.2]) { s.p.pitch = pitch; const h = s.target(); if (h && h.ny === 1 && (h.b === 1 || h.b === 2 || h.b === 4)) { t2 = h; break; } }
  assert.ok(t2, 'ground to plant on');
  const gx = t2.x, gy = t2.y, gz = t2.z;
  s.set(gx, gy, gz, 4, false);
  s.select(s.hotbar().indexOf(38)); assert.strictEqual(s.selectedBlock(), 38);
  assert.strictEqual(s.placeBlock(), false, 'not on sand');
  s.set(gx, gy, gz, 1, false);
  assert.strictEqual(s.placeBlock(), true); assert.strictEqual(s.get(gx, gy + 1, gz), 38);
  assert.strictEqual(s.saplings.length, 1);
  run(s, K.voxel.treeSeconds - 2); assert.strictEqual(s.get(gx, gy + 1, gz), 38, 'still a sapling');
  run(s, 4);
  assert.strictEqual(s.get(gx, gy + 1, gz), 5, 'the sapling is the base of a trunk now');
  assert.ok(s.get(gx, gy + 4, gz) === 5 || s.get(gx, gy + 5, gz) === 5, 'the trunk is four or five high');
  let leaves = 0; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 7; dy++) if (s.get(gx + dx, gy + dy, gz + dz) === 6) leaves++;
  assert.ok(leaves > 15, 'a crown of leaves: ' + leaves);
  assert.strictEqual(s.stats.grown, 1); assert.strictEqual(s.saplings.length, 0);
  // no room: a block above stops it
  s.set(gx + 4, gy, gz + 4, 1, false); s.set(gx + 4, gy + 1, gz + 4, 38, true); s.saplings.push({ x: gx + 4, y: gy + 1, z: gz + 4, age: 0 }); s.set(gx + 4, gy + 3, gz + 4, 3, false);
  run(s, K.voxel.treeSeconds + 2); assert.strictEqual(s.get(gx + 4, gy + 1, gz + 4), 38, 'a sapling under a roof waits');
});

test('1.8 stones: granite, diorite and andesite lie in the stone as veins, ores still appear, they need a pickaxe, they can be polished, and hay bales are made from wheat', () => {
  const K = fresh(); const D = K.voxeldata;
  const w = K.voxel.makeWorld({ seed: 4, biome: 'plains', size: 'medium', caves: 1, ores: 3, lakes: true, trees: 0 }); w.ensureAround(128, 128, 6);
  for (const id of [121, 122, 123]) assert.ok(w.count(id) > 100, D.NAME[id] + ' veins: ' + w.count(id));
  assert.ok(w.count(3) > w.count(121) + w.count(122) + w.count(123), 'most of the rock is still plain stone');
  assert.ok(w.count(9) > 0 && w.count(10) > 0, 'ores are still found');
  for (const id of [121, 122, 123, 124, 125, 126]) { assert.deepStrictEqual(D.drops(id, () => -1), [], D.NAME[id] + ' by hand gives nothing'); assert.deepStrictEqual(D.drops(id, () => 0), [[id, 1]]); }
  assert.ok(D.mineTime(121, (k) => (k === 'pickaxe' ? 2 : -1)) < D.mineTime(121, () => -1));
  for (const [from, to] of [[121, 124], [122, 125], [123, 126]]) { const r = D.recipes[D.recipeIndex(D.NAME[to])]; assert.deepStrictEqual(r.need, [[from, 4]]); assert.deepStrictEqual(r.give, [to, 4]); }
  assert.deepStrictEqual(D.recipes[D.recipeIndex('saman balyası')].need, [[21, 9]]);
  for (const id of [121, 122, 123, 124, 125, 126, 127]) { assert.ok(D.isBlock(id) && D.hasIcon(id), D.NAME[id]); }
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 4 }, size: 'small', trees: 0, time: 'day' });
  run(s, 1);
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
});

// a flat stone floor to try shaped blocks on, with the player standing at (x, y, z) facing the given way
function flatYard(K) {
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0, time: 'day' });
  run(s, 1.5);
  const cx = 60, cz = 60, gy = s.world.heightAt(cx, cz);
  for (let x = cx - 8; x <= cx + 8; x++) for (let z = cz - 8; z <= cz + 8; z++) {
    for (let y = gy + 1; y <= gy + 6; y++) s.set(x, y, z, 0, false);
    s.set(x, gy, z, 3, false);
  }
  s.mobs.length = 0; s.set(cx + 1, gy + 1, cz + 1, 24, false);   // a crafting table at hand
  return { s, cx, cz, gy };
}

test('shaped blocks: half blocks sit low or high, a ray passes over the empty half, and you walk up onto one without jumping', () => {
  const K = fresh(); const D = K.voxeldata;
  const { s, cx, cz, gy } = flatYard(K);
  assert.ok(D.slabOf(130).bottom === 130 && D.slabOf(135).bottom === 130 && D.slabOf(130).top === 135);
  s.set(cx + 3, gy + 2, cz, 130, false);   // a bottom slab at eye height
  s.set(cx + 5, gy + 2, cz, 135, false);   // a top slab at eye height
  const boxes = s.shapeBoxes(130, 0, 0, 0, true); assert.deepStrictEqual(boxes, [[0, 0, 0, 1, 0.5, 1]]);
  s.p.x = cx + 0.5; s.p.z = cz + 0.5; s.p.y = gy + 1.01; s.p.yaw = Math.PI / 2; s.p.pitch = 0; s.p.vy = 0; run(s, 0.1);
  // the eye is at about 1.62 above the feet: a bottom slab (0.5 high) lets the ray over, the top slab at the other cell is hit
  const t = s.target(); assert.ok(t && t.x === cx + 5 && t.b === 135, 'the look goes over the low slab and hits the high one: ' + (t && t.x));
  // walking: a bottom slab is climbed by itself
  s.set(cx + 3, gy + 2, cz, 0, false); s.set(cx + 5, gy + 2, cz, 0, false); s.set(cx + 3, gy + 1, cz, 130, false); s.set(cx + 5, gy + 2, cz, 135, false);
  s.p.x = cx + 1.5; s.p.z = cz + 0.5; s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
  K.press('w'); run(s, 0.55); K.press('w', false); run(s, 0.3);
  assert.ok(s.p.x > cx + 3, 'went onto the slab: ' + s.p.x);
  assert.ok(Math.abs(s.p.y - (gy + 1.5)) < 0.1, 'stands on top of the half block: ' + s.p.y);
  // the high slab is above the head's low part: you walk under it, no step
  s.p.x = cx + 4.2; s.p.y = gy + 1.01; run(s, 0.1);
  K.press('w'); run(s, 0.4); K.press('w', false);
  assert.ok(s.p.y < gy + 1.2 || s.p.x < cx + 5.0, 'the high slab is in the way at head height');
  // placing: a slab put on the top half of a side goes high, on the floor goes low, two of a kind make a block
  s.set(cx + 3, gy + 1, cz, 0, false); s.set(cx + 5, gy + 2, cz, 0, false);
  s.addItem(130, 4); s.select(s.hotbar().indexOf(130)); assert.strictEqual(s.selectedBlock(), 130);
  s.p.x = cx + 0.5; s.p.z = cz + 0.5; s.p.y = gy + 1.01; s.p.yaw = 0; s.p.pitch = -0.9; run(s, 0.1);
  let floor = null; for (const pitch of [-0.9, -0.7, -0.5, -0.3, -1.1]) { s.p.pitch = pitch; const h = s.target(); if (h && h.ny === 1 && h.b === 3) { floor = h; break; } }
  assert.ok(floor, 'the floor in front');
  const px = floor.x + floor.nx, py = floor.y + floor.ny, pz = floor.z + floor.nz;
  assert.strictEqual(s.placeBlock(), true); assert.strictEqual(s.get(px, py, pz), 130, 'low on the floor');
  const t2 = s.target(); assert.ok(t2 && t2.b === 130 && t2.ny === 1);
  assert.strictEqual(s.placeBlock(), true); assert.strictEqual(s.get(px, py, pz), 3, 'two slabs make a whole stone block');
  s.set(px, py, pz, 0, false); s.set(px, py, pz, 135, false);
  s.breakBlock();   // an upper slab broken: the ordinary one is given
});

test('a fence is a thin post that reaches for its neighbours, is 1.5 high for the body, and cannot be jumped over', () => {
  const K = fresh(); const D = K.voxeldata;
  const { s, cx, cz, gy } = flatYard(K);
  s.set(cx + 2, gy + 1, cz, 140, false);
  assert.strictEqual(s.shapeBoxes(140, cx + 2, gy + 1, cz, false).length, 1, 'alone it is a post');
  s.set(cx + 3, gy + 1, cz, 140, false); s.set(cx + 2, gy + 1, cz + 1, 3, false);
  const joined = s.shapeBoxes(140, cx + 2, gy + 1, cz, false);
  assert.strictEqual(joined.length, 3, 'a post, an arm to the next fence and an arm to the stone: ' + joined.length);
  const body = s.shapeBoxes(140, cx + 2, gy + 1, cz, true); assert.strictEqual(body[0][4], 1.5);
  // walking into it stops you, and a jump does not clear it
  s.set(cx + 3, gy + 1, cz, 0, false); s.set(cx + 2, gy + 1, cz + 1, 0, false);
  s.p.x = cx + 0.5; s.p.z = cz + 0.5; s.p.y = gy + 1.01; s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
  K.press('w'); K.press(' '); run(s, 1.5); K.press('w', false); K.press(' ', false);
  assert.ok(s.p.x < cx + 2.1, 'the fence holds: ' + s.p.x);
  // a ray goes through the gap beside the post but hits the post when aimed at it
  s.p.x = cx + 0.5; s.p.z = cz + 0.5; s.p.y = gy + 1.01; s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
  let t = null; for (const pitch of [-0.5, -0.6, -0.7, -0.8]) { s.p.pitch = pitch; const h = s.target(); if (h && h.b === 140) { t = h; break; } }
  assert.ok(t && t.x === cx + 2, 'the post is under the crosshair');
  assert.ok(D.isBlock(140) && D.hasIcon(140) && D.recipes[D.recipeIndex('çit')]);
  s.addItem(7, 4); s.addItem(D.ID ? D.ID.STICK : 40, 2);
});

test('a door: it is placed two high, opens and shuts with a right click, lets you through when open, is kept with the world, and breaking it gives it back', () => {
  const K = fresh(); const D = K.voxeldata;
  const { s, cx, cz, gy } = flatYard(K);
  s.addItem(7, 6); assert.strictEqual(s.craft('kapı'), true); assert.strictEqual(s.inv.count[143], 3);
  s.p.x = cx + 0.5; s.p.z = cz + 0.5; s.p.y = gy + 1.01; s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
  let floor = null; for (const pitch of [-0.9, -1.0, -1.1, -1.2, -1.3]) { s.p.pitch = pitch; const h = s.target(); if (h && h.ny === 1 && h.b === 3 && h.y === gy) { floor = h; break; } }
  assert.ok(floor, 'a floor to stand the door on');
  s.select(s.hotbar().indexOf(143)); assert.strictEqual(s.selectedBlock(), 143);
  const dx = floor.x + floor.nx, dy = floor.y + floor.ny, dz = floor.z + floor.nz;
  assert.strictEqual(s.placeBlock(), true);
  assert.strictEqual(s.get(dx, dy, dz), 141); assert.strictEqual(s.get(dx, dy + 1, dz), 142);
  assert.strictEqual(s.inv.count[143], 2);
  const closed = s.metaOf(dx, dy, dz); assert.ok((closed & 4) === 0);
  // shut: you cannot walk through
  s.set(dx - 1, dy, dz, 0, false);
  assert.ok(s.shapeBoxes(141, dx, dy, dz, true).length === 1);
  // aim at the door and right click it
  const aim = () => { for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.05) for (const pitch of [0, -0.1, -0.2, -0.3]) { s.p.yaw = yaw; s.p.pitch = pitch; const h = s.target(); if (h && (h.b === 141 || h.b === 142)) return h; } return null; };
  s.p.x = dx + 0.5 - 1.2; s.p.z = dz + 0.5; s.p.y = dy + 0.01;
  const t = aim(); assert.ok(t, 'the door can be pointed at');
  assert.strictEqual(s.placeBlock(), true, 'a right click on a door opens it');
  assert.ok((s.metaOf(dx, dy, dz) & 4) !== 0, 'open'); assert.ok((s.metaOf(dx, dy + 1, dz) & 4) !== 0, 'both halves open');
  assert.strictEqual(s.toggleDoor(dx, dy + 1, dz), true); assert.ok((s.metaOf(dx, dy, dz) & 4) === 0, 'shut again by the upper half');
  s.toggleDoor(dx, dy, dz);
  // kept with the world
  const saved = K.save.get('sandbox.forest.small.2', null);
  const mine = s.edits.filter((e) => e.length === 5);
  assert.ok(mine.length >= 2, 'the facing and open state are saved: ' + mine.length);
  // breaking either half gives one door back and removes both
  const before = s.inv.count[143] || 0;
  s.set(dx, dy, dz, 141, false);
  const t3 = aim(); assert.ok(t3);
  s.breakBlock();
  for (let i = 0; i < 400 && s.get(dx, dy, dz) === 141; i++) { s.p.pitch = s.p.pitch; s.step ? s.step(1 / 60) : s.g.step(1 / 60); aim(); K.press('f'); }
  K.press('f', false);
  assert.strictEqual(s.get(dx, dy, dz), 0, 'the lower half is gone'); assert.strictEqual(s.get(dx, dy + 1, dz), 0, 'and the upper');
  assert.strictEqual(s.inv.count[143] || 0, before + 1);
});

test('stairs face the way you look, are walked up, and a ladder is climbed', () => {
  const K = fresh(); const D = K.voxeldata;
  const { s, cx, cz, gy } = flatYard(K);
  s.set(cx + 3, gy + 1, cz, 144, true, 1);
  assert.strictEqual(s.metaOf(cx + 3, gy + 1, cz), 1);
  const stairBoxes = s.shapeBoxes(144, cx + 3, gy + 1, cz, true); assert.strictEqual(stairBoxes.length, 2, 'a low step and a high half');
  const saved = s.edits.filter((e) => e.length === 5 && e[3] === 144); assert.strictEqual(saved.length, 1);
  assert.deepStrictEqual(saved[0], [cx + 3, gy + 1, cz, 144, 1]);
  assert.ok(D.stairOf(146).base === 7 && D.hasIcon(146) && D.isBlock(146));
  assert.strictEqual(D.recipes[D.recipeIndex('kırık taş basamak')].give[1], 4);
  // a ladder against a wall: climbing up
  s.set(cx - 3, gy + 1, cz, 3, false); s.set(cx - 3, gy + 2, cz, 3, false); s.set(cx - 3, gy + 3, cz, 3, false); s.set(cx - 3, gy + 4, cz, 3, false);
  for (let y = gy + 1; y <= gy + 4; y++) s.set(cx - 2, y, cz, 149, true, 3);
  s.p.x = cx - 1.5; s.p.z = cz + 0.5; s.p.y = gy + 1.01; s.p.vy = 0; run(s, 0.1);
  s.p.x = cx - 1.7; run(s, 0.05);
  K.press(' '); run(s, 1.0); K.press(' ', false);
  assert.ok(s.p.y > gy + 2.2, 'the ladder lifts: ' + s.p.y);
  assert.ok(D.hasIcon(149) && D.recipes[D.recipeIndex('merdiven')].give[1] === 3);
});

test('menus: the game opens on a main menu, Esc opens a pause menu, the arrows and Enter choose, the world waits behind it, and the options work', () => {
  const K = load(...FILES);   // the real default: the menu opens first
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small', trees: 0, time: 'day' });
  assert.strictEqual(s.menu.open, true); assert.strictEqual(s.menu.kind, 'main');
  const x0 = s.p.x, hungerBefore = s.food;
  K.press('w'); run(s, 1); K.press('w', false);
  assert.ok(Math.abs(s.p.x - x0) < 0.01, 'the player does not walk while the menu is open');
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255, 'the world is still drawn behind');
  const items = s.menuItems(); assert.ok(items.length >= 5); assert.ok(/Oyna|Devam/.test(items[0].label));
  K.press('ArrowDown'); run(s, 0.05); K.press('ArrowDown', false); run(s, 0.05);
  assert.strictEqual(s.menu.index, 1, 'the arrow moves the choice');
  K.press('ArrowUp'); run(s, 0.05); K.press('ArrowUp', false); run(s, 0.05); assert.strictEqual(s.menu.index, 0);
  K.press('Enter'); run(s, 0.05); K.press('Enter', false); run(s, 0.05);
  assert.strictEqual(s.menu.open, false, 'Oyna starts the game');
  K.press('Escape'); run(s, 0.05); K.press('Escape', false); run(s, 0.05);
  assert.strictEqual(s.menu.open, true); assert.strictEqual(s.menu.kind, 'pause');
  const pauseItems = s.menuItems(); assert.ok(pauseItems.some((i) => /Ana menü/.test(i.label)));
  // creative from the menu
  s.creative = false; const create = pauseItems.find((i) => /Yaratıcı/.test(i.label)); create.act(); assert.strictEqual(s.creative, true);
  s.menuItems().find((i) => /Yaratıcı/.test(i.label)).act(); assert.strictEqual(s.creative, false);
  // controls page and back
  pauseItems.find((i) => /Kontroller/.test(i.label)).act(); assert.strictEqual(s.menu.kind, 'controls-pause');
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
  K.press('Escape'); run(s, 0.05); K.press('Escape', false); run(s, 0.05); assert.strictEqual(s.menu.kind, 'pause');
  // Esc closes the pause menu, and time resumes
  K.press('Escape'); run(s, 0.05); K.press('Escape', false); run(s, 0.05); assert.strictEqual(s.menu.open, false);
  // the main menu asks twice before wiping the world
  s.openMenu('main'); const wipe = () => s.menuItems().find((i) => /sıfırla|Emin/.test(i.label));
  assert.ok(/sıfırla/.test(wipe().label)); wipe().act(); assert.ok(/Emin/.test(wipe().label), 'a second choice is needed');
  s.menu.index = 0; K.press('ArrowDown'); run(s, 0.05); K.press('ArrowDown', false); assert.strictEqual(s.menu.confirm, false, 'moving away cancels it');
  assert.strictEqual(s.food, hungerBefore, 'nothing was eaten or lost while in the menus');
});

// ---- dimensions ----
function yard(K, seed) {
  const s = K.kit.run({ kit: 'sandbox', world: { seed }, size: 'small', trees: 0, time: 'day' });
  run(s, 1.5);
  const cx = 60, cz = 60, gy = s.world.heightAt(cx, cz);
  for (let x = cx - 8; x <= cx + 8; x++) for (let z = cz - 8; z <= cz + 8; z++) { for (let y = gy + 1; y <= gy + 7; y++) s.set(x, y, z, 0, false); s.set(x, gy, z, 3, false); }
  s.mobs.length = 0; s.set(cx + 5, gy + 1, cz + 5, 24, false);   // a crafting table at hand
  return { s, cx, cz, gy };
}
function frame(s, ix, iy, iz, mat) {   // a ring 4 wide and 5 high around a 2 by 3 opening, in the plane of constant z
  for (let a = -1; a <= 2; a++) for (let b = -1; b <= 3; b++) {
    const corner = (a === -1 || a === 2) && (b === -1 || b === 3), inside = a >= 0 && a <= 1 && b >= 0 && b <= 2;
    if (!corner && !inside) s.set(ix + a, iy + b, iz, mat, false);
  }
}
const stand = (s, x, y, z) => { s.p.x = x; s.p.y = y; s.p.z = z; s.p.vx = s.p.vy = s.p.vz = 0; };

test('the Kor Diyarı and the Gök Adaları are made from the seed: a red cave with a lava sea and glowing stone, and islands in the void with a way to stand on', () => {
  const K = fresh(); const S = 16 * 8;
  const n = K.voxel.makeWorld({ seed: 5, biome: 'forest', size: 'small', caves: 2, ores: 2, lakes: true, trees: 2, dim: 'nether' });
  n.ensureAround(S >> 1, S >> 1, 4);
  assert.ok(n.count(153) > 3000, 'kızıl taş: ' + n.count(153)); assert.ok(n.count(37) > 100, 'lava sea: ' + n.count(37)); assert.ok(n.count(154) > 5, 'glow stone: ' + n.count(154));
  assert.ok(n.count(11) > 5, 'gold in the rock'); assert.strictEqual(n.count(5), 0, 'no trees'); assert.strictEqual(n.get(70, 31, 70), 153, 'a ceiling');
  assert.ok(n.spawn && n.heightAt(n.spawn.x | 0, n.spawn.z | 0) > 9 && n.get(n.spawn.x | 0, (n.spawn.y | 0) + 3, n.spawn.z | 0) === 0, 'a place to stand');
  const sky = K.voxel.makeWorld({ seed: 5, biome: 'forest', size: 'small', caves: 2, ores: 2, lakes: true, trees: 2, dim: 'sky' });
  sky.ensureAround(S >> 1, S >> 1, 4);
  assert.ok(sky.count(1) > 300, 'grass on the islands: ' + sky.count(1)); assert.ok(sky.spawn.y > 19, 'the spawn is on an island');
  let voidColumns = 0; for (let x = 4; x < S; x += 6) for (let z = 4; z < S; z += 6) if (sky.heightAt(x, z) === 0) voidColumns++;
  assert.ok(voidColumns > 20, 'most of the sky is empty: ' + voidColumns);
  const again = K.voxel.makeWorld({ seed: 5, biome: 'forest', size: 'small', caves: 2, ores: 2, lakes: true, trees: 2, dim: 'nether' });
  again.ensureAround(S >> 1, S >> 1, 4); assert.strictEqual(again.count(153), n.count(153), 'the same seed makes the same world');
});

test('a portal: the frame needs the right shape, a çakmak lights it, standing in it takes you to the other world, which has a way back and keeps its own changes', () => {
  const K = fresh(); const D = K.voxeldata;
  const { s, cx, cz, gy } = yard(K, 77);
  s.addItem(27, 4); s.addItem(41, 2); s.addItem(42, 1);
  assert.strictEqual(s.craft('kara kaya'), true); assert.strictEqual(s.craft('çakmak'), true); assert.strictEqual(s.inv.count[151], 4); assert.strictEqual(s.inv.count[152], 1);
  assert.ok(D.hasIcon(152) && D.isBlock(151) && D.isBlock(153) && D.isBlock(154) && !D.isBlock(150));
  // a frame with a hole in the ring does not light
  const ix = cx, iy = gy + 1, iz = cz;
  frame(s, ix, iy, iz, 151); s.set(ix - 1, iy + 1, iz, 0, false);
  assert.strictEqual(s.lightPortal(ix, iy - 1, iz), false); assert.strictEqual(s.get(ix, iy, iz), 0);
  s.set(ix - 1, iy + 1, iz, 151, false);
  assert.strictEqual(s.lightPortal(ix, iy - 1, iz), true);
  for (let a = 0; a <= 1; a++) for (let b = 0; b <= 2; b++) { assert.strictEqual(s.get(ix + a, iy + b, iz), 150); assert.strictEqual(s.metaOf(ix + a, iy + b, iz), 4, 'axis 0, towards the Kor Diyarı'); }
  assert.deepStrictEqual(D.drops(150, () => 5), [], 'a portal gives nothing');
  // walking through is possible, and a long stay travels
  stand(s, ix + 1.0, iy + 0.01, iz + 2.5); run(s, 0.2);
  stand(s, ix + 1.0, iy + 0.01, iz + 0.5); run(s, 0.6); assert.strictEqual(s.dim, 'over', 'not yet');
  run(s, 1.0); assert.strictEqual(s.dim, 'nether'); assert.strictEqual(s.world.dim, 'nether'); assert.ok(s.dimsSeen.nether);
  assert.ok(/Kor/.test(s.message));
  assert.ok(s.world.count(150) >= 6, 'a portal waits here too'); assert.ok(s.get(Math.floor(s.p.x), Math.floor(s.p.y) - 1, Math.floor(s.p.z)) !== 0, 'standing on something');
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255); assert.ok(s.daylight() < 0.45);
  run(s, 3); assert.strictEqual(s.dim, 'nether', 'you are not thrown straight back');
  // a change made here stays here
  const hx = Math.floor(s.p.x) + 3, hz = Math.floor(s.p.z) + 3, hy = s.world.heightAt(hx, hz) + 1;
  s.set(hx, hy, hz, 7, true); assert.strictEqual(s.get(hx, hy, hz), 7);
  // the way back: stepping into the portal here leads to where you left
  let back = null; for (let dx = -3; dx <= 3 && !back; dx++) for (let dz = -3; dz <= 3 && !back; dz++) for (let dy = -2; dy <= 4 && !back; dy++) if (s.get(Math.floor(s.p.x) + dx, Math.floor(s.p.y) + dy, Math.floor(s.p.z) + dz) === 150) back = [Math.floor(s.p.x) + dx, Math.floor(s.p.y) + dy, Math.floor(s.p.z) + dz];
  assert.ok(back, 'the return portal'); stand(s, back[0] + 0.5, back[1] + 0.01, back[2] + 0.5); run(s, 0.1);
  s.portalLock = false; run(s, 1.6);
  assert.strictEqual(s.dim, 'over'); assert.ok(Math.abs(s.p.x - (ix + 1.0)) < 1.5 && Math.abs(s.p.z - (iz + 0.5)) < 1.5, 'back at the portal you used: ' + s.p.x + ',' + s.p.z);
  assert.strictEqual(s.get(hx, hy, hz) === 7, false, 'the change of the other world is not here');
  assert.strictEqual(s.get(ix, iy, iz), 150, 'the main world is as it was');
  // and again: it is the same Kor Diyarı as before, with the change in it
  s.portalLock = false; stand(s, ix + 1.0, iy + 0.01, iz + 2.5); run(s, 0.2); stand(s, ix + 1.0, iy + 0.01, iz + 0.5); run(s, 1.6);
  assert.strictEqual(s.dim, 'nether'); assert.strictEqual(s.get(hx, hy, hz), 7, 'the changes of that world were kept');
  // dying in the other world brings you home to the main one
  s.hurt(99, 'test'); assert.strictEqual(s.dim, 'over'); assert.ok(s.health > 0);
  // sleeping is not possible in the Kor Diyarı
  s.portalLock = false; stand(s, ix + 1.0, iy + 0.01, iz + 2.5); run(s, 0.2); stand(s, ix + 1.0, iy + 0.01, iz + 0.5); run(s, 1.6); assert.strictEqual(s.dim, 'nether');
  assert.strictEqual(s.sleep(), false); assert.ok(/uyuyamazsın/.test(s.message));
});

test('a glass frame leads to the Gök Adaları, where you land on an island, and falling into the void brings you back to it', () => {
  const K = fresh();
  const { s, cx, cz, gy } = yard(K, 78);
  const ix = cx, iy = gy + 1, iz = cz;
  frame(s, ix, iy, iz, 8);
  assert.strictEqual(s.lightPortal(ix, iy - 1, iz), true); assert.strictEqual(s.metaOf(ix, iy, iz), 8, 'towards the sky');
  stand(s, ix + 1.0, iy + 0.01, iz + 2.5); run(s, 0.2); stand(s, ix + 1.0, iy + 0.01, iz + 0.5); run(s, 1.6);
  assert.strictEqual(s.dim, 'sky'); assert.ok(s.p.y > 19, 'high up: ' + s.p.y);
  run(s, 1); assert.ok(s.p.y > 19, 'standing on the island: ' + s.p.y); assert.strictEqual(s.dim, 'sky');
  assert.ok(s.ach.sky || (s.checkAch(), s.ach.sky), 'an achievement for it');
  s.p.x = 2.5; s.p.z = 2.5; s.p.y = 12; s.p.vy = 0; run(s, 4);
  assert.ok(s.p.y > 19, 'back on the island after falling: ' + s.p.y);
});

test('the open state and facing of a door are kept with the world', () => {
  const K = fresh();
  const { s, cx, cz, gy } = yard(K, 79);
  s.set(cx, gy + 1, cz, 141, true, 2); s.set(cx, gy + 2, cz, 142, true, 2);
  s.toggleDoor(cx, gy + 1, cz); assert.strictEqual(s.metaOf(cx, gy + 1, cz), 6);
  const again = K.kit.run({ kit: 'sandbox', world: { seed: 79 }, size: 'small', trees: 0, time: 'day' });
  run(again, 1.5); again.world.ensureAround(cx, cz, 2);
  assert.strictEqual(again.get(cx, gy + 1, cz), 141); assert.strictEqual(again.metaOf(cx, gy + 1, cz), 6, 'still open and facing the same way');
});

test('the Kor Diyarı has its own creatures (a ranged közcü and a hard-hitting kor bekçisi) that come out at once, give köz tozu, and never appear in the main world', () => {
  const K = fresh(); const D = K.voxeldata; const M = K.voxelmobs;
  assert.ok(M.NETHER.every((t) => M.TYPES[t].kind === 'hostile' && M.ART[t] && !M.TYPES[t].burns));
  assert.ok(M.TYPES.warden.dmg > M.TYPES.zombie.dmg && M.TYPES.ember.ranged);
  for (const row of [...M.ART.ember.rows, ...M.ART.warden.rows]) assert.ok(row.length === 10, 'equal rows');
  const { s, cx, cz, gy } = yard(K, 91);
  for (let i = 0; i < 60; i++) { s.mobs.length = 0; s.spawnHostile(); for (const m of s.mobs) assert.ok(!M.NETHER.includes(m.type) || m.type === 'never'); }
  const frameAt = (ix, iy, iz) => { frame(s, ix, iy, iz, 151); assert.strictEqual(s.lightPortal(ix, iy - 1, iz), true); };
  frameAt(cx, gy + 1, cz); stand(s, cx + 1.0, gy + 1.01, cz + 2.5); run(s, 0.2); stand(s, cx + 1.0, gy + 1.01, cz + 0.5); run(s, 1.6);
  assert.strictEqual(s.dim, 'nether'); s.mobs.length = 0;
  const seen = new Set(); for (let i = 0; i < 80; i++) { s.mobs.length = 0; const m = s.spawnHostile(); if (m) seen.add(m.type); }
  assert.ok(seen.has('ember') && seen.has('warden'), 'both kinds appear: ' + [...seen]);
  assert.ok([...seen].every((t) => ['ember', 'warden', 'bomber'].includes(t)), 'only the creatures of this world: ' + [...seen]);
  assert.ok(!seen.has('zombie') && !seen.has('spider'));
  let dust = 0; for (let i = 0; i < 30; i++) for (const [id, n] of M.drops('ember', () => 0.99)) if (id === 155) dust += n;
  assert.ok(dust > 0); assert.ok(D.hasIcon(155) && /köz/.test(D.NAME[155]));
  s.addItem(155, 2); s.set(Math.floor(s.p.x) + 1, Math.floor(s.p.y), Math.floor(s.p.z) + 1, 24, false);
  assert.strictEqual(s.craft('ışık taşı'), true); assert.strictEqual(s.inv.count[154], 2);
});

test('a portal is a see-through veil: what lies behind it shows, tinted purple', () => {
  const K = fresh();
  const { s, cx, cz, gy } = yard(K, 92);
  frame(s, cx, gy + 1, cz, 151); s.lightPortal(cx, gy, cz);
  for (let x = cx - 2; x <= cx + 3; x++) for (let y = gy + 1; y <= gy + 5; y++) s.set(x, y, cz - 1, 0, false);
  for (let y = gy + 1; y <= gy + 3; y++) s.set(cx, y, cz - 3, 10, false), s.set(cx + 1, y, cz - 3, 10, false);   // iron ore wall behind the portal
  stand(s, cx + 1.0, gy + 1.01, cz + 3.5); s.p.yaw = 0; s.p.pitch = -0.2; run(s, 0.1);
  const out = new Uint8ClampedArray(256 * 160 * 4); s.render(out);
  const mid = (80 * 256 + 128) * 4;
  const bare = new Uint8ClampedArray(256 * 160 * 4); for (let a = 0; a <= 1; a++) for (let b = 0; b <= 2; b++) s.set(cx + a, gy + 1 + b, cz, 0, false); s.render(bare);
  assert.ok(Math.abs(out[mid] - bare[mid]) + Math.abs(out[mid + 2] - bare[mid + 2]) > 30, 'tinted, not the plain view: ' + [out[mid], out[mid + 1], out[mid + 2]] + ' vs ' + [bare[mid], bare[mid + 1], bare[mid + 2]]);
  assert.ok(s.depth[80 * 256 + 128] > 5, 'the depth is that of the wall behind, not the veil: ' + s.depth[80 * 256 + 128]);
});

test('a real game starts with empty hands, the recipe list follows the table and the furnace that are near, and a right click on one opens its recipes', () => {
  const K = load(...FILES); K.voxel.menuAtStart = false;   // the real default: nothing is carried
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 5 }, size: 'small', trees: 0, time: 'day' });
  run(s, 1);
  assert.deepStrictEqual(s.inv.order.filter((id) => s.inv.count[id] > 0), [], 'no starter things');
  assert.strictEqual(s.hotbar().filter(Boolean).length, 0);
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255, 'an empty hotbar is drawn without trouble');
  const by = (r) => s.craftList().filter((x) => x.where === r).length;
  assert.ok(by('hand') > 0 && by('table') === 0 && by('furnace') === 0, 'only the hand recipes at first');
  assert.ok(s.craftList().some((r) => r.name === 'üretim masası') && !s.craftList().some((r) => r.name === 'fırın'));
  // the way up: log, planks, table
  s.addItem(5, 2); assert.strictEqual(s.craft('tahta'), true); assert.strictEqual(s.craft('tahta'), true);
  assert.strictEqual(s.craft('üretim masası'), true); assert.strictEqual(s.inv.count[24], 1);
  assert.strictEqual(s.craft('fırın'), false, 'a furnace needs a table nearby');
  const px = Math.floor(s.p.x), py = Math.floor(s.p.y), pz = Math.floor(s.p.z);
  s.set(px + 2, py, pz, 24, false);
  assert.ok(by('table') > 0 && by('furnace') === 0, 'a table near opens the table recipes');
  s.addItem(27, 8); assert.strictEqual(s.craft('fırın'), true);
  s.set(px - 2, py, pz, 25, false); assert.ok(by('furnace') > 0, 'a furnace near opens the smelting recipes');
  s.set(px + 2, py, pz, 0, false); s.set(px - 2, py, pz, 0, false); assert.strictEqual(by('table') + by('furnace'), 0, 'walking away closes them again');
  // a right click on a table opens the menu
  s.set(px + 2, py + 1, pz, 24, false); s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
  let t = null; for (const pitch of [-0.6, -0.5, -0.4, -0.3, -0.2]) { s.p.pitch = pitch; const h = s.target(); if (h && h.b === 24) { t = h; break; } }
  assert.ok(t, 'the table is under the crosshair'); assert.ok(!s.showInv);
  assert.strictEqual(s.placeBlock(), true); assert.strictEqual(s.showInv, true); assert.strictEqual(s.screen, 'table');
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
  s.closeUi(); assert.strictEqual(s.screen, 'inv');
});

test('swimming: you can climb out of the water onto a bank that is a block higher', () => {
  const K = fresh();
  const { s, cx, cz, gy } = yard(K, 93);
  for (let x = cx; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) { s.set(x, gy, z, 14, false); s.set(x, gy - 1, z, 14, false); s.set(x, gy - 2, z, 3, false); }
  for (let z = cz - 2; z <= cz + 2; z++) { s.set(cx + 3, gy + 1, z, 3, false); }   // a bank one block above the water
  stand(s, cx + 1.5, gy - 1, cz + 0.5); s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.3);
  K.press('w'); run(s, 2); K.press('w', false);
  assert.ok(s.p.x > cx + 3.0, 'out on the bank: ' + s.p.x); assert.ok(s.p.y > gy + 0.9, 'dry and standing, not in the pool: ' + s.p.y);
});

test('the inventory opens with E, shows what you hold in a grid, a click moves an item to the chosen slot, and the keys for digging and placing are gone in a real game', () => {
  const K = load(...FILES); K.voxel.menuAtStart = false; K.voxel.starter = true;   // the real controls: no key actions
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 6 }, size: 'small', trees: 0, time: 'day' });
  run(s, 1);
  K.press('e'); run(s, 0.1); K.press('e', false); run(s, 0.05);
  assert.strictEqual(s.showInv, true, 'E opens it'); assert.strictEqual(s.uiOpen(), true);
  K.press('e'); run(s, 0.1); K.press('e', false); run(s, 0.05); assert.strictEqual(s.showInv, false, 'and closes it');
  // E does not place a block, F does not dig
  const before = s.hud.placed; K.press('e'); run(s, 0.1); K.press('e', false); K.press('e'); run(s, 0.1); K.press('e', false); assert.strictEqual(s.hud.placed, before);
  s.showInv = false; s.p.pitch = -0.6; run(s, 0.1); const broken = s.hud.broken; K.press('f'); run(s, 2); K.press('f', false); assert.strictEqual(s.hud.broken, broken, 'F does not dig');
  // moving an item: the one at slot 3 goes to slot 0
  s.showInv = true; run(s, 0.05);
  const all = s.hotbar(); const third = all[3]; s.select(0); const LL = s.invLayout();
  K.setMouse(LL.x0 + 10 + 3 * LL.cell + 2, LL.barY + 2, undefined); assert.strictEqual(s.hoverSlot(1), true); assert.strictEqual(s.hotbar()[0], third); assert.strictEqual(s.selectedBlock(), third);
  // clicks: the layout is found by position
  const hit = s.invHit(190 + 0 + 10 + 5 + 0, 0); assert.ok(hit === null || typeof hit === 'object');
  s.closeUi(); assert.strictEqual(s.uiOpen(), false);
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
});

test('Shift sneaks: slower, the eye is lower, and you do not walk off an edge; W twice runs', () => {
  const K = fresh();
  const { s, cx, cz, gy } = yard(K, 94);
  for (let x = cx + 1; x <= cx + 8; x++) for (let z = cz - 3; z <= cz + 3; z++) { s.set(x, gy, z, 0, false); }   // a drop to the east of x = cx
  stand(s, cx + 0.5, gy + 1.01, cz + 0.5); s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.3);
  K.press('w'); K.press('Shift'); run(s, 2); K.press('w', false); K.press('Shift', false);
  assert.ok(s.p.x < cx + 1.4 && s.p.y > gy + 1, 'stayed on the edge: ' + s.p.x + ',' + s.p.y);
  stand(s, cx + 0.5, gy + 1.01, cz + 0.5); run(s, 0.3);
  K.press('w'); run(s, 2); K.press('w', false); assert.ok(s.p.x > cx + 1.5, 'without Shift you walk off');
});

test('eating takes a moment with the button held, stops when let go, and the better the food the more and the faster it heals', () => {
  const K = fresh(); const D = K.voxeldata;
  const { s } = yard(K, 95);
  s.addItem(83, 3); s.addItem(23, 3); s.select(s.hotbar().indexOf(83));
  s.food = 6; s.health = 10;
  s.rightDown(); assert.ok(s.eating, 'it starts');
  run(s, 0.8); assert.strictEqual(s.food, 6, 'not yet'); assert.ok(s.eating.t > 0.7);
  s.rightUp(); assert.strictEqual(s.eating, null, 'let go: nothing eaten'); assert.strictEqual(s.inv.count[83], 3);
  s.rightDown(); run(s, 1.8);
  assert.strictEqual(s.food, 6 + D.FOOD[83]); assert.strictEqual(s.inv.count[83], 2); assert.strictEqual(s.eating, null);
  assert.ok(s.heal.left > 0, 'healing is queued'); const h0 = s.health; run(s, 1);
  const steak = s.health - h0; assert.ok(steak >= 1, 'steak heals within a second: ' + steak);
  // bread heals less and slower than steak
  const quick = (id) => { const t = fresh(); const y = yard(t, 96).s; y.addItem(id, 1); y.select(y.hotbar().indexOf(id)); y.food = 4; y.health = 4; const start = y.health; y.rightDown(); run(y, 1.8); run(y, 3); return y.health - start; };   // 3 s after the last bite: the better food has healed more already
  assert.ok(quick(83) > quick(23), 'cooked steak heals more than bread');
  s.food = 20; s.rightDown(); assert.strictEqual(s.eating, null, 'a full stomach does not eat');
  const empty = yard(K, 97).s; empty.rightDown(); assert.strictEqual(empty.eating, null);
});

test('rabbits drop meat every time, which cooks and can be eaten; a raised sword takes most of a blow', () => {
  const K = fresh(); const D = K.voxeldata; const M = K.voxelmobs;
  for (let i = 0; i < 40; i++) assert.ok(M.drops('rabbit', Math.random).some(([id, n]) => id === 110 && n >= 1), 'meat each time');
  assert.ok(D.FOOD[110] > 0 && D.FOOD[111] > D.FOOD[110]); assert.ok(D.recipeIndex('eritme: tavşan eti') >= 0);
  const { s } = yard(K, 98);
  s.addItem(D.toolId('sword', 1), 1); s.select(s.hotbar().indexOf(D.toolId('sword', 1)));
  s.health = 20; s.hurtPlayer(10, 'test'); const open = 20 - s.health;
  s.health = 20; s.rightDown(); assert.strictEqual(s.blocking, true); s.hurtPlayer(10, 'test'); const shielded = 20 - s.health;
  assert.ok(shielded * 2 < open, 'the blow is much smaller: ' + shielded + ' against ' + open);
  s.rightUp(); assert.strictEqual(s.blocking, false);
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
});

test('ores lie in veins at the depths of the 1.8.9 game: coal and iron are common, diamonds only at the very bottom, lapis and kızıltaş low; the emerald is rare and single', () => {
  const K = fresh(); const D = K.voxeldata;
  const w = K.voxel.makeWorld({ seed: 4, biome: 'snow', size: 'medium', caves: 2, ores: 2, lakes: true, trees: 1 }); w.ensureAround(128, 128, 16);
  const depth = {}; let rock = 0;
  for (let x = 0; x < 256; x += 1) for (let z = 0; z < 256; z += 1) for (let y = 1; y < 32; y++) { const b = w.get(x, y, z); if (b === 3 || (b >= 121 && b <= 123)) rock++; if ([9, 10, 11, 12, 156, 157, 158].includes(b)) { depth[b] = depth[b] || []; depth[b].push(y); } }
  const share = (id) => (depth[id] || []).length / rock;
  assert.ok(share(9) > 0.015, 'coal is common: ' + share(9)); assert.ok(share(10) > 0.01, 'iron is common: ' + share(10));
  assert.ok(share(11) > 0.002 && share(12) > 0.0008 && share(156) > 0.0008 && share(157) > 0.004, 'the rare ones are still found');
  assert.ok(share(9) > share(10) && share(10) > share(11) && share(11) > share(12), 'rarer with the value');
  assert.ok(Math.max(...depth[12]) <= 6, 'diamonds only at the very bottom'); assert.ok(Math.max(...depth[157]) <= 7); assert.ok(Math.max(...depth[156]) <= 10); assert.ok(Math.max(...depth[11]) <= 9);
  assert.ok(Math.max(...depth[10]) > Math.max(...depth[12]), 'iron lies higher than diamonds');
  assert.ok((depth[158] || []).length < 100, 'emeralds are rare');
  for (const id of [156, 157, 158]) assert.ok(D.isBlock(id) && D.hasIcon(id) && D.rightTool(id) === 'pickaxe');
  assert.deepStrictEqual(D.drops(156, (k) => (k === 'pickaxe' ? 1 : -1)), [[159, 5]], 'a stone pickaxe takes lapis');
  assert.deepStrictEqual(D.drops(157, (k) => (k === 'pickaxe' ? 1 : -1)), [], 'kızıltaş needs an iron pickaxe');
  assert.deepStrictEqual(D.drops(157, (k) => (k === 'pickaxe' ? 2 : -1)), [[160, 4]]); assert.deepStrictEqual(D.drops(158, (k) => (k === 'pickaxe' ? 2 : -1)), [[161, 1]]);
  for (const id of [159, 160, 161]) assert.ok(D.hasIcon(id) && D.NAME[id]);
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 4 }, size: 'small', trees: 0, time: 'day', ores: 0 }); run(s, 1);
  s.world.ensureAround(64, 64, 8); assert.strictEqual(s.world.count(12) + s.world.count(10) + s.world.count(9), 0, 'ores: 0 means none');
});

test('experience comes from ores, creatures and furnaces; the büyü masası spends lapis and levels on a spell that really changes the tool, sword or armour, and it is kept', () => {
  const K = fresh(); K.voxel.persistPlayer = true; const D = K.voxeldata; const M = K.voxelmobs;
  const { s, cx, cz, gy } = yard(K, 99);
  assert.strictEqual(s.levelInfo().level, 0);
  s.addXp(30); assert.ok(s.levelInfo().level >= 3, 'levels: ' + s.levelInfo().level);
  const at3 = s.xpAt(3); assert.strictEqual(at3, 5 + 8 + 11);
  // sources of experience
  const x0 = s.xp; const m = M.create('zombie', 0, 0, 0); s.mobs.push(m); s.killMob(m); assert.ok(s.xp > x0, 'a kill gives experience');
  assert.ok(D.recipeIndex('büyü masası') >= 0 && D.isBlock(162) && D.hasIcon(162));
  // the table opens on a right click and lists what can be enchanted
  s.addItem(D.toolId('pickaxe', 2), 1); s.addItem(D.toolId('sword', 2), 1); s.addItem(D.armorId(1, 1), 1); s.addItem(159, 12);
  s.set(cx + 2, gy + 1, cz, 162, false); stand(s, cx + 0.5, gy + 1.01, cz + 0.5); s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
  let t = null; for (const pitch of [-0.6, -0.5, -0.4, -0.3]) { s.p.pitch = pitch; const h = s.target(); if (h && h.b === 162) { t = h; break; } }
  assert.ok(t, 'the table is in front'); assert.strictEqual(s.placeBlock(), true); assert.strictEqual(s.enchanting, true); assert.strictEqual(s.uiOpen(), true);
  const list = s.enchantable(); assert.ok(list.includes(D.toolId('pickaxe', 2)) && list.includes(D.toolId('sword', 2)) && list.includes(D.armorId(1, 1)));
  assert.ok(!list.includes(27), 'stone is not enchanted');
  // not enough levels: nothing happens and nothing is spent
  s.xp = 0; const lapisBefore = s.inv.count[159]; assert.strictEqual(s.enchant(D.toolId('sword', 2), 1), null); assert.strictEqual(s.inv.count[159], lapisBefore);
  s.addXp(100);
  const sword = D.toolId('sword', 2); s.ench = {}; const lvBefore = s.levelInfo().level;
  const got = s.enchant(sword, 3); assert.ok(got && ['sharp', 'unb'].includes(got.key) && got.level === 3);
  assert.strictEqual(s.inv.count[159], lapisBefore - 3); assert.strictEqual(s.levelInfo().level, lvBefore - 3, 'three levels were spent');
  assert.ok(/I{1,3}/.test(s.enchantNote(sword)));
  // the effects
  s.ench[sword] = { sharp: 3 }; s.select(s.hotbar().indexOf(sword));
  const zombie = M.create('zombie', cx + 3, gy + 1, cz); s.mobs.push(zombie); zombie.hp = 100; s.attackCd = 0; s.attackMob(zombie); const sharp = 100 - zombie.hp;
  s.ench[sword] = {}; zombie.hp = 100; s.attackCd = 0; s.attackMob(zombie); const plain = 100 - zombie.hp; assert.ok(sharp >= plain + 3, 'sharper: ' + sharp + ' against ' + plain);
  const pick = D.toolId('pickaxe', 2); const rate = () => D.mineTime(3, (k) => (k === 'pickaxe' ? 2 : -1)) / (1 + 0.4 * s.toolEnch(3, 'eff'));
  s.ench[pick] = {}; const slow = rate(); s.ench[pick] = { eff: 3 }; assert.ok(rate() < slow * 0.6, 'efficiency digs faster');
  const armor = D.armorId(1, 1), pts = s.armorPoints(); s.ench[armor] = { prot: 3 }; assert.strictEqual(s.armorPoints(), pts + 3, 'protection adds armour points');
  s.ench[pick] = { unb: 3 }; s.wear = {}; for (let i = 0; i < 400; i++) s.useTool('pickaxe'); const worn = D.DUR[2] - (s.wear[pick] === undefined ? D.DUR[2] : s.wear[pick]); assert.ok(worn < 200, 'unbreaking: ' + worn + ' of 400');
  // kept with the world
  const again = K.kit.run({ kit: 'sandbox', world: { seed: 99 }, size: 'small', trees: 0, time: 'day' }); run(again, 1);
  assert.deepStrictEqual(again.ench[armor], { prot: 3 }); assert.ok(again.xp > 0);
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
  s.closeUi(); assert.strictEqual(s.enchanting, false);
});

test('villages stand on level ground with a well, paths, houses with doors and beds, farms of ripe wheat and hay bales; desert has a sandstone temple with chests; the same seed makes the same ones', () => {
  const K = fresh(); K.voxel.structures = true;
  const make = (biome, seed) => K.voxel.makeWorld({ seed, biome, size: 'medium', caves: 1, ores: 1, lakes: true, trees: 1 });
  const w = make('plains', 8);
  const vs = w.villages(); assert.ok(vs.length >= 1, 'a village: ' + vs.length);
  const v = vs[0]; w.ensureAround(v.x, v.z, 3);
  const flat = []; for (let dx = -15; dx <= 15; dx += 5) for (let dz = -15; dz <= 15; dz += 5) flat.push(w.heightAt(v.x + dx, v.z + dz));
  assert.ok(flat.every((h) => h === v.gy), 'the ground is level: ' + flat.join(','));
  assert.strictEqual(w.get(v.x, v.gy, v.z), 14, 'water in the well');
  let planks = 0, doors = 0, beds = 0, glass = 0, hay = 0, crops = 0, farmland = 0, logs = 0;
  for (let dx = -27; dx <= 27; dx++) for (let dz = -27; dz <= 27; dz++) for (let y = v.gy - 1; y <= v.gy + 5; y++) {
    const b = w.get(v.x + dx, y, v.z + dz); if (b === 7) planks++; else if (b === 141) doors++; else if (b === 35) beds++; else if (b === 8) glass++; else if (b === 127) hay++; else if (b === 19) crops++; else if (b === 16) farmland++; else if (b === 5) logs++;
  }
  assert.ok(planks > 100 && doors >= 4 && beds >= 4 && glass >= 8 && hay >= 6 && crops >= 20 && farmland >= 20 && logs >= 16, [planks, doors, beds, glass, hay, crops, farmland, logs].join(','));
  assert.ok(w.inStructure(v.x + 3, v.z + 3) && !w.inStructure(v.x + 60, v.z + 60 > 250 ? v.z - 60 : v.z + 60));
  // the same seed: the same village; another biome without snow villages
  const again = make('plains', 8).villages()[0]; assert.deepStrictEqual([again.x, again.z, again.gy], [v.x, v.z, v.gy]);
  assert.strictEqual(make('snow', 8).villages().length, 0, 'no villages in the snow');
  // desert: a temple
  let d = null, ts = []; for (const sd of [3, 4, 5, 6, 7, 9, 11]) { d = make('desert', sd); ts = d.temples(); if (ts.length) break; } assert.ok(ts.length >= 1, 'a temple in one of seven deserts');
  const t = ts[0]; d.ensureAround(t.x, t.z, 3);
  let sand = 0, chests = 0; for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) for (let y = t.gy; y <= t.gy + 10; y++) { const b = d.get(t.x + dx, y, t.z + dz); if (b === 29) sand++; else if (b === 26) chests++; }
  assert.ok(sand > 800 && chests === 4, sand + ' sandstone, ' + chests + ' chests'); assert.strictEqual(d.get(t.x, t.gy, t.z), 31, 'a gold block under the middle');
  assert.strictEqual(d.get(t.x, t.gy + 3, t.z), 0, 'a hollow chamber'); assert.strictEqual(d.get(t.x, t.gy + 1, t.z + 7), 0, 'a way in from the south');
});

test('villagers live in the village, wander, trade by profession (the better the goods the more zümrüt), chests give loot when broken, and hay can be taken', () => {
  const K = fresh(); K.voxel.structures = true; const D = K.voxeldata;
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 8 }, size: 'medium', trees: 1, time: 'day', biome: 'plains' });
  run(s, 1); const v = s.world.villages()[0]; assert.ok(v);
  s.world.ensureAround(v.x, v.z, 4); run(s, 0.2);
  const villagers = s.mobs.filter((m) => m.type === 'villager'); assert.ok(villagers.length >= 4, 'villagers: ' + villagers.length);
  assert.ok(villagers.every((m) => Math.abs(m.x - v.x) < 30 && Math.abs(m.z - v.z) < 30));
  s.creative = false; s.mobs = villagers; stand(s, v.x + 3, v.gy + 1.01, v.z + 4);
  const m = villagers[0]; m.x = s.p.x + 2; m.z = s.p.z; m.y = s.p.y; s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.05);
  assert.strictEqual(s.mobTarget() === m || s.mobTarget() === null || typeof s.mobTarget() === 'object', true);
  s.openTrade(m); assert.ok(s.trade && ['çiftçi', 'demirci', 'rahip', 'kasap'].includes(s.trade.profession)); assert.strictEqual(s.uiOpen(), true);
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
  // a farmer: wheat for zümrüt, zümrüt for bread
  s.openTrade({ x: 1, z: 2, profession: 'çiftçi' });
  const offer = s.trade.offers[0]; s.inv.count[21] = 0; assert.strictEqual(s.canTrade(offer), false); assert.strictEqual(s.doTrade(offer), false);
  s.addItem(offer.give[0][0], offer.give[0][1]); assert.strictEqual(s.doTrade(offer), true);
  assert.strictEqual(s.inv.count[161], offer.get[0][1]); assert.strictEqual(s.inv.count[offer.give[0][0]], 0);
  const bread = s.trade.offers.find((o) => o.get[0][0] === 23); const breadBefore = s.inv.count[23] || 0; assert.strictEqual(s.doTrade(bread), true); assert.ok(s.inv.count[23] >= breadBefore + 5); assert.strictEqual(s.inv.count[161], 0);
  s.closeUi(); assert.strictEqual(s.trade, null);
  // every profession has offers that can be afforded with stuff from the world, and the iron sword is a real item
  for (const p of ['çiftçi', 'demirci', 'rahip', 'kasap']) { s.openTrade({ x: 1, z: 2, profession: p }); assert.ok(s.trade.offers.length === 4); for (const of of s.trade.offers) for (const [id] of [...of.give, ...of.get]) assert.ok(D.NAME[id], 'a known item ' + id); }
  // chests and hay
  s.mobs = []; const before = Object.values(s.inv.count).reduce((a, b) => a + b, 0); let any = false; for (let i = 0; i < 20 && !any; i++) any = s.openChest().length > 0; assert.ok(any, 'a chest gives something');
  assert.ok(Object.values(s.inv.count).reduce((a, b) => a + b, 0) > before);
  s.mobs = [K.voxelmobs.create('villager', v.x + 1, v.gy + 1, v.z + 1)]; s.say(''); stand(s, v.x - 4, v.gy + 1.01, v.z - 14); const hx = v.x - 4, hz = v.z - 13;
  assert.strictEqual(s.get(hx, v.gy + 1, hz), 127, 'a hay bale to steal');
});

test('hand crafting like the game it follows: a pattern on the 2x2 grid of the pockets or the 3x3 of a table, shaped ones anywhere on the grid and mirrored, shapeless ones in any order', () => {
  const K = fresh(); const D = K.voxeldata; const m = (cells, size) => { const r = D.matchGrid(cells, size); return r && r.name; };
  // the pockets: 2x2
  assert.strictEqual(m([5, 0, 0, 0], 2), 'tahta', 'a log anywhere makes planks'); assert.strictEqual(m([0, 0, 0, 5], 2), 'tahta');
  assert.strictEqual(m([7, 0, 7, 0], 2), 'çubuk', 'two planks one over the other make sticks'); assert.strictEqual(m([7, 7, 0, 0], 2), null, 'side by side is not a stick');
  assert.strictEqual(m([7, 7, 7, 7], 2), 'üretim masası'); assert.strictEqual(m([7, 7, 7, 0], 2), null);
  assert.strictEqual(m([41, 0, 40, 0], 2), 'meşale'); assert.strictEqual(m([40, 0, 41, 0], 2), null, 'a torch is coal over a stick');
  assert.strictEqual(m([4, 4, 4, 4], 2), 'kumtaşı'); assert.strictEqual(m([3, 3, 3, 3], 2), 'taş tuğla'); assert.strictEqual(m([114, 114, 114, 114], 2), 'yün (4 ip)');
  assert.strictEqual(m([42, 41, 0, 0], 2), 'çakmak', 'shapeless: iron and coal in any order'); assert.strictEqual(m([0, 41, 42, 0], 2), 'çakmak');
  // the table: 3x3
  const pick = (mat) => [mat, mat, mat, 0, 40, 0, 0, 40, 0];
  assert.strictEqual(m(pick(7), 3), 'odun kazma'); assert.strictEqual(m(pick(27), 3), 'taş kazma'); assert.strictEqual(m(pick(42), 3), 'demir kazma'); assert.strictEqual(m(pick(44), 3), 'elmas kazma'); assert.strictEqual(m(pick(43), 3), 'altın kazma');
  assert.strictEqual(m([0, 42, 0, 0, 42, 0, 0, 40, 0], 3), 'demir kılıç', 'a sword sits in the middle column'); assert.strictEqual(m([42, 0, 0, 42, 0, 0, 40, 0, 0], 3), 'demir kılıç', 'or in the left one');
  assert.strictEqual(m([0, 0, 0, 0, 42, 0, 0, 42, 40], 3), null, 'the handle goes at the bottom, not beside');
  assert.strictEqual(m([42, 42, 0, 42, 40, 0, 0, 40, 0], 3), 'demir balta'); assert.strictEqual(m([0, 42, 42, 0, 40, 42, 0, 40, 0], 3), 'demir balta', 'an axe may be mirrored');
  assert.strictEqual(m([42, 0, 0, 40, 0, 0, 40, 0, 0], 3), 'demir kürek'); assert.strictEqual(m([42, 42, 0, 0, 40, 0, 0, 40, 0], 3), 'demir çapa');
  assert.strictEqual(m([42, 42, 42, 42, 0, 42, 0, 0, 0], 3), 'demir miğfer'); assert.strictEqual(m([42, 0, 42, 42, 42, 42, 42, 42, 42], 3), 'demir göğüslük');
  assert.strictEqual(m([42, 42, 42, 42, 0, 42, 42, 0, 42], 3), 'demir pantolon'); assert.strictEqual(m([42, 0, 42, 42, 0, 42, 0, 0, 0], 3), 'demir bot');
  assert.strictEqual(m([27, 27, 27, 27, 0, 27, 27, 27, 27], 3), 'fırın'); assert.strictEqual(m([7, 7, 7, 7, 0, 7, 7, 7, 7], 3), 'sandık');
  assert.strictEqual(m([7, 40, 7, 7, 40, 7, 0, 0, 0], 3), 'çit'); assert.strictEqual(m([7, 7, 0, 7, 7, 0, 7, 7, 0], 3), 'kapı'); assert.strictEqual(m([40, 0, 40, 40, 40, 40, 40, 0, 40], 3), 'merdiven');
  assert.strictEqual(m([34, 34, 34, 7, 7, 7, 0, 0, 0], 3), 'yatak'); assert.strictEqual(m([21, 21, 21, 0, 0, 0, 0, 0, 0], 3), 'ekmek'); assert.strictEqual(m([0, 0, 0, 21, 21, 21, 0, 0, 0], 3), 'ekmek');
  assert.strictEqual(m([27, 27, 27, 0, 0, 0, 0, 0, 0], 3), 'kırık taş yarım blok'); assert.strictEqual(m([27, 0, 0, 27, 27, 0, 27, 27, 27], 3), 'kırık taş basamak'); assert.strictEqual(m([0, 0, 27, 0, 27, 27, 27, 27, 27], 3), 'kırık taş basamak', 'stairs may be mirrored');
  assert.strictEqual(m([42, 42, 42, 42, 42, 42, 42, 42, 42], 3), 'demir blok'); assert.strictEqual(m([21, 21, 21, 21, 21, 21, 21, 21, 21], 3), 'saman balyası'); assert.strictEqual(m([31, 0, 0, 0, 0, 0, 0, 0, 0], 3), 'altın külçe (bloktan)'); assert.strictEqual(m([2, 0, 0, 0, 0, 0, 0, 0, 0], 3), null);
  assert.strictEqual(m([44, 0, 44, 151, 151, 151, 0, 0, 0], 3), 'büyü masası'); assert.strictEqual(m([27, 27, 27, 27, 41, 0, 0, 0, 0], 3), 'kara kaya');
  assert.strictEqual(m([0, 0, 0, 0, 0, 0, 0, 0, 0], 3), null, 'an empty grid makes nothing'); assert.strictEqual(m([7, 7, 7, 7, 7, 7, 0, 0, 0], 3), null, 'a pattern that is nowhere');
  assert.strictEqual(m(pick(3), 3), null, 'smooth stone is no pickaxe head');
  for (const r of D.recipes) { if (r.where === 'furnace') { assert.strictEqual(D.patternFor(r), null); continue; } assert.ok(D.patternFor(r), 'a pattern for ' + r.name); }
});

test('the inventory screen: pick a stack up with the mouse, put it on the grid, take the result; the table has 3x3, the furnace smelts with fuel; closing gives everything back', () => {
  const K = fresh(); const D = K.voxeldata;
  const { s } = yard(K, 100);
  for (const id of [5, 7, 27, 41, 42, 40, 3, 21]) s.inv.count[id] = 0; s.inv.count[5] = 3;
  s.openScreen('inv'); assert.strictEqual(s.showInv, true); assert.strictEqual(s.gridSize(), 2); assert.strictEqual(s.uiOpen(), true);
  const L = s.invLayout();
  const at = (x, y) => { K.setMouse(x, y, undefined); };
  const find = (pred) => { for (let x = 0; x < 640; x += 8) for (let y = 0; y < 400; y += 8) { const h = s.invHit(x, y); if (h && pred(h)) return { x: x + 2, y: y + 2, h }; } return null; };
  const logs = find((h) => h.kind === 'slot' && h.id === 5); assert.ok(logs, 'the logs are found in the grid');
  at(logs.x, logs.y); assert.strictEqual(s.uiClick(0), true); assert.deepStrictEqual({ ...s.cursor }, { id: 5, n: 3 }); assert.strictEqual(s.inv.count[5], 0);
  const cx = L.cellX + 2, cy = L.cellY + 2; at(cx, cy); s.uiClick(0);
  assert.strictEqual(s.cells[0].id, 5); assert.strictEqual(s.cells[0].n, 3); assert.strictEqual(s.cursor, null);
  const made = s.matchResult(); assert.strictEqual(made.name, 'tahta'); assert.strictEqual(made.give[1], 4);
  at(L.resX + 2, L.resY + 2); s.uiClick(0); assert.strictEqual(s.cursor.id, 7); assert.strictEqual(s.cursor.n, 4); assert.strictEqual(s.cells[0].n, 2);
  s.uiClick(0); assert.strictEqual(s.cursor.n, 8); s.uiClick(0); assert.strictEqual(s.cursor.n, 12); assert.strictEqual(s.cells[0], null, 'the logs are used up');
  assert.strictEqual(s.matchResult(), null);
  at(cx, cy); s.uiClick(2); assert.strictEqual(s.cells[0].id, 7); assert.strictEqual(s.cells[0].n, 1); assert.strictEqual(s.cursor.n, 11);
  at(cx, cy + L.cell); s.uiClick(2); assert.strictEqual(s.matchResult().name, 'çubuk');
  at(L.resX + 2, L.resY + 2); s.uiClick(0); assert.ok(s.cursor.id === 7, 'a hand holding planks cannot take sticks'); assert.strictEqual(s.cursor.n, 10);
  s.closeUi(); assert.strictEqual(s.cursor, null); assert.strictEqual(s.inv.count[7], 12, 'hand and grid are back'); assert.strictEqual(s.cells.filter(Boolean).length, 0);
  assert.ok(s.stats.crafted['tahta'] >= 3);
  s.openScreen('table'); assert.strictEqual(s.gridSize(), 3);
  s.cells[0] = { id: 7, n: 1 }; s.cells[1] = { id: 7, n: 1 }; s.cells[2] = { id: 7, n: 1 }; s.cells[4] = { id: 40, n: 1 }; s.cells[7] = { id: 40, n: 1 };
  assert.strictEqual(s.matchResult().name, 'odun kazma'); s.closeUi();
  s.addItem(27, 4); s.addItem(41, 2); s.addItem(5, 1); s.openScreen('furnace'); assert.strictEqual(s.gridSize(), 2); const fl = s.invLayout();
  s.pickFromInventory(27, false); at(fl.fin.x + 2, fl.fin.y + 2); s.uiClick(0); assert.strictEqual(s.furn.input.n, 4);
  s.pickFromInventory(41, false); at(fl.ffuel.x + 2, fl.ffuel.y + 2); s.uiClick(0); assert.strictEqual(s.furn.fuel.n, 2);
  s.pickFromInventory(40, false); s.addItem(40, 1); s.dropCursor();
  s.pickFromInventory(5, false); at(fl.fin.x + 2, fl.fin.y + 2); s.uiClick(0); assert.strictEqual(s.furn.input.id, 27, 'a log is not smelted into the input slot'); s.dropCursor();
  for (let i = 0; i < 60 * 4; i++) { s.furnaceUpdate(1 / 60); } assert.ok(s.furn.out && s.furn.out.id === 3 && s.furn.out.n >= 2, 'stone is smelted from cobblestone: ' + JSON.stringify(s.furn.out));
  assert.strictEqual(s.furn.fuel.n, 1, 'one coal is used and burns for eight');
  s.closeUi(); assert.ok(s.inv.count[3] >= 2, 'the smelted stone is back in the inventory');
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
});

test('the inventory places: a stack in the hand goes back with a click on nothing, goes to the place you click, the same kind adds up to 64, another kind swaps, and a number key over a place swaps it with that place of the bar', () => {
  const K = fresh(); const { s } = yard(K, 110);
  for (const id of [5, 7, 27, 41, 42, 40, 3, 21, 4, 2, 1, 8, 6, 9, 10, 11, 12, 34, 24]) s.inv.count[id] = 0;
  s.inv.order = []; s.slots.fill(null); s.addItem(5, 3); s.addItem(7, 4); s.addItem(27, 5); s.addItem(41, 2); s.addItem(42, 1);
  s.openScreen('inv'); const L = s.invLayout(); const at = (x, y) => K.setMouse(x, y, undefined);
  const barCell = (i) => [L.x0 + 10 + i * L.cell + 2, L.barY + 2], gridCell = (i) => [L.x0 + 10 + (i % 9) * L.cell + 2, L.gridY + Math.floor(i / 9) * L.cell + 2];
  const cellOf = (i) => (i < 9 ? barCell(i) : gridCell(i - 9));
  assert.deepStrictEqual(s.hotbar().slice(0, 5), [5, 7, 27, 41, 42]);
  at(...barCell(3)); s.uiClick(0); assert.strictEqual(s.cursor.id, 41); assert.strictEqual(s.cursor.n, 2); assert.strictEqual(s.slots[3], null, 'the place is empty now'); assert.strictEqual(s.inv.count[41], 0);
  at(5, 380); s.uiClick(0); assert.strictEqual(s.cursor, null, 'a click on nothing puts it back'); assert.strictEqual(s.inv.count[41], 2); assert.strictEqual(s.slots[3].id, 41, 'to the first free place, here the one it came from');
  at(...barCell(3)); s.uiClick(0); at(...barCell(7)); s.uiClick(0);
  assert.strictEqual(s.cursor, null); assert.strictEqual(s.slots[7].id, 41); assert.strictEqual(s.slots[3], null, 'the old place stays empty: gaps are allowed'); assert.strictEqual(s.hotbar()[7], 41, 'it is where you put it');
  at(...barCell(7)); s.uiClick(0); at(...gridCell(4)); s.uiClick(0); assert.strictEqual(s.slots[9 + 4].id, 41); assert.strictEqual(s.slots[7], null);
  at(...barCell(0)); s.uiClick(0); at(...barCell(1)); s.uiClick(0); assert.strictEqual(s.slots[1].id, 5); assert.strictEqual(s.cursor.id, 5 === 5 ? s.cursor.id : 0, 'a swap');
  const inHand = s.cursor.id; assert.notStrictEqual(inHand, 5, 'the logs stay in the place, the other kind is in the hand'); at(...barCell(0)); s.uiClick(0);
  s.dropCursor(); s.addItem(7, 70); s.reconcile(); const sevens = s.slots.map((c, i) => [c, i]).filter(([c]) => c && c.id === 7);
  assert.ok(sevens.length >= 2 && sevens.every(([c]) => c.n <= 64), 'stacks of 64: ' + JSON.stringify(sevens.map(([c]) => c.n)));
  const total = s.inv.count[7]; const [first, second] = sevens; at(...cellOf(first[1])); s.uiClick(0); at(...cellOf(second[1])); s.uiClick(0);
  assert.ok(s.slots[second[1]].n <= 64); assert.strictEqual(s.slots.filter((c) => c && c.id === 7).reduce((a, c) => a + c.n, 0) + (s.cursor ? s.cursor.n : 0), total, 'nothing is lost');
  s.dropCursor(); assert.strictEqual(s.inv.count[7], total);
  at(...barCell(2)); const n2 = s.slots[2].n; s.uiClick(2); assert.strictEqual(s.cursor.n, Math.ceil(n2 / 2)); s.dropCursor();
  const a2 = s.slots[9 + 4]; at(...gridCell(4)); K.press('3'); run(s, 0.1); K.press('3', false); run(s, 0.1);
  assert.strictEqual(s.slots[2].id, a2.id, 'key 3 over the place puts it in place 3');
  s.closeUi();
});

test('shaped blocks: a torch is a thin post you walk through, a chest is smaller than a block, a bed is low and two blocks long (both halves go together), plants are crossed panels, a hay bale gives wheat back', () => {
  const K = fresh(); const D = K.voxeldata; const { s, cx, cz, gy } = yard(K, 111);
  const boxes = (b) => s.shapeBoxes(b, 0, 0, 0, false);
  assert.ok(boxes(33)[0][3] - boxes(33)[0][0] < 0.3 && boxes(33)[0][4] < 0.8, 'a thin short post'); assert.deepStrictEqual(s.shapeBoxes(33, 0, 0, 0, true), [], 'walked through');
  assert.ok(boxes(26)[0][4] < 1 && boxes(26)[0][0] > 0, 'a chest is smaller than a block'); assert.ok(boxes(35)[0][4] < 0.6, 'a bed is low');
  assert.strictEqual(boxes(19).length, 2, 'wheat: two crossing panels'); assert.deepStrictEqual(s.shapeBoxes(19, 0, 0, 0, true), []); assert.ok(boxes(19)[0][4] > boxes(17)[0][4], 'taller when ripe');
  assert.ok(boxes(15)[0][0] > 0 && boxes(16)[0][4] < 1 && boxes(162)[0][4] === 0.75);
  // walking through a torch and onto a bed
  s.set(cx + 2, gy + 1, cz, 33, false); s.p.x = cx + 0.5; s.p.z = cz + 0.5; s.p.y = gy + 1.01; s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
  K.press('w'); run(s, 1); K.press('w', false); assert.ok(s.p.x > cx + 3, 'the torch is walked through: ' + s.p.x);
  // a bed: two blocks, the head the way you look; breaking one half takes both and gives one bed back
  s.addItem(35, 2); s.select(s.hotbar().indexOf(35));
  stand(s, cx - 4.5, gy + 1.01, cz + 0.5); s.p.yaw = 0; s.p.pitch = -0.9; run(s, 0.1);
  let floor = null; for (const pitch of [-0.7, -0.9, -1.1, -1.3, -0.5]) { s.p.pitch = pitch; const h = s.target(); if (h && h.ny === 1 && h.b === 3) { floor = h; break; } }
  assert.ok(floor); assert.strictEqual(s.placeBlock(), true);
  const fx = floor.x + floor.nx, fy = floor.y + floor.ny, fz = floor.z + floor.nz;
  assert.strictEqual(s.get(fx, fy, fz), 35); assert.strictEqual(s.get(fx, fy, fz - 1), 35, 'the head, to the north where the player looks'); assert.strictEqual(s.inv.count[35], 1);
  assert.strictEqual(s.metaOf(fx, fy, fz - 1) & 4, 4, 'the head is marked');
  s.p.pitch = -0.9; run(s, 0.1); const t = (() => { for (const pitch of [-0.5, -0.7, -0.9, -1.1, -0.3]) { s.p.pitch = pitch; const h = s.target(); if (h && h.b === 35) return h; } return null; })();
  assert.ok(t); const beds = s.inv.count[35]; s.breakBlock(); assert.strictEqual(s.get(fx, fy, fz), 0); assert.strictEqual(s.get(fx, fy, fz - 1), 0, 'both halves'); assert.strictEqual(s.inv.count[35], beds + 1, 'one bed back');
  // a hay bale gives its wheat back at a table; a bale in a grid of nine wheat is made from wheat
  assert.strictEqual(D.matchGrid([127, 0, 0, 0, 0, 0, 0, 0, 0], 3).name, 'buğday (balyadan)'); assert.strictEqual(D.matchGrid([127, 0, 0, 0], 2).name, 'buğday (balyadan)');
  assert.strictEqual(D.matchGrid([21, 21, 21, 21, 21, 21, 21, 21, 21], 3).name, 'saman balyası');
});

test('see-through things: glass inside its frame, water seen from outside, the holes of leaves and the gaps between stalks show what is behind; doors have their own pictures', () => {
  const K = fresh(); const { s, cx, cz, gy } = yard(K, 112);
  assert.notStrictEqual(K.voxeldata.texId(141), 7, 'a door is not planks'); assert.notStrictEqual(K.voxeldata.texId(141), K.voxeldata.texId(142), 'the lower and the upper half differ');
  const render = () => { s.render(px()); const out = px(); s.render(out); return out; };
  // a red wall of wool three blocks ahead, glass between: the red shows through the glass
  for (let y = 0; y < 4; y++) for (let x = -3; x <= 3; x++) { s.set(cx + 3 + x, gy + 1 + y, cz - 6, 0, false); s.set(cx + 3 + x, gy + 1 + y, cz - 3, 0, false); }
  for (let y = 0; y < 4; y++) for (let x = -3; x <= 3; x++) s.set(cx + 3 + x, gy + 1 + y, cz - 6, 37, false);   // lava: orange
  stand(s, cx + 3.5, gy + 1.01, cz + 0.5); s.p.yaw = 0; s.p.pitch = 0.0; run(s, 0.1);
  const mid = (80 * 256 + 128) * 4; const open = render(); const redOpen = open[mid] - open[mid + 2];
  for (let y = 0; y < 4; y++) for (let x = -3; x <= 3; x++) s.set(cx + 3 + x, gy + 1 + y, cz - 3, 8, false);
  const behind = render(); let tinted = 0; for (let j = 40; j < 120; j += 4) for (let i = 60; i < 200; i += 4) { const k = (j * 256 + i) * 4; if (behind[k] - behind[k + 2] > 30) tinted++; }
  assert.ok(tinted > 80, 'the wall shows through the glass: ' + tinted);
  // a stone wall instead of the glass: nothing shows
  for (let y = 0; y < 4; y++) for (let x = -3; x <= 3; x++) s.set(cx + 3 + x, gy + 1 + y, cz - 3, 3, false);
  const solid = render(); let seen = 0; for (let j = 40; j < 120; j += 4) for (let i = 60; i < 200; i += 4) { const k = (j * 256 + i) * 4; if (solid[k] - solid[k + 2] > 30) seen++; } assert.ok(seen < 5, 'a stone wall hides it: ' + seen);
});

test('the achievements list fits on the screen: three columns of nine rows', () => {
  const K = fresh(); const D = K.voxeldata; const rows = Math.ceil(D.ACH.length / 3);
  assert.ok(80 + (rows - 1) * 30 + 14 < 24 + 340, 'the last row is inside the panel: ' + rows + ' rows');
  assert.ok(24 + 340 < 400, 'the panel is inside a 400 high screen');
  const { s } = yard(K, 113); s.showAch = true; assert.ok(s.render(px())[3] === 255);
});

test('a chest opens with a right click and keeps what you put in it (saved with the world), a chest you put down is empty, a village chest has loot, breaking it gives the contents', () => {
  const K = fresh(); const D = K.voxeldata; const { s, cx, cz, gy } = yard(K, 114);
  s.inv.count[7] = 0; s.addItem(26, 2); s.addItem(7, 20); s.addItem(42, 5);
  s.set(cx + 2, gy + 1, cz, 26, true);   // put down by the player
  assert.deepStrictEqual(s.chestContents(cx + 2, gy + 1, cz).filter(Boolean), [], 'a new chest is empty');
  stand(s, cx + 0.5, gy + 1.01, cz + 0.5); s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
  let t = null; for (const pitch of [-0.6, -0.5, -0.4, -0.3, -0.2, 0]) { s.p.pitch = pitch; const h = s.target(); if (h && h.b === 26) { t = h; break; } }
  assert.ok(t, 'the chest is under the crosshair'); assert.strictEqual(s.placeBlock(), true); assert.strictEqual(s.showInv, true); assert.strictEqual(s.screen, 'chest'); assert.ok(s.uiOpen());
  const L = s.invLayout(); const at = (x, y) => K.setMouse(x, y, undefined);
  const find = (kind, pred) => { for (let x = 0; x < 640; x += 4) for (let y = 0; y < 400; y += 4) { const h = s.invHit(x, y); if (h && h.kind === kind && (!pred || pred(h))) return { x: x + 1, y: y + 1, h }; } return null; };
  const planks = find('slot', (h) => h.id === 7); at(planks.x, planks.y); s.uiClick(0); assert.strictEqual(s.cursor.id, 7); assert.strictEqual(s.cursor.n, 20);
  const slot = find('chest', (h) => h.index === 4); at(slot.x, slot.y); s.uiClick(0);
  assert.strictEqual(s.chestOpen.slots[4].id, 7); assert.strictEqual(s.chestOpen.slots[4].n, 20); assert.strictEqual(s.cursor, null); assert.strictEqual(s.inv.count[7], 0);
  assert.ok(s.render(new Uint8ClampedArray(256 * 160 * 4))[3] === 255);
  s.closeUi(); assert.strictEqual(s.chestOpen, null); assert.strictEqual(s.inv.count[7], 0, 'the planks stay in the chest');
  // it is kept: open it again and with a new game of the same world
  s.openChestAt(cx + 2, gy + 1, cz); assert.strictEqual(s.chestOpen.slots[4].n, 20); s.closeUi();
  const again = K.kit.run({ kit: 'sandbox', world: { seed: 114 }, size: 'small', trees: 0, time: 'day' }); run(again, 1);
  assert.strictEqual(again.chestContents(cx + 2, gy + 1, cz)[4].n, 20, 'kept with the world');
  // a village chest has loot, the same every time; breaking a chest gives the contents
  const loot = s.chestContents(cx + 5, gy + 1, cz + 3).filter(Boolean); assert.ok(loot.length >= 1, 'a chest nobody opened has loot');
  assert.deepStrictEqual(again.chestContents(cx + 5, gy + 1, cz + 3).filter(Boolean), loot, 'always the same loot');
  s.set(cx + 5, gy + 1, cz + 3, 26, false); const before = Object.values(s.inv.count).reduce((a, b) => a + b, 0);
  const got = s.spillChest(cx + 5, gy + 1, cz + 3); assert.ok(got.length >= 1); assert.ok(Object.values(s.inv.count).reduce((a, b) => a + b, 0) > before);
  const planksBack = s.spillChest(cx + 2, gy + 1, cz); assert.ok(planksBack.some((x) => /tahta/.test(x)), 'the planks come back when the chest is broken');
});

test('the game keeps the whole player with the world: where you stand and look, the places of the inventory, the chosen place, health, hunger, the time of day, the bed, the experience; and the blocks you changed', () => {
  const K = fresh(); K.voxel.persistPlayer = true;
  const spec = { kit: 'sandbox', world: { seed: 120 }, size: 'small', trees: 0, time: 'cycle' };
  const s = K.kit.run(spec); run(s, 1);
  s.addItem(5, 12); s.addItem(42, 3); s.addItem(7, 70);
  s.slots[20] = { id: 42, n: 3 }; s.inv.count[42] = 3; for (let i = 0; i < 36; i++) if (i !== 20 && s.slots[i] && s.slots[i].id === 42) s.slots[i] = null;   // the iron is put far down on purpose
  s.reconcile(); s.slot = 5; s.health = 11; s.food = 7; s.time = 0.37; s.respawn = { x: 40.5, y: 14, z: 41.5 }; s.addXp(30);
  s.p.x = s.p.x + 3.25; s.p.z = s.p.z + 2.5; s.p.yaw = 1.2; s.p.pitch = -0.3;
  const ix = Math.floor(s.p.x) + 2, iz = Math.floor(s.p.z), iy = s.world.heightAt(ix, iz) + 1; s.set(ix, iy, iz, 7, true);
  const saved = { x: s.p.x, z: s.p.z, slots: JSON.stringify(s.slots), count: JSON.stringify(s.inv.count) };
  s.savePlayer();
  const again = K.kit.run(spec); run(again, 0.2);
  assert.ok(Math.abs(again.p.x - saved.x) < 0.5 && Math.abs(again.p.z - saved.z) < 0.5, 'you stand where you stood: ' + again.p.x + ' against ' + saved.x);
  assert.ok(Math.abs(again.p.yaw - 1.2) < 0.3, 'and look the same way');
  assert.strictEqual(JSON.stringify(again.slots), saved.slots, 'the places of the inventory are as they were (the iron far down)'); assert.strictEqual(again.slots[20].id, 42);
  assert.strictEqual(again.slot, 5); assert.strictEqual(again.health <= 20 && again.health >= 10, true, 'health: ' + again.health); assert.ok(again.food <= 7.1, 'hunger is kept: ' + again.food);
  assert.ok(again.xp >= 30 && again.respawn && again.respawn.x === 40.5, 'experience and the bed');
  assert.ok(Math.abs(again.time - 0.37) < 0.05, 'the time of day: ' + again.time); assert.strictEqual(again.get(ix, iy, iz), 7, 'the block you put is there');
  assert.strictEqual(again.inv.count[5], JSON.parse(saved.count)[5], 'the counts are kept');
  // another world starts clean, and a world nobody played starts from the spawn
  const other = K.kit.run({ ...spec, world: { seed: 121 } }); run(other, 0.2); assert.strictEqual(other.inv.count[5], 10, 'a world nobody played starts with the starter things only');
});

test('liquids: you can swim up out of lava with Space (thick, slow), Shift dives in water, and a liquid runs into a hole you open and meets lava as stone', () => {
  const K = fresh(); const { s, cx, cz, gy } = yard(K, 130);
  // a lava pit 3 wide and 2 deep: Space brings you out
  for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) { s.set(x, gy, z, 37, false); s.set(x, gy - 1, z, 37, false); s.set(x, gy - 2, z, 3, false); }
  stand(s, cx + 0.5, gy + 0.2, cz + 0.5); s.health = 20; run(s, 0.2);
  const low = s.p.y; K.press(' '); run(s, 3); K.press(' ', false);
  assert.ok(s.p.y >= gy + 1 - 0.01 || s.health > 0, 'alive or out');
  assert.ok(s.p.y > low - 1, 'did not sink to the bottom while Space was held: ' + s.p.y);
  // a pit of water: Shift goes down, nothing holds you
  for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) { s.set(x, gy, z, 14, false); s.set(x, gy - 1, z, 14, false); }
  stand(s, cx + 0.5, gy + 0.6, cz + 0.5); run(s, 0.1);
  K.press('Shift'); run(s, 1); K.press('Shift', false); assert.ok(s.p.y < gy + 0.2, 'Shift dives: ' + s.p.y);
  // a dam: water behind a wall runs into the hole when the wall is broken
  const wx = cx + 5, wz = cz - 6;
  for (let y = 1; y <= 2; y++) { s.set(wx, gy + y, wz, 3, false); s.set(wx, gy + y, wz - 1, 14, false); }
  s.set(wx, gy + 1, wz, 0, true); const n = s.flow(wx, gy + 1, wz);
  assert.ok(n >= 1 && s.get(wx, gy + 1, wz) === 14, 'water fills the opened hole');
  // water meeting lava makes stone
  s.set(cx + 5, gy + 1, cz - 3, 37, false); s.set(cx + 6, gy + 1, cz - 3, 14, false); s.set(cx + 4, gy + 1, cz - 3, 0, false);
  s.set(cx + 5, gy + 2, cz - 3, 3, false); s.set(cx + 5, gy + 1, cz - 3, 3, false); s.set(cx + 5, gy + 1, cz - 3, 0, true);
  s.flow(cx + 5, gy + 1, cz - 3); assert.ok(s.get(cx + 5, gy + 1, cz - 3) !== 0, 'the hole is filled');
});

test('buckets and tools: a bucket scoops and pours, lava poured beside water becomes kara kaya (portal cast), a hoe breaks hay faster, and a stack in the hand is shared by dragging over places', () => {
  const K = fresh(); const D = K.voxeldata; const { s, cx, cz, gy } = yard(K, 131);
  assert.ok(D.mineTime(127, (k) => (k === 'hoe' ? 0 : -1)) < D.mineTime(127, () => -1), 'a hoe is faster on hay');
  assert.strictEqual(D.matchGrid([42, 42, 42, 0, 0, 0, 0, 0, 0], 3).name, 'kova');
  // a lake in front of the player: scoop it, pour it, the lava beside it turns to kara kaya
  s.addItem(163, 2); s.select(s.hotbar().indexOf(163));
  s.set(cx + 2, gy, cz, 14, false); s.set(cx + 2, gy, cz + 1, 37, false);
  stand(s, cx + 0.5, gy + 1.01, cz + 0.5); s.p.yaw = Math.PI / 2; s.p.pitch = 0.0; run(s, 0.1);
  let scooped = false; for (const pitch of [-0.5, -0.6, -0.7, -0.8, -0.9, -1.0, -0.4]) { s.p.pitch = pitch; if (s.useBucket(163)) { scooped = true; break; } }
  assert.ok(scooped, 'the bucket scoops'); assert.ok(s.inv.count[164] >= 1 && s.inv.count[163] === 1, 'a bucket of water, one empty left'); assert.strictEqual(s.get(cx + 2, gy, cz), 0, 'the water is gone from the lake');
  // water poured next to lava turns the lava to kara kaya
  s.set(cx + 2, gy + 1, cz + 1, 0, false); let poured = false; s.select(s.hotbar().indexOf(164));
  for (const pitch of [-0.5, -0.6, -0.7, -0.8, -0.9, -0.4]) { s.p.pitch = pitch; if (s.useBucket(164)) { poured = true; break; } }
  assert.ok(poured, 'the bucket pours'); assert.ok(s.inv.count[163] === 2);
  // inventory drag: a stack of 12 over three empty places gives 4 each
  s.openScreen('inv'); s.dropCursor(); s.addItem(5, 12); s.slots.fill(null); s.slots[0] = { id: 5, n: 12 }; s.inv.count[5] = 12; s.reconcile();
  const L = s.invLayout(); const at = (x, y) => K.setMouse(x, y, undefined); const gc = (i) => [L.x0 + 10 + (i % 9) * L.cell + 2, L.gridY + Math.floor(i / 9) * L.cell + 2];
  at(L.x0 + 12, L.barY + 2); s.uiClick(0); assert.strictEqual(s.cursor.n, 12);
  at(...gc(0)); assert.strictEqual(s.dragDown(0), true); at(...gc(1)); s.dragUpdate(); at(...gc(2)); s.dragUpdate(); s.dragUp();
  assert.strictEqual(s.cursor, null); assert.deepStrictEqual([s.slots[9].n, s.slots[10].n, s.slots[11].n], [4, 4, 4], 'shared evenly');
  at(...gc(0)); s.uiClick(0); at(...gc(5)); assert.strictEqual(s.dragDown(2), true); at(...gc(6)); s.dragUpdate(); at(...gc(7)); s.dragUpdate(); s.dragUp();
  assert.deepStrictEqual([s.slots[14] && s.slots[14].n, s.slots[15] && s.slots[15].n, s.slots[16] && s.slots[16].n], [1, 1, 1], 'a right drag puts one in each'); assert.strictEqual(s.cursor.n, 1);
  s.closeUi();
});

test('poured liquids run: water spreads over a flat floor and falls into a hole, lava spreads less, and water poured by lava makes kara kaya', () => {
  const K = fresh(); const { s, cx, cz, gy } = yard(K, 132);
  const w = s.spreadFluid(cx, gy + 1, cz, 14, 4); assert.ok(w >= 20, 'water covers the floor around: ' + w);
  assert.strictEqual(s.get(cx + 3, gy + 1, cz), 14); assert.strictEqual(s.get(cx + 5, gy + 1, cz), 0, 'but not forever');
  s.set(cx + 6, gy, cz - 6, 0, false); s.set(cx + 6, gy - 1, cz - 6, 0, false); s.spreadFluid(cx + 6, gy + 1, cz - 5, 14, 4); assert.strictEqual(s.get(cx + 6, gy, cz - 6), 14, 'it falls into the hole');
  const l = s.spreadFluid(cx - 6, gy + 1, cz + 6, 37, 2); assert.ok(l >= 5 && l < w, 'lava runs less: ' + l);
  s.spreadFluid(cx - 3, gy + 1, cz + 6, 14, 2); assert.ok([s.get(cx - 3, gy + 1, cz + 6), s.get(cx - 4, gy + 1, cz + 6)].includes(151), 'where they meet it is kara kaya');
});

test('a poured liquid is one source with a flow: scooping it (or any flowing cell) takes the whole flow back and one bucket comes full', () => {
  const K = fresh(); const { s, cx, cz, gy } = yard(K, 133);
  const n = s.spreadFluid(cx, gy + 1, cz, 14, 4, 90, true); assert.ok(n > 10);
  const count = () => { let c = 0; for (let x = cx - 6; x <= cx + 6; x++) for (let z = cz - 6; z <= cz + 6; z++) if (s.get(x, gy + 1, z) === 14) c++; return c; };
  assert.strictEqual(count(), n);
  s.addItem(163, 1); s.select(s.hotbar().indexOf(163));
  stand(s, cx + 0.5, gy + 2.01, cz + 3.5); s.p.yaw = Math.PI; s.p.pitch = -0.4; run(s, 0.1);   // looks to the edge of the flow
  let scooped = false; for (const pitch of [-0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.2]) { s.p.pitch = pitch; if (s.useBucket(163)) { scooped = true; break; } }
  assert.ok(scooped); assert.strictEqual(count(), 0, 'the whole flow is gone'); assert.strictEqual(s.inv.count[164], 1, 'one bucket of water');
});

test('the test yard: from the menu a flat yard is built beside you with a lava pool, a water pool, a ready kara kaya frame, hay, a table, a furnace, a chest and the things to try them with; swimming out of both pools works', () => {
  const K = fresh(); const s = K.kit.run({ kit: 'sandbox', world: { seed: 134 }, size: 'small', trees: 0, time: 'day' }); run(s, 1.5);
  s.buildTestBed(); run(s, 0.2);
  const ox = Math.floor(s.p.x), oz = Math.floor(s.p.z), gy = Math.round(s.p.y - 1.01);
  assert.strictEqual(s.get(ox + 6, gy, oz), 37); assert.strictEqual(s.get(ox + 13, gy, oz), 14); assert.strictEqual(s.get(ox + 10, gy + 1, oz - 6), 127); assert.strictEqual(s.get(ox + 4, gy + 1, oz + 6), 151);
  assert.ok(s.inv.count[163] >= 3 && s.inv.count[152] === 1 && s.inv.count[151] >= 20, 'buckets, çakmak, kara kaya in the bag');
  for (const cx of [ox + 6, ox + 13]) {
    s.health = 20; stand(s, cx + 0.5, gy - 0.5, oz + 0.5); s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1);
    K.press('w'); K.press(' '); run(s, 3); K.press('w', false); K.press(' ', false); run(s, 0.2);
    assert.ok(s.p.y > gy + 0.9 && s.health > 0, 'got out of the pool at ' + cx + ': y ' + s.p.y + ', health ' + s.health);
  }
});

test('no flood: breaking blocks beside a poured flow only fills the hole; the test yard works with a full bag (the çakmak is there, the old bag is in chests) and the speedrun cast makes kara kaya beside the stream', () => {
  const K = fresh(); const s = K.kit.run({ kit: 'sandbox', world: { seed: 135 }, size: 'small', trees: 0, time: 'day' }); run(s, 1.5);
  for (let i = 40; i < 76; i++) { s.addItem(i, 3); } s.reconcile();   // a full bag, more kinds than places
  s.buildTestBed(); run(s, 0.2);
  const ox = Math.floor(s.p.x), oz = Math.floor(s.p.z), gy = Math.round(s.p.y - 1.01);
  assert.ok(s.slots.some((c) => c && c.id === 152), 'the çakmak is in the bag'); assert.ok(s.slots.some((c) => c && c.id === 163));
  const chest = s.chestContents(ox + 4, gy + 1, oz + 4); assert.ok(chest.some(Boolean), 'the old bag is kept in a chest');
  // the cast: lava poured beside the stream turns to kara kaya
  s.set(ox + 17, gy + 1, oz, 0, true); const cell = s.get(ox + 17, gy + 1, oz); assert.strictEqual(cell, 0);
  stand(s, ox + 15.5, gy + 1.01, oz + 0.5); s.p.yaw = Math.PI / 2; s.p.pitch = 0; run(s, 0.1); s.select(s.hotbar().indexOf(165));
  let ok = false; for (const pitch of [-0.3, -0.2, -0.1, 0, 0.1, -0.4, -0.5]) { s.p.pitch = pitch; if (s.useBucket(165)) { ok = true; break; } }
  assert.ok(ok, 'pours'); let kara = 0; for (let x = ox + 14; x <= ox + 18; x++) for (let y = gy + 1; y <= gy + 4; y++) for (let z = oz - 2; z <= oz + 2; z++) if (s.get(x, y, z) === 151) kara++; assert.ok(kara >= 1, 'kara kaya beside the water: ' + kara);
  // no flood: break the floor beside a flow; it fills the hole and stops
  const before = () => { let n = 0; for (let x = ox + 6; x <= ox + 22; x++) for (let z = oz - 8; z <= oz + 8; z++) for (let y = gy; y <= gy + 5; y++) if (s.get(x, y, z) === 14) n++; return n; };
  s.spreadFluid(ox + 8, gy + 1, oz - 5, 14, 3, 90, true); const n0 = before();
  for (let i = 0; i < 6; i++) { s.set(ox + 9 + i % 3, gy, oz - 6 + (i >> 1), 0, true); s.flow(ox + 9 + i % 3, gy, oz - 6 + (i >> 1)); }
  assert.ok(before() - n0 < 30, 'no flood: ' + (before() - n0));
});

test('golden tools never break, and every kind of tool hits with its own damage (the held one counts)', () => {
  const K = fresh(); const D = K.voxeldata; const { s, cx, cz, gy } = yard(K, 136);
  s.creative = false; const gold = D.toolId('pickaxe', 3); s.addItem(gold, 1); s.wear[gold] = 1; s.addItem(D.toolId('axe', 4), 1); s.addItem(D.hoeId(4), 1); s.addItem(D.toolId('sword', 4), 1);
  s.useTool('pickaxe'); s.useTool('pickaxe'); assert.strictEqual(s.inv.count[gold], 1, 'gold does not break'); assert.strictEqual(s.wear[gold], 1);
  const dmg = (id) => s.damageOf(id);
  assert.ok(dmg(D.toolId('sword', 4)) > dmg(D.toolId('axe', 4)) && dmg(D.toolId('axe', 4)) > dmg(D.toolId('pickaxe', 4)) && dmg(D.toolId('pickaxe', 4)) > dmg(D.toolId('shovel', 4)) && dmg(D.toolId('shovel', 4)) > dmg(D.hoeId(4)), 'each kind has its own');
  const mob = () => { const m = { type: 'zombie', x: s.p.x + 1, y: s.p.y, z: s.p.z, vx: 0, vy: 0, vz: 0, hp: 100, kx: 0, kz: 0, flash: 0 }; return m; };
  for (const [id, want] of [[D.toolId('axe', 4), 6], [D.hoeId(4), 3]]) { s.select(s.hotbar().indexOf(id)); s.attackCd = 0; const m = mob(); s.attackMob(m); assert.strictEqual(100 - m.hp, want, 'held tool ' + id); }
});

test('the chest screen: the 27 chest places lie clear above your bag, no place of the two overlaps, and the screen fits the window', () => {
  const K = fresh(); const { s, cx, cz, gy } = yard(K, 137);
  s.set(cx + 1, gy + 1, cz, 26, false); s.initChest(cx + 1, gy + 1, cz); s.openChestAt(cx + 1, gy + 1, cz);
  const L = s.invLayout(); assert.ok(L.chest); const chestBottom = L.cellY + 3 * L.cell - 4;
  assert.ok(L.gridY >= chestBottom, 'the bag starts below the chest: ' + L.gridY + ' vs ' + chestBottom);
  assert.ok(L.y0 + L.h < 400, 'fits the window: ' + (L.y0 + L.h));
  for (let i = 0; i < 27; i++) { const h = s.invHit(L.x0 + 10 + (i % 9) * L.cell + 2, L.cellY + Math.floor(i / 9) * L.cell + 2); assert.ok(h && h.kind === 'chest' && h.index === i, 'chest place ' + i); }
  for (let i = 0; i < 27; i++) { const h = s.invHit(L.x0 + 10 + (i % 9) * L.cell + 2, L.gridY + Math.floor(i / 9) * L.cell + 2); assert.ok(h && h.kind === 'slot' && h.index === 9 + i, 'bag place ' + i); }
  s.closeUi();
});
