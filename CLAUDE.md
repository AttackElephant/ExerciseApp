# ExerciseApp

A single-user offline PWA for logging daily morning and afternoon exercise sessions against a personal training regime, installable on iPhone via Safari without an Apple Developer account.

Tech stack: Vanilla HTML/CSS/JS (ES modules), Dexie.js (IndexedDB, Phase 2+), hand-rolled cache-first Service Worker (see ADR-002), GitHub Pages.

## Commands

# No build pipeline — serve files directly
npx serve .          # Local dev server (port 3000)
# Or use Live Server in VS Code

## Project Structure

/                    # App root — all files served as static assets
index.html           # App shell
sw.js                # Service worker (Workbox)
manifest.json        # PWA manifest
src/
  app.js             # Entry point, bootstraps app
  schema.js          # Single source of truth for all persisted data shapes
                     #   (constants, validateRegime, JSDoc typedefs) — see ADR-003
  db.js              # Dexie schema and all IndexedDB operations
  regime.js          # Active-regime read/write, weekday helpers
  defaultRegime.js   # Embedded default regime
  session.js         # Date view; renders sessions and input fields
  log.js             # Per-exercise input field components
  export.js          # TSV construction and clipboard write
  regimePanel.js     # Paste-import UI for replacing the active regime
  images.js          # Per-exercise image paste / view modal
  ui.js              # DOM helpers (el, mount, clear, formatters)
vendor/
  dexie.mjs          # Dexie ES module, vendored for offline precaching
assets/
  icons/             # PWA icons (192×192, 512×512)
docs/
  adr/               # Architectural Decision Records
  architecture.md
PRD.md
CLAUDE.md
progress.md

## Conventions

- No framework — all DOM manipulation via vanilla JS; no virtual DOM
- All persisted-data shapes live in src/schema.js — constants, validators, and JSDoc typedefs (see ADR-003)
- All storage operations go through db.js — nothing else touches IndexedDB directly
- Dates stored and keyed as YYYY-MM-DD strings (device local time, no timezone handling)
- Each log entry embeds a snapshot of the exercise definition at write time (see US12)
- Regime validation is synchronous and returns { valid: boolean, error?: string }
- Exercise type is always present on every log row — never inferred from position
- Images keyed by exercise name in IndexedDB; survive regime updates
- Service worker uses cache-first for all app assets — no network calls after install

## Architectural Decisions

Before making changes that affect architecture, read relevant ADRs in docs/adr/.
Always create an ADR when changes affect overall architecture.
After creating an ADR, update this file if the decision introduces a new convention.

## Reference Documents

@docs/architecture.md — read when modifying system design
@PRD.md — read when starting a new feature phase
@AGENTS.md — cross-tool conventions

## Session Protocol

At the end of every session:
1. Update progress.md with what was completed and what's next
2. Check whether any conventions above have been invalidated by changes made during this session

## iOS PWA Notes (read before touching manifest or sw.js)

- iOS does not prompt for install — first-launch UI must instruct: Share → Add to Home Screen
- Service worker scope must match the GitHub Pages path prefix if no custom domain
- manifest.json start_url must include the repo subpath
- Test offline behaviour with airplane mode, not just DevTools throttling — Safari handles these differently
