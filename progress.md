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

## Next: Phase 2 — Session Logging
- Introduce `src/db.js` (Dexie schema, daily-log read/write).
- Add input fields per exercise; persist partial entries to IndexedDB.
- Distinct morning/afternoon state; per-session "complete" action.
- Verify entered values survive an app restart.

## Convention check
None of the conventions in CLAUDE.md were invalidated. ADR-002 amended the
tech-stack convention (hand-rolled SW instead of Workbox); CLAUDE.md was
updated to match.
