# ADR-003: Centralise data schemas in `src/schema.js`

**Status:** Accepted
**Date:** 2026-05-04

## Context
Through Phases 1–5 the project accumulated three separate places that
described the same data model:

- `src/regime.js` — held `validateRegime` plus the value-set constants
  (`VALID_DAYS`, `VALID_TYPES`, etc.).
- `src/types.js` — held JSDoc typedefs for `Regime`, `Exercise`, etc.
- `src/db.js` — implicitly defined the shape of stored sessions and
  images via JS object literals, with no formal description anywhere.

When the user asked "do we have a regime input schema?" the answer
required pointing at three files plus the test suite. Adding a new
field — or a new related entity — would mean editing all three, with no
mechanical way to ensure they agree.

## Decision
A single file, `src/schema.js`, owns every persisted-data shape:

- Frozen constant arrays for each closed value-set (`WEEKDAYS`,
  `SESSIONS`, `EXERCISE_TYPES`, `SURFACES`).
- The runtime validator `validateRegime`.
- JSDoc typedefs for `Regime`, `Exercise`, `LoggedSession`,
  `LoggedEntry`, `StoredImage`, `ValidationResult`.

`src/regime.js` keeps the helpers that *operate* on a regime
(`getActiveRegime`, `setActiveRegime`, `sessionsForDate`, `weekdayFor`)
and re-exports `validateRegime` so the historical import path keeps
working. `src/types.js` is deleted.

## Consequences
- One mechanical place to edit when the data model changes.
- The validator and the typedefs cannot drift, because they sit beside
  each other in the same file.
- `regime.js` becomes a small helper module rather than a mixed
  schema-and-helpers grab-bag.
- Callers that imported `validateRegime` from `regime.js` keep working
  via the re-export; new code is encouraged to import from
  `./schema.js` directly.
- Any future schema (e.g. a richer `LoggedEntry`, a new `Tag` entity)
  goes here, not in the module that happens to use it.

## Alternatives Considered
- **Leave as is.** Rejected — the user surfaced the friction; three
  places to update for one data-model change is a known maintenance
  hazard.
- **JSON Schema document.** Rejected for now — a single-user app with
  no external API doesn't benefit from a separate schema language. If
  we later expose an import format to other tools, revisit.
- **Move helpers (sessionsForDate, etc.) into schema.js too.** Rejected
  — `schema.js` should describe *what* a Regime is, not *what to do
  with one*. Mixing the two re-creates the original problem on a
  smaller scale.
