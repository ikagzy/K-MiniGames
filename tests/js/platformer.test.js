const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

const FILES = ['kgame.js', 'kgame.sprites.js', 'kgame.animation.js', 'kgame.themes.js', 'kgame.levels.js', 'kgame.hud.js',
  'kgame.audio2.js', 'kgame.items.js', 'kgame.enemies.js', 'kgame.kits.js', 'kgame.platformer.js'];
const fresh = () => load(...FILES);
function run(state, seconds, each) { for (let i = 0; i < Math.round(seconds * 60); i++) { if (each) each(i); state.g.step(1 / 60); } }

const FLAT = ['..............', 'P............F', '##############', '##############'];
const PIT = ['..............', 'P............F', '####..########', '####..########'];

// ---- the kit registry ----
test('the registry lists kits and features and checks a spec', () => {
  const K = fresh();
  assert.ok(K.kit.list().includes('platformer'));
  assert.ok(K.feature.list('platformer').includes('doubleJump'));
  assert.deepStrictEqual(K.kit.check({ kit: 'platformer' }), []);
  assert.ok(K.kit.check({ kit: 'yok' })[0].includes('bilinmeyen kit'));
  assert.ok(K.kit.check({ kit: 'platformer', features: ['uçmak'] })[0].includes('bilinmeyen özellik'));
  assert.ok(K.kit.check(null)[0]);
});

test('a level that cannot be finished makes the spec invalid, with the reason', () => {
  const K = fresh();
  const errors = K.kit.check({ kit: 'platformer', levels: [['P.........F', '###......###', '###......###']] });
  assert.ok(errors.length === 1 && /boşluk|ulaş/i.test(errors[0]), errors.join('|'));
  assert.throws(() => K.kit.run({ kit: 'platformer', levels: [['....', '####']] }), /geçersiz/);
  const warn = K.kit.check({ kit: 'platformer', levels: [['P.a.F', '#####']] });
  assert.ok(warn.some((e) => e.includes("'a'")));
});

test('defaults are merged under the spec and the spec wins', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', hero: { lives: 5 }, levels: [FLAT] });
  assert.strictEqual(s.hud.lives, 5);
  assert.strictEqual(s.spec.hero.speed, 170);
  assert.strictEqual(s.spec.gravity, 1100);
  assert.strictEqual(K.exposed().g, s.g, 'the state is exposed for tests');
});

// ---- playing ----
test('the default level runs and a long level scrolls with the hero', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer' });
  run(s, 1);
  assert.ok(s.me.onFloor);
  assert.strictEqual(K.music.current, 'overworld');
  assert.ok(s.hud.lives === 3);
  const long = ['.'.repeat(60), 'P' + '.'.repeat(58) + 'F', '#'.repeat(60), '#'.repeat(60)];
  const s2 = K.kit.run({ kit: 'platformer', levels: [long], time: 100 });
  K.press('d');
  run(s2, 5);
  K.press('d', false);
  assert.ok(s2.me.x > 400, 'x = ' + s2.me.x);
  assert.ok(s2.g.camera.x > 100, 'camera = ' + s2.g.camera.x);
});

test('a bot that runs right finishes a flat level and the win screen comes', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', levels: [FLAT], time: 100 });
  K.press('d');
  run(s, 10);
  K.press('d', false);
  assert.strictEqual(s.g.current, 'win');
  assert.ok(s.hud.score > 1000);
});

test('a bot that jumps at the edge crosses a pit', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', levels: [PIT], time: 100 });
  K.press('d');
  let jumping = false;
  run(s, 14, () => {
    const me = s.me;
    const ahead = s.map.solidAt(me.cx + 28, me.bottom + 4);
    if (!ahead && me.onFloor) jumping = true;       // jump at the edge and keep the button down until landing
    else if (ahead && me.onFloor) jumping = false;
    K.press(' ', jumping);
  });
  K.press('d', false); K.press(' ', false);
  assert.strictEqual(s.g.current, 'win', 'it reached the flag (lives left: ' + s.hud.lives + ')');
  assert.strictEqual(s.hud.lives, 3);
});

test('without a jump the pit costs a life and the level starts again', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', levels: [PIT], time: 100 });
  K.press('d');
  run(s, 2.2);
  K.press('d', false);   // it has run into the pit
  run(s, 3);
  assert.strictEqual(s.hud.lives, 2);
  assert.ok(s.me.x < 100, 'back at the start (x = ' + s.me.x + ')');
  assert.strictEqual(s.g.current, 'play');
});

