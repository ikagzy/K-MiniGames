/* kgame.animation.js: kare animasyonu. K.anim.attach(varlık, {sprites:{idle:[...], run:[...], jump:[...], die:[...]}, fps:{run:10}})
   varlığın hızından durumu seçer (havada: jump, hareketli: run, durgun: idle), baktığı yöne çevirir (e.flip) ve her karede
   e.texture'a doğru kareyi koyar. Önce kgame.js ve kgame.sprites.js yüklenmiş olmalı. */
(function (root) {
  var K = root.K;
  var A = K.anim = {};

  A.attach = function (e, o) {
    var control = { state: "idle", time: 0, forced: null };
    var fps = o.fps || {};
    var previous = e.onUpdate;
    e.onUpdate = function (self, dt) {
      if (previous) previous(self, dt);
      var state = control.forced;
      if (!state) {
        if (self.dead && o.sprites.die) state = "die";
        else if (self.onFloor === false || (self.floor === undefined && self.onFloor === undefined && Math.abs(self.vy) > 40 && o.sprites.jump)) state = o.sprites.jump ? "jump" : "idle";
        else if (Math.abs(self.vx) > 8 && o.sprites.run) state = "run";
        else state = "idle";
      }
      if (!o.sprites[state]) state = "idle";
      if (state !== control.state) { control.state = state; control.time = 0; }
      control.time += dt;
      var frames = o.sprites[state], rate = fps[state] || 8;
      var frame = frames[Math.floor(control.time * rate) % frames.length];
      self.texture = K.sprites.get(frame);
      if (self.vx > 8) self.flip = false;
      else if (self.vx < -8) self.flip = true;
    };
    control.play = function (name) { control.forced = name; };
    control.release = function () { control.forced = null; };
    return control;
  };

  // A short squash (wider and lower) or stretch (narrower and taller) that returns to the normal size.
  A.squash = function (e, amount, ms) {
    var w0 = e._w0 === undefined ? (e._w0 = e.w) : e._w0, h0 = e._h0 === undefined ? (e._h0 = e.h) : e._h0;
    var bottom = e.y + e.h;
    var o = { k: 0 };
    e.w = w0 * (1 + amount); e.h = h0 * (1 - amount); e.y = bottom - e.h;
    K.tween(o, { k: 1 }, ms || 150);
    var previous = e.onUpdate;
    e.onUpdate = function (self, dt) {
      if (previous) previous(self, dt);
      var b = self.y + self.h, t = o.k;
      self.w = w0 * (1 + amount * (1 - t)); self.h = h0 * (1 - amount * (1 - t)); self.y = b - self.h;
      if (t >= 1) { self.w = w0; self.h = h0; self.onUpdate = previous; }
    };
  };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
