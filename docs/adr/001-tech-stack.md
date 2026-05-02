# ADR-001: Technology Stack Selection

**Status:** Accepted
**Date:** 2026-05-02

## Context
A single user needs an offline-capable iPhone exercise log that can be installed
without an Apple Developer account. The user wants minimal friction, no backend,
and durable local data.

## Decision
- **Vanilla HTML/CSS/JS (ES modules)** — no build step, served as static files.
- **PWA** delivered via **GitHub Pages**, installed via Safari "Add to Home Screen".
- **Service Worker** for cache-first offline behaviour.
- **IndexedDB** (via Dexie.js, introduced in Phase 2) for logged session data.
- **No framework, no bundler, no transpiler.**

## Consequences
- Trivial deployment: push to `main`, GitHub Pages serves it.
- No build pipeline to maintain; source = production.
- Browser must support ES modules and Service Workers (Safari 15+ does).
- All code paths are visible in DevTools without source maps.
- iOS Safari quirks (no install prompt, storage eviction risk) must be handled
  in product copy and storage strategy.

## Alternatives Considered
- **React/Vue + bundler:** rejected — overkill for a single-screen single-user app
  and adds build/maintenance overhead.
- **Native iOS app:** rejected — requires Apple Developer account ($99/yr).
- **Capacitor/Cordova:** rejected — adds tooling for no benefit over PWA here.
- **localStorage instead of IndexedDB:** rejected — image blobs (Phase 5) and
  query-by-date access patterns warrant IndexedDB.
