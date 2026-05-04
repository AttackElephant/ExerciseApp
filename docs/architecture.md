# Architecture

A single-user offline PWA. No backend, no auth, no network calls after install.

## Runtime model

```
┌──────────────── iPhone Safari (PWA) ────────────────┐
│                                                     │
│   index.html ── styles.css ── importmap → dexie     │
│       │                                             │
│       └── src/app.js  (entry, SW register)          │
│              │                                      │
│              ├── src/schema.js                      │
│              │      ├── WEEKDAYS / SESSIONS / …     │
│              │      ├── validateRegime()            │
│              │      └── JSDoc typedefs              │
│              │                                      │
│              ├── src/regime.js                      │
│              │      ├── getActiveRegime()           │
│              │      ├── setActiveRegime()           │
│              │      └── sessionsForDate()           │
│              │                                      │
│              ├── src/defaultRegime.js  (embedded)   │
│              ├── src/session.js     (date renderer) │
│              ├── src/log.js         (form fields)   │
│              ├── src/export.js      (TSV+clipboard) │
│              ├── src/regimePanel.js (paste-import)  │
│              ├── src/images.js      (paste / view)  │
│              ├── src/db.js          (Dexie I/O)     │
│              └── src/ui.js          (DOM helpers)   │
│                                                     │
│   vendor/dexie.mjs  (ES module, precached)          │
│   sw.js  (cache-first; precaches all of the above)  │
│                                                     │
│   IndexedDB                                         │
│     sessions  [date+session] →                      │
│       { complete, completedAt, entries: [           │
│         { definition, values } ] }                  │
│     meta       key →                                │
│       'regime' → { value: <user-pasted regime> }    │
│     images    name →                                │
│       { blob, mime, addedAt }                       │
└─────────────────────────────────────────────────────┘
```

## Module responsibilities

- **schema.js** — single source of truth for every persisted-data shape:
  closed value-sets, `validateRegime`, JSDoc typedefs for `Regime`,
  `LoggedSession`, `StoredImage`. See ADR-003.
- **regime.js** — runtime helpers around the active regime: read/write
  via the meta store, weekday lookup. Re-exports `validateRegime` from
  `schema.js` for callers that already had it imported here.
- **defaultRegime.js** — the regime shipped with the app. Replaced at
  runtime once the user pastes one (Phase 5a).
- **session.js** — date view; renders sessions and input fields.
- **log.js** — per-exercise input field components.
- **export.js** — TSV construction + clipboard write.
- **regimePanel.js** — paste-import UI for replacing the active regime.
- **images.js** — per-exercise image paste, view modal, IndexedDB I/O.
- **db.js** — Dexie wrapper; the only module that touches IndexedDB.
- **ui.js** — DOM construction helpers (`el`, `mount`, `clear`).
- **app.js** — wires the above together and registers the service worker.

## Storage

All IndexedDB I/O goes through `src/db.js` (Dexie). No other module touches
IndexedDB directly. Each row in the `sessions` store is keyed by
`[date+session]` and embeds a snapshot of each exercise's definition next to
the values the user entered. The snapshot is groundwork for PRD US12 — it
means historic dates stay coherent across future regime updates without any
schema migration.

Dexie ships as a vendored ES module (`vendor/dexie.mjs`) and is resolved via
an import map declared in `index.html`, so `import Dexie from 'dexie'` works
identically in the browser and under Node tests.

## Service worker

Hand-rolled cache-first (`sw.js`). Precaches every shipped file at install.
On `fetch`, serves from cache when available, falls back to network for
unknown URLs, and on network failure for navigations falls back to
`index.html`. See ADR-002 for why Workbox was deferred.

## Date handling

Dates are device-local YYYY-MM-DD strings. No timezone conversion. "Today"
comes from `new Date()` in the device's locale.
