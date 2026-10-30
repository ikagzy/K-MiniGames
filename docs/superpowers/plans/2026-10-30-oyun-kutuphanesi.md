# Oyun Kütüphanesi (A + D + S) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modelin oyunu sıfırdan yazması yerine, uygulamayla gelen modüler bir JS kütüphanesini (çekirdek, bot, spor) kullanarak küçük bir `oyun.html` yazmasını sağlamak; sonucu voleybol tarifiyle eski yöntemle karşılaştırmak.

**Architecture:** Kütüphane dosyaları (`kgame*.js`) `src/k_minigames/assets/lib/` içinde durur, oyun oluşturulurken oyun klasörüne kopyalanır; `oyun.html`'e `<script src>` etiketlerini uygulama ekler. Modele yalnızca seçilen modüllerin kısa kılavuzu (`*.guide.md`) gösterilir. Düzenleme "bul/değiştir" yamalarıyla yapılır, olmazsa bütün dosya yöntemine dönülür. JS mantığı DOM'dan ayrıdır ve Node ile test edilir.

**Tech Stack:** Python >=3.11 (stdlib), pytest, JavaScript (ES2020, bağımlılıksız), Node.js (yalnızca testler; yoksa JS testleri atlanır), tarayıcı (rapor sunucusu üzerinden).

**Spec:** `docs/superpowers/specs/2026-10-30-oyun-kutuphanesi-design.md`

## Global Constraints

- Çalışma zamanı bağımlılığı yok (`dependencies = []`); kütüphane JS'i saf, tek dosya/modül, **harici ağ adresi yok**.
- Oyun klasörü yapısı (mevcut) + kütüphane dosyaları kökte: `kgame.js`, `kgame.ai.js`, `kgame.sports.js`. `oyun.html` bunları göreli yolla çağırır.
- Modele giden istemde kılavuz bütçesi: çekirdek en fazla **2000**, her modül en fazla **1500** token (yaklaşık 3,5 karakter = 1 token; testte `len(text) / 3.5`). Bağlam `num_ctx = 8192` kalır.
- Modül adları: `core`, `ai`, `sports`. `core` her zaman vardır; `sports` → `ai`'ye bağlıdır. Listede olmayan ad atılır.
- Düzeltme en fazla **3** deneme, en iyi sürüm korunur (mevcut davranış değişmez). Kütüphanesiz (eski) oyunlar aynen çalışır.
- Kaynak metinler Türkçe, `i18n.t()` İngilizce çevirir. Ayarlar ve testler gerçek ağa/Ollama'ya/`%APPDATA%`'ya dokunmaz (`tests/conftest.py`).
- **Standart commit adımı (CS):** listelenen dosyalar `git add` ile eklenir; mesaj sonuna `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` konur; sonra `docs/CHECKPOINTS.md`'ye CP kaydı ve `docs/HAFIZA.md` güncellemesi yapılır (CLAUDE.md kuralı). Hiçbir şey push edilmez.
- Test komutu: `python -m pytest -q`; JS testleri bunun içinde `tests/test_kgame_js.py` ile `node --test tests/js` çalıştırır (node yoksa atlanır).

## Review Focus

