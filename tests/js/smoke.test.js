const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers');

test('the core file loads without a DOM and says its version', () => {
  const K = load('kgame.js');
  assert.strictEqual(K.version, '1');
});
