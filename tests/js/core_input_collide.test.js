const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

function fresh() { return load('kgame.js'); }
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }

test('wasd and arrows controls move only the entities that ask for them', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const a = g.add({ shape: 'rect', x: 100, y: 100, w: 10, h: 10, controls: 'wasd', speed: 100 });
  const b = g.add({ shape: 'rect', x: 100, y: 100, w: 10, h: 10, controls: 'arrows', speed: 100 });
  const c = g.add({ shape: 'rect', x: 100, y: 100, w: 10, h: 10 });
  K.press('d');
  run(g, 0.5);
  assert.ok(a.x > 140);
  assert.strictEqual(b.x, 100);
  assert.strictEqual(c.x, 100);
  K.press('d', false);
  const stopped = a.x;
  run(g, 0.5);
  assert.strictEqual(a.x, stopped);
  K.press('ArrowLeft');
  run(g, 0.5);
  assert.ok(b.x < 60);
});

test('vertical keys move a gravity-free entity but not an entity that falls', () => {
  const K = fresh();
  const g = K.game({ headless: true, gravity: 0 });
  const free = g.add({ shape: 'rect', x: 0, y: 100, w: 10, h: 10, controls: 'wasd', speed: 100 });
  K.press('w');
  run(g, 0.5);
  assert.ok(free.y < 60);
  const g2 = K.game({ headless: true, gravity: 500 });
  const faller = g2.add({ shape: 'rect', x: 0, y: 0, w: 10, h: 10, controls: 'wasd', speed: 100, gravity: true });
  K.press('w');
  run(g2, 0.2);
  assert.ok(faller.vy > 0, 'w does not fly');
});

test('the mouse position can be set and read', () => {
  const K = fresh();
  K.setMouse(30, 40, true);
  assert.deepStrictEqual({ x: K.mouse.x, y: K.mouse.y, down: K.mouse.down }, { x: 30, y: 40, down: true });
});

test('the three overlap tests tell touching from apart', () => {
  const K = fresh();
  assert.ok(K.hit.rectRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }));
  assert.ok(!K.hit.rectRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }));
  assert.ok(K.hit.circleCircle({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 }));
  assert.ok(!K.hit.circleCircle({ x: 0, y: 0, r: 5 }, { x: 11, y: 0, r: 5 }));
  assert.ok(K.hit.circleRect({ x: 12, y: 5, r: 3 }, { x: 0, y: 0, w: 10, h: 10 }));
  assert.ok(!K.hit.circleRect({ x: 20, y: 5, r: 3 }, { x: 0, y: 0, w: 10, h: 10 }));
});

test('onCollide by tag fires once when they meet, not every step, and again after they part', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const ball = g.add({ shape: 'circle', x: 0, y: 50, r: 5, vx: 100, tag: 'ball' });
  g.add({ shape: 'rect', x: 50, y: 40, w: 10, h: 20, tag: 'paddle' });
  let count = 0;
  g.onCollide('ball', 'paddle', () => { count++; });
  run(g, 0.55);
  assert.ok(count >= 1);
  const afterFirst = count;
  run(g, 0.05);
  assert.strictEqual(count, afterFirst, 'no repeat while they still touch');
  ball.vx = -300;
  run(g, 1);
  ball.vx = 300;
  run(g, 1);
  assert.ok(count > afterFirst, 'fires again after they parted and met');
});

test('onCollide also takes the entities themselves', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const a = g.add({ shape: 'rect', x: 0, y: 0, w: 10, h: 10 });
  const b = g.add({ shape: 'rect', x: 5, y: 5, w: 10, h: 10 });
  let hit = null;
  g.onCollide(a, b, (x, y) => { hit = [x, y]; });
  g.step(1 / 60);
  assert.deepStrictEqual(hit, [a, b]);
});

test('a tilemap knows its solid tiles and where things spawn', () => {
  const K = fresh();
  const map = K.tilemap(['#..', '.P#'], { '#': 'wall', 'P': 'start' }, 32);
  assert.ok(map.solidAt(5, 5));
  assert.ok(!map.solidAt(40, 5));
  assert.ok(map.solidAt(70, 40));
  assert.deepStrictEqual(map.spawn('P'), [{ x: 32, y: 32 }]);
  assert.strictEqual(map.width, 96);
  assert.strictEqual(map.height, 64);
});

test('collideTiles pushes an entity out of a wall and stops it', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const map = K.tilemap(['....#', '....#'], { '#': 'wall' }, 32);
  const e = g.add({ shape: 'rect', x: 100, y: 10, w: 20, h: 20, vx: 200 });
  for (let i = 0; i < 30; i++) { g.step(1 / 60); g.collideTiles(e, map); }
  assert.ok(e.x + e.w <= 128 + 0.001, 'stopped at the wall');
  assert.strictEqual(e.vx, 0);
});
