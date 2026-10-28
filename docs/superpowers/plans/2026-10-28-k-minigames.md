# K-MiniGames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcının yerel Ollama modeliyle tarif ettiği oyunu üreten, deneyen, düzelten ve kütüphanede saklayan Windows masaüstü uygulaması; K-Series bunu bir ürün kartı olarak algılar.

**Architecture:** Python paketi `k_minigames` (saf mantık modülleri + tkinter arayüzü). Mantık modülleri (`ollama_client`, `installer`, `advisor`, `model_check`, `generator`, `htmlscan`, `report_server`, `checker`, `studio`, `library`) arayüzden bağımsızdır ve sahte (fake) bağımlılıklarla test edilir. Arayüz, sabit 1024x572 bir sahne üzerinde (arka plan + maskot + diyalog kutusu) bu modülleri çağırır; uzun işler iş parçacığında, sonuçlar `after` ile arayüze döner.

**Tech Stack:** Python >=3.11, tkinter, standart kütüphane (`urllib`, `http.server`, `ctypes`, `json`), pytest, PyInstaller. Pillow yalnızca `tools/` altındaki görsel hazırlama araçlarında (uygulamada yok).

**Spec:** `docs/superpowers/specs/2026-10-28-k-minigames-design.md` (görseller: `docs/ui-varliklari.md`)

## Global Constraints

