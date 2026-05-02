# Architecture

A single-user offline PWA. No backend, no auth, no network calls after install.

## Runtime model

```
┌──────────────── iPhone Safari (PWA) ────────────────┐
│                                                     │
│   index.html ── styles.css                          │
│       │                                             │
│       └── src/app.js  (entry, SW register)          │
│              │                                      │
│              ├── src/regime.js                      │
│              │      ├── validateRegime()            │
│              │      ├── getActiveRegime()           │
│              │      └── sessionsForDate()           │
│              │                                      │
│              ├── src/defaultRegime.js  (embedded)   │
│              ├── src/session.js  (today renderer)   │
│              ├── src/ui.js       (DOM helpers)      │
│              └── src/types.js    (JSDoc typedefs)   │
│                                                     │
│   sw.js  (cache-first; precaches all of the above)  │
│                                                     │
│   IndexedDB (Phase 2+, via src/db.js)               │
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

## Storage (Phase 2+)

All IndexedDB I/O will go through `src/db.js`. No other module touches
IndexedDB directly. Per-day log entries embed a snapshot of each exercise
definition so historic dates remain coherent across regime updates (PRD US12).

## Service worker

Hand-rolled cache-first (`sw.js`). Precaches every shipped file at install.
On `fetch`, serves from cache when available, falls back to network for
unknown URLs, and on network failure for navigations falls back to
`index.html`. See ADR-002 for why Workbox was deferred.

## Date handling

Dates are device-local YYYY-MM-DD strings. No timezone conversion. "Today"
comes from `new Date()` in the device's locale.
