/* kgame.js: oyun kütüphanesi çekirdeği (v1). DOM olmadan da yüklenir. */
(function (root) {
  var K = root.K = root.K || {};
  K.version = "1";
  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
