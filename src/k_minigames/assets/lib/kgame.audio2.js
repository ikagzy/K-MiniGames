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

  M.define = function (name, def) {
    M.tracks[name] = { bpm: def.bpm || 120, wave: def.wave || "square", notes: M.parse(def.notes), loop: def.loop !== false,
                       bass: def.bass ? M.parse(def.bass) : null, bassWave: def.bassWave || "triangle" };
  };

  // Original tunes written for this library (not taken from any game).
  M.define("overworld", { bpm: 138, notes: "C5:0.5 E5:0.5 G5:1 E5:0.5 C5:0.5 D5:1 R:0.5 D5:0.5 F5:0.5 A5:1 F5:0.5 D5:0.5 E5:2 R:1 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:1 B4:1 C5:2 R:1" });
  M.define("underground", { bpm: 96, wave: "triangle", notes: "A2:1 E3:1 A3:1 R:1 F2:1 C3:1 F3:1 R:1 G2:1 D3:1 G3:1 R:1 E2:2 B2:2" });
  M.define("castle", { bpm: 132, wave: "sawtooth", notes: "D3:0.5 F3:0.5 A3:0.5 D4:0.5 C4:1 R:0.5 A#3:0.5 A3:1 F3:1 G3:0.5 A3:0.5 A#3:1 G3:1 D3:2" });
  M.define("boss", { bpm: 168, wave: "sawtooth", notes: "E3:0.25 E3:0.25 G3:0.25 E3:0.25 B3:0.5 A3:0.5 G3:0.5 F#3:0.5 E3:0.25 E3:0.25 G3:0.25 E3:0.25 D4:0.5 C4:0.5 B3:1 R:0.5" });
  M.define("victory", { bpm: 132, loop: false, notes: "D5:0.5 F#5:0.5 A5:0.5 D6:1.5 A5:0.5 F#5:0.5 D6:2.5" });
  M.define("gameover", { bpm: 84, loop: false, wave: "triangle", notes: "A4:1 F4:1 D4:1 E4:0.5 D4:0.5 C#4:0.5 D4:2.5" });

  // ---- a composer: the model picks a mood, a tempo and a seed; this writes an original tune from scale and chord rules ----
  // K.music.compose({mood, tempo, seed}) -> a track definition (lead + bass) for K.music.define. The same numbers always give the
  // same tune. A tune is 64 beats: A, A with a changed third bar, B (higher), A; the lead leans on chord tones on the strong
  // beats and moves by steps in between; the bass plays the chord roots; it ends on the root so that it loops.
  var MOODS = {
    happy:   { scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 0]], bpm: [128, 150, 172], wave: "square" },
    calm:    { scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 5, 3, 4], [0, 3, 0, 4]], bpm: [72, 88, 104], wave: "triangle" },
    tense:   { scale: [0, 2, 3, 5, 7, 8, 11], prog: [[0, 5, 3, 4], [0, 3, 4, 0]], bpm: [132, 154, 176], wave: "sawtooth" },
    epic:    { scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 5, 2, 6], [0, 6, 5, 4]], bpm: [112, 134, 156], wave: "sawtooth" },
    mystery: { scale: [0, 2, 3, 5, 7, 9, 10], prog: [[0, 3, 0, 6], [0, 6, 3, 6]], bpm: [78, 94, 110], wave: "triangle" },
    spooky:  { scale: [0, 1, 3, 5, 7, 8, 10], prog: [[0, 1, 0, 6], [0, 5, 1, 0]], bpm: [88, 108, 128], wave: "sawtooth" }
  };
  var RHYTHMS = [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 1, 1], [2, 1, 1], [1, 0.5, 0.5, 2], [0.5, 0.5, 0.5, 0.5, 2],
                 [1, 1, 2], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, 0.5, 0.5, 1, 1]];
  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function noteName(midi) { return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1); }
  function seeded(seed) {
    var a = (Math.floor(seed) * 2654435761 + 12345) >>> 0 || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  M.moods = Object.keys(MOODS);
  M.compose = function (o) {
    o = o || {};
    var mood = MOODS[o.mood] ? o.mood : "happy", def = MOODS[mood];
    var seed = typeof o.seed === "number" && isFinite(o.seed) ? o.seed : 1;
    var tag = 0;   // the mood is part of the seed: the same seed in another mood is another tune, not the same one in another scale
    for (var c = 0; c < mood.length; c++) tag = (tag * 31 + mood.charCodeAt(c)) % 100003;
    var rnd = seeded(seed * 1009 + tag);
    var pick = function (list) { return list[Math.floor(rnd() * list.length) % list.length]; };
    var bpm = o.tempo === "slow" ? def.bpm[0] : o.tempo === "fast" ? def.bpm[2] : def.bpm[1];
    var root = 48 + pick([0, 2, 3, 5, 7, 9]), scale = def.scale;
    var pitch = function (idx) { return root + 12 * Math.floor(idx / 7) + scale[((idx % 7) + 7) % 7]; };
    var prog = pick(def.prog);
    var isTone = function (idx, d) { return [0, 2, 4].some(function (k) { return ((idx - d - k) % 7 + 7) % 7 === 0; }); };
    var nearestTone = function (idx, d) { for (var k = 0; k < 7; k++) { if (isTone(idx + k, d)) return idx + k; if (isTone(idx - k, d)) return idx - k; } return idx; };
    var lead = [];

    var bar = function (d, from, lo, hi, closing) {   // one bar of 4 beats; returns the last pitch index
      var rhythm = closing ? pick([[2, 2], [1, 1, 2], [1, 3]]) : pick(RHYTHMS), at = 0, idx = from, before = from;
      rhythm.forEach(function (beats, i) {
        var last = closing && i === rhythm.length - 1;
        if (last || at % 2 === 0) idx = nearestTone(idx + (last ? 0 : pick([-2, -1, 0, 1, 2])), d);   // a strong beat or the end: a chord tone
        else idx = idx + pick([-1, 1, -2, 2]);   // in between: a step
        idx = Math.max(lo, Math.min(hi, idx));
        if (last) idx = nearestTone(idx, d);
        if (idx === before && rnd() < 0.9) {   // the same note again and again is dull: move to a neighbour, a chord tone if there is one
          var near = [1, -1, 2, -2].map(function (s) { return before + s; }).filter(function (x) { return x >= lo && x <= hi; });
          var tones = near.filter(function (x) { return isTone(x, d); });
          idx = tones.length ? tones[0] : (near.length ? near[0] : idx);
        }
        before = idx;
        var rest = !last && at > 0 && rnd() < 0.08;
        lead.push((rest ? "R" : noteName(pitch(idx))) + ":" + beats);
        at += beats;
      });
      return idx;
    };
    var at = 8 + Math.floor(rnd() * 5);   // the tune starts on a different note each time
    var section = function (low, high, vary) {
      var idx = Math.max(low, Math.min(high, at));
      prog.forEach(function (d, i) {
        var closing = i === 3;
        if (i === 2 && vary) { idx = bar(d, idx + pick([-3, 3]), low, high, false); return; }
        idx = bar(d, idx, low, high, closing);
      });
      at = idx;
    };
    section(7, 14, false); section(7, 14, true); section(10, 17, false); section(7, 14, false);

    var bass = [];
    for (var s = 0; s < 4; s++) prog.forEach(function (d) {
      var low = pitch(d - 7), fifth = pitch(d - 7 + 4);
      bass.push(noteName(low) + ":1", noteName(fifth) + ":1", noteName(low) + ":1", noteName(fifth) + ":1");
    });
    return { bpm: bpm, wave: def.wave, notes: lead.join(" "), bass: bass.join(" "), bassWave: "triangle", mood: mood };
  };

  // The secret tune (for easter eggs): a mystery tune written by the composer once (mood mystery, medium, seed 7) and kept as it
  // is, so that a later change of the composer does not change it. K.music.play("secret").
  M.define("secret", { bpm: 94, wave: "triangle", bassWave: "triangle",
    notes: "A4:0.5 C5:0.5 A4:1 D5:1 C5:1 B4:1 A4:1 G4:1 B4:1 D5:0.5 C5:0.5 B4:1 A4:0.5 G4:0.5 E4:1 G4:1 E4:3 A4:1 B4:1 D5:2 B4:0.5 D5:0.5 B4:0.5 C5:0.5 R:2 D5:1.5 C5:0.5 D5:1 R:1 D5:1 C5:1 C5:2 A4:1 B4:1 A4:1 G4:1 B4:0.5 A4:0.5 C5:1 R:0.5 C5:0.5 D5:1 F5:0.5 D5:0.5 C5:0.5 A4:0.5 A4:2 C5:1 E5:3 C5:0.5 D5:0.5 B4:1 D5:0.5 B4:0.5 G4:1 B4:0.5 D5:0.5 B4:0.5 C5:0.5 B4:2 A4:1 C5:1 D5:1 C5:1 G4:1 A4:1 G4:2",
    bass: "D2:1 A2:1 D2:1 A2:1 G2:1 D3:1 G2:1 D3:1 D2:1 A2:1 D2:1 A2:1 C3:1 G3:1 C3:1 G3:1 D2:1 A2:1 D2:1 A2:1 G2:1 D3:1 G2:1 D3:1 D2:1 A2:1 D2:1 A2:1 C3:1 G3:1 C3:1 G3:1 D2:1 A2:1 D2:1 A2:1 G2:1 D3:1 G2:1 D3:1 D2:1 A2:1 D2:1 A2:1 C3:1 G3:1 C3:1 G3:1 D2:1 A2:1 D2:1 A2:1 G2:1 D3:1 G2:1 D3:1 D2:1 A2:1 D2:1 A2:1 C3:1 G3:1 C3:1 G3:1" });

  var timer = null;
  var contextOf = function () { try { return new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return null; } };
  var ctx;

  function schedule(track, name) {
    if (!ctx) return;
    var start = ctx.currentTime + 0.05, beat = 60 / track.bpm;
    var voice = function (notes, wave, volume) {   // writes one line of notes into the audio clock; returns where it ends
      var t = start;
      notes.forEach(function (n) {
        var length = n.beats * beat;
        if (n.freq) {
          try {
            var osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = wave; osc.frequency.value = n.freq;
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.0008, t + length * 0.95);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + length);
          } catch (e) { /* silent */ }
        }
        t += length;
      });
      return t;
    };
    var t = voice(track.notes, track.wave, M.volume);
    if (track.bass) voice(track.bass, track.bassWave, M.volume * 0.75);
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
