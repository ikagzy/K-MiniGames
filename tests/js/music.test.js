const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { LIB } = require('./helpers');

function loadWithAudio() {   // a fake sound card that remembers what is connected to its output
  const log = { masters: [], connected: 0 };
  class Node { constructor(kind) { this.kind = kind; this.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; this.frequency = {}; this.live = false; }
    connect(to) { if (to === destination) { this.live = true; log.masters.push(this); } return to; } disconnect() { this.live = false; } start() {} stop() {} }
  const destination = { kind: 'destination' };
  class FakeContext { constructor() { this.destination = destination; this.currentTime = 0; } createGain() { return new Node('gain'); } createOscillator() { return new Node('osc'); } }
  const env = { AudioContext: FakeContext };
  for (const file of ['kgame.js', 'kgame.audio2.js']) new Function('globalThis', 'module', fs.readFileSync(path.join(LIB, file), 'utf8'))(env, undefined);
  return { K: env.K, log };
}

test('stopping the music silences notes that were already scheduled, and playing again does not pile a second copy on top', () => {
  const { K, log } = loadWithAudio();
  assert.ok(K.music.play('secret'));
  assert.strictEqual(log.masters.length >= 1, true);
  const first = log.masters[0];
  assert.strictEqual(first.live, true);
  K.music.stop();
  assert.strictEqual(first.live, false, 'the old output is cut');
  assert.ok(K.music.play('secret'));
  const second = log.masters[log.masters.length - 1];
  assert.notStrictEqual(second, first); assert.strictEqual(second.live, true);
  assert.strictEqual(first.live, false, 'only one copy is audible');
  K.music.stop(); assert.strictEqual(second.live, false);
});