- Yalnızca Windows; Python `>=3.11`; çalışma zamanı bağımlılığı yok (`dependencies = []`), HTTP için standart kütüphane.
- Kaynak metinler Türkçe; `i18n.t()` bilinen cümleleri İngilizceye çevirir. Dil, `%APPDATA%\K-Series\settings.json` içindeki `language` ("tr"/"en") anahtarından izlenir; yoksa sistem dili.
- Ayarlar `%LOCALAPPDATA%\K-MiniGames\settings.json` içinde (oyun klasörü, `game_model`, `exe_path`).
- Ollama API: `http://127.0.0.1:11434`. Üretim isteklerinde `options.num_ctx = 8192` (planın kararı: varsayılan bağlam uzun bir HTML'ye yetmez).
- Ollama, danışman modeli ve oyun modeli **yalnızca kullanıcının tıklamasıyla** indirilir; indirme adresi ve boyut önceden gösterilir.
- Oyun klasörü yapısı: `oyun.html`, `baslat.bat`, `assets\`, `surumler\` (`oyun-001.html`…), `testler.json`, `game.json`.
- Üret → dene → düzelt döngüsünde en fazla **3** düzeltme denemesi. Test durumları: `pending`, `passed`, `failed`, `unverified` (arayüzde: bekliyor, geçti, kaldı, doğrulanamadı).
- `report_server` yalnızca `127.0.0.1`'de, rastgele portta, jetonla dinler.
- Testler gerçek ağa, gerçek Ollama'ya, gerçek `%APPDATA%`/`%LOCALAPPDATA%`'a dokunmaz (`tests/conftest.py` izole eder).
- **Standart commit adımı (CS):** listelenen dosyalar `git add` ile eklenir; commit mesajı `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` ile biter; ardından `docs/CHECKPOINTS.md`'ye bir sonraki `CP-n` satırı (commit kısaltmasıyla) eklenir, `docs/HAFIZA.md` "Durum" bölümü güncellenir ve `docs: CP-n kaydı` diye ikinci commit atılır (`CLAUDE.md` kuralı).
- Test komutu: `python -m pytest -q` (depo kökünden).

## Review Focus

Spec'in ima ettiği ama görev testlerinin doğal olarak yakalamayacağı, bir kullanıcıyı en çok vuracak durumlar (her biri sahibi görevde testle sabitlenir):

1. **Oyun adı/yolu:** `CON`, `a/b:c`, boş ad, çok uzun ad, aynı ad iki kez, Türkçe harfler → güvenli, benzersiz klasör (Görev 6).
2. **Model çıktısı çöp/yarım:** HTML'siz, `</html>`'siz (kesik) ya da bozuk cevap → çalışan oyun asla ezilmez (Görev 7, 11).
3. **Ollama akış ortasında kesilirse/kapanırsa:** çökme yok, anlaşılır hata, yarım cevap oyun sayılmaz (Görev 2).
4. **Rapor sunucusu:** yol gezinmesi (`..%2f`), yanlış jeton, çok büyük gövde → reddedilir, oyun klasörü dışına çıkılmaz (Görev 9).
5. **İndirme iptal/disk dolu:** yarım dosya bırakılmaz, tekrar denenebilir (Görev 4).

---

## File Structure

```
pyproject.toml, requirements.txt, requirements-tools.txt, launcher.py, K-MiniGames.spec, README.md
src/k_minigames/
  __init__.py (__version__)  __main__.py  settings.py  i18n.py
  ollama_client.py  hardware.py  catalog.py  data/models.json  model_check.py
  installer.py  advisor.py  library.py  generator.py  htmlscan.py
  report_server.py  harness.py  testlist.py  checker.py  studio.py  mascot.py
  ui/ worker.py  stage.py  app.py  setup_screen.py  advisor_flow.py  advisor_screen.py
      library_screen.py  studio_screen.py
  assets/ui/ (mevcut kaynak görseller)   assets/runtime/ (sabit boyutlu çalışma görselleri)
tools/ remove_checkerboard.py  build_mascot.py  prepare_assets.py  make_version.py
tests/ conftest.py + her modül için test_*.py
```

---

### Task 1: İskelet, ayarlar, dil

**Files:** Create `pyproject.toml`, `requirements.txt`, `requirements-tools.txt`, `src/k_minigames/__init__.py`, `settings.py`, `i18n.py`, `tests/conftest.py`, `tests/test_settings.py`, `tests/test_i18n.py`

**Interfaces — Produces:**
- `settings.app_dir() -> Path`; `load() -> dict`; `save(data: dict) -> bool` (geçici dosya + `os.replace`); `get(key: str, default=None)`; `put(key: str, value) -> bool`
- `settings.games_dir() -> Path | None` (ayarlı ve klasör hâlâ varsa); `set_games_dir(path: Path) -> bool`; `register_exe(exe: Path) -> bool` (`exe_path` yazar)
- `i18n.t(text: str) -> str`; `follow() -> bool`; `current() -> str`; `set_language(code: str) -> None`; `saved_language() -> str`

- [ ] **Step 1: Testleri yaz.** `test_settings.py`: bozuk JSON → `load() == {}`; Türkçe karakterli değerin `save`/`load` gidiş-dönüşü; `games_dir()` ayarsızken `None`, ayarlıyken klasör silinince `None`; `register_exe` sonrası `get("exe_path")` verilen yol. `test_i18n.py`: `set_language("en")` ile `t("Oyun klasörü") == "Games folder"`; `"tr"` ile metin aynı; bilinmeyen dil kodu `"tr"` olur; `follow()` K-Series ayar dosyasında `language: "en"` yazılınca `True` döndürür ve `current() == "en"`. `conftest.py`: `LOCALAPPDATA`/`APPDATA`'yı `tmp_path`'e yönlendiren autouse fixture; `urllib.request.urlopen`'ı `URLError` fırlatan autouse fixture.
- [ ] **Step 2: Çalıştır, başarısız olduğunu gör** — `python -m pytest tests/test_settings.py tests/test_i18n.py -q` → `ModuleNotFoundError: k_minigames`.
- [ ] **Step 3: Uygula.** `pyproject.toml`: ad `k-minigames`, sürüm `0.1.0`, `requires-python >=3.11`, `dependencies = []`, `pythonpath = ["src"]`, `testpaths = ["tests"]`, `package-data k_minigames = ["data/*.json"]` (K-Optimizer'ın `pyproject.toml`'u gibi). `i18n.py`, `k_optimizer/i18n.py`'nin yapısını izler (`_PAIRS`, uzundan kısaya birleşik regex; yalnızca K-MiniGames metinleri). `settings_path()` K-Series dosyasını okur.
- [ ] **Step 4: Çalıştır, geçtiğini gör** — iki test dosyası geçer.
- [ ] **Step 5: CS** — dosyalar: yukarıdaki tümü.

### Task 2: `ollama_client`

**Files:** Create `src/k_minigames/ollama_client.py`, `tests/test_ollama_client.py`

**Interfaces — Produces:**
```python
class OllamaError(Exception): ...
NUM_CTX = 8192
class OllamaClient:
    def __init__(self, base: str = "http://127.0.0.1:11434", opener=urllib.request.urlopen): ...
    def is_running(self) -> bool
    def models(self) -> list[str]                      # GET /api/tags; OllamaError if unreachable
    def chat(self, model: str, messages: list[dict], on_token: Callable[[str], None] | None = None,
             cancel: Callable[[], bool] | None = None) -> str   # POST /api/chat, stream NDJSON
    def pull(self, model: str, on_progress: Callable[[str, int, int], None],
             cancel: Callable[[], bool] | None = None) -> bool   # POST /api/pull
```

- [ ] **Step 1: Testler** (sahte `opener`, NDJSON satırları döndürür): `is_running()` `URLError`'da `False`; `models()` `{"models":[{"name":"a:1"}]}` → `["a:1"]`; `chat` parçaları birleştirir ve her parça için `on_token` çağrılır; istek gövdesinde `options["num_ctx"] == 8192` ve `stream is True`; **akış `done:true` olmadan biterse `OllamaError`** (Review Focus 3); boş cevap → `OllamaError`; `cancel()` `True` olunca `OllamaError("cancelled")`; `pull` ilerlemeyi `(status, completed, total)` ile bildirir, `{"status":"success"}` ile `True`, `{"error":"..."}` ile `False`, bağlantı kopunca `False` (çökmez).
- [ ] **Step 2: Çalıştır, başarısız olsun.**
- [ ] **Step 3: Uygula** yukarıdaki imzalarla; satır satır `readline` ile akış okur; her `URLError`/`OSError`/`ValueError` `OllamaError` ya da `False`'a çevrilir.
- [ ] **Step 4: Çalıştır, geçsin.** **Step 5: CS.**

### Task 3: Donanım, katalog, model önerisi doğrulama

**Files:** Create `src/k_minigames/hardware.py`, `catalog.py`, `data/models.json`, `model_check.py`, `tests/test_model_check.py`, `tests/test_hardware.py`

**Interfaces — Produces:**
```python
hardware.ram_gb() -> float            # ctypes GlobalMemoryStatusEx
hardware.vram_gb() -> float | None    # nvidia-smi --query-gpu=memory.total; yoksa None
@dataclass(frozen=True) class ModelInfo: id: str; size_gb: float; min_ram_gb: float
catalog.advisor() -> ModelInfo; catalog.coders() -> list[ModelInfo]   # boyuta göre artan
@dataclass(frozen=True) class Recommendation: model: ModelInfo; substituted: bool; fits: bool; reason: str
model_check.recommend(proposed: str | None, ram_gb: float, vram_gb: float | None) -> Recommendation
```
`data/models.json` (geçici değerler, Adım 5'te elle doğrulanır): `advisor` = `qwen2.5:3b` (1.9 GB, min RAM 6); `coders` = `qwen2.5-coder:1.5b` (1.0, 4), `:3b` (1.9, 6), `:7b` (4.7, 10), `:14b` (9.0, 18), `:32b` (20.0, 36).

- [ ] **Step 1: Testler.** Sığma kuralı: `ram_gb >= min_ram_gb` **ya da** `vram_gb >= size_gb * 1.2`. `recommend("qwen2.5-coder:7b", 16, None)` → aynı model, `substituted=False`; `recommend("qwen2.5-coder:32b", 16, None)` → `:14b`'ye düşer (`substituted=True`, sebep "sığmıyor"); `recommend("uydurma-model:9b", 16, None)` → sığan en büyük `coder`, `reason` "katalogda yok"; `recommend(None, 3, None)` → en küçük `coder`, `fits=False`; `recommend("  Qwen2.5-Coder:7B ", ...)` büyük/küçük harf ve boşlukları yok sayar; `vram_gb=12` ve `ram_gb=4` → `:7b` sığar (`12 >= 4.7*1.2`). `test_hardware.py`: `ram_gb() > 0`; `vram_gb()` `nvidia-smi` bulunamazsa (monkeypatch `subprocess.run` → `FileNotFoundError`) `None`.
- [ ] **Step 2: Çalıştır, başarısız olsun.** **Step 3: Uygula.** **Step 4: Geçsin.**
- [ ] **Step 5: Elle doğrulama (Spec açık noktası):** Ollama kuruluysa `ollama pull qwen2.5:3b` ve Türkçe bir örnek ("uzayda geçen bir oyun istiyorum") gönder; Türkçe anlaşılır cevap vermiyorsa `models.json` içindeki `advisor.id`'yi `llama3.2:3b` yap ve `docs/HAFIZA.md`'ye kararı yaz. Ollama yoksa bu adım "doğrulanamadı" diye `HAFIZA.md`'ye not edilir. **CS.**

### Task 4: `installer`

**Files:** Create `src/k_minigames/installer.py`, `tests/test_installer.py`

**Interfaces — Consumes:** `OllamaClient.is_running()`. **Produces:**
```python
OLLAMA_URL = "https://ollama.com/download/OllamaSetup.exe"
def ollama_exe() -> Path | None                       # %LOCALAPPDATA%\Programs\Ollama\ollama.exe, yoksa shutil.which
def download_size(url: str = OLLAMA_URL, opener=urlopen) -> int | None   # HEAD Content-Length
def download(url: str, dest: Path, on_progress: Callable[[int, int | None], None],
             cancel: Callable[[], bool] | None = None, opener=urlopen) -> bool
def run_setup(setup: Path, popen=subprocess.Popen) -> bool
def start_server(exe: Path, popen=subprocess.Popen) -> bool     # `ollama serve`, gizli pencere
def wait_until_running(client, timeout_s: float = 60, sleep=time.sleep, clock=time.monotonic) -> bool
```

- [ ] **Step 1: Testler.** `download` içeriği `dest`'e yazar ve ilerlemeyi bildirir; **`cancel()` `True` olunca `False` döner, ne `dest` ne `dest.part` kalır** (Review Focus 5); yazma sırasında `OSError` (sahte opener ortasında ya da hedef klasör yok) → `False`, `.part` kalmaz; `download_size` hatada `None`; `ollama_exe` `LOCALAPPDATA` altında sahte dosyayı bulur; `start_server` komutu `[exe, "serve"]` ve `CREATE_NO_WINDOW` bayrağıyla çağırır; `wait_until_running` sahte saatle: ikinci yoklamada çalışıyorsa `True`, süre dolarsa `False`.
- [ ] **Step 2: Başarısız. Step 3: Uygula** (`.part` dosyasına yazıp `os.replace`; her çıkış yolunda `.part` temizlenir). **Step 4: Geçsin. Step 5: CS.**

### Task 5: `advisor`

**Files:** Create `src/k_minigames/advisor.py`, `tests/test_advisor.py`

**Interfaces — Consumes:** `OllamaClient.chat`, `catalog.coders()`. **Produces:**
```python
def system_prompt() -> str            # Türkçe; katalogdaki tüm coder kimliklerini içerir
@dataclass(frozen=True) class AdvisorReply: text: str; proposal: str | None   # text: JSON satırı çıkarılmış
def extract_proposal(text: str) -> str | None
class Advisor:
    def __init__(self, client, model: str): ...
    def ask(self, history: list[dict], user_text: str, on_token=None, cancel=None) -> AdvisorReply
```
Prompt sözleşmesi: danışman, oyunu anlayınca cevabın son satırına `{"model": "<katalogdaki kimlik>"}` yazar.

- [ ] **Step 1: Testler.** `extract_proposal`: düz JSON satırı, kod çiti içinde, Türkçe metnin içinde, birden çok JSON varsa sonuncusu, bozuk JSON → `None`, `model` anahtarı yoksa `None`. `ask`: `client.chat` çağrısındaki mesajlar `[system] + history + [user]` sırasında; dönen `text` JSON satırını içermez; `system_prompt()` her coder kimliğini içerir (`for m in catalog.coders(): assert m.id in prompt`).
- [ ] **Step 2–4:** başarısız → uygula → geçsin. **Step 5: CS.**

### Task 6: `library`

**Files:** Create `src/k_minigames/library.py`, `tests/test_library.py`

**Interfaces — Produces:**
```python
@dataclass(frozen=True) class Game: name: str; folder: Path   # html_path, launcher_path, assets_dir, versions_dir, tests_path özellikleri
@dataclass(frozen=True) class Texture: file: str; description: str; width: int; height: int   # .url -> "assets/" + quote(file)
def safe_folder_name(name: str) -> str
def can_write(games_dir: Path, min_free_mb: int = 50) -> bool
def create_game(games_dir: Path, name: str) -> Game
def list_games(games_dir: Path) -> list[Game]                 # yalnızca oyun.html olan klasörler, ada göre
def save_version(game: Game, html: str) -> int                # önceki oyun.html -> surumler/oyun-NNN.html; baslat.bat yazar; arşivlenen sürüm sayısı
def versions(game: Game) -> list[int]
def restore_version(game: Game, n: int) -> bool               # güncel sürüm önce arşivlenir
def add_texture(game: Game, src: Path, description: str) -> Texture   # ValueError: resim uzantısı değil
def textures(game: Game) -> list[Texture]                     # game.json
```
`baslat.bat` içeriği tam olarak: `@echo off\r\nstart "" "%~dp0oyun.html"\r\n`. Resim uzantıları: `.png .jpg .jpeg .gif .webp .bmp`; boyut yalnızca PNG başlığından okunur (diğerleri 0x0).

- [ ] **Step 1: Testler** (Review Focus 1): `safe_folder_name("CON") == "_CON"`, `("a/b:c") == "abc"`, `("") == "Oyun"`, `("...") == "Oyun"`, 100 karakterlik ad 60'a kısalır, `"Çöl Koşusu"` aynen kalır; aynı ad iki kez `create_game` → `"Ad"` ve `"Ad (2)"`; `save_version` iki kez: `surumler/oyun-001.html` ilk içeriği taşır, `baslat.bat` tam içerikle yazılmış; `restore_version(game, 1)` sonrası `versions()` bir artar (hiçbir sürüm kaybolmaz); `add_texture` aynı dosya adını iki kez → `zemin.png`, `zemin-2.png`; boşluklu ad için `.url == "assets/zemin%20bir.png"`; resim olmayan uzantı → `ValueError` ve `assets/` içine hiçbir şey kopyalanmaz; `list_games` `oyun.html`'siz klasörü atlar; `can_write` olmayan klasör/dosya yolu/`shutil.disk_usage` düşük (monkeypatch) için `False`.
- [ ] **Step 2–4:** başarısız → uygula (tüm yazmalar geçici dosya + `os.replace`) → geçsin. **Step 5: CS.**

### Task 7: `generator`

**Files:** Create `src/k_minigames/generator.py`, `tests/test_generator.py`

**Interfaces — Consumes:** `OllamaClient.chat`, `library.Texture`. **Produces:**
```python
class GenerationError(Exception): ...
@dataclass(frozen=True) class Generated: html: str; checklist: list[str]
def build_create_messages(description: str, textures: list[Texture]) -> list[dict]
def build_edit_messages(html: str, request: str, textures: list[Texture], checklist: list[str]) -> list[dict]
def build_fix_messages(html: str, problems: list[str]) -> list[dict]
def build_test_messages(html: str, checklist: list[str]) -> list[dict]
def parse_response(text: str) -> Generated | None      # tam HTML belgesi şart; checklist: ```json {"checklist": [...]} bloğundan
def parse_tests(text: str, n: int) -> list[str | None]  # {"tests":[{"index":0,"code":"..."}]}; eksik indeks None
class Generator:
    def __init__(self, client, model: str): ...
    def create(self, description, textures, on_token=None, cancel=None) -> Generated
    def edit(self, html, request, textures, checklist, on_token=None, cancel=None) -> Generated
    def fix(self, html, problems: list[str], on_token=None, cancel=None) -> Generated
    def write_tests(self, html, checklist, cancel=None) -> list[str | None]
```
Sistem isteminde şu ifadeler bulunur (testler bunları denetler): `window.__game`, `assets/<dosya>` + boyut + açıklama, `getImageData`'yı kullanma, dış ağ adresi (`http://`, `https://`) kullanma, tek dosya `oyun.html`.

- [ ] **Step 1: Testler.** Create isteminde her dokunun adı, boyutu ve açıklaması geçer; edit isteminde güncel HTML ve kullanıcı isteği geçer; `parse_response`: ```html çitli, çitsiz `<!doctype html>…</html>`, birden çok blok (sonuncu tam olan), **`</html>`'siz kesik cevap → `None`**, HTML'siz metin → `None` (Review Focus 2); checklist ayrıştırması; `Generator.create` ayrıştırma `None` ise `GenerationError` fırlatır ve **asla kısmi HTML döndürmez**; `parse_tests` eksik indeksleri `None` yapar.
- [ ] **Step 2–4:** başarısız → uygula → geçsin. **Step 5: CS.**

### Task 8: `htmlscan`

**Files:** Create `src/k_minigames/htmlscan.py`, `tests/test_htmlscan.py`

**Interfaces — Produces:**
```python
@dataclass(frozen=True) class Problem: kind: str; detail: str; severity: str   # severity: "error" | "warning"
    def as_text(self) -> str                                                  # modele verilecek Türkçe cümle
def scan(html: str, asset_files: list[str]) -> list[Problem]
```
Türler: `missing_asset` (error), `external_url` (warning), `no_game_state` (error).

- [ ] **Step 1: Testler.** `assets/zemin.png` başvurusu, dosya `assets_files`'ta yoksa `missing_asset`; tırnak çeşitleri (`src="…"`, `'…'`, `url(…)`, JS dizgesi); büyük/küçük harf ve `%20` kodlu ad eşleşir; aynı eksik dosya bir kez raporlanır; `http://www.w3.org/` ad alanı `external_url` sayılmaz, `https://cdn.example.com/x.js` sayılır; `window.__game` yoksa `no_game_state`; temiz HTML için boş liste.
- [ ] **Step 2–4:** başarısız → uygula → geçsin. **Step 5: CS.**

### Task 9: `report_server` ve `harness`

**Files:** Create `src/k_minigames/report_server.py`, `harness.py`, `tools/smoke_harness.py`, `tests/test_report_server.py`, `tests/test_harness.py`

**Interfaces — Produces:**
```python
class ReportServer:
    def __init__(self, game_dir: Path | None = None): ...
    def start(self) -> None; def stop(self) -> None
    port: int; token: str                      # secrets.token_urlsafe(16)
    def page_url(self) -> str                  # http://127.0.0.1:{port}/play/{token}/oyun.html
    def set_page(self, html: str) -> None      # bellekten sunulur
    def events(self) -> list[dict]
    def wait_for(self, kind: str, timeout_s: float) -> dict | None
@dataclass(frozen=True) class TestSpec: id: str; code: str   # code: "async (game) => boolean" gövdesi
harness.inject(html: str, report_url: str, tests: list[TestSpec]) -> str
```
Yollar: `GET /play/<token>/oyun.html`, `GET /play/<token>/assets/<dosya>` (`game_dir/assets` içinden), `POST /report/<token>` (JSON olay). Olay türleri: `error`, `console_error`, `asset_error`, `test` (`id`, `passed`, `vacuous`, `error`), `done`. Gövde sınırı 64 KB; yanlış jeton 403; bilinmeyen yol 404; fazla büyük gövde 413.

- [ ] **Step 1: Testler** (Review Focus 4; sunucuya gerçek `urllib` isteği): doğru jetonla sayfa ve `assets/` dosyası gelir; `/play/<token>/assets/..%2f..%2fsecret.txt` → 404 ve dosya içeriği sızmaz; yanlış jeton 403; `POST` olay `events()`'e düşer, `wait_for("done", 1)` döner; 64 KB üstü gövde 413; `server.server_address[0] == "127.0.0.1"`; iki sunucu farklı port alır. `inject`: betik tam bir kez eklenir (iki kez çağırmak çoğaltmaz); `<head>`'siz HTML'de de eklenir; test kodundaki `</script>` kaçışlanır (`<\/script>`); betik `window.onerror`, `unhandledrejection`, `console.error`, yakalama aşamasında `error` (resim hataları), her test için önce boş `{}` durumuna karşı çalıştırma (geçerse `vacuous: true`), sonra `window.__game`'e karşı, en sonda `done` yollar; sayfada "Oyun deneniyor, sekmeyi kapatma" afişi, bitince "Test bitti, kapatabilirsin".
- [ ] **Step 2–4:** başarısız → uygula → geçsin.
- [ ] **Step 5: Elle doğrulama (JS pytest'te çalışmaz):** `python tools/smoke_harness.py` küçük bir oyunu (bilerek hatalı bir satır ve geçen bir testle) sunucuyla varsayılan tarayıcıda açar; beklenen çıktı: yazdırılan olaylarda en az bir `error`, bir `test` (`passed: true`) ve `done`. **CS.**

### Task 10: `testlist` ve `checker`

**Files:** Create `src/k_minigames/testlist.py`, `checker.py`, `tests/test_testlist.py`, `tests/test_checker.py`

**Interfaces — Consumes:** `Game`, `Problem`, `htmlscan.scan`, `ReportServer`, `harness.inject`. **Produces:**
```python
PENDING, PASSED, FAILED, UNVERIFIED = "pending", "passed", "failed", "unverified"
@dataclass class TestItem: id: str; text: str; code: str | None; status: str = PENDING; note: str = ""
testlist.load(game) -> list[TestItem]; save(game, items) -> None            # testler.json (UTF-8)
testlist.merge_checklist(items, checklist: list[str]) -> list[TestItem]      # yeni metinler "t1","t2"… kimlikle eklenir; eskiler korunur
testlist.apply_results(items, events: list[dict]) -> list[TestItem]
testlist.summary(items) -> dict[str, int]
@dataclass class CheckReport: problems: list[Problem]; items: list[TestItem]; js_errors: list[str]; finished: bool
checker.run_once(game, html, items, server, open_url=webbrowser.open, timeout_s: float = 20) -> CheckReport
```
Eşleme: `passed` → `PASSED`; `vacuous` → `UNVERIFIED` (not: "boş durumda da geçti"); `passed:false` ya da test hatası → `FAILED`; `code is None` → `UNVERIFIED`; `done` gelmeden zaman aşımı → `finished=False` ve sonuçsuz maddeler `UNVERIFIED` (not: "zaman aşımı").

- [ ] **Step 1: Testler** (sahte sunucu hazır olayları döndürür, `open_url` çağrıyı kaydeder): `testler.json` Türkçe metinle gidiş-dönüş; `merge_checklist` eski durumları korur ve aynı metni ikinci kez eklemez; `apply_results` yukarıdaki eşlemenin her satırı için; `summary` sayıları; `run_once` önce `htmlscan` problemlerini toplar, `server.set_page` enjekte edilmiş HTML ile çağrılır, `open_url` sunucunun `page_url()`'ü ile çağrılır, `error`/`asset_error` olayları `js_errors`'a girer.
- [ ] **Step 2–4:** başarısız → uygula → geçsin. **Step 5: CS.**

### Task 11: Onarım döngüsü ve üretim hattı (`studio`)

**Files:** Create `src/k_minigames/studio.py`, `tests/test_studio.py`

**Interfaces — Consumes:** `Generator`, `checker.run_once`, `testlist`, `library`. **Produces:**
```python
MAX_ATTEMPTS = 3
@dataclass(frozen=True) class Outcome: html: str; report: CheckReport; attempts: int; saved: bool; rejected: bool
def repair_loop(generator, game, html, items, server, open_url, on_status: Callable[[str], None], cancel=None) -> tuple[str, CheckReport, int]
def create_game_flow(generator, game, description, textures, server, open_url, on_status, cancel=None) -> Outcome
def edit_game_flow(generator, game, request, textures, server, open_url, on_status, cancel=None) -> Outcome
```
Kurallar: puan = hata düzeyi problem + `js_errors` + `FAILED` madde sayısı (uyarılar sayılmaz). Döngü: `run_once`; puan 0 ise biter; değilse `generator.fix(html, problem_metinleri)`; en fazla `MAX_ATTEMPTS` düzeltme; **son sürüm değil en düşük puanlı sürüm** tutulur; `GenerationError` döngüyü bitirir (en iyi sürüm kalır); döngü sonunda hâlâ `FAILED` olan maddeler `UNVERIFIED` olur (not: "otomatik düzeltilemedi"). `create_game_flow` en iyi sürümü her durumda `save_version` ile kaydeder. `edit_game_flow` yeni sürümü yalnızca sonuçta hata düzeyi problem ve `js_errors` yoksa kaydeder; aksi halde `rejected=True`, `oyun.html` **bayt bayt aynı** kalır. Düzenlemede önceden `PASSED` olan madde bozulursa fix isteminde "Daha önce geçen madde bozuldu: …" cümlesi yer alır.

- [ ] **Step 1: Testler** (sahte `Generator` senaryolu çıktı verir, sahte sunucu/`run_once`): temiz sürümde `attempts == 0`; her zaman hatalı sürümde tam 3 `fix` çağrısı; ikinci denemenin puanı üçüncüden iyiyse ikincisi döner (Review Focus 2); `GenerationError` döngüyü durdurur, en iyi sürüm döner; `cancel()` döngüyü keser; `edit_game_flow` bozuk düzenlemeyi reddeder ve `oyun.html` baytları değişmez; düzenleme `PASSED` bir maddeyi bozarsa fix istemi o cümleyi içerir; `create_game_flow` sonunda `library.versions` ve `testler.json` güncel.
- [ ] **Step 2–4:** başarısız → uygula → geçsin. **Step 5: CS.**

### Task 12: Maskot mantığı, çalışma görselleri, `Stage`

**Files:** Create `src/k_minigames/mascot.py`, `ui/stage.py`, `tools/prepare_assets.py`, `assets/runtime/*`, `tests/test_mascot.py`, `tests/test_stage.py`

**Interfaces — Produces:**
```python
mascot.frame(character: str, state: str, tick: int = 0) -> str       # character: "advisor" | "bear"; "danisman/bosta" gibi görsel adı (uzantısız)
# durumlar: idle, listening, greeting, farewell, talking, thinking, testing, fixed, success, error, unsure, proposal
class Stage(tk.Canvas):                                               # 1024x572
    def __init__(self, master): ...
    def set_scene(self, name: str) -> None                            # "danisman" | "lobi"
    def set_character(self, character: str, state: str, tick: int = 0) -> None
    def say(self, speaker: str, text: str) -> None                    # speaker: "DANIŞMAN" | "SEN" (t() ile)
    def ask(self, on_submit: Callable[[str], None]) -> None; def stop_asking(self) -> None
```
Eşleme `docs/ui-varliklari.md` tablolarındadır (danışman: bosta, karsilama, veda, dinliyor, yaziyor, oneri, emin_degil, konusuyor_a/b; ayı: bosta, dinliyor, selamlama, veda, konusuyor_a/b, dusunuyor, test_ediyor, anladim, basari, hata, emin_degil). `talking` karesi `tick`'e göre `bosta → konusuyor_a → konusuyor_b → konusuyor_a` döngüsünde. `tools/prepare_assets.py` (Pillow): `lobi.png` → 1024x572; ayı kareleri 0.75 ölçekle (LANCZOS, `RGBa` üzerinden); danışman sahnesi ve karelerini, `diyalog.png`'yi `assets/runtime/`'a yazar. Çalışma zamanında Pillow yoktur: Tk `PhotoImage` yalnızca tam sayı ölçekler, bu yüzden boyutlar önceden hazırlanır.

- [ ] **Step 1: Testler.** `frame()` döndürdüğü her ad için `assets/runtime/<ad>.png` vardır (yazım hatalarına karşı, iki karakter × tüm durumlar); `talking` döngüsü üç farklı kare üretir; bilinmeyen durum `idle` verir; `assets/runtime/lobi.png` 1024x572; Tk açılabiliyorsa (`pytest.importorskip` + `Tk()` hatasında skip) `Stage` oluşturulur, `say("DANIŞMAN", "Merhaba")` canvas'ta o metni içeren bir öğe bırakır.
- [ ] **Step 2: Başarısız. Step 3: Uygula** (`prepare_assets.py`'yi çalıştırıp çıktıyı commit'e ekle). **Step 4: Geçsin.**
- [ ] **Step 5: Elle ayar:** `Stage`'i tek başına açan küçük bir betikle danışman karakterinin masaya, ayının zemine oturduğu konum sabitlerini (`ADVISOR_ANCHOR`, `BEAR_FEET`) ekran görüntüsüyle ayarla (öneri: ayı ayakları y≈352, x=512; danışman karesinin altı masa üstü ≈ y 330); `ui-varliklari.md` "Birleştirirken karar" maddelerini (ayıyı lobi tonuna koyulaştırma, diyalog yüksekliği) burada karara bağla. **CS.**

### Task 13: Uygulama kabuğu, `Worker`, başlangıç ekranı

**Files:** Create `src/k_minigames/ui/worker.py`, `ui/app.py`, `ui/setup_screen.py`, `__main__.py`, `tests/test_worker.py`, `tests/test_startup.py`

**Interfaces — Produces:**
```python
class CancelToken: def cancel(self) -> None; def __call__(self) -> bool
class Worker:
    def __init__(self, schedule: Callable[[int, Callable], object]): ...      # Tk için root.after
    def run(self, fn: Callable[[], object], on_done: Callable[[object], None],
            on_error: Callable[[Exception], None] | None = None) -> None
def startup_state(client, advisor_id: str, game_model: str | None) -> str      # "setup" | "advisor" | "library"
@dataclass(frozen=True) class SetupButtons: ollama: str; advisor: str   # "download" | "disabled" | "done"
def setup_buttons(ollama_installed: bool, ollama_running: bool, advisor_installed: bool) -> SetupButtons
```
Kurallar: Ollama kurulu değil / çalışmıyor (kuruluysa `start_server` denenir) / danışman modeli kurulu değil → `"setup"`; oyun modeli seçili değil ya da kurulu değil → `"advisor"`; aksi `"library"`. `setup_buttons`: Ollama yokken Ollama düğmesi `download`, danışman `disabled`; Ollama çalışırken ve danışman yokken ikisi sırasıyla `done`/`download`. Başlangıç ekranı: iki ayrı düğme ("Ollama'yı indir (yaklaşık X GB)", "Danışmanı indir (yaklaşık Y GB)"; Ollama boyutu `installer.download_size()`, alınamazsa katalogdan), tıklayınca adres ve boyutu gösteren onay penceresi (`messagebox.askyesno`), ilerleme çubuğu, "İptal", hata/iptalde "Tekrar dene"; oyun klasörü seçici (`filedialog.askdirectory` → `settings.set_games_dir`, `library.can_write` denetimi). `__main__.py` pencereyi açar, `settings.register_exe(Path(sys.executable))` yalnızca `sys.frozen` iken.

- [ ] **Step 1: Testler.** `Worker`: sahte `schedule` ile `fn` sonucu `on_done`'a, istisna `on_error`'a gider; `CancelToken` iptal sonrası `True`; `startup_state` tablosu (sahte `client` ile): Ollama çalışmıyor → `setup`; Ollama çalışıyor, danışman yok → `setup`; danışman var, `game_model=None` → `advisor`; `game_model` ayarlı ama `client.models()`'te yok → `advisor`; hepsi tamam → `library`; `setup_buttons` üç durum.
- [ ] **Step 2–4:** başarısız → uygula → geçsin.
- [ ] **Step 5: Elle doğrulama:** `python -m k_minigames` ile başlangıç ekranını aç, ekran görüntüsü al (`run` yeteneği); beklenen: iki düğme ve boyut bilgisi, Ollama yokken danışman düğmesi pasif. Gerçek indirme **tıklanmaz** (onay penceresinde "Hayır"). **CS.**

### Task 14: Danışman ekranı

**Files:** Create `src/k_minigames/ui/advisor_flow.py`, `ui/advisor_screen.py`, `tests/test_advisor_flow.py`

**Interfaces — Consumes:** `Advisor`, `model_check.recommend`, `hardware`, `OllamaClient.pull`, `Stage`. **Produces:**
```python
class AdvisorFlow:                                   # saf mantık (arayüzsüz)
    def __init__(self, advisor, client, ram_gb: float, vram_gb: float | None): ...
    state: str     # "chatting" | "awaiting_consent" | "installing" | "done" | "error"
    history: list[dict]; recommendation: Recommendation | None
    def user_says(self, text: str) -> AdvisorReply
    def decline(self) -> None                        # "chatting"e döner
    def accept(self, on_progress, cancel=None) -> bool   # pull; başarıda settings.put("game_model", id), state "done"
```
Ekran: danışman sahnesi; açılışta `greeting`, danışman yazarken `talking` (daktilo etkisi, 30 ms/karakter, her 3 karakterde `tick`), sıra kullanıcıdayken `listening` ve etiket `SEN`, öneri geldiğinde `proposal` ve "Yükle (yaklaşık X GB) / Başka öneri" düğmeleri; `Recommendation.substituted` ise sebep gösterilir, `fits=False` ise uyarı; indirme hatasında `error`; bitişte `farewell` ve kütüphaneye geçiş.

- [ ] **Step 1: Testler** (`AdvisorFlow`, sahte `Advisor`/`client`): öneri gelince `state == "awaiting_consent"` ve `recommendation` `model_check.recommend` sonucudur; `decline()` sohbete döner ve geçmiş korunur; `accept()` başarıda `settings.get("game_model")` önerilen kimlik, `False` dönerse `state == "error"` ve `game_model` değişmez; geçersiz öneri katalogdaki alternatifle değiştirilir (`substituted`).
- [ ] **Step 2–4:** başarısız → uygula → geçsin.
- [ ] **Step 5: Elle doğrulama:** ekran görüntüsüyle danışman sahnesi, `DANIŞMAN`/`SEN` etiketi, diyalog yazısının okunabilirliği (siyah zemin üstünde açık renk). **CS.**

### Task 15: Kütüphane ve stüdyo ekranları

**Files:** Create `src/k_minigames/ui/library_screen.py`, `ui/studio_screen.py`, `tests/test_studio_view.py`

**Interfaces — Consumes:** `library`, `studio`, `Stage`, `Worker`. **Produces:**
```python
def summary_lines(report: CheckReport, attempts: int, rejected: bool) -> list[str]
```
`summary_lines` tam metinleri: `"{n} madde geçti"`, `"{n} madde doğrulanamadı"`, `"{n} madde kaldı"` (yalnızca sıfırdan büyükse), ek olarak `attempts > 0` ise `"{attempts} kez otomatik düzelttim"`, `rejected` ise `"Bu düzenleme çalışmadı; oyunun önceki hâli korundu."`.
Kütüphane ekranı: oyun listesi (ad, "Aç" → `os.startfile(baslat.bat)`, "Düzenle", "Klasörü aç"), "Yeni oyun". Stüdyo ekranı (lobi + ayı): oyun adı ve tarif alanları; doku ekleme (`filedialog.askopenfilenames` → her biri için açıklama sorusu → `add_texture`); "Üret"; ayı durumları: `thinking` (üretim), `testing` + "Oyun deneniyor, sekmeyi kapatma" (deneme), `fixed` ("Hata buldum, düzeltiyorum (k/3)"), bitişte `success` ya da `error`/`unsure` ve `summary_lines`; düzenleme kipi: istek alanı, sürüm listesi + "Bu sürüme dön" (`restore_version`). Üretimden önce `library.can_write` ve `client.is_running()` denetlenir; Ollama kapalıysa `error` karesi ve anlaşılır mesaj, oyun klasörüne dokunulmaz.

- [ ] **Step 1: Testler.** `summary_lines` için üç kombinasyon (hepsi geçti; 4 geçti + 1 doğrulanamadı + 2 deneme; reddedilen düzenleme) tam metinlerle.
- [ ] **Step 2–4:** başarısız → uygula → geçsin.
- [ ] **Step 5: Elle uçtan uca (gerçek Ollama gerekir):** küçük bir tarifle ("tek tuşla zıplayan kare, engellerden kaç") oyun üret; beklenen: oyun kütüphanede görünür, `baslat.bat` oyunu varsayılan tarayıcıda açar, `testler.json` oluşur, ardından "topu hızlandır" türü bir düzenleme `surumler\oyun-001.html` bırakır. Test sekmesinin deneyimini (açık sekme, kapatma uyarısı) `HAFIZA.md`'ye değerlendir (Spec açık noktası). Ollama yoksa bu adım "doğrulanamadı" diye `HAFIZA.md`'ye yazılır. **CS.**

### Task 16: Paketleme

**Files:** Create `launcher.py`, `K-MiniGames.spec`, `tools/make_version.py`, `README.md`, `tests/test_version_file.py`

- [ ] **Step 1: Test.** `tools/make_version.py` (K-Optimizer'daki aynı adlı aracın uyarlaması: ürün adı `K-MiniGames`, `__version__`'dan sürüm dosyası üretir) çıktısı sürümü ve `K-MiniGames.exe` adını içerir; `test_version_file.py` K-Optimizer'daki testle aynı biçimde.
- [ ] **Step 2: Başarısız. Step 3: Uygula.** `K-MiniGames.spec`: tek dosya, pencereli (konsolsuz), `assets/runtime` ve `data/models.json` `datas`'a, sürüm dosyası bağlı. `launcher.py`: `k_minigames.__main__`'i çağırır.
- [ ] **Step 4: Geçsin ve derle:** `pyinstaller K-MiniGames.spec` → `dist\K-MiniGames.exe` oluşur; çalıştırınca pencere açılır ve `%LOCALAPPDATA%\K-MiniGames\settings.json` içinde `exe_path` yazılıdır. **Step 5: CS.**
- Kapsam dışı (kullanıcı ayrıca yetkilendirmeden yapılmaz): GitHub sürümü/CI iş akışı ve itch.io zip'i.

### Task 17: K-Series entegrasyonu (K-Optimizer deposu)

**Files:** Modify `K-Optimizer/src/k_series/products.py`, `src/k_series/app.py`, `tests/conftest.py`, `tests/test_products.py`, `tests/test_kseries_app.py`; kod `K-Optimizer` deposunda, ayrı commit'lerle.

**Interfaces — Produces:** `Product(id="k-minigames", name="K-MiniGames", tagline="Yerel yapay zekayla kendi oyununu yap", …)`; `products.find_minigames(saved: Path | None = None, scan_roots=None, extra_dirs=()) -> Path | None` (öncelik: K-MiniGames'in kendi `%LOCALAPPDATA%\K-MiniGames\settings.json` içindeki `exe_path`, `saved`, `%LOCALAPPDATA%\Programs\K-MiniGames`, Program Files, `extra_dirs`, `klauncher.scan_for_exe(..., name="K-MiniGames.exe")`); `products.detect(..., saved_minigames: Path | None = None)` artık üç ürün döndürür.

- [ ] **Step 1: Önce oku:** `klauncher.running_optimizer_exes` ve `app.py`'deki `_PRODUCTS`, `_NAMES`, `_LOGO_SETS`, `_EXE`, `_SAVED_KEY` ve Ana Sayfa kartlarının çizildiği yer; aynı kalıpla `klauncher.running_minigames_exes()` ve `k-minigames` girdileri eklenecek (`_LOGO_SETS["k-minigames"] = "ks"` geçici; ayrı simge yok). `tests/conftest.py`'de yeni çalışan-süreç işlevi de boş listeye sabitlenir.
- [ ] **Step 2: Testler** (`test_products.py`, mevcut `make_exe` yardımcısı ile): hiçbir şey kurulu değilken `{"k-optimizer","k-launcher","k-minigames"}` rapor edilir ve `k-minigames` `installed is False`; `exe_path` kaydıyla bulunur; `saved_minigames` ile bulunur; yanlış yazılmış (var olmayan) `exe_path` yok sayılır ve sonraki adaya geçilir; `launch` yeni ürün için çalışır. `test_kseries_app.py`: Ana Sayfa üç ürün kartı listeler.
- [ ] **Step 3: Başarısız. Step 4: Uygula** (kart yalnızca durum ve "Aç" düğmesi gösterir; K-MiniGames için güncelleme düğmesi ve ayrı gezinme sayfası yoktur). **Step 5: Geçsin** (K-Optimizer'ın tüm testleri: `python -m pytest -q`, kırılan olmamalı). **Step 6: Commit** (K-Optimizer deposu, kendi commit stiliyle; `git push` yapılmaz) ve K-MiniGames'te `CHECKPOINTS.md`/`HAFIZA.md` güncellenir.

---

## Self-Review

- **Spec kapsamı:** Parçalar tablosundaki her modül bir görevde (ollama_client 2, installer 4, advisor 5, model_check 3, generator 7, checker 10 + htmlscan 8, report_server 9, library 6, settings 1, ui 12–15); akış 1–6 → 13, 14, 15; dokular → 6, 7, 8; deneme/test → 8–11; K-Series → 17; hata durumları (Ollama yok 13, indirme kesildi 4/13 "Tekrar dene", geçersiz öneri 3/14, bozuk HTML 7/11, disk dolu 6/15); güvenlik (127.0.0.1+jeton 9, onaylı indirme 13/14, dış ağ taraması 8); dil → 1; geliştirme süreci (CS). Açık noktalar: danışman modeli → 3 Adım 5; test sekmesi deneyimi → 15 Adım 5.
- **Tip tutarlılığı:** `Problem`, `TestItem`, `CheckReport`, `Outcome`, `Recommendation`, `Texture` adları ve alanları görevler arasında aynı; durum sabitleri tek yerde (`testlist`).
- **Spec'ten bilinçli sapma/karar:** (a) Test sayfası `file://` yerine `report_server`'dan (`http://127.0.0.1`) sunulur: CORS gerekmez; fark: `getImageData` kısıtı bu sayfada geçerli olmaz, yine de modele yasaklanır. (b) `num_ctx = 8192`. (c) Çalışma görselleri önceden hazırlanır (Tk kesirli ölçek yapamaz). (d) K-Series'te K-MiniGames için güncelleme düğmesi yok.
- **Orantı:** Plan kod gövdeleri yerine imza, test adı ve değer içerir; kod yazımı uygulayıcıya bırakılmıştır.
