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
  NAME[80] = "çiğ et"; COLOR[80] = [[210, 110, 110]]; NAME[81] = "pişmiş et"; COLOR[81] = [[150, 90, 50]];
  D.FOOD = { 23: 5, 80: 3, 81: 8 };   // what eating fills (of 20): bread, raw meat, cooked meat
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

  // ---- item icons: 16x16 pixel art in rows; h = the tool tier colour, d = handle brown, a = the item colour, b = darker, c = lighter, k = near black ----
  var P = {
    pickaxe: ["................", "....hhhhhhhh....", "...hhhhhhhhhh...", "..hhh..dd..hhh..", "..hh...dd...hh..", "......dd........", "......dd........", ".....dd.........", ".....dd.........", "....dd..........", "....dd..........", "...dd...........", "...dd...........", "..dd............", "................", "................"],
    axe: ["................", ".....hhhh.......", "....hhhhhh......", "....hhhhhhd.....", "....hhhhhdd.....", "....hhhhdd......", ".....hhdd.......", "......dd........", ".....dd.........", ".....dd.........", "....dd..........", "....dd..........", "...dd...........", "...dd...........", "................", "................"],
    shovel: ["..........hhh...", ".........hhhhh..", ".........hhhhh..", ".........hhhhh..", "..........hhh...", ".........dd.....", "........dd......", "........dd......", ".......dd.......", "......dd........", "......dd........", ".....dd.........", "....dd..........", "....dd..........", "................", "................"],
    sword: ["..............hh", ".............hhh", "............hhh.", "...........hhh..", "..........hhh...", ".........hhh....", "........hhh.....", ".d.....hhh......", "..d...hhh.......", "...dd.hh........", "....ddh.........", "....dd..........", "...dd.d.........", "..dd............", "................", "................"],
    hoe: ["................", "....hhhhhhh.....", "...hhhhhhhhh....", "...hh.....hhd...", "...h.......dd...", "..........dd....", ".........dd.....", ".........dd.....", "........dd......", "........dd......", ".......dd.......", ".......dd.......", "......dd........", "......dd........", "................", "................"],
    torch: ["................", "......aa........", ".....acca.......", ".....acca.......", "......aa........", "......dd........", "......dd........", "......dd........", "......dd........", "......dd........", "......dd........", "......dd........", "......dd........", "......dd........", "................", "................"],
    stick: ["................", "...............d", "..............dd", ".............dd.", "............dd..", "...........dd...", "..........dd....", ".........dd.....", "........dd......", ".......dd.......", "......dd........", ".....dd.........", "....dd..........", "...dd...........", "..d.............", "................"],
    coal: ["................", "................", "......kkkk......", "....kkkkkkkk....", "...kkcckkkkkk...", "...kkckkkkkkk...", "..kkkkkkkkkkkk..", "..kkkkkkkkcckk..", "..kkkkkkkkkckk..", "...kkkkkkkkkk...", "....kkkkkkkk....", ".....kkkkkk.....", "................", "................", "................", "................"],
    ingot: ["................", "................", "................", "................", "...ccccccccccc..", "..cccccccccccab.", ".ccccccccccaabb.", ".aaaaaaaaaaabb..", ".aaaaaaaaaaabb..", ".aaaaaaaaaaab...", ".bbbbbbbbbbb....", "................", "................", "................", "................", "................"],
    diamond: ["................", "................", "....cccccccc....", "...caaaaaaaac...", "..caaaccaaaaac..", ".caaacccaaaaaac.", ".caaaaaaaaaabbc.", "..caaaaaaaabbc..", "...caaaaaabbc...", "....caaaabbc....", ".....caabbc.....", "......cbc.......", ".......c........", "................", "................", "................"],
    seeds: ["................", "................", "................", "....aa..........", "...abba.........", "....aa....aa....", "..........abba..", "..aa.......aa...", ".abba...........", "..aa...aa.......", "......abba......", ".......aa.......", "................", "................", "................", "................"],
    wheat: ["................", "......a.........", ".....aca........", "....aaca.a......", ".....acaaca.....", "..a..aca.ca.....", ".aca.aca.a......", "..aacaca........", "...aaca.........", ".....ca.........", ".....ca.........", ".....bb.........", ".....bb.........", "................", "................", "................"],
    bread: ["................", "................", "................", "................", "....cccccccc....", "..ccaaaaaaaacc..", ".caaaaacaaaaaac.", ".caacaaaaacaaac.", ".caaaaaaaaaaaac.", "..bbaaaaaaaabb..", "...bbbbbbbbbb...", "................", "................", "................", "................", "................"],
    meat: ["................", "................", "......aaaa......", "....aaaaaaaa....", "...aaccaaaaaa...", "..aaaccaaaaaaa..", "..aaaaaaaaaabb..", "..aaaaaaaaabbk..", "...aaaaaabbbb...", ".....bbbbbk.....", "........kk......", ".......kkw......", "........w.......", "................", "................", "................"]
  };

  function pad16(rows) { var out = rows.map(function (r) { while (r.length < 16) r += "."; return r.slice(0, 16); }); while (out.length < 16) out.push("................"); return out; }
  P.feather = pad16(["..............aa", ".............aaa", "............aaaa", "...........aaaa.", "..........aaaa..", ".........aaaa...", "........aaab....", ".......aaab.....", "......aab.......", ".....dd.........", "....dd..........", "...dd..........."]);
  P.leather = pad16(["", "", "...aaaaaaaaaa...", "..abbbbbbbbbba..", "..abaaaaaaaaba..", "..abaaaaaaaaba..", "..abaaaaaaaaba..", "..abaaaaaaaaba..", "..abbbbbbbbbba..", "...aaaaaaaaaa..."]);
  P.string = pad16(["", "......wwww......", "....ww....ww....", "...w........w...", "...w........w...", "....ww....ww....", "......wwww......", ".........w......", "........w.......", ".......w........"]);
  P.helmet = pad16(["", ".....hhhhhh.....", "....hhhhhhhh....", "...hhhhhhhhhh...", "...hhhhhhhhhh...", "...hhh....hhh...", "...hh......hh..."]);
  P.chestplate = pad16(["", "..hhh......hhh..", ".hhhhh....hhhhh.", ".hhhhhhhhhhhhhh.", ".hhhhhhhhhhhhhh.", "..hhhhhhhhhhhh..", "..hhhhhhhhhhhh..", "..hhhhhhhhhhhh..", "..hhhhhhhhhhhh..", "..hhhhhhhhhhhh..", "...hhhhhhhhhh..."]);
  P.leggings = pad16(["", "...hhhhhhhhhh...", "...hhhhhhhhhh...", "...hhhhhhhhhh...", "...hhh....hhh...", "...hhh....hhh...", "...hhh....hhh...", "...hhh....hhh...", "...hhh....hhh...", "...hhh....hhh..."]);
  P.boots = pad16(["", "", "", "...hhh....hhh...", "...hhh....hhh...", "...hhh....hhh...", "..hhhh....hhhh..", ".hhhhh....hhhhh.", ".hhhhh....hhhhh."]);
  P.sapling = pad16(["", "", "......aa........", ".....aaaa.......", "..aa.aaaa.aa....", ".aaaaaaaaaaaa...", "..aaaabbaaaa....", ".....abba.......", "......bb........", "......bb........", "......dd........", "......dd........", "......dd........", ".....dddd......."]);
  P.apple = pad16(["", "", ".......d........", "......d.........", "....aaddaa......", "...aaaaaaaaa....", "..aacaaaaaaaa...", "..aacaaaaaaaa...", "..aaaaaaaaaaa...", "..aaaaaaaaaaa...", "...aaaaaaaaa....", "....aaa.aaa....."]);
  P.arrow = pad16(["...............w", "..............ww", ".............ww.", "............dd..", "...........dd...", "..........dd....", ".........dd.....", "........dd......", ".......dd.......", "...cc.dd........", "..ccc.d.........", ".ccc............"]);
  var TIER_RGB = [[176, 140, 84], [128, 128, 128], [220, 220, 226], [250, 220, 70], [90, 230, 230]];
  // rows and a palette for an item: { rows: [...], pal: { h: [r,g,b], ... } } or null for blocks (those are drawn as cubes from their textures)
  D.icon = function (id) {
    var t = D.toolOf(id), c = (COLOR[id] || [[255, 0, 255]])[0];
    var shade = function (rgb, f) { return [Math.min(255, rgb[0] * f), Math.min(255, rgb[1] * f), Math.min(255, rgb[2] * f)]; };
    var pal = { a: c, b: shade(c, 0.7), c: shade(c, 1.25), d: [120, 84, 46], k: [34, 34, 38], w: [235, 235, 235] };
    if (t) { pal.h = TIER_RGB[t.tier]; pal.b = shade(pal.h, 0.7); return { rows: P[t.kind], pal: pal }; }
    var ar = D.armorOf(id);
    if (ar) { pal.h = ARMOR_RGB[ar.tier]; pal.b = shade(pal.h, 0.7); return { rows: P[["helmet", "chestplate", "leggings", "boots"][ar.slot]], pal: pal }; }
    var kind = { 33: "torch", 40: "stick", 41: "coal", 42: "ingot", 43: "ingot", 44: "diamond", 20: "seeds", 21: "wheat", 23: "bread", 80: "meat", 81: "meat", 82: "meat", 83: "meat", 84: "meat", 85: "meat", 86: "meat", 87: "meat", 88: "meat", 89: "meat", 110: "meat", 111: "meat",
                 112: "feather", 113: "leather", 114: "string", 115: "stick", 116: "coal", 117: "coal", 118: "arrow", 38: "sapling", 120: "apple" }[id];
    if (id === 116) pal.a = [100, 100, 106]; if (id === 117) pal.a = [100, 130, 70]; if (id === 115) { pal.d = [228, 224, 205]; }
    if (id === 41) pal.a = [34, 34, 38];
    if (id === 80) pal.a = [215, 110, 110];
    if (id === 81) pal.a = [160, 95, 55];
    return kind ? { rows: P[kind], pal: pal } : null;
  };

  // ---- creatures' drops, armour and the wearing of tools ----
  var ARMOR_TIERS = D.ARMOR_TIERS = ["deri", "demir", "altın", "elmas"], ARMOR_PARTS = D.ARMOR_PARTS = [["helmet", "miğfer"], ["chestplate", "göğüslük"], ["leggings", "pantolon"], ["boots", "bot"]];
  var ARMOR_RGB = [[160, 100, 60], [220, 220, 226], [250, 220, 70], [90, 230, 230]];
  var ARMOR_POINTS = D.ARMOR_POINTS = [[1, 3, 2, 1], [2, 6, 5, 2], [2, 5, 3, 1], [3, 8, 6, 3]];   // helmet, chest, legs, boots
  D.armorOf = function (id) { if (id < 90 || id > 105) return null; var t = Math.floor((id - 90) / 4), s = (id - 90) % 4; return { tier: t, slot: s, points: ARMOR_POINTS[t][s] }; };
  D.armorId = function (tier, slot) { return 90 + tier * 4 + slot; };
  for (var at = 0; at < 4; at++) for (var ap = 0; ap < 4; ap++) { NAME[90 + at * 4 + ap] = ARMOR_TIERS[at] + " " + ARMOR_PARTS[ap][1]; COLOR[90 + at * 4 + ap] = [ARMOR_RGB[at]]; }
  D.DUR = [59, 131, 250, 32, 1561];   // uses of a wood, stone, iron, gold and diamond tool
  var RAW = [[82, 83, "biftek", [210, 90, 90], 3, 8], [84, 85, "domuz eti", [232, 150, 160], 3, 8], [86, 87, "koyun eti", [200, 90, 100], 2, 6], [88, 89, "tavuk", [235, 190, 150], 2, 6], [110, 111, "tavşan eti", [200, 130, 110], 3, 5]];
  RAW.forEach(function (r) {
    NAME[r[0]] = "çiğ " + r[2]; COLOR[r[0]] = [r[3]]; NAME[r[1]] = "pişmiş " + r[2]; COLOR[r[1]] = [[150, 92, 52]];
    D.FOOD[r[0]] = r[4]; D.FOOD[r[1]] = r[5];
  });
  NAME[112] = "tüy"; COLOR[112] = [[240, 240, 240]]; NAME[113] = "deri"; COLOR[113] = [[150, 96, 56]]; NAME[114] = "ip"; COLOR[114] = [[235, 235, 235]]; NAME[115] = "kemik"; COLOR[115] = [[228, 224, 205]];
  NAME[116] = "barut"; COLOR[116] = [[96, 96, 100]]; NAME[117] = "çürük et"; COLOR[117] = [[110, 140, 80]]; NAME[118] = "ok"; COLOR[118] = [[200, 200, 200]];
  D.FOOD[117] = 4;
  NAME[35] = "yatak"; COLOR[35] = [[190, 50, 50], [176, 70, 70], [176, 140, 84]]; NAME[37] = "lav"; COLOR[37] = [[244, 120, 30], [230, 100, 20], [230, 100, 20]];
  NAME[38] = "fidan"; COLOR[38] = [[70, 160, 60]]; NAME[120] = "elma"; COLOR[120] = [[210, 50, 50]]; D.FOOD[120] = 4;
  NAME[34] = "yün"; COLOR[34] = [[236, 236, 236], [226, 226, 230], [226, 226, 230]];
  D.hasIcon = function (id) { return D.isBlock(id) || !!D.icon(id); };

  // ---- achievements: each one looks at the game state (s.ever: kinds you ever held, s.stats, s.hud, s.deaths) ----
  var crafted = function (s, name) { return (s.stats.crafted[name] || 0) >= 1; };
  var anyPick = function (s) { for (var t = 0; t < 5; t++) if (s.ever[D.toolId("pickaxe", t)]) return true; return false; };
  D.ACH = [
    { id: "wood", name: "Ağaç Kes", desc: "bir kütük topla", test: function (s) { return !!s.ever[5]; } },
    { id: "table", name: "Çalışma Masası", desc: "üretim masası yap", test: function (s) { return crafted(s, "üretim masası"); } },
    { id: "pick", name: "Kazma Zamanı", desc: "bir kazma yap", test: anyPick },
    { id: "stone", name: "Taş Devri", desc: "kırık taş topla", test: function (s) { return !!s.ever[27]; } },
    { id: "furnace", name: "Sıcak Konu", desc: "bir fırın yap", test: function (s) { return crafted(s, "fırın"); } },
    { id: "iron", name: "Demir Çağı", desc: "demir külçe elde et", test: function (s) { return !!s.ever[42]; } },
    { id: "gold", name: "Altın Çağı", desc: "altın külçe elde et", test: function (s) { return !!s.ever[43]; } },
    { id: "diamond", name: "Elmas!", desc: "bir elmas bul", test: function (s) { return !!s.ever[44]; } },
    { id: "diamondpick", name: "Tam Donanım", desc: "elmas kazma yap", test: function (s) { return crafted(s, "elmas kazma"); } },
    { id: "glass", name: "Cam Ustası", desc: "fırında cam pişir", test: function (s) { return !!s.ever[8] && s.stats.smelted > 0; } },
    { id: "farmer", name: "Çiftçi", desc: "ektiğin ekini hasat et", test: function (s) { return s.hud.harvested >= 1; } },
    { id: "bread", name: "Ekmek Yap", desc: "buğdaydan ekmek yap", test: function (s) { return crafted(s, "ekmek"); } },
    { id: "eat", name: "Karnını Doyur", desc: "bir şey ye", test: function (s) { return s.stats.eaten >= 1; } },
    { id: "explorer", name: "Gezgin", desc: "10 parça gez", test: function (s) { return s.hud.explored >= 10; } },
    { id: "wanderer", name: "Kaşif", desc: "50 parça gez", test: function (s) { return s.hud.explored >= 50; } },
    { id: "deep", name: "Derin Madenci", desc: "yüzeyin 15 blok altına in", test: function (s) { return s.hud.depth >= 15; } },
    { id: "digger", name: "Kazıcı", desc: "200 blok kır", test: function (s) { return s.hud.broken >= 200; } },
    { id: "builder", name: "İnşaatçı", desc: "100 blok koy", test: function (s) { return s.hud.placed >= 100; } },
    { id: "torch", name: "Işığı Yak", desc: "meşale yap", test: function (s) { return crafted(s, "meşale"); } },
    { id: "died", name: "Pes Etmek Yok", desc: "bir kez öl ve geri dön", test: function (s) { return s.deaths >= 1; } },
    { id: "sleep", name: "Tatlı Rüyalar", desc: "yatakta bir gece geçir", test: function (s) { return s.stats.slept >= 1; } },
    { id: "hunter", name: "Avcı", desc: "10 canlı avla", test: function (s) { return s.kills >= 10; } },
    { id: "forester", name: "Ormancı", desc: "diktiğin fidandan ağaç yetiştir", test: function (s) { return s.stats.grown >= 1; } }
  ];
  // a block can be put down: the ground and plant blocks, and the new building blocks (not tools, food or materials)
  D.isBlock = function (id) { return (id >= 1 && id <= 13) || id === 15 || (id >= 24 && id <= 35) || id === 38; };

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
  D.smelts = [[ID.COBBLE, ID.STONE, "taş"], [ID.SAND, ID.GLASS, "cam"], [ID.IRON_ORE, ID.IRON_INGOT, "demir külçe"], [ID.GOLD_ORE, ID.GOLD_INGOT, "altın külçe"], [80, 81, "pişmiş et"]];
  D.smelts.forEach(function (s) { add("eritme: " + s[2], "furnace", [[s[0], 1]], [s[1], 1]); });
  add("yün (4 ip)", "hand", [[114, 4]], [34, 1]);
  add("yatak", "table", [[34, 3], [ID.PLANKS, 3]], [35, 1]);
  for (var ar = 0; ar < 4; ar++) {
    var armMat = [113, ID.IRON_INGOT, ID.GOLD_INGOT, ID.DIAMOND][ar], armCost = [5, 8, 7, 4];
    for (var part = 0; part < 4; part++) add(ARMOR_TIERS[ar] + " " + ARMOR_PARTS[part][1], "table", [[armMat, armCost[part]]], [D.armorId(ar, part), 1]);
  }
  RAW.forEach(function (r) { add("eritme: " + (r[2] === "biftek" ? "biftek" : r[2]), "furnace", [[r[0], 1]], [r[1], 1]); });
  D.recipeIndex = function (name) { for (var i = 0; i < R.length; i++) if (R[i].name === name) return i; return -1; };

  if (typeof module !== "undefined" && module && module.exports) module.exports = K;
})(globalThis);