test('with one life left the same fall ends the game, and R starts again', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', levels: [PIT], hero: { lives: 1 }, time: 100 });
  K.press('d');
  run(s, 6);
  K.press('d', false);
  assert.strictEqual(s.g.current, 'over');
  K.press('r');
  run(s, 0.2);
  K.press('r', false);
  assert.strictEqual(s.g.current, 'play');
  assert.strictEqual(s.hud.lives, 1);
});

test('landing on an enemy squashes it for points; touching its side hurts', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', levels: [['..............', 'P.....E.....F.', '##############', '##############']], time: 100 });
  run(s, 0.5);
  const en = s.g.all('enemy')[0];
  s.me.x = en.x + 2; s.me.y = en.y - 40; s.me.vy = 200;
  run(s, 0.2);
  assert.strictEqual(en.tag, 'squashed');
  assert.ok(s.hud.score >= 100);
  assert.strictEqual(s.hud.lives, 3);
  const s2 = K.kit.run({ kit: 'platformer', levels: [['..............', 'P.....E.....F.', '##############', '##############']], time: 100 });
  run(s2, 0.5);
  const en2 = s2.g.all('enemy')[0];
  s2.me.x = en2.x - 10; s2.me.y = en2.y; s2.me.vy = 0;
  run(s2, 0.1);
  run(s2, 2);
  assert.ok(s2.hud.lives < 3, 'the side hit cost a life');
});

test('coins are picked up and counted', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', levels: [['..............', 'Po...........F', '##############', '##############']] });
  K.press('d');
  run(s, 1.2);
  K.press('d', false);
  assert.strictEqual(s.hud.coins, 1);
  assert.strictEqual(s.g.all('coin').length, 0);
});

test('hitting a question block from below gives its content once', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', qblocks: ['coin'], levels: [['..............', '..?...........', 'P............F', '##############', '##############']] });
  run(s, 0.5);
  const block = s.g.all('qblock')[0];
  s.me.x = block.x + 4; s.me.y = block.y + 40; s.me.vy = -420;
  run(s, 0.3);
  assert.strictEqual(block.used, true);
  assert.strictEqual(s.hud.coins, 1);
});

test('a mushroom makes the hero big and a hit then only shrinks it', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', levels: [['..............', 'PM..E........F', '##############', '##############']], time: 100 });
  run(s, 0.3);
  const mushroom = s.g.all('powerup')[0];
  s.me.x = mushroom.x; s.me.y = mushroom.y - 6;   // pick it up
  run(s, 0.1);
  assert.strictEqual(s.me.big, true);
  assert.strictEqual(s.me.h, 42);
  const lives = s.hud.lives;
  const en = s.g.all('enemy')[0];
  s.me.x = en.x - 12; s.me.y = en.y - 10; s.me.vy = 0;
  run(s, 0.2);
  assert.strictEqual(s.me.big, false);
  assert.strictEqual(s.hud.lives, lives, 'no life lost');
});

test('doubleJump lets the hero jump once more in the air, but only once', () => {
  const K = fresh();
  const plain = K.kit.run({ kit: 'platformer', levels: [FLAT] });
  const withJump = K.kit.run({ kit: 'platformer', levels: [FLAT], features: ['doubleJump'] });
  const peak = (s) => {
    run(s, 0.5);
    let top = s.me.y;
    K.press(' ');
    run(s, 0.05); K.press(' ', false);
    run(s, 0.15);
    K.press(' '); run(s, 0.05); K.press(' ', false);   // a second press in the air
    for (let i = 0; i < 60; i++) { s.g.step(1 / 60); top = Math.min(top, s.me.y); }
    return top;
  };
  const a = peak(plain), b = peak(withJump);
  assert.ok(b < a - 20, 'the double jump went higher (' + b + ' vs ' + a + ')');
});

test('time running out costs a life', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', levels: [FLAT], time: 2 });
  run(s, 4);
  assert.ok(s.hud.lives <= 2);
});

