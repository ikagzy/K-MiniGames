const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

// A canvas that records what is drawn on it (there is no DOM in Node).
function fakeCanvas() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name === 'calls') return calls;
      if (name in target) return target[name];
      return (...args) => { calls.push([String(name), ...args]); };
    },
    set(target, name, value) { target[name] = value; if (name === 'globalAlpha' || name === 'fillStyle') calls.push(['set:' + String(name), value]); return true; },
  });
  return { width: 0, height: 0, getContext: () => ctx, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }), ctx, calls };
}
const fresh = () => load('kgame.js');
function run(g, seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60); }

test('a parallax layer is drawn behind the world and moves slower than the camera', () => {
  const K = fresh();
  const canvas = fakeCanvas();
  const g = K.game({ canvas, width: 400, height: 200 });
  const seen = [];
  g.layers.push({ speed: 0.5, draw: (ctx, game, ox, oy) => { seen.push([ox, oy]); ctx.fillRect(0, 0, 1, 1); } });
  g.camera.x = 100;
  g.draw();
  assert.deepStrictEqual(seen, [[50, 0]]);
  const names = canvas.calls.map((c) => c[0]);
  assert.ok(names.indexOf('fillRect') >= 0);
});

test('the camera stays inside its bounds while following', () => {
  const K = fresh();
  const g = K.game({ headless: true, width: 200, height: 100 });
  g.cameraBounds = { x0: 0, y0: 0, x1: 600, y1: 100 };
  const e = g.add({ shape: 'rect', x: 5000, y: 0, w: 10, h: 10 });
  g.follow(e, 1);
  run(g, 0.2);
  assert.strictEqual(g.camera.x, 400);   // 600 - the width of the view
  e.x = -5000;
  run(g, 0.2);
  assert.strictEqual(g.camera.x, 0);
});

test('a fade goes from one opacity to another, calls back once, and is drawn over everything', () => {
  const K = fresh();
  const canvas = fakeCanvas();
  const g = K.game({ canvas, width: 200, height: 100 });
  let done = 0;
  g.fade({ color: '#000', from: 1, to: 0, ms: 100, onDone: () => { done++; } });
  assert.strictEqual(g.fadeAlpha(), 1);
  run(g, 0.05);
  assert.ok(g.fadeAlpha() > 0 && g.fadeAlpha() < 1);
  run(g, 0.2);
  assert.strictEqual(g.fadeAlpha(), 0);
  assert.strictEqual(done, 1);
  g.fade({ color: '#fff', from: 0, to: 0.5, ms: 50 });
  run(g, 0.1);
  canvas.calls.length = 0;
  g.draw();
  assert.ok(canvas.calls.some((c) => c[0] === 'set:globalAlpha' && c[1] === 0.5), 'the overlay is drawn with its opacity');
});

test('an entity with a drawable texture is drawn through it, with its facing', () => {
  const K = fresh();
  const canvas = fakeCanvas();
  const g = K.game({ canvas, width: 200, height: 100 });
  const drawn = [];
  g.add({ shape: 'rect', x: 10, y: 20, w: 12, h: 16, flip: true, texture: { draw: (ctx, x, y, w, h, flip) => drawn.push([x, y, w, h, flip]) } });
  g.draw();
  assert.deepStrictEqual(drawn, [[10, 20, 12, 16, true]]);
});

test('the sound table can be extended by modules and an unknown name still does not throw', () => {
  const K = fresh();
  K.sfxTable.stomp = [300, 80, 0.1, 'square'];
  assert.doesNotThrow(() => K.sfx('stomp'));
  assert.doesNotThrow(() => K.sfx('yok'));
});

test('draw order: background, parallax, world, then the screen overlay', () => {
  const K = fresh();
  const canvas = fakeCanvas();
  const g = K.game({ canvas, width: 200, height: 100, background: '#123' });
  const order = [];
  g.layers.push({ speed: 0, draw: () => order.push('layer') });
  g.add({ shape: 'rect', x: 0, y: 0, w: 5, h: 5, texture: { draw: () => order.push('entity') } });
  g.scene('play', { draw: () => order.push('scene') });
  g.ui.text('t', 'x', 1, 1);
  g.fade({ color: '#000', from: 1, to: 1, ms: 1000 });
  g.draw();
  assert.deepStrictEqual(order, ['layer', 'entity', 'scene']);
  const last = canvas.calls[canvas.calls.length - 1];
  assert.ok(canvas.calls.map((c) => c[0]).lastIndexOf('fillText') < canvas.calls.map((c) => c[0]).lastIndexOf('fillRect'), 'the fade is over the text');
});
