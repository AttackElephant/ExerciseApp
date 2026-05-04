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

## Phase 3 — Historic Logging and Date Navigation

**Status:** complete (pending iPhone verification).

### Done
- `src/session.js` — `renderToday` replaced by `renderForDate(root, regime,
  date, onDateChange)`. Renders date navigation (prev / native picker /
  next / today). Future dates blocked: the picker `max` is today and the
  next-day button is disabled when the view is on today. Sessions render
  from each entry's stored definition snapshot when a row exists, and from
  the current regime template when the date has no log yet.
- `src/app.js` — owns the current-date state and re-invokes `renderForDate`
  when the user picks a different day.
- `src/db.js` —
  - `loadSession` now returns stored entries verbatim (with their original
    definition snapshots), and only seeds from supplied defaults when no
    row exists. The previous reconcile-by-name behaviour broke US12 by
    overwriting stored snapshots with current-regime defs.
  - `saveExerciseValues` preserves the existing definition snapshot on
    subsequent edits — only the very first write seeds `definition` from
    the supplied regime. Values still merge as before.
- `tests/lib/db.test.js` — added cases for snapshot preservation across
  saves (US12), unlogged-date templating (US10), historic-vs-today
  isolation. Total suite is now 27 passing.
- `styles.css` — date-nav row (prev / picker / next / today) styled to
  match the existing pill-button visual language. Picker uses native
  `input[type=date]`, which iOS Safari surfaces as a wheel.
- `sw.js` — `CACHE_VERSION` bumped to v4. No new files added to precache.

### Acceptance check
- US10: any past date can be reached via the picker or prev button. Past
  dates with stored data show those values; dates with no log show the
  current regime template for that weekday with empty inputs.
- US11: all input fields remain editable on past dates; saves keyed by
  the navigated date go through the same `saveExerciseValues` path.
- US12: confirmed by `definition snapshot is preserved across subsequent
  saves` test — the stored definition is never clobbered by a later edit
  using a different regime definition.

### Boundaries respected
No future-date logging (picker capped at today, next-day disabled). No
clipboard export. No regime updates. No images. No aggregation views.

## Phase 4 — Clipboard Export

**Status:** complete (pending iPhone verification).

### Done
- `src/export.js` —
  - `sessionsToTSV(rows)` builds the TSV string with the header row
    `date \t session \t exercise_name \t type \t sets \t reps \t
    duration_s \t distance_km \t duration_min \t surface` and one data
    row per stored exercise. Cells not applicable to the row's type are
    empty. `exercise_name` and `type` are always populated, so concat'd
    rows from different regime versions remain self-describing (US15).
  - `renderExportPanel(root)` mounts the export UI: from/to pickers,
    "All dates" toggle, copy button, status message. Uses
    `navigator.clipboard.writeText` with a hidden-textarea fallback.
- `src/db.js` — `getSessionsInRange(from, to)` (uses the existing `date`
  index, inclusive bounds), `getAllSessions()`. Both sort by date asc
  then morning-before-afternoon.
- `src/app.js` — splits `#app` into a re-rendering `day-view`, a
  mount-once `export-view`, and a `hint-view`. The export panel's
  from/to state survives date navigation.
- `styles.css` — export panel matches the session card styling; range
  collapses to a single column under 420 px.
- `sw.js` — precache list extended with `src/export.js`; `CACHE_VERSION`
  bumped to v5.
- Tests: `tests/lib/export.test.js` (8 cases for header order, empty
  cells, single-day, multi-day, escaping) and three new cases in
  `tests/lib/db.test.js` (range, single-day, all). Suite is now 38
  passing.

### Acceptance check
- US13: from/to picker + copy button writes TSV to clipboard;
  status message shows row count and scope.
- US14: header row always emitted (even with zero data rows); column
  order matches the PRD; type-irrelevant cells are empty.
- US15: `exercise_name` and `type` are written for every row, so a
  pre-update row and a post-update row concatenate without ambiguity.
- US16: from = to is handled by the same code path, no special case.
- US16.5: "All dates" checkbox disables the range inputs and copies
  every stored row.

### Boundaries respected
Clipboard only — no file download, no scheduled export. No filtering
by exercise type or session. No summary, aggregation, or calculated
fields. Header is the only metadata.

## Phase 5a — Regime Paste-Import

**Status:** complete (pending iPhone verification).

> **TESTING PANEL — REMOVE BEFORE PUBLIC RELEASE.**
> A `<details>` panel at the bottom of the app exposes "Reset today's
> session" and "Wipe all data" buttons so the regime apply / logging
> paths can be validated without devtools. To remove at go-live:
> 1. Delete `src/testingPanel.js`.
> 2. Remove the import + `renderTestingPanel(...)` call in `src/app.js`.
> 3. Remove the `.testing*` CSS block in `styles.css`.
> 4. Drop `./src/testingPanel.js` from `sw.js` precache.
> 5. Bump `CACHE_VERSION`.

Per the PRD's "flag before starting" note, Phase 5 was split into 5a
(regime updates, US17/US18) and 5b (images, US19–US21). 5b will be a
follow-up branch.

### Done
- `src/db.js` — bumped to schema v2; added a `meta` key/value table.
  New helpers `getStoredRegime`, `setStoredRegime`, `clearStoredRegime`.
- `src/regime.js` — `getActiveRegime` is now async and reads the stored
  regime from the meta table, falling back to the embedded default if
  nothing is stored or the stored regime fails validation. New
  `setActiveRegime(regime)` validates first and throws a plain-text
  error if invalid (US17).
- `src/regimePanel.js` (new) — collapsed `<details>` panel with a
  textarea + "Apply regime" button + status line. Handles JSON parse
  errors and validation errors with plain-text messages. On success it
  fires `onRegimeChange(newRegime)` so the day view re-renders.
- `src/app.js` — awaits the active regime at boot, mounts the regime
  panel below the export panel, and re-renders the day view via
  `onRegimeChange` when the user applies a new one.
- `styles.css` — regime panel styling matched to the existing card
  language.
- `sw.js` — precache list adds `regimePanel.js`; `CACHE_VERSION` → v7.
- Tests: `tests/lib/db.test.js` adds 4 cases (meta round-trip, clear,
  US18 isolation between regime writes and session writes);
  `tests/lib/regime.test.js` adds 4 async cases (default fallback,
  store/retrieve, invalid input rejected, corrupted-stored fallback).
  Suite is now 46 passing.

### Acceptance check
- US17: paste valid JSON + tap Apply → stored, immediate re-render of
  the day view; paste invalid JSON or invalid regime → existing regime
  unchanged, plain-text error shown inline.
- US18: writing to the meta table never touches the sessions table;
  Phase 3's snapshot semantics already keep historic logs coherent
  across regime swaps.

### Boundaries respected
Paste only — no in-app regime editor. No version history or rollback
(the user can paste an old regime back in to revert). No images yet
(Phase 5b).

## Next: Phase 5b — Exercise Images
- Per-resistance-exercise image upload via clipboard paste, stored in
  IndexedDB keyed by exercise name.
- Info button next to exercises that have an associated image; tap to
  view full-screen / modal; dismissible by tap.
- Images persist across app restarts and regime updates (US21).

## Convention check
None of the conventions in CLAUDE.md were invalidated. The "each log
entry embeds a snapshot of the exercise definition at write time"
convention is now actively enforced by `saveExerciseValues` — the
snapshot is sealed on first write and never overwritten.