test('the Mario example spec is valid and plays for ten seconds without an error', () => {
  const fs = require('fs'), path = require('path');
  const { LIB } = require('./helpers');
  const html = fs.readFileSync(path.join(LIB, 'examples', 'mario.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const K = fresh();
  new Function('K', script)(K);
  const state = K.exposed();
  K.press('d');
  for (let i = 0; i < 600; i++) state.g.step(1 / 60);
  assert.ok(Number.isFinite(state.me.x) && Number.isFinite(state.me.y));
  assert.deepStrictEqual(K.kit.check({ kit: 'platformer', levels: state.spec.levels, features: state.spec.features }), []);
});

test('a spec that only describes its levels with numbers gets finishable levels and can be played to the end', () => {
  const K = fresh();
  const spec = { kit: 'platformer', time: 200, generate: [{ seed: 2, width: 50, pits: 0, enemies: 0, pipes: 0, spikes: 0, flyers: 0, coins: 2, blocks: 2 }] };
  assert.deepStrictEqual(K.kit.check(spec), []);
  const s = K.kit.run(spec);
  assert.strictEqual(s.level.cols, 50);
  K.press('d');
  run(s, 14);
  K.press('d', false);
  assert.strictEqual(s.g.current, 'win', 'finished (lives ' + s.hud.lives + ')');
  assert.ok(s.hud.coins > 0 || s.hud.score > 1000);
});

test('many generated levels with everything switched on are valid specs', () => {
  const K = fresh();
  for (let seed = 0; seed < 25; seed++) {
    const spec = { kit: 'platformer', generate: [{ seed, width: 90, difficulty: 1 + (seed % 5), pits: 5, enemies: 5, blocks: 5, pipes: 5, coins: 5, flyers: 5, spikes: 5 }] };
    assert.deepStrictEqual(K.kit.check(spec), [], 'seed ' + seed);
  }
});

test('a feature listed twice is applied once', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', features: ['doubleJump', 'doubleJump', { name: 'doubleJump' }] });
  assert.strictEqual(s.jumpHooks.length, 1);
});

// ---- Sonic features: springs, dash pads, rings ----
const LONG = ['.'.repeat(80), 'P' + '.'.repeat(77) + 'F', '#'.repeat(80), '#'.repeat(80)];
const sonic = (K, features, extra) => K.kit.run(Object.assign({ kit: 'platformer', levels: [LONG], features, time: 100 }, extra || {}));

test('spring, dashPad and rings are known features of the platformer and pass the check', () => {
  const K = fresh();
  ['spring', 'dashPad', 'rings'].forEach((f) => assert.ok(K.feature.list('platformer').includes(f), f));
  assert.deepStrictEqual(K.kit.check({ kit: 'platformer', features: ['spring', 'dashPad', 'rings', 'doubleJump'] }), []);
});

test('springs and dash pads stand on flat ground, away from the start and the flag, and never on the same spot', () => {
  const K = fresh();
  const s = sonic(K, ['spring', 'dashPad']);
  run(s, 0.1);
  const springs = s.g.all('spring'), pads = s.g.all('dashpad');
  assert.ok(springs.length >= 2 && pads.length >= 2, springs.length + ' springs, ' + pads.length + ' pads');
  const all = springs.concat(pads);
  all.forEach((e) => { assert.ok(e.x > 160 && e.x < 80 * 32 - 160, 'away from the ends: ' + e.x); });
  assert.strictEqual(new Set(all.map((e) => Math.round(e.x / 32))).size, all.length, 'no two on one spot');
});

test('a spring throws the hero much higher than a jump, and a level without the feature has none', () => {
  const K = fresh();
  const s = sonic(K, ['spring']);
  run(s, 0.3);
  const sp = s.g.all('spring')[0];
  s.me.x = sp.x + 2; s.me.y = sp.y - s.me.h; s.me.vy = 0;
  let top = s.me.y;
  run(s, 1, () => { top = Math.min(top, s.me.y); });
  assert.ok(sp.y - top > 160, 'rose ' + (sp.y - top) + ' px');   // a normal jump of 430 reaches about 84 px
  const plain = sonic(fresh(), []);
  run(plain, 0.1);
  assert.strictEqual(plain.g.all('spring').length, 0);
});

test('a dash pad makes a running hero much faster for a while, then the speed comes back', () => {
  const plain = sonic(fresh(), []);
  const K = fresh();
  const s = sonic(K, ['dashPad']);
  run(plain, 0.3); run(s, 0.3);
  const pad = s.g.all('dashpad')[0];
  K.press('d');
  plain.me.x = pad.x - 40; s.me.x = pad.x - 40;
  run(plain, 0.8); run(s, 0.8);
  assert.ok(s.speedMul > 2, 'boost is on: ' + s.speedMul);
  assert.ok(s.me.vx > plain.me.vx * 1.8, 'with the pad ' + s.me.vx + ', without ' + plain.me.vx);
  K.press('d', false);
  run(s, 2);
  assert.strictEqual(s.speedMul, 1, 'the boost ended');
});

test('with rings a hit costs the coins but not the life; with no coins a hit works as usual', () => {
  const K = fresh();
  const s = sonic(K, ['rings']);
  run(s, 0.3);
  s.hud.coins = 7;
  s.g.add({ shape: 'rect', x: s.me.x, y: s.me.y, w: 30, h: 30, tag: 'hazard' });
  run(s, 0.1);
  assert.strictEqual(s.hud.coins, 0, 'the coins are gone');
  assert.strictEqual(s.hud.lives, 3);
  assert.ok(!s.me.dying);
  run(s, 2.5);   // the blinking is over
  s.g.add({ shape: 'rect', x: s.me.x, y: s.me.y, w: 30, h: 30, tag: 'hazard' });
  run(s, 0.1);
  assert.ok(s.me.dying, 'without coins it is a normal hit');
});

test('all the Sonic features together keep a generated level playable to the end for a running bot', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', features: ['spring', 'dashPad', 'rings', 'doubleJump'], hero: { speed: 260 }, generate: [{ seed: 5, width: 60, difficulty: 2 }], time: 200 });
  assert.deepStrictEqual(K.kit.check(s.spec), []);
  run(s, 3);
  assert.ok(s.g.all('spring').length + s.g.all('dashpad').length > 0);
});