1. **Model kütüphane etiketini kendisi yazar, ya da hiç yazmaz, ya da iki kez yazar** → `ensure_scripts` her durumda tek, doğru sırada etiket bırakır (Görev 1).
2. **Oyun klasörü taşınır / `baslat.bat` ile `file://` açılır** → yollar göreli, `install` tekrar çalışınca bozulmaz, eski kopyayı günceller (Görev 1, 2).
3. **Model uydurma/yanlış yazılmış modül listesi verir** (olmayan ad, büyük/küçük harf, tekrar, boş) → `normalize` atar, çekirdekle devam edilir (Görev 1, 11).
4. **Yama blokları bozuk ya da aranan metin bulunmuyor/birden çok yerde** → çalışan oyun ezilmez, bütün dosya yöntemine dönülür (Görev 12).
5. **Kılavuzlar büyüyüp bağlamı taşırır** → bütçe testi uyarır; model yarım cevap verirse mevcut "kesik cevap oyun sayılmaz" kuralı korur (Görev 9).

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `src/k_minigames/kgamelib.py` | Modül kaydı, `normalize`, `install`, `guides`, `ensure_scripts` |
| `src/k_minigames/assets/lib/kgame.js` | 2B çekirdek |
| `src/k_minigames/assets/lib/kgame.ai.js` | Bot modülü |
| `src/k_minigames/assets/lib/kgame.sports.js` | Spor modülü |
| `src/k_minigames/assets/lib/*.guide.md` | Modele gösterilen kılavuzlar (+ örnek oyunlar) |
| `src/k_minigames/patching.py` | Bul/değiştir yama biçimi |
| `src/k_minigames/library.py` (değişir) | `modules(game)`, `set_modules(game, names)` |
| `src/k_minigames/report_server.py` (değişir) | Kütüphane betiklerini oyun klasöründen sunar |
| `src/k_minigames/generator.py`, `studio.py`, `advisor.py`, `ollama_client.py` (değişir) | İstem, akış, modül seçimi, `keep_alive`, yapılandırılmış çıktı |
| `tests/js/*.test.js`, `tests/test_kgame_js.py` | Node ile JS testleri |
| `tools/measure_library.py` | Eski/yeni yöntem ölçümü |

---

### Görev 1: Modül kaydı ve kurulum (`kgamelib.py`)

**Files:**
- Create: `src/k_minigames/kgamelib.py`, `tests/test_kgamelib.py`
- Create (boş yer tutucu, sonraki görevler doldurur): `src/k_minigames/assets/lib/kgame.js`, `kgame.ai.js`, `kgame.sports.js`, `core.guide.md`, `ai.guide.md`, `sports.guide.md` (her biri tek satırlık başlık)

**Interfaces:**
- Produces:
  - `LIB_DIR: Path`, `LIB_VERSION: str = "1"`
  - `@dataclass(frozen=True) class Module: name: str; files: tuple[str, ...]; guide: str; needs: tuple[str, ...]`
  - `MODULES: dict[str, Module]` (`core`, `ai`, `sports`)
  - `normalize(names: Iterable[str]) -> list[str]` — küçük harfe çevirir, bilinmeyeni atar, bağımlıları ekler, `core` başa, bağımlılık sırasıyla, tekrarsız.
  - `all_files() -> set[str]`
  - `install(game: Game, modules: list[str]) -> list[str]` — dosyaları oyun klasörüne kopyalar (var olanın üstüne yazar), kopyalanan adları döndürür.
  - `guides(modules: list[str]) -> str`
  - `ensure_scripts(html: str, modules: list[str]) -> str`

- [ ] **Step 1: Failing tests** — `tests/test_kgamelib.py`:
  - `test_normalize_drops_unknown_adds_dependencies_and_puts_core_first`: `normalize(["Sports", "xyz", "sports"]) == ["core", "ai", "sports"]`; `normalize([]) == ["core"]`; `normalize(["AI"]) == ["core", "ai"]`.
  - `test_install_copies_the_files_into_the_game_folder_and_is_repeatable`: `install(game, ["core","ai"])` → `kgame.js`, `kgame.ai.js` var; ikinci çağrı hata vermez; `sports` dosyası kopyalanmaz.
  - `test_ensure_scripts_adds_the_tags_once_in_order_before_the_first_script`: HTML'de etiket yok → `<script src="kgame.js"></script>` sonra `kgame.ai.js`, oyunun ilk `<script>`'inden önce; HTML'de zaten `kgame.js` etiketi varsa tekrar eklenmez; modelin yazdığı yanlış sıra düzeltilir (kopya silinip doğru sırada tek bırakılır); `<head>` yoksa `<body>` başına eklenir.
  - `test_guides_joins_the_selected_modules_guides`: `guides(["core"])` çekirdek kılavuz başlığını içerir, `ai` başlığını içermez.
