/* kgame.audio2.js: chiptune müzik dizicisi ve oyun sesleri. K.music.play('overworld'), K.music.stop(). Yeni parça:
   K.music.define(ad, {bpm, wave, notes:'C4:1 E4:1 R:1 G4:2', loop:true}) (nota:vuruş sayısı, R sessizlik). Hazır parçalar: overworld,
   underground, castle, boss, victory, gameover. Ses paketi K.sfx(ad)'a şunları ekler: stomp, powerup, death, oneup, kick, break,
   fire, flag, bump. Önce kgame.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var M = K.music = { tracks: {}, current: null, volume: 0.08 };

  var SEMI = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  M.parse = function (text) {
    return text.split(/\s+/).filter(Boolean).map(function (token) {
      var parts = token.split(":"), name = parts[0], beats = parseFloat(parts[1] || "1");
      if (name === "R") return { freq: 0, beats: beats };
      var m = /^([A-G]#?)(\d)$/.exec(name);
      if (!m) return { freq: 0, beats: beats };
      var midi = 12 * (parseInt(m[2], 10) + 1) + SEMI[m[1]];
      return { freq: 440 * Math.pow(2, (midi - 69) / 12), beats: beats };
    });
  };

  M.define = function (name, def) { M.tracks[name] = { bpm: def.bpm || 120, wave: def.wave || "square", notes: M.parse(def.notes), loop: def.loop !== false }; };

  M.define("overworld", { bpm: 150, notes: "E5:0.5 E5:0.5 R:0.5 E5:0.5 R:0.5 C5:0.5 E5:1 G5:1 R:1 G4:1 R:1 C5:1.5 G4:1 R:0.5 E4:1 A4:0.5 B4:0.5 A#4:0.5 A4:1" });
  M.define("underground", { bpm: 120, wave: "triangle", notes: "C3:0.5 C4:0.5 A2:0.5 A3:0.5 A#2:0.5 A#3:0.5 R:1 C3:0.5 C4:0.5 A2:0.5 A3:0.5 A#2:0.5 A#3:0.5 R:1" });
  M.define("castle", { bpm: 140, wave: "sawtooth", notes: "D3:0.5 D3:0.5 D4:0.5 D3:0.5 A3:0.5 D3:0.5 G#3:1 R:0.5 G3:0.5 F3:1 D3:0.5 F3:0.5 G3:0.5" });
  M.define("boss", { bpm: 170, wave: "sawtooth", notes: "E3:0.5 E3:0.5 R:0.5 E3:0.5 G3:0.5 E3:0.5 B3:1 A3:0.5 G3:0.5 E3:1 R:1" });
  M.define("victory", { bpm: 140, loop: false, notes: "C5:0.5 E5:0.5 G5:0.5 C6:1 G5:0.5 C6:2" });
  M.define("gameover", { bpm: 100, loop: false, wave: "triangle", notes: "C5:1 G4:1 E4:1 A4:0.5 B4:0.5 A4:0.5 G#4:0.5 A#4:0.5 G#4:0.5 G4:2" });

  var timer = null;
  var contextOf = function () { try { return new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return null; } };
  var ctx;

  function schedule(track, name) {
    if (!ctx) return;
    var t = ctx.currentTime + 0.05, beat = 60 / track.bpm;
    track.notes.forEach(function (n) {
      var length = n.beats * beat;
      if (n.freq) {
        try {
          var osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = track.wave; osc.frequency.value = n.freq;
          gain.gain.setValueAtTime(M.volume, t);
          gain.gain.exponentialRampToValueAtTime(0.0008, t + length * 0.95);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(t); osc.stop(t + length);
        } catch (e) { /* silent */ }
      }
      t += length;
    });
    var total = (t - ctx.currentTime) * 1000;
    timer = setTimeout(function () {
      if (M.current !== name) return;
      if (track.loop) schedule(track, name); else M.current = null;
    }, Math.max(100, total - 50));
  }

  M.play = function (name) {
    var track = M.tracks[name];
    if (!track) return false;
    M.stop();
    M.current = name;
    if (ctx === undefined) ctx = contextOf();
    schedule(track, name);
    return true;
  };
  M.stop = function () { M.current = null; if (timer) { clearTimeout(timer); timer = null; } };

  var T = K.sfxTable;
  T.stomp = [300, 80, 0.1, "square"]; T.powerup = [330, 990, 0.35, "square"]; T.death = [500, 60, 0.7, "sawtooth"];
  T.oneup = [660, 1320, 0.4, "square"]; T.kick = [180, 90, 0.12, "square"]; T.break = [260, 40, 0.25, "sawtooth"];
  T.fire = [900, 200, 0.15, "square"]; T.flag = [440, 1760, 0.8, "triangle"]; T.bump = [160, 120, 0.08, "square"];

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