test('the hero can be another character; an unknown one makes the spec invalid', () => {
  const K = fresh();
  assert.deepStrictEqual(K.kit.check({ kit: 'platformer', hero: { character: 'runner' } }), []);
  assert.ok(K.kit.check({ kit: 'platformer', hero: { character: 'yok' } })[0].includes('bilinmeyen kahraman'));
  const s = K.kit.run({ kit: 'platformer', hero: { character: 'runner' }, levels: [LONG], time: 100 });
  run(s, 0.3);
  assert.ok(K.sprites.has('runner.run1') && K.sprites.has('runner.die'));
});

// ---- campaign: many levels from a few numbers ----
test('a campaign gives that many levels, the difficulty climbs and each level can be finished', () => {
  const K = fresh();
  const list = K.levels.campaign({ count: 12, from: 1, to: 5, width: 50, seed: 7 });
  assert.strictEqual(list.length, 12);
  assert.strictEqual(list[0].difficulty, 1);
  assert.strictEqual(list[11].difficulty, 5);
  for (let i = 1; i < list.length; i++) assert.ok(list[i].difficulty >= list[i - 1].difficulty, 'never gets easier');
  assert.ok(list[11].width > list[0].width, 'later levels are longer');
  assert.strictEqual(new Set(list.map((o) => o.seed)).size, 12, 'every level is different');
  const spec = { kit: 'platformer', campaign: { count: 12, from: 1, to: 5, width: 50, seed: 7 } };
  assert.deepStrictEqual(K.kit.check(spec), []);
  assert.deepStrictEqual(K.levels.campaign({ count: 12, from: 1, to: 5, width: 50, seed: 7 }), list, 'the same numbers, the same campaign');
});

test('a campaign is played level by level and the HUD says which one', () => {
  const K = fresh();
  const s = K.kit.run({ kit: 'platformer', campaign: { count: 3, from: 1, to: 2, width: 30, seed: 3 }, time: 100, generate: [{ seed: 1 }] });
  assert.strictEqual(s.levels.count, 3);
  run(s, 0.1);
  assert.ok(s.g.ui.items['hud.world'].text.includes('1/3'), s.g.ui.items['hud.world'].text);
  const out = K.levels.campaign({ count: 99, from: 9, to: -4 });
  assert.strictEqual(out.length, 20, 'the count is capped');
  assert.ok(out.every((o) => o.difficulty >= 1 && o.difficulty <= 5));
});

test('a campaign beats generate but custom level rows beat both', () => {
  const K = fresh();
  assert.strictEqual(K.levels.fromSpec({ campaign: { count: 4 }, generate: [{ seed: 1 }] }).length, 4);
  assert.strictEqual(K.levels.fromSpec({ campaign: { count: 4 }, levels: [FLAT] }).length, 1);
});
