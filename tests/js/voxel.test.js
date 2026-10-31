const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.audio2.js', 'kgame.kits.js', 'kgame.voxeldata.js', 'kgame.voxel.js'];
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
  assert.strictEqual(s.showCraft, true);
  const bread = s.inv.count[23]; s.inv.count[21] = 3;
  s.craftCursor = K.voxeldata.recipeIndex('ekmek');
  K.press('Enter'); run(s, 0.1); K.press('Enter', false);
  assert.strictEqual(s.inv.count[23], bread + 1, 'Enter crafts the recipe the cursor is on');
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

test('the hotbar is a window over everything you hold, so new tools show up, and the number keys follow the window', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'sandbox', world: { seed: 2 }, size: 'small' });
  run(s, 1);
  for (const id of [40, 41, 42, 43, 44, 50, 51]) s.addItem(id, 1);
  const all = s.hotbar();
  assert.ok(all.length > 9);
  s.select(all.length - 1);
  assert.ok(s.windowStart() > 0 && s.windowStart() + 9 === all.length, 'the window slid to show the last one');
  const start = s.windowStart();
  K.press('1'); run(s, 0.1); K.press('1', false);
  assert.strictEqual(s.selectedBlock(), all[start], 'key 1 is the first slot shown');
  s.select(0); assert.strictEqual(s.windowStart(), 0);
});
