const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const fresh = () => load('kgame.js', 'kgame.ai.js');
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }
const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

test('follow closes the distance and stops at stopAt', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const target = g.add({ shape: 'rect', x: 400, y: 200, w: 10, h: 10 });
  const e = g.add({ shape: 'rect', x: 0, y: 0, w: 10, h: 10 });
  K.ai.follow(e, target, { speed: 200, stopAt: 50 });
  const before = dist(e, target);
  run(g, 1);
  assert.ok(dist(e, target) < before);
  run(g, 3);
  assert.ok(dist(e, target) >= 45 && dist(e, target) <= 60, 'it stops near stopAt');
});

test('flee opens the distance', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const threat = g.add({ shape: 'rect', x: 100, y: 100, w: 10, h: 10 });
  const e = g.add({ shape: 'rect', x: 120, y: 100, w: 10, h: 10 });
  K.ai.flee(e, threat, { speed: 100 });
  const before = dist(e, threat);
  run(g, 1);
  assert.ok(dist(e, threat) > before + 50);
});

test('patrol goes to the points and back', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const e = g.add({ shape: 'rect', x: 0, y: 0, w: 10, h: 10 });
  K.ai.patrol(e, [[0, 0], [100, 0]], { speed: 100 });
  let maxX = 0, backAtStart = false;
  for (let i = 0; i < 60 * 4; i++) {
    g.step(1 / 60);
    maxX = Math.max(maxX, e.x);
    if (maxX > 90 && e.x < 10) backAtStart = true;
  }
  assert.ok(maxX >= 95);
  assert.ok(backAtStart);
});

test('wander keeps moving without leaving a steady direction forever', () => {
  const K = fresh();
  K.seed(3);
  const g = K.game({ headless: true });
  const e = g.add({ shape: 'rect', x: 200, y: 200, w: 10, h: 10 });
  K.ai.wander(e, { speed: 60 });
  const xs = [];
  for (let i = 0; i < 300; i++) { g.step(1 / 60); xs.push(e.vx); }
  assert.ok(Math.hypot(e.vx, e.vy) > 30);
  assert.ok(new Set(xs.map((v) => Math.round(v))).size > 3, 'the heading changes');
});

test('paddle answers the ball: up when it is above, down when it is below', () => {
  const K = fresh();
  for (const [ballY, sign] of [[0, -1], [400, 1]]) {
    const g = K.game({ headless: true, height: 500 });
    const ball = g.add({ shape: 'circle', x: 300, y: ballY, r: 8 });
    const bot = g.add({ shape: 'rect', x: 600, y: 200, w: 10, h: 60 });
    K.ai.paddle(bot, ball, { level: 'hard', axis: 'y' });
    run(g, 0.5);
    assert.ok(Math.sign(bot.y - 200) === sign, 'moves toward the ball (' + sign + ')');
  }
});

test('paddle on the x axis follows the ball sideways', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 800 });
  const ball = g.add({ shape: 'circle', x: 100, y: 100, r: 8 });
  const bot = g.add({ shape: 'rect', x: 600, y: 300, w: 60, h: 10 });
  K.ai.paddle(bot, ball, { level: 'hard', axis: 'x' });
  run(g, 0.5);
  assert.ok(bot.x < 600);
  assert.strictEqual(bot.y, 300);
});

test('an easy paddle is slower than a hard one', () => {
  const K = fresh();
  const moved = (level) => {
    K.seed(1);
    const g = K.game({ headless: true, height: 2000 });
    const ball = g.add({ shape: 'circle', x: 300, y: 1800, r: 8 });
    const bot = g.add({ shape: 'rect', x: 600, y: 100, w: 10, h: 60 });
    K.ai.paddle(bot, ball, { level, axis: 'y' });
    run(g, 1);
    return bot.y - 100;
  };
  assert.ok(moved('easy') < moved('hard'));
  assert.ok(moved('easy') > 0);
});

test('fsm changes state when a state function returns a name', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const e = g.add({ shape: 'rect', x: 0, y: 0 });
  let ticks = 0;
  const machine = K.ai.fsm(e, {
    idle: () => { ticks++; return ticks > 10 ? 'chase' : undefined; },
    chase: (me) => { me.vx = 50; },
  }, 'idle');
  assert.strictEqual(machine.state, 'idle');
  run(g, 0.5);
  assert.strictEqual(machine.state, 'chase');
  assert.ok(e.vx === 50);
});

test('astar walks round a wall, and says null when there is no way', () => {
  const K = fresh();
  const grid = [
    [0, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
  ];
  const path = K.ai.astar(grid, [0, 0], [0, 2]);
  assert.deepStrictEqual(path[0], [0, 0]);
  assert.deepStrictEqual(path[path.length - 1], [0, 2]);
  assert.strictEqual(path.length, 9);
  assert.ok(path.every(([c, r]) => grid[r][c] === 0));
  assert.strictEqual(K.ai.astar([[0, 1, 0]], [0, 0], [2, 0]), null);
  assert.deepStrictEqual(K.ai.astar([[0]], [0, 0], [0, 0]), [[0, 0]]);
});

test('sees is false with a wall in between and out of range', () => {
  const K = fresh();
  const g = K.game({ headless: true });
  const a = g.add({ shape: 'rect', x: 0, y: 50, w: 10, h: 10 });
  const b = g.add({ shape: 'rect', x: 200, y: 50, w: 10, h: 10 });
  const wall = g.add({ shape: 'rect', x: 100, y: 0, w: 10, h: 200 });
  assert.ok(K.ai.sees(a, b, [], 500));
  assert.ok(!K.ai.sees(a, b, [wall], 500));
  assert.ok(!K.ai.sees(a, b, [], 100));
});

test('swarm pulls spread-out members together', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 2000, height: 2000 });
  const list = [0, 1, 2, 3].map((i) => g.add({ shape: 'rect', x: i * 300, y: i % 2 * 300, w: 10, h: 10 }));
  const spread = () => {
    const cx = list.reduce((s, e) => s + e.cx, 0) / list.length, cy = list.reduce((s, e) => s + e.cy, 0) / list.length;
    return list.reduce((s, e) => s + Math.hypot(e.cx - cx, e.cy - cy), 0);
  };
  const before = spread();
  K.ai.swarm(list, { cohesion: 0.5, separation: 20, speed: 80 });
  run(g, 3);
  assert.ok(spread() < before);
});

test('the difficulty names are the three the guide promises', () => {
  const K = fresh();
  assert.deepStrictEqual(Object.keys(K.ai.levels).sort(), ['easy', 'hard', 'normal']);
});
