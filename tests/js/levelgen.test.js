const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const fresh = () => load('kgame.js', 'kgame.levels.js');

test('a generated level is rectangular with exactly one start and one flag', () => {
  const K = fresh();
  const rows = K.levels.generate({ width: 60, seed: 5 });
  assert.ok(rows.length >= 8 && rows.length <= 14);
  assert.ok(rows.every((r) => r.length === 60));
  const text = rows.join('');
  assert.strictEqual((text.match(/P/g) || []).length, 1);
  assert.strictEqual((text.match(/F/g) || []).length, 1);
  assert.ok(rows[rows.length - 1].replace(/#/g, '').length < 20, 'the ground is mostly solid');
});

test('every level is finishable, for many seeds and every difficulty', () => {
  const K = fresh();
  const failures = [];
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    for (let seed = 0; seed < 60; seed++) {
      const rows = K.levels.generate({ width: 40 + seed, difficulty, seed, pits: 5, enemies: 5, blocks: 5, pipes: 5, coins: 5, flyers: 3, spikes: 4 });
      const v = K.levels.validate(K.levels.parse(rows), { jump: 4, gap: 3 });
      if (!v.ok) failures.push(difficulty + '/' + seed + ': ' + v.reason);
    }
  }
  assert.deepStrictEqual(failures, []);
});

test('the same seed gives the same level and another seed another one', () => {
  const K = fresh();
  const a = K.levels.generate({ seed: 11 }), b = K.levels.generate({ seed: 11 }), c = K.levels.generate({ seed: 12 });
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
});

test('the densities decide what is in the level', () => {
  const K = fresh();
  const count = (rows, ch) => rows.join('').split(ch).length - 1;
  const none = K.levels.generate({ width: 80, seed: 3, pits: 0, enemies: 0, coins: 0, blocks: 0, pipes: 0, flyers: 0, spikes: 0 });
  assert.strictEqual(count(none, 'E') + count(none, 'o') + count(none, 'B') + count(none, 'T') + count(none, '?'), 0);
  assert.ok(!none[none.length - 3].includes('.'), 'no pits');
  const busy = K.levels.generate({ width: 80, seed: 3, pits: 5, enemies: 5, coins: 5, blocks: 5, pipes: 5, flyers: 4, spikes: 5, difficulty: 4 });
  assert.ok(count(busy, 'E') > 0 && count(busy, 'o') > 5 && count(busy, 'T') > 0 && count(busy, '?') + count(busy, 'B') > 3);
  assert.ok(count(busy, '^') > 0 && count(busy, 'S') > 0);
  const easy = K.levels.generate({ width: 80, seed: 3, difficulty: 1, spikes: 5, flyers: 4 });
  assert.strictEqual(count(easy, 'S'), 0, 'spikes only from difficulty 3');
});

test('nonsense options are clamped instead of breaking the level', () => {
  const K = fresh();
  for (const o of [{ width: 5 }, { width: 9999 }, { height: 2 }, { height: 99 }, { difficulty: 99 }, { seed: 'abc' }, { coins: -3 }, null, undefined, {}]) {
    const rows = K.levels.generate(o);
    assert.ok(K.levels.validate(K.levels.parse(rows), { jump: 4, gap: 3 }).ok, JSON.stringify(o));
    assert.ok(rows[0].length >= 24 && rows[0].length <= 160);
  }
});

test('levelsFor turns a spec into level rows: custom rows win, then generators, then the default level', () => {
  const K = fresh();
  const custom = [['P.F', '###']];
  assert.strictEqual(K.levels.fromSpec({ levels: custom }), custom);
  const generated = K.levels.fromSpec({ generate: [{ seed: 1 }, { seed: 2, width: 30 }] });
  assert.strictEqual(generated.length, 2);
  assert.strictEqual(generated[1][0].length, 30);
  assert.strictEqual(K.levels.fromSpec({}).length, 1);
  assert.strictEqual(K.levels.fromSpec({ levels: [], generate: [] }).length, 1);
});

test('levels have styles: hills raise the ground, a gauntlet puts enemies in pairs, and every style stays finishable', () => {
  const K = fresh();
  const raised = (rows) => rows.slice(0, rows.length - 3).some((r) => r.includes('#'));   // solid ground above the normal ground line
  let plainRaised = 0;
  for (let seed = 0; seed < 20; seed++) {
    assert.ok(raised(K.levels.generate({ width: 80, seed, style: 1, difficulty: 2 })), 'a hills level always has a raised part');
    if (raised(K.levels.generate({ width: 80, seed, style: 0, difficulty: 2 }))) plainRaised++;
  }
  assert.ok(plainRaised <= 8, 'a plain level only now and then has a hill');
  const pairs = (rows) => /E.E/.test(rows.join('\n'));
  assert.ok([...Array(20).keys()].some((seed) => pairs(K.levels.generate({ width: 100, seed, style: 3, enemies: 5 }))));
  for (let style = 0; style < K.levels.STYLES; style++) {
    for (let seed = 0; seed < 40; seed++) {
      const rows = K.levels.generate({ width: 40 + seed * 2, difficulty: 1 + (seed % 5), seed, style, pits: 5, enemies: 5, blocks: 5, pipes: 5, coins: 5, flyers: 3, spikes: 4 });
      assert.ok(K.levels.validate(K.levels.parse(rows), { jump: 4, gap: 3 }).ok, 'style ' + style + ' seed ' + seed);
    }
  }
});

test('a campaign mixes the styles and the levels of one difficulty are not the same kind of level', () => {
  const K = fresh();
  const list = K.levels.campaign({ count: 12, from: 1, to: 5, width: 60, seed: 7 });
  assert.ok(new Set(list.map((o) => o.style)).size >= 4, 'at least four different styles in twelve levels');
  for (let i = 1; i < list.length; i++) assert.notStrictEqual(list[i].style, list[i - 1].style, 'two levels in a row never share a style');
  assert.ok(new Set(list.map((o) => o.enemies + ',' + o.pits + ',' + o.coins + ',' + o.blocks)).size >= 6, 'the densities vary from level to level');
});
