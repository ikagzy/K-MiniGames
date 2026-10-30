const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const fresh = () => load('kgame.js', 'kgame.ai.js', 'kgame.sports.js');
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }

function volley(opts) {
  const K = fresh();
  const g = K.game({ headless: true, width: 800, height: 450, gravity: 700 });
  const court = K.sports.court(g, { type: 'volleyball', net: true });
  const ball = K.sports.ball(g, court, { radius: 12, bounce: 0.85 });
  return { K, g, court, ball };
}

test('a volleyball court has a floor, a net in the middle, and says which side a place is on', () => {
  const { court } = volley();
  assert.strictEqual(court.netX, 400);
  assert.ok(court.floorY < 450 && court.netTop < court.floorY);
  assert.strictEqual(court.sideOf(100), 'left');
  assert.strictEqual(court.sideOf(700), 'right');
});

test('the ball bounces off the net instead of passing through it', () => {
  const { g, court, ball } = volley();
  ball.x = court.netX - 30; ball.y = court.floorY - 50; ball.vx = 400; ball.vy = 0;
  ball.gravity = false;
  run(g, 0.5);
  assert.ok(ball.x < court.netX, 'still on the left of the net');
  assert.ok(ball.vx < 0, 'turned back');
});

test('a ball that lands on the left floor gives the right side a point and is served again', () => {
  const { K, g, court, ball } = volley();
  const state = K.sports.rules.volleyball(g, court, { to: 15 });
  ball.x = 100; ball.y = court.floorY - 40; ball.vx = 0; ball.vy = 300;
  run(g, 0.3);
  assert.strictEqual(state.scoreRight, 1);
  assert.strictEqual(state.scoreLeft, 0);
  assert.strictEqual(g.score('right'), 1);
  assert.ok(ball.y < court.floorY - 100, 'back up for the serve');
});

test('reaching the winning score ends the match', () => {
  const { K, g, court, ball } = volley();
  const state = K.sports.rules.volleyball(g, court, { to: 2 });
  for (let i = 0; i < 2; i++) { ball.x = 100; ball.y = court.floorY - 40; ball.vx = 0; ball.vy = 300; run(g, 0.3); }
  assert.strictEqual(state.scoreRight, 2);
  assert.strictEqual(state.winner, 'right');
  assert.strictEqual(g.current, 'over');
});

test('hit sends the ball toward the target with both an x and a y speed', () => {
  const { K, g, ball } = volley();
  const me = g.add({ shape: 'rect', x: 280, y: 340, w: 30, h: 50 });
  ball.x = 300; ball.y = 330; ball.vx = 0; ball.vy = 0;
  const done = K.sports.hit(g, ball, me, { x: 600, y: 100 }, { power: 650 });
  assert.strictEqual(done, true);
  assert.ok(ball.vx > 100, 'goes right');
  assert.ok(ball.vy < -100, 'goes up');
  assert.ok(Math.hypot(ball.vx, ball.vy) > 600);
});

test('hit does nothing when the ball is out of reach', () => {
  const { K, g, ball } = volley();
  const me = g.add({ shape: 'rect', x: 50, y: 340, w: 30, h: 50 });
  ball.x = 600; ball.y = 100; ball.vx = 5; ball.vy = 5;
  assert.strictEqual(K.sports.hit(g, ball, me, { x: 700, y: 100 }), false);
  assert.strictEqual(ball.vx, 5);
});

test('hitOnClick hits once per click, not while the button stays down', () => {
  const { K, g, ball } = volley();
  const me = g.add({ shape: 'rect', x: 280, y: 340, w: 30, h: 50 });
  K.sports.hitOnClick(g, ball, me, { power: 600 });
  ball.x = 300; ball.y = 330; ball.vx = 0; ball.vy = 0; ball.gravity = false;
  K.setMouse(600, 100, true);
  g.step(1 / 60);
  assert.ok(ball.vx > 0);
  ball.vx = 0; ball.vy = 0; ball.x = 300; ball.y = 330;
  g.step(1 / 60);
  assert.strictEqual(ball.vx, 0, 'button still down: no second hit');
  K.setMouse(600, 100, false);
  g.step(1 / 60);
  K.setMouse(600, 100, true);
  g.step(1 / 60);
  assert.ok(ball.vx > 0, 'a new click hits again');
});

test('too many touches on one side is a fault: the other side gets the point', () => {
  const { K, g, court, ball } = volley();
  const state = K.sports.rules.volleyball(g, court, { to: 15, touches: 3 });
  const me = g.add({ shape: 'rect', x: 140, y: 340, w: 30, h: 50 });
  for (let i = 0; i < 4; i++) {
    ball.x = 150; ball.y = 330; ball.vx = 0; ball.vy = 0;
    K.sports.hit(g, ball, me, { x: 300, y: 100 });
  }
  assert.strictEqual(state.scoreRight, 1);
});

test('pong: a ball past the left edge scores for the right and is served again at an angle', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 800, height: 450 });
  const court = K.sports.court(g, { type: 'pong' });
  const ball = K.sports.ball(g, court, { radius: 8 });
  const state = K.sports.rules.pong(g, court, { to: 5 });
  ball.x = 10; ball.y = 225; ball.vx = -300; ball.vy = 0;
  run(g, 0.2);
  assert.strictEqual(state.scoreRight, 1);
  assert.ok(Math.abs(ball.vx) > 0 && Math.abs(ball.vy) > 0, 'served with both speeds');
  assert.ok(ball.x > 300 && ball.x < 500, 'back in the middle');
});

test('pong: a paddle returns the ball and gives it a sideways push from where it was hit', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 800, height: 450 });
  const court = K.sports.court(g, { type: 'pong' });
  const ball = K.sports.ball(g, court, { radius: 8 });
  const paddle = g.add({ shape: 'rect', x: 20, y: 200, w: 10, h: 80, tag: 'paddle' });
  ball.x = 60; ball.y = 210; ball.vx = -300; ball.vy = 0;
  run(g, 0.3);
  assert.ok(ball.vx > 0, 'returned');
  assert.ok(ball.vy < 0, 'hit above the middle of the paddle: it goes up');
});

test('football: a ball into the left goal scores for the right', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 800, height: 450 });
  const court = K.sports.court(g, { type: 'football' });
  const ball = K.sports.ball(g, court, { radius: 10 });
  const state = K.sports.rules.goal(g, court, { to: 3 });
  ball.x = 30; ball.y = 225; ball.vx = -400; ball.vy = 0;
  run(g, 0.3);
  assert.strictEqual(state.scoreRight, 1);
  assert.ok(Math.abs(ball.x - 400) < 5 && Math.abs(ball.y - 225) < 5, 'kick-off from the middle');
});

test('football: a ball that hits the wall beside the goal bounces back', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 800, height: 450 });
  const court = K.sports.court(g, { type: 'football' });
  const ball = K.sports.ball(g, court, { radius: 10 });
  const state = K.sports.rules.goal(g, court, { to: 3 });
  ball.x = 30; ball.y = 40; ball.vx = -400; ball.vy = 0;
  run(g, 0.3);
  assert.strictEqual(state.scoreRight + state.scoreLeft, 0);
  assert.ok(ball.vx > 0);
});

test('the basketball court is known and has hoops as goals', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 800, height: 450, gravity: 700 });
  const court = K.sports.court(g, { type: 'basketball' });
  assert.ok(court.goals.left && court.goals.right);
});
