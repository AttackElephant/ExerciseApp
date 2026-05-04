# Progress

## Phase 1 — PWA Shell and Regime Data Model

**Status:** complete.

### Done
- `src/regime.js` — `validateRegime`, `getActiveRegime`, `sessionsForDate`,
  `weekdayFor`. All 10 existing unit tests pass.
- `src/defaultRegime.js` — embedded default regime covering Mon–Sat with a
  mix of running and resistance exercises across morning and afternoon
  sessions (Sunday is a rest day). Satisfies US2.
- `src/session.js` — renders today's morning/afternoon sessions or an
  explicit rest-day message (US5).
- `src/ui.js` — `el`, `mount`, `clear`, date/weekday formatters.
- `src/app.js` — bootstraps the app, validates the active regime,
  registers the service worker, shows an iOS install hint when not in
  standalone mode.
- `src/types.js` — JSDoc typedefs for `Regime`, `Exercise`, etc.
- `index.html`, `styles.css` — app shell with safe-area-aware layout and
  light/dark themes.
- `manifest.json` — PWA manifest, scope `./`, standalone display.
- `sw.js` — hand-rolled cache-first service worker; precaches all shipped
  files; activates on install. See ADR-002.
- `assets/icons/icon-192.png`, `assets/icons/icon-512.png` — solid-colour
  placeholder icons (replace later with branded artwork).
- `docs/adr/001-tech-stack.md` — filled in.
- `docs/adr/002-service-worker.md` — documents Workbox deferral.
- `docs/architecture.md` — module map and runtime model.
- `CLAUDE.md` — updated tech-stack line to reference ADR-002.

### Acceptance check
- US1 (offline launch): SW precaches every shipped asset; verify on a
  device by installing, then enabling airplane mode and re-launching.
- US2 (default regime): app loads and renders without any user action.
- US3 (data model): regime supports per-day morning/afternoon arrays;
  malformed input rejected with plain-text error (10 tests).
- US4 (exercise types): both `running` and `resistance` parse; resistance
  accepts reps-only or duration-only.
- US5 (today's view): correct session shown per weekday; Sunday shows a
  rest-day message.

### Boundaries respected
No logging, no paste-import, no images, no clipboard export, no backend,
no auth, no nav beyond today's view.

## Phase 2 — Session Logging

**Status:** complete (pending iPhone verification).

### Done
- `src/db.js` — Dexie wrapper around the `sessions` store
  (`[date+session]` primary key). API: `loadSession`, `saveExerciseValues`,
  `setSessionComplete`, `dateKey`. Definition snapshots stored alongside
  values per CLAUDE.md and as groundwork for US12.
- `src/log.js` — pure UI for exercise input fields. Running renders
  distance/duration/surface; resistance renders sets and either reps or
  hold seconds depending on what the regime defines. `isEntryComplete`
  flags a row as visually "logged" when every required field is filled.
- `src/session.js` — rewritten to render input fields per exercise, load
  prior values from IndexedDB on mount, persist on each `change` event,
  and host a per-session "Mark complete" toggle (US9). Both morning and
  afternoon always render.
- `vendor/dexie.mjs` — Dexie ES module vendored from npm and precached.
- `index.html` — import map maps the bare specifier `dexie` to the
  vendored module, so the same `import Dexie from 'dexie'` works in the
  browser and in Node tests.
- `styles.css` — input fields, radio pill group, completion check mark,
  per-session complete badge.
- `sw.js` — precache list extended with `db.js`, `log.js`, and
  `vendor/dexie.mjs`; `CACHE_VERSION` bumped to v3.
- Tests: `tests/lib/db.test.js` (8 cases, fake-indexeddb) and
  `tests/lib/log.test.js` (6 cases). Total suite now 24 passing.

### Acceptance check
- US6: each exercise renders the correct input fields per type; partial
  entry is saved on every `change` event and re-rendered on next load.
  Distance accepts 1 decimal place (`step="0.1"`).
- US7: writes go through Dexie → IndexedDB; verified in tests by reload
  cycle and by smoke-test instructions in `docs/testing-on-iphone.md`.
- US8: session row keyed by `[date+session]`, so morning and afternoon
  state never collide. Test covers it.
- US9: per-session "Mark complete" toggle persisted to the same row;
  `session--complete` class flips on click; completed sessions remain
  fully editable. Test covers it.

### Boundaries respected
Today only — no historic dates yet (Phase 3). No clipboard export, no
regime updates, no images. No validation beyond field type. No
progression suggestions.

## Next: Phase 3 — Historic Logging and Date Navigation
- Date picker / back-nav so the user can jump to any past date.
- Past dates render the regime template plus stored values, if any.
- Past dates editable; saves keyed by date.
- US12: continue storing the definition snapshot per entry — already in
  place from Phase 2.

## Convention check
None of the conventions in CLAUDE.md were invalidated. The new `db.js`
module honours the "all IndexedDB I/O goes through `src/db.js`" rule.
