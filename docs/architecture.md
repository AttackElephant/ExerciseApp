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
│              ├── src/regime.js                      │
│              │      ├── validateRegime()            │
│              │      ├── getActiveRegime()           │
│              │      └── sessionsForDate()           │
│              │                                      │
│              ├── src/defaultRegime.js  (embedded)   │
│              ├── src/session.js     (date renderer) │
│              ├── src/log.js         (form fields)   │
│              ├── src/export.js      (TSV+clipboard) │
│              ├── src/regimePanel.js (paste-import)  │
│              ├── src/db.js          (Dexie I/O)     │
│              ├── src/ui.js          (DOM helpers)   │
│              └── src/types.js       (JSDoc typedefs)│
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
└─────────────────────────────────────────────────────┘
```

## Module responsibilities

- **regime.js** — single source of truth for regime shape and validity.
  Everything else asks `regime.js` for today's exercises.
- **defaultRegime.js** — the regime shipped with the app. Replaced at runtime
  once Phase 5 ships paste-import.
- **session.js** — pure render of today's morning + afternoon sessions.
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
