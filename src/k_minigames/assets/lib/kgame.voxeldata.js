/* kgame.voxeldata.js: küp dünya kitinin VERİSİ (saf tablolar ve küçük işlevler): bloklar ve eşyalar, kazma süreleri, alet kademeleri, üretim ve eritme tarifleri.
   Eski Minecraft (1.8.9) tarifleri, bu dünyada anlamı olan çekirdek hâliyle: tarifler dizilim değil MALZEME listesidir (hangi malzemeden ne çıkar).
   Önce kgame.js. kgame.voxel.js bunu kullanır. */
(function (root) {
  var K = root.K;
  var D = K.voxeldata = {};

  // ---- ids: 1-23 as in the kit (blocks, crops, seeds, wheat, hoe, bread), the new ones below ----
  var ID = D.ID = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7, GLASS: 8, COAL_ORE: 9, IRON_ORE: 10, GOLD_ORE: 11, DIAMOND_ORE: 12, SNOW: 13, WATER: 14, CACTUS: 15,
    FARMLAND: 16, CROP1: 17, CROP2: 18, CROP3: 19, SEEDS: 20, WHEAT: 21, WOOD_HOE: 22, BREAD: 23,
    TABLE: 24, FURNACE: 25, CHEST: 26, COBBLE: 27, STONE_BRICKS: 28, SANDSTONE: 29, IRON_BLOCK: 30, GOLD_BLOCK: 31, DIAMOND_BLOCK: 32, TORCH: 33,
    STICK: 40, COAL: 41, IRON_INGOT: 42, GOLD_INGOT: 43, DIAMOND: 44
  };
  var TIERS = D.TIERS = ["odun", "taş", "demir", "altın", "elmas"];
  var TOOLS = D.TOOLS = [["pickaxe", "kazma", 50], ["axe", "balta", 55], ["shovel", "kürek", 60], ["sword", "kılıç", 65]];   // first id of the five tiers
  var HOE_FIRST = 70;   // stone hoe 70 ... diamond hoe 73 (the wooden hoe is 22)
  var NAME = D.NAME = {
    1: "çimen", 2: "toprak", 3: "taş", 4: "kum", 5: "kütük", 6: "yaprak", 7: "tahta", 8: "cam", 9: "kömür cevheri", 10: "demir cevheri", 11: "altın cevheri", 12: "elmas cevheri",
    13: "kar", 14: "su", 15: "kaktüs", 16: "tarla", 17: "buğday filizi", 18: "büyüyen buğday", 19: "olgun buğday", 20: "tohum", 21: "buğday", 23: "ekmek",
    24: "üretim masası", 25: "fırın", 26: "sandık", 27: "kırık taş", 28: "taş tuğla", 29: "kumtaşı", 30: "demir blok", 31: "altın blok", 32: "elmas blok", 33: "meşale",
    40: "çubuk", 41: "kömür", 42: "demir külçe", 43: "altın külçe", 44: "elmas"
  };
  var COLOR = D.COLOR = {   // [top, side, bottom]: the colours the picture and the bar use (the first one is the swatch)
    1: [[88, 152, 52], [134, 96, 62], [134, 96, 62]], 2: [[134, 96, 62]], 3: [[128, 128, 128]], 4: [[222, 208, 150]], 5: [[104, 80, 48], [110, 84, 52]],
    6: [[52, 120, 40]], 7: [[176, 140, 84]], 8: [[196, 230, 240]], 9: [[128, 128, 128], [30, 30, 30]], 10: [[128, 128, 128], [216, 176, 140]],
    11: [[128, 128, 128], [250, 216, 60]], 12: [[128, 128, 128], [80, 230, 230]], 13: [[240, 244, 250], [225, 232, 242]], 14: [[50, 100, 200]], 15: [[40, 130, 50]],
    16: [[92, 60, 36], [120, 84, 54], [120, 84, 54]], 17: [[100, 170, 60], [90, 160, 55], [90, 160, 55]], 18: [[150, 185, 60], [120, 170, 55], [120, 170, 55]],
    19: [[225, 195, 70], [205, 170, 60], [205, 170, 60]], 20: [[170, 150, 80]], 21: [[225, 195, 70]], 23: [[200, 140, 70]],
    24: [[160, 116, 64], [130, 90, 50], [110, 80, 46]], 25: [[100, 100, 104], [86, 86, 90], [100, 100, 104]], 26: [[170, 120, 60], [150, 104, 52], [150, 104, 52]],
    27: [[112, 112, 112]], 28: [[140, 140, 144]], 29: [[216, 200, 140], [206, 190, 130], [216, 200, 140]], 30: [[220, 220, 224]], 31: [[250, 220, 70]], 32: [[90, 230, 230]],
    33: [[250, 200, 80]], 40: [[160, 120, 70]], 41: [[40, 40, 44]], 42: [[220, 220, 226]], 43: [[250, 220, 70]], 44: [[90, 230, 230]]
  };
  var TIER_COLOR = [[176, 140, 84], [128, 128, 128], [220, 220, 226], [250, 220, 70], [90, 230, 230]];
  TOOLS.forEach(function (t) { for (var i = 0; i < 5; i++) { NAME[t[2] + i] = TIERS[i] + " " + t[1]; COLOR[t[2] + i] = [TIER_COLOR[i]]; } });
  NAME[22] = "odun çapa"; COLOR[22] = [TIER_COLOR[0]];
  for (var h = 1; h < 5; h++) { NAME[HOE_FIRST + h - 1] = TIERS[h] + " çapa"; COLOR[HOE_FIRST + h - 1] = [TIER_COLOR[h]]; }
  D.hoeId = function (tier) { return tier === 0 ? 22 : HOE_FIRST + tier - 1; };
  D.toolId = function (kind, tier) { for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i][0] === kind) return TOOLS[i][2] + tier; return 0; };
  // what an item is: { kind: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe', tier: 0-4 } or null
  D.toolOf = function (id) {
    for (var i = 0; i < TOOLS.length; i++) if (id >= TOOLS[i][2] && id < TOOLS[i][2] + 5) return { kind: TOOLS[i][0], tier: id - TOOLS[i][2] };
    if (id === 22) return { kind: "hoe", tier: 0 };
    if (id >= HOE_FIRST && id < HOE_FIRST + 4) return { kind: "hoe", tier: id - HOE_FIRST + 1 };
    return null;
  };
  // a block can be put down: the ground and plant blocks, and the new building blocks (not tools, food or materials)
  D.isBlock = function (id) { return (id >= 1 && id <= 13) || id === 15 || (id >= 24 && id <= 33); };

  // ---- mining: how long a block takes by hand (seconds), which tool is the right one, and the lowest tier that gets something out of it ----
  var HARD = { 1: 0.6, 2: 0.5, 3: 1.5, 4: 0.5, 5: 2, 6: 0.2, 7: 2, 8: 0.3, 9: 3, 10: 3, 11: 3, 12: 3, 13: 0.2, 15: 0.4, 16: 0.6, 17: 0, 18: 0, 19: 0, 24: 2.5, 25: 3.5, 26: 2.5, 27: 2, 28: 2, 29: 0.8, 30: 5, 31: 5, 32: 5, 33: 0 };
  var RIGHT = { 1: "shovel", 2: "shovel", 3: "pickaxe", 4: "shovel", 5: "axe", 7: "axe", 9: "pickaxe", 10: "pickaxe", 11: "pickaxe", 12: "pickaxe", 13: "shovel", 16: "shovel",
                24: "axe", 25: "pickaxe", 26: "axe", 27: "pickaxe", 28: "pickaxe", 29: "pickaxe", 30: "pickaxe", 31: "pickaxe", 32: "pickaxe" };
  var NEED_TIER = { 3: 0, 9: 0, 10: 1, 11: 2, 12: 2, 25: 0, 27: 0, 28: 0, 29: 0, 30: 1, 31: 2, 32: 2 };   // pickaxe blocks drop nothing without a good enough pickaxe
  var SPEED = [2, 4, 6, 12, 8];   // wood, stone, iron, gold, diamond (gold is fast but soft: it only reaches tier 1 in what it may mine)
  var HARVEST = [0, 1, 2, 0, 3];   // the level a tool tier counts for when asked "is it good enough": gold only counts as wood
  D.rightTool = function (b) { return RIGHT[b] || null; };
  // seconds to break block b with the best tool of each kind (`have(kind)` gives the best tier owned, -1 for none); creative is instant
  D.mineTime = function (b, have) {
    var base = (HARD[b] === undefined ? 1 : HARD[b]) * 1.5;
    if (base === 0) return 0;
    var kind = RIGHT[b], tier = kind ? have(kind) : -1;
    return tier >= 0 ? base / SPEED[tier] : base;
  };
  // what breaking gives: [[id, count], ...] (the farming drops are decided by the kit, they need chance)
  D.drops = function (b, have) {
    var need = NEED_TIER[b];
    if (need !== undefined) {
      var tier = have("pickaxe");
      if (tier < 0 || HARVEST[tier] < need) return [];
    }
    if (b === ID.STONE) return [[ID.COBBLE, 1]];
    if (b === ID.COAL_ORE) return [[ID.COAL, 1]];
    if (b === ID.DIAMOND_ORE) return [[ID.DIAMOND, 1]];
    if (b === ID.GLASS || b === ID.LEAVES) return [];
    if (b === ID.GRASS || b === ID.FARMLAND) return [[ID.DIRT, 1]];
    return [[b, 1]];
  };

  // ---- recipes: [name, where, needs, gives]; where is "hand" (anywhere), "table" (a crafting table near) or "furnace" (a furnace near and coal) ----
  var R = D.recipes = [];
  function add(name, where, needs, give) { R.push({ name: name, where: where, need: needs, give: give }); }
  add("tahta", "hand", [[ID.LOG, 1]], [ID.PLANKS, 4]);
  add("çubuk", "hand", [[ID.PLANKS, 2]], [ID.STICK, 4]);
  add("üretim masası", "hand", [[ID.PLANKS, 4]], [ID.TABLE, 1]);
  add("meşale", "hand", [[ID.COAL, 1], [ID.STICK, 1]], [ID.TORCH, 4]);
  add("fırın", "table", [[ID.COBBLE, 8]], [ID.FURNACE, 1]);
  add("sandık", "table", [[ID.PLANKS, 8]], [ID.CHEST, 1]);
  add("kumtaşı", "table", [[ID.SAND, 4]], [ID.SANDSTONE, 1]);
  add("taş tuğla", "table", [[ID.STONE, 4]], [ID.STONE_BRICKS, 4]);
  add("ekmek", "table", [[ID.WHEAT, 3]], [ID.BREAD, 1]);
  add("demir blok", "table", [[ID.IRON_INGOT, 9]], [ID.IRON_BLOCK, 1]);
  add("altın blok", "table", [[ID.GOLD_INGOT, 9]], [ID.GOLD_BLOCK, 1]);
  add("elmas blok", "table", [[ID.DIAMOND, 9]], [ID.DIAMOND_BLOCK, 1]);
  add("demir külçe (bloktan)", "table", [[ID.IRON_BLOCK, 1]], [ID.IRON_INGOT, 9]);
  add("altın külçe (bloktan)", "table", [[ID.GOLD_BLOCK, 1]], [ID.GOLD_INGOT, 9]);
  add("elmas (bloktan)", "table", [[ID.DIAMOND_BLOCK, 1]], [ID.DIAMOND, 9]);
  var MATERIAL = [ID.PLANKS, ID.COBBLE, ID.IRON_INGOT, ID.GOLD_INGOT, ID.DIAMOND];
  var COST = { pickaxe: 3, axe: 3, shovel: 1, sword: 2, hoe: 2 }, STICKS = { pickaxe: 2, axe: 2, shovel: 2, sword: 1, hoe: 2 };
  for (var tier = 0; tier < 5; tier++) {
    ["pickaxe", "axe", "shovel", "sword", "hoe"].forEach(function (kind) {
      var id = kind === "hoe" ? D.hoeId(tier) : D.toolId(kind, tier), label = kind === "hoe" ? "çapa" : TOOLS.filter(function (t) { return t[0] === kind; })[0][1];
      if (kind === "hoe" && tier === 0) { add(TIERS[0] + " çapa", "table", [[ID.PLANKS, 2], [ID.STICK, 2]], [id, 1]); return; }
      add(TIERS[tier] + " " + label, "table", [[MATERIAL[tier], COST[kind]], [ID.STICK, STICKS[kind]]], [id, 1]);
    });
  }
  // smelting: [from, to]; each coal does eight
  D.smelts = [[ID.COBBLE, ID.STONE, "taş"], [ID.SAND, ID.GLASS, "cam"], [ID.IRON_ORE, ID.IRON_INGOT, "demir külçe"], [ID.GOLD_ORE, ID.GOLD_INGOT, "altın külçe"]];
  D.smelts.forEach(function (s) { add("eritme: " + s[2], "furnace", [[s[0], 1]], [s[1], 1]); });
  D.recipeIndex = function (name) { for (var i = 0; i < R.length; i++) if (R[i].name === name) return i; return -1; };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
