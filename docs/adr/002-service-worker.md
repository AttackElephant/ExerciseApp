# ADR-002: Hand-rolled Service Worker (deferring Workbox)

**Status:** Accepted
**Date:** 2026-05-02

## Context
The original tech-stack note (CLAUDE.md) named Workbox as the service-worker
library. Phase 1 needs a tiny precache-and-serve worker for ~12 static files.
Adopting Workbox in Phase 1 would mean either:

- Self-hosting the Workbox runtime (extra files to precache and version-bump), or
- Loading from a CDN (incompatible with the offline-first first-launch promise
  unless the CDN script itself is also precached).

For the current asset set the worker is ~30 lines of plain JavaScript with no
moving parts.

## Decision
Ship a hand-rolled cache-first service worker (`sw.js`) for Phase 1. Revisit if
either of these triggers occur:

- Asset count or runtime caching strategy grows beyond what one file can
  comfortably express.
- A later phase needs background sync, navigation preloads, or precise routing
  that Workbox provides out of the box.

CLAUDE.md is updated to reflect this.

## Consequences
- Zero third-party dependencies in the runtime.
- Cache versioning is manual: bump `CACHE_VERSION` in `sw.js` whenever the
  precache list changes, otherwise users will be served stale assets.
- We carry the (small) cost of re-validating the precache logic ourselves.

## Alternatives Considered
- **Workbox via CDN:** rejected — first-launch offline only works if the CDN
  script is itself precached, which negates the simplicity argument.
- **Workbox self-hosted:** rejected for now — overhead exceeds need; reconsider
  when complexity grows.
- **No service worker (manifest only):** rejected — fails US1 (offline launch).
