// Loads the library files the way a page does (one after the other, sharing one global object), with no DOM.
const fs = require('fs');
const path = require('path');

const LIB = path.resolve(__dirname, '..', '..', 'src', 'k_minigames', 'assets', 'lib');

function load(...files) {
  const env = {};
  for (const file of files) {
    const code = fs.readFileSync(path.join(LIB, file), 'utf8');
    new Function('globalThis', 'module', code)(env, undefined);
  }
  return env.K;
}

module.exports = { load, LIB };
