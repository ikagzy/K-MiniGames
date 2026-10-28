# Uygulama sırasında alınan kararlar ve bulgular (ledger)

Bu dosya uygulama sırasında tutulan günlüğün kalıcı kopyasıdır: planla çelişen ya da planın bırakıp bağımsız karar verdiği her yer `Ruling:` ile, ertelenen küçük bulgular `minor (deferred)` ile yazılıdır.

# SDD ledger — plan: docs/superpowers/plans/2026-10-28-k-minigames.md
Spec: docs/superpowers/specs/2026-10-28-k-minigames-design.md (read; binding)
Pre-flight: T4→T2 is_running ok; T5→T2 chat,T3 catalog.coders ok; T7→T2,T6 Texture ok; T10→T6 Game,T8 Problem/scan,T9 ReportServer/inject ok; T11→T7,T10,T6 ok; T14→T5,T3,T2,T1 settings.put ok; T15→T6,T11,T12,T13 ok; T18→T11,T14 ok; T17 separate repo (K-Optimizer).
Ruling: work on main, no worktree — new project, user said "direkt başlayabilirsin", git history/CP records are the rollback — cost if wrong: none, checkpoints exist.
Ruling: pytest installed with pip (dev tool named in plan's requirements.txt) — cost if wrong: none.
Ruling: T11 repair_loop/create_game_flow/edit_game_flow get kw-only `memory: str = ""` (passed to generator.fix/edit); T18 wires the real value — plan's T11 signatures omitted it but T18 needs it — cost if wrong: one param.
Task 1: complete (commits 5b84294..65e4937, tests: python -m pytest -q → 9 passed in 0.09s)
Task 2: complete (commits 65e4937..1731781, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 25 passed in 0.11s)
Task 3: Ruling: plan's test 'recommend(32b, ram=16) -> 14b' contradicts its own catalog (14b needs 18 GB) — used ram=24 in that test — cost if wrong: none
Task 3: Ruling: Step 5 (manual Turkish check of qwen2.5:3b) not done — Ollama server not running and a 1.9 GB download needs user consent; noted as unverified in HAFIZA.md — cost if wrong: advisor may answer poorly in Turkish; swap id in models.json
Task 3: complete (commits 1731781..b2d9487, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 36 passed in 0.13s)
Task 4: complete (commits b2d9487..b4201e6, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 49 passed in 0.28s)
Task 5: Ruling: memory.py created now with only block()+MAX_CHARS (Task 5/7 need the block text; Task 18 adds load/save/update/paths) — cost if wrong: none
Task 5: complete (commits b4201e6..cbdda93, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 61 passed in 0.29s)
Task 6: complete (commits cbdda93..5bd7292, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 89 passed in 0.36s)
Task 7: Ruling: Generator converts OllamaError into GenerationError (message kept) so flows handle one error type; memory is keyword-only (*, memory="") on build_* and Generator methods; generator.client/.model are public (Task 18 uses them) — cost if wrong: one rename
Task 7: complete (commits 5bd7292..8ae61e5, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 109 passed in 0.44s)
Task 8: complete (commits 8ae61e5..1631f14, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 119 passed in 0.44s)
Task 9: Ruling: manual browser check done in the built-in browser pane (not the user's default browser, less intrusive) via tools/smoke_harness.py --no-open; events error, asset_error, test(passed+vacuous), done all arrived — cost if wrong: none
Task 9: Note for Task 10: console_error events also count as js_errors (spec says console errors are reported; plan text listed only error/asset_error)
Task 9: complete (commits 1631f14..5afcba8, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 144 passed in 2.19s)
Task 10: Ruling: ReportServer gets report_url() and clear_events() (plan's Task 9 interface lacked them; run_once needs the report address and a repeat run must not see the previous run's done) — cost if wrong: none
Task 10: Ruling: js_errors include console_error events (spec: console errors are reported) in addition to error/asset_error — cost if wrong: a game that logs console.error on purpose gets 'fixed' needlessly
Task 10: complete (commits 5afcba8..a1ce006, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 160 passed in 2.50s)
Task 11: Ruling: on_status takes two args (state, text) with state in generating|testing|fixing (plan said Callable[[str], None]); the bear screen (Task 15) maps state to a mascot frame without parsing text — cost if wrong: one signature
Task 11: complete (commits a1ce006..939d7c9, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 175 passed in 3.02s)
Task 12: Ruling: advisor frames scaled 0.7 and bear 0.75 in prepare_assets (tuned with composites + a real Tk screenshot); bear is not darkened (left as a polish item) — cost if wrong: bear slightly bright in the dim lobby
Task 12: complete (commits 939d7c9..3f97fd6, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 213 passed in 3.38s)
Task 13: Ruling: default advisor changed qwen2.5:3b -> qwen3.5:4b (3.4 GB, min RAM 8) after a real Turkish test of 5 models (qwen2.5:3b gave broken sentences and skipped the questions; qwen3.5:4b and gemma3:4b were fluent) — cost if wrong: one json line; alternative gemma3:4b
Task 13: Ruling: new user requirement (use an installed model if enough, else ask to install, else cancel message) implemented in startup.py/model_check/ollama_client.installed + docs (spec section + plan amendment 1); Task 14 AdvisorFlow will use the same offers — cost if wrong: none
Task 13: Ruling: Stage loads pictures via PhotoImage(data=base64) instead of file= (Tk file= failed randomly on the Turkish-letter folder path; 0/10 failures after the change) — cost if wrong: none
Task 13: complete (commits 3f97fd6..831b37e, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 262 passed in 3.92s)
Task 14: Ruling: for the game model the installed-model offer prefers a code model, else the biggest adequate one (prefer="best"); the advisor keeps 'smallest adequate' — found in a real run where the smallest rule offered the old general llama3 for writing games — cost if wrong: a bigger model than strictly needed is offered (still only after a yes)
Task 14: Ruling: real end-to-end check done with qwen3.5:4b (settings isolated in a temp LOCALAPPDATA, no downloads): greeting, SEN/DANIŞMAN turns, proposal, 'installed model found' question, accept -> game_model set, finish message
Task 14: complete (commits 831b37e..1d8dd2b, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 285 passed in 6.78s)
Task 15: Ruling: the bear's speaker label is GÖREVLİ (EN BELLHOP) — the spec only names DANIŞMAN/SEN; the bear is the bellhop — cost if wrong: one string + one i18n pair
Task 15: Ruling: studio asks name then description through the dialogue box (stage.ask) instead of a form (the dialogue area is too small for a form); textures via 'Add texture' button, versions via 'Go back to an older version' (ask_text) — cost if wrong: UI shape only
Task 15: Ruling: real end-to-end run done with llama3.1:8b (settings isolated, test-only headless Edge in the drive script, product stays browser independent): generation, browser try, auto fix and honest 'could not be verified' all worked; found+fixed parse_tests template-literal failure and checklist prompt quality (see tests in test_generator) — cost if wrong: none
Task 15: Note: Step 5 'tab experience' judged from the run: with the real default browser a visible tab opens; not evaluated by the user yet
Task 15: complete (commits 1d8dd2b..33723dd, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 307 passed in 10.74s)
Task 16: Ruling: app icon made from the bear's face (tools/make_icon.py, Pillow) — the plan had no icon decision; the spec file references it — cost if wrong: swap src/k_minigames/assets/icon.ico
Task 16: Ruling: built dist/K-MiniGames.exe (15.5 MB) and checked it runs: process stays up, window shows the packaged pictures, FileVersion 0.1.0.0, settings.json gets exe_path (run with a throw-away LOCALAPPDATA); build/ and dist/ are git-ignored; GitHub release/CI/itch.io left out as the plan says (needs user authorization)
Task 16: complete (commits 33723dd..fa5d730, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 310 passed in 12.32s)
Task 17: Ruling: K-MiniGames card is a shorter second-row card on the K-Series home page (the two big cards need their width for the Detail/Update buttons), only an Open button, no detail page, no update (not in _PRODUCTS/_NAMES so no update checks); logo falls back to the KS set — cost if wrong: layout/logo only
Task 17: Ruling: detection order running -> K-MiniGames' own registered exe_path -> saved -> next to K-Series -> install folders -> scan (plan listed registered first; a running copy wins like for K-Optimizer) — cost if wrong: none
Task 17: Note: work is in the K-Optimizer repo, commit 581e83e on main (local, NOT pushed); its own suite 331/331 passed; Python writes converted LF files to CRLF on Windows so line endings were restored before committing
Task 17: Note: K-Optimizer's psutil was installed with pip to run its tests (it is its only runtime dependency)
Task 17: complete (commits fa5d730..eb68cde, tests: bash -c 'cd '../K-Optimizer' && python -m pytest -q -p no:cacheprovider' → 331 passed, 7 warnings in 46.79s)
Task 18: Ruling: studio flows read the game memory file themselves and update it at the end (explicit memory= still overrides, for tests); the memory update can be handed to a background(...) hook, which StudioScreen uses (own thread) so the result is shown without waiting for the extra model call — the plan said flows update inline; the spec says 'arka planda, arayüzü bekletmez' — cost if wrong: none
Task 18: Ruling: AdvisorFlow.user_says(memory=None) loads advisor_hafiza.md by default; AdvisorScreen runs flow.remember on the Worker after each reply — cost if wrong: none
Task 18: Ruling: memory.update catches every exception of the summariser (not only OllamaError) and falls back to a one-line note, so a broken client never stops a chat or a build — cost if wrong: a real bug in the summariser call would be hidden behind the fallback
Task 18: Note: real check done with qwen3.5:4b (throw-away LOCALAPPDATA): summaries written after each message, survive a restart, the advisor then names the game and the character from memory
Task 18: complete (commits eb68cde..3e4d871, tests: C:\Users\kagzi\AppData\Local\Programs\Python\Python314\python.exe -m pytest -q → 332 passed in 9.88s)
Final: review done (opus; the first attempt with fable failed for missing usage credits): 6 Important, 9 Minor, 0 Critical. pytest 332/332 at review time.
Final: re-grade by effect — Important stay: #1 unfinished try counts as clean (a hanging edit replaces the working game), #2 stale tabs report into later runs, #3 texture names with spaces/parentheses make every build/edit fail, #4 leaving the studio mid-build cancels nothing and draws over the library, #5 memory update lost when two overlap, #6 final message hides leftover errors. Re-graded Minor -> fix: #7 memory.load crashes on non-UTF-8 hand edits (breaks every build of that game), #9 fixed 20 s timeout starves long test lists (the checklist only grows), #15 edit mode skips the disk/writable check the spec requires before every generation.
Final: minor (deferred): #8 i18n.t() also rewrites file names inside f-strings in English (SENSOR.png -> YOUSOR.png)
Final: minor (deferred): #10 the game-model download cannot be cancelled from the advisor screen (no cancel button)
Final: minor (deferred): #11 console_error counts in the edit gate, so a game that logs console.error in handled code is always rejected on edit
Final: minor (deferred): #12 next_screen starts `ollama serve` at launch without a click (not recorded as a decision before; harmless, helpful, differs from the spec's 'Start Ollama' button)
Final: minor (deferred): #13 blocking calls on the UI thread (client.is_running up to 2 s, nvidia-smi up to 5 s) freeze the window briefly
Final: minor (deferred): #14 a setup probe that finishes after hide() can raise TclError on destroyed buttons
Final: minor (deferred): #16 K-Optimizer: products.detect is never given saved_minigames (the 'saved path' step never runs) and a missing K-MiniGames adds one more scan
Final: fixed #1 unfinished try — test_an_edit_whose_page_never_reports_back_is_rejected_and_the_working_game_is_untouched RED→GREEN, suite 357/357
Final: fixed #2 stale tabs — test_events_from_a_tab_of_an_earlier_run_are_ignored (run number in the report address) RED→GREEN, suite 357/357
Final: fixed #3 texture names — test_texture_names_with_spaces_and_parentheses_are_known_files + test_texture_names_are_given_to_the_model_in_their_url_form RED→GREEN, suite 357/357
Final: fixed #4 leaving the studio — test_leaving_the_studio_during_a_build_cancels_it_and_draws_nothing_afterwards + test_the_toolbar_does_nothing_while_a_build_is_running RED→GREEN, suite 357/357
Final: fixed #5 lost memory update — test_two_updates_at_the_same_time_keep_both_exchanges (memory.remember, one lock per file) RED→GREEN, suite 357/357
Final: fixed #6 final message — test_errors_that_are_still_there_are_listed, test_a_try_that_never_finished_says_so, test_the_pose_is_success_only_for_a_clean_and_finished_run RED→GREEN, suite 357/357
Final: fixed #7 non-UTF-8 memory file — test_a_memory_file_saved_in_an_old_code_page_is_still_read RED→GREEN, suite 357/357
Final: fixed #9 time allowed — test_the_time_allowed_grows_with_the_number_of_tests RED→GREEN, suite 357/357
Final: fixed #15 edit mode writable check — test_editing_checks_the_games_folder_first RED→GREEN, suite 357/357
Final: Ruling: declined-to-judge item 'num_ctx 8192 may be too small for edit/fix prompts that carry the whole HTML' — left at 8192 — a very long game could be cut by Ollama and then fail to parse (shown as an error, never saved over a working game) — cost if wrong: long games cannot be edited until num_ctx is raised