- [ ] **Step 2:** `python -m pytest tests/test_kgamelib.py -q` → FAIL (modül yok).
- [ ] **Step 3:** `kgamelib.py` içinde yukarıdaki imzaları yaz. `ensure_scripts`: önce HTML'deki tüm `<script src="kgame*.js">` etiketlerini regex ile siler, sonra `normalize`d listenin dosyalarını sırayla ilk satır içi `<script>`'ten önce (yoksa `</head>`'den önce, yoksa `<body>` sonrasına) ekler.
- [ ] **Step 4:** testler PASS.
- [ ] **Step 5:** CS (`src/k_minigames/kgamelib.py`, `src/k_minigames/assets/lib`, `tests/test_kgamelib.py`).

### Görev 2: Rapor sunucusu kütüphane betiklerini sunar

**Files:** Modify: `src/k_minigames/report_server.py`; Test: `tests/test_report_server.py`

**Interfaces:**
- Consumes: `kgamelib.all_files() -> set[str]`
- Produces: `GET /play/<jeton>/kgame.js` (ve `kgame.ai.js`, `kgame.sports.js`) → oyun klasörünün kökündeki dosya, `application/javascript`; listede olmayan ad ya da klasör dışı yol → 404.

- [ ] **Step 1:** Testler: `test_library_scripts_are_served_from_the_game_folder` (klasöre `kgame.js` yaz, GET 200 ve içerik); `test_other_files_in_the_game_folder_are_not_served` (`oyun.html` hariç `gizli.txt` → 404); `test_a_traversal_name_is_refused` (`..%2fkgame.js` → 404).
- [ ] **Step 2:** FAIL doğrula.
- [ ] **Step 3:** `do_GET` içinde `rest in kgamelib.all_files()` ise `game_dir / rest`'ten oku (çözülmüş yol `game_dir` içinde olmalı); `.js` için `mimetypes` yerine `application/javascript; charset=utf-8`.
- [ ] **Step 4:** PASS. **Step 5:** CS.

### Görev 3: JS test altyapısı (Node)

**Files:** Create: `tests/js/helpers.js`, `tests/js/smoke.test.js`, `tests/test_kgame_js.py`

**Interfaces:** Produces: `tests/js/helpers.js` → `load(...files): K` (verilen kütüphane dosyalarını sırayla `vm` içinde `globalThis` sahte ortamında yükler, `K` döndürür); `tests/test_kgame_js.py::test_the_js_tests_pass` → `node --test tests/js` çıkış kodu 0.

- [ ] **Step 1:** `smoke.test.js`: `load("kgame.js").version === "1"` (şimdilik `kgame.js` yer tutucuyu `globalThis.K = {version:"1"}` yap). `test_kgame_js.py`: node yoksa `pytest.skip`; `subprocess.run(["node","--test","tests/js"])` çıkış 0 beklenir.
- [ ] **Step 2:** FAIL (helpers yok). **Step 3:** `helpers.js` yaz: dosya içeriğini `new Function("globalThis","module", kod)` ile çalıştırır; DOM yoksa `document` tanımsız kalır (kütüphane bunu desteklemeli). **Step 4:** PASS. **Step 5:** CS.

### Görev 4: Çekirdek — dünya, varlıklar, fizik

**Files:** Modify: `assets/lib/kgame.js`; Test: `tests/js/core_world.test.js`

**Interfaces — Produces (JS, `K` üzerinde):**
- `K.version: "1"`
- `K.game({width=800,height=450,gravity=0,canvas,headless}) -> Game`
- `Game.add(spec) -> Entity`; spec: `{shape:'rect'|'circle'|'text', x,y,w,h,r,text,color, vx,vy, gravity:boolean|number, bounce=0, friction=0, solid=false, tag, controls:'wasd'|'arrows'|null, speed, bounds:boolean, onUpdate:(e,dt)=>void}`
- `Game.remove(e)`, `Game.all(tag?) -> Entity[]`, `Game.step(dt)` (saniye), `Game.run()` (rAF ile `step`+`draw`), `Game.draw()`
- Entity alanları: `x,y,vx,vy,w,h,r,color,tag,dead`

- [ ] **Step 1:** Testler (headless): `gravity` 900, `dt=1/60`, 60 adım → `vy` ≈ 900 (±1), `y` arttı; `bounce:0.5` ile zemine (`game.height`) çarpan daire `vy` işaret değiştirir ve büyüklüğü yarıya iner; `friction` hızı azaltır; `bounds:true` varlık `[0,width]×[0,height]` dışına çıkmaz; `remove` sonrası `all()`'da yok; `gravity:false` varlık düşmez.
- [ ] **Step 2:** FAIL. **Step 3:** Çekirdeği yaz (sabit adım birikimi `run` içinde; `step` doğrudan dt alır). Çizim `ctx` yoksa (`headless`) atlanır. **Step 4:** PASS. **Step 5:** CS.

### Görev 5: Çekirdek — girdi, çarpışma, karo haritası

**Files:** Modify: `assets/lib/kgame.js`; Test: `tests/js/core_input_collide.test.js`

**Interfaces — Produces:**
- `K.key(name) -> boolean` (`'w'`, `'ArrowLeft'`, `' '`…), `K.press(name, down=true)` (testler ve denetçi için sahte basma), `K.mouse -> {x,y,down}`, `K.setMouse(x,y,down)`
- `controls:'wasd'|'arrows'` olan varlık `speed` hızıyla `vx/vy` alır; `controls` olmayan etkilenmez.
- `Game.onCollide(a, b, fn)` — `a`,`b` Entity ya da tag dizgesi; `fn(a,b)` her çarpışma başlangıcında bir kez.
- `K.hit.rectRect(a,b)`, `K.hit.circleCircle(a,b)`, `K.hit.circleRect(c,r)` → boolean
- `K.tilemap(rows: string[], legend: object, tile=32) -> {tiles, solidAt(x,y), spawn(char)}`; `Game.collideTiles(entity, tilemap)` varlığı katı karolardan iter.

- [ ] **Step 1:** Testler: `K.press('d')` + `step` → `controls:'wasd'` varlık sağa gider, `'arrows'` varlık gitmez; `K.press('d', false)` durur; üç çarpışma fonksiyonu için kesişen/kesişmeyen/teğet durumlar; `onCollide('ball','paddle')` tag ile bir kez tetiklenir, temas sürerken tekrar etmez; `tilemap(["#..", "..#"], {'#':'wall'})` `solidAt` doğru; `collideTiles` bir varlığı duvara gömmez.
- [ ] **Step 2:** FAIL. **Step 3:** Yaz; tarayıcıda `keydown/keyup/mousemove/mousedown/mouseup` dinleyicilerini yalnızca `document` varsa bağla (Node'da yok). **Step 4:** PASS. **Step 5:** CS.

### Görev 6: Çekirdek — kamera, sahne, arayüz, zaman, ses, doku, kayıt, `expose`

**Files:** Modify: `assets/lib/kgame.js`; Test: `tests/js/core_misc.test.js`

**Interfaces — Produces:**
- `Game.camera = {x,y,zoom}`, `Game.follow(entity, lerp=0.1)`, `Game.shake(power, ms)`
- `Game.scene(name, {enter,update,draw})`, `Game.go(name)`; başlangıç sahnesi `'play'`
- `Game.score(name) -> number`, `Game.addScore(name, n)`, `Game.ui.text(id, text, x, y)`, `Game.ui.bar(id, value, max, x, y, w)`
- `K.timer.after(ms, fn) -> id`, `K.timer.every(ms, fn) -> id`, `K.timer.clear(id)`, `K.timer.tick(dt)`; `K.tween(obj, props, ms, ease='linear')`
- `K.rand(a,b)`, `K.seed(n)` (belirleyici), `K.pick(arr)`
- `K.sfx(name)` (`'jump'|'hit'|'coin'|'boom'`; WebAudio yoksa sessizce hiçbir şey yapmaz)
- `K.particles.burst(g, x, y, {count,color,speed,life})`
- `K.texture.make(name, size=32) -> {name,size,canvas|null}` (`brick|grass|stone|wood|water|sky`)
- `K.save.set(key,v)`, `K.save.get(key,def)` (localStorage yoksa bellek)
- `K.expose(obj) -> obj` → `globalThis.__game = obj`

- [ ] **Step 1:** Testler: `seed(1)` iki kez aynı diziyi verir; `timer.after(100, fn)` 100 ms'lik `tick`'ten sonra bir kez çalışır, `clear` ile iptal edilir; `tween` bitişte hedef değeri verir; `go('over')` sahne `enter`'ini çağırır; `addScore('p',2)` → `score('p') == 2`; `follow` kamerayı yaklaştırır; `K.expose({a:1})` sonrası `globalThis.__game.a === 1`; `K.save` set/get; `K.sfx('hit')` Node'da hata atmaz; `K.texture.make('brick', 16).size === 16`; `particles.burst` varlık sayısını `count` kadar artırır ve `life` sonunda siler.
- [ ] **Step 2:** FAIL. **Step 3:** Yaz. **Step 4:** PASS. **Step 5:** CS.

### Görev 7: Bot modülü (`kgame.ai.js`)

**Files:** Modify: `assets/lib/kgame.ai.js`; Test: `tests/js/ai.test.js`

**Interfaces — Produces (`K.ai`):**
- `follow(e, target, {speed=120, stopAt=0}) -> void` (her `step`te hareket eder; `e.onUpdate` zincirine eklenir)
- `flee(e, from, {speed})`, `wander(e, {speed, turn})`, `patrol(e, points, {speed})`
- `paddle(e, ball, {level:'easy'|'normal'|'hard', axis:'y'|'x', speed}) -> e` — botu topun konumuna göre kaydırır; `easy` yavaş ve gecikmeli.
- `fsm(e, states: {[name]: (e,dt)=>string|void}, start) -> {state}`
- `astar(grid: number[][], from:[c,r], to:[c,r]) -> [c,r][] | null` (0 geçilir, 1 duvar)
- `sees(a, b, walls: Entity[], range) -> boolean`
- `swarm(list, {cohesion, separation, speed})`

- [ ] **Step 1:** Testler: `follow` uzaklığı azaltır ve `stopAt`'ta durur; `flee` uzaklığı artırır; `patrol` noktalar arasında gidip gelir; `paddle` (`axis:'y'`) top yukarıdayken bot yukarı, aşağıdayken aşağı gider (iki deneme), `easy` bot `hard` bottan yavaş; `astar` duvarı dolaşan en kısa yolu bulur, yol yoksa `null`; `sees` aradaki duvar varken `false`; `fsm` durum geçişi yapar.
- [ ] **Step 2:** FAIL. **Step 3:** Yaz. **Step 4:** PASS. **Step 5:** CS.

### Görev 8: Spor modülü (`kgame.sports.js`)

**Files:** Modify: `assets/lib/kgame.sports.js`; Test: `tests/js/sports.test.js`

**Interfaces — Produces (`K.sports`):**
- `court(g, {type:'volleyball'|'pong'|'football'|'basketball', net:boolean}) -> Court` (`{left,right,floorY,netX,netTop,sides}`; sınırları ve file engelini `g`ye ekler)
- `ball(g, court, {radius=12, bounce=0.85, gravity}) -> Entity` (tag `'ball'`)
- `hit(g, ball, hitter: Entity, target: {x,y}, {power=650, reach=60}) -> boolean` — `hitter`, `reach` içindeyse topa `target`'a doğru hem `vx` hem `vy` verir; değilse `false`.
- `rules.volleyball(g, court, {to=15, touches=3, onPoint}) -> {scoreLeft,scoreRight}` — top zemine düşünce karşı taraf puan alır, topu servise alır; `to`'ya ulaşan kazanır (`g.go('over')`).
- `rules.pong(g, court, {to})`, `rules.goal(g, court, {to})` (futbol/basketbol: kale/pota)

- [ ] **Step 1:** Testler: voleybol sahasında top fileye çarpıp geri döner; `hit` hedef sağ-üstteyse top `vx>0` ve `vy<0` alır ve **iki bileşen de sıfır değil** (düz dikey değil); `reach` dışında `hit` `false`; top sol sahada zemine düşünce sağ taraf +1, top servise döner; 15. puanda `go('over')`; `rules.pong` kale çizgisini geçen topa puan.
- [ ] **Step 2:** FAIL. **Step 3:** Yaz (fizik çekirdeğin `g.add`/`onCollide`'ını kullanır). **Step 4:** PASS. **Step 5:** CS.

### Görev 9: Kılavuzlar, örnek oyunlar ve bütçe testi

**Files:** Modify: `assets/lib/core.guide.md`, `ai.guide.md`, `sports.guide.md`; Create: `assets/lib/examples/volleyball.html`, `pong.html`, `platform-lite.html`; Test: `tests/test_guides.py`, `tests/js/examples.test.js`

**Interfaces:** Consumes: `kgamelib.guides`, JS API'leri. Produces: her kılavuz = (1) 10–25 satırlık API listesi (imza + tek cümle), (2) bir tam örnek oyun gövdesi. Kılavuz `const CONFIG = {...}` kuralını (JSON-geçerli, tırnaklı anahtarlar) ve "kütüphane etiketlerini yazma, uygulama ekler" kuralını belirtir.

- [ ] **Step 1:** Testler: `test_guide_budgets`: `len(guide)/3.5` çekirdek ≤ 2000, `ai` ≤ 1500, `sports` ≤ 1500; `examples.test.js`: üç örnek HTML'in `<script>` gövdesi Node'da (kütüphane yüklü, `headless`) hata atmadan 600 adım (10 sn) çalışır ve `__game` içinde `ball`/`score` alanları sayıdır; örnekler `kgamelib.ensure_scripts` ile etiketlenince geçerli HTML kalır.
- [ ] **Step 2:** FAIL. **Step 3:** Kılavuz ve örnekleri yaz. Voleybol örneği tasarım belgesindeki hedef biçimdir, `g` ilk argümanla (`K.sports.court(g, …)`); belgedeki örnek de bu imzaya güncellenir. **Step 4:** PASS. **Step 5:** CS.

### Görev 10: İstemler kütüphaneyi kullanır (`generator.py`)

**Files:** Modify: `src/k_minigames/generator.py`; Test: `tests/test_generator.py`

**Interfaces:**
- Consumes: `kgamelib.guides`, `kgamelib.normalize`
- Produces: `build_create_messages(description, textures, *, memory="", modules=())`, `build_edit_messages(html, request, textures, checklist, resolved=(), *, memory="", modules=())`, `build_fix_messages(html, problems, *, memory="", modules=())`; `Generator.create/edit/fix(..., modules=())`. `modules` boşsa çıktı bugünkü ile **birebir aynı** (eski yol).

- [ ] **Step 1:** Testler: modüllü `create` sistem mesajı kılavuzu ve "yalnızca oyun kurallarını yaz; kütüphane etiketlerini yazma" kuralını içerir, bugünkü `_RULES` "TEK dosya, saf JS" cümlesini **içermez** (çelişki olmasın); modülsüz çağrı eski mesajla eşit (`==` karşılaştırması, anlık görüntü); modül listesi `normalize` edilir.
- [ ] **Step 2:** FAIL. **Step 3:** `_RULES_LIB` ekle, `_system(...)` modüllü dalı seç. **Step 4:** PASS. **Step 5:** CS.

### Görev 11: Modül seçimi, kayıt ve akış

**Files:** Modify: `src/k_minigames/ollama_client.py` (`chat(..., schema=None, keep_alive=None)`), `advisor.py` (`choose_modules`), `ui/advisor_flow.py`, `ui/advisor_screen.py` (`_hand_over`), `library.py` (`modules`, `set_modules`), `studio.py`, `ui/studio_screen.py`; Test: `tests/test_ollama_client.py`, `tests/test_advisor.py`, `tests/test_library.py`, `tests/test_studio.py`

**Interfaces:**
- Produces: `OllamaClient.chat(model, messages, on_token=None, cancel=None, *, schema: dict | None = None, keep_alive: str | None = None) -> str` (`schema` → istek gövdesinde `"format": schema`; `keep_alive` → `"keep_alive"`).
- `Advisor.choose_modules(history: list[dict]) -> list[str]` — `{"modules": ["core","sports"]}` şemasıyla çağırır, `kgamelib.normalize` ile temizler; hata olursa `["core"]`.
- `library.modules(game) -> list[str]` (`game.json`'daki `modules`, yoksa `[]`), `library.set_modules(game, names)`.
- `studio.create_game_flow(..., modules=None)`: `modules` verilirse `kgamelib.install` + `ensure_scripts` yapılır ve `generator`'a iletilir; verilmezse eski akış. Düzenleme akışı oyunun kayıtlı modüllerini kullanır. Üretim sonunda `keep_alive="2m"` ile bellek serbest bırakma isteği (son çağrı).
- `AdvisorScreen._hand_over` `services.session = {"mode": "create", "modules": flow.modules}` verir; `StudioScreen._on_name` oyunu yaratınca `set_modules`.

- [ ] **Step 1:** Testler: `chat` gövdesinde `format` ve `keep_alive` gönderilir (sahte opener ile); `choose_modules` bozuk/boş/uydurma cevapta `["core"]` döner, `"SPORTS"` → `["core","ai","sports"]`; `set_modules/modules` gidiş-dönüş, bozuk `game.json`'da `[]`; `create_game_flow` modüllü çağrıda oyun klasöründe `kgame.js` vardır ve sonuç HTML'de etiket bir kez geçer; modülsüz çağrıda dosya kopyalanmaz.
- [ ] **Step 2:** FAIL. **Step 3:** Yaz. **Step 4:** tam `python -m pytest -q` PASS. **Step 5:** CS.

### Görev 12: Yama ile düzenleme (`patching.py`)

**Files:** Create: `src/k_minigames/patching.py`, `tests/test_patching.py`; Modify: `generator.py` (`Generator.edit` yama kipi), `studio.py` (`edit_game_flow`)

**Interfaces — Produces:**
- `@dataclass(frozen=True) class Patch: find: str; replace: str`
- `parse_patches(text: str) -> list[Patch]` — blok biçimi: satırı yalnız `<<<<<<< BUL` / `=======` / `>>>>>>> DEĞİŞTİR` olan üçlüler; bozuk blok atılır.
- `apply_patches(html: str, patches: list[Patch]) -> str | None` — her `find` HTML'de **tam bir kez** geçmeli, aksi halde `None`.
- `Generator.edit(..., modules=())` modüllü ve HTML uzunsa önce yama ister; `parse` boş ya da `apply` `None` ise bir kez bütün dosya isteğine döner.

- [ ] **Step 1:** Testler: iki bloğu ayrıştırır; yarım blok atılır; `apply_patches` bulunmayan `find` için `None`, iki yerde geçen için `None`, geçerli için değişmiş HTML; edit akışında `apply` `None` olunca ikinci (bütün dosya) çağrı yapılır ve çalışan oyun yalnızca sonuç iyiyse değişir (mevcut `rejected` kuralı).
- [ ] **Step 2:** FAIL. **Step 3:** Yaz. **Step 4:** PASS. **Step 5:** CS.

### Görev 13: `CONFIG` bloğu doğrulaması

**Files:** Modify: `src/k_minigames/htmlscan.py`; Test: `tests/test_htmlscan.py`

**Interfaces:** `htmlscan.scan(...)` kütüphaneli oyunda (HTML'de `kgame` geçiyorsa) `const CONFIG = {...};` bulur, JSON olarak okunamıyorsa `Problem("bad_config", ayrıntı, "error")` ekler; `Problem.as_text` "CONFIG geçerli JSON olmalı (tırnaklı anahtarlar)" der; `CONFIG` hiç yoksa uyarı yok.

- [ ] **Step 1:** Testler: geçerli JSON → sorun yok; `{gravity: 700}` (tırnaksız) → `bad_config`; `CONFIG` yok → sorun yok; kütüphanesiz oyunda taranmaz.
- [ ] **Step 2:** FAIL. **Step 3:** Yaz. **Step 4:** PASS. **Step 5:** CS.

### Görev 14: Paketleme, belgeler, `play` yolu

**Files:** Modify: `K-MiniGames.spec` (`datas` + `('src/k_minigames/assets/lib', 'k_minigames/assets/lib')`), `README.md`, `docs/ui-varliklari.md` yok; Test: `tests/test_kgamelib.py`

- [ ] **Step 1:** Test: `LIB_DIR` altında üç modülün tüm dosyaları ve kılavuzları mevcut (`MODULES` kaydındaki her dosya var). **Step 2:** FAIL gerekirse. **Step 3:** `spec`'e `datas` ekle; README'ye "Oyun kütüphanesi" bölümü (modüller, `CONFIG`, three.js ileride). **Step 4:** `python -m PyInstaller K-MiniGames.spec --noconfirm` başarılı; `dist\K-MiniGames.exe` içinde `kgame.js` çıkarılabiliyor (`python -c` ile `sys._MEIPASS` yoksa kaynak yolunu doğrula; derlemede dosyalar `datas` ile gelir). **Step 5:** CS.

### Görev 15: Ölçüm (eski yöntem ↔ yeni yöntem)

**Files:** Create: `tools/measure_library.py`, `docs/olcum-kutuphane.md`

**Interfaces:** `python tools/measure_library.py --model qwen2.5-coder:14b --recipe volleyball --runs 2` aynı tarifi (`docs`'taki metin: iki kişilik voleybol, WASD, fare ile vuruş, kolay bot) önce modülsüz, sonra `["core","ai","sports"]` ile üretir; her koşu için geçen/doğrulanamayan madde sayısı, düzeltme sayısı, kalan hata, yoklama bulguları ve süreyi yazdırır; sonuçları `docs/olcum-kutuphane.md` tablosuna ekler. Yalnızca kurulu modelleri kullanır (indirme yapmaz).

- [ ] **Step 1:** `measure_library.py` yaz (gerçek Ollama gerekir; testi yok, `--dry-run` ile istem boyutlarını yazdırır). **Step 2:** `--dry-run` çalıştır: modüllü istemin token tahmini `num_ctx`'in altında. **Step 3:** Gerçek 14B ile çalıştır, tabloyu doldur, sonucu kullanıcıya yorumla (başarı ölçütü: tasarım belgesi §9). **Step 4:** CS (`tools/`, `docs/olcum-kutuphane.md`).

---

## Self-review notları

- Spec kapsamı: §3.1 (Görev 1,2,14), §3.2 (9,10), §3.3 (11), §3.4 (9,13), §3.5 (12), §3.6 (6), §4 çekirdek/bot/spor (4–8) — seviye, 2B tür, 3B modülleri bilinçli olarak sonraki planlara bırakıldı; §5 sınama (3, 15), §6 (1,12), §7 `keep_alive` (11), §9 (15).
- Bilinçli sapma: spor API'si `g`'yi ilk argüman alır (spec örneği Görev 9'da güncellenir).
- İsimler: `normalize`, `install`, `guides`, `ensure_scripts`, `modules`, `set_modules`, `choose_modules`, `parse_patches`, `apply_patches` tüm görevlerde aynı.
