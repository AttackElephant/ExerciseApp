// IndexedDB access. Single source of truth for logged session state,
// the active regime, and per-exercise demonstration images.
// Stores:
//   sessions  — one row per (date, session). Each row carries a snapshot of
//               the regime exercises that applied at log time (US12) plus
//               the values the user entered.
//   meta      — small key/value bag. Currently holds the active regime
//               under key 'regime' once the user has pasted one.
//   images    — one row per resistance-exercise name; carries the image
//               blob and its MIME type. Keyed by name so a regime update
//               that retains the same name retains the image (US21).

import Dexie from 'dexie';

const DB_NAME = 'exerciseapp';
const SESSION_TABLE = 'sessions';
const META_TABLE = 'meta';
const IMAGES_TABLE = 'images';

let _db = null;

function openDb() {
  if (_db) return _db;
  _db = new Dexie(DB_NAME);
  _db.version(1).stores({
    [SESSION_TABLE]: '[date+session], date, session, complete'
  });
  _db.version(2).stores({
    [SESSION_TABLE]: '[date+session], date, session, complete',
    [META_TABLE]: 'key'
  });
  _db.version(3).stores({
    [SESSION_TABLE]: '[date+session], date, session, complete',
    [META_TABLE]: 'key',
    [IMAGES_TABLE]: 'name'
  });
  return _db;
}

/**
 * Today's date as a device-local YYYY-MM-DD string.
 * @param {Date} [date]
 * @returns {string}
 */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function emptyEntries(definitions) {
  return definitions.map((def) => ({
    definition: def,
    values: {}
  }));
}

/**
 * Load the stored session record for a given (date, session). If a row
 * exists, returns its entries verbatim — including each entry's stored
 * definition snapshot, which is the source of truth for historic display
 * (US12). If no row exists, returns a fresh non-persisted skeleton seeded
 * from `defaultDefinitions` so the caller can render a template.
 *
 * @param {string} date YYYY-MM-DD
 * @param {'morning' | 'afternoon'} session
 * @param {Array} [defaultDefinitions] regime exercises used only when no
 *        stored row exists; ignored when one does.
 */
export async function loadSession(date, session, defaultDefinitions = []) {
  const db = openDb();
  const stored = await db.table(SESSION_TABLE).get([date, session]);
  if (stored) {
    return {
      date,
      session,
      complete: !!stored.complete,
      completedAt: stored.completedAt ?? null,
      entries: (stored.entries ?? []).map((e) => ({
        definition: e.definition,
        values: { ...e.values }
      }))
    };
  }
  return {
    date,
    session,
    complete: false,
    completedAt: null,
    entries: emptyEntries(defaultDefinitions)
  };
}

/**
 * Update the user-entered values for a single exercise within a session.
 * Creates the session row if it doesn't exist.
 *
 * @param {string} date
 * @param {'morning' | 'afternoon'} session
 * @param {number} index exercise position within the session
 * @param {Array} definitions regime definitions to use when creating a new row
 * @param {Object} values
 */
export async function saveExerciseValues(date, session, index, definitions, values) {
  const db = openDb();
  await db.transaction('rw', db.table(SESSION_TABLE), async () => {
    const existing = await db.table(SESSION_TABLE).get([date, session]);
    const base = existing ?? {
      date,
      session,
      complete: false,
      completedAt: null,
      entries: emptyEntries(definitions)
    };
    // Pad if we're writing past the current length.
    while (base.entries.length <= index) {
      const i = base.entries.length;
      base.entries.push({ definition: definitions?.[i], values: {} });
    }
    const prior = base.entries[index] ?? {};
    base.entries[index] = {
      // Preserve the original snapshot once one exists (US12). Only seed it
      // from the supplied regime definition on the very first write.
      definition: prior.definition ?? definitions?.[index],
      values: { ...prior.values, ...values }
    };
    await db.table(SESSION_TABLE).put(base);
  });
}

/**
 * Mark a session complete or incomplete. Stamps completedAt on transition.
 *
 * @param {string} date
 * @param {'morning' | 'afternoon'} session
 * @param {boolean} complete
 * @param {Array} definitions regime definitions to use when creating a new row
 */
export async function setSessionComplete(date, session, complete, definitions) {
  const db = openDb();
  await db.transaction('rw', db.table(SESSION_TABLE), async () => {
    const existing = await db.table(SESSION_TABLE).get([date, session]);
    const base = existing ?? {
      date,
      session,
      entries: emptyEntries(definitions)
    };
    base.complete = !!complete;
    base.completedAt = complete ? Date.now() : null;
    await db.table(SESSION_TABLE).put(base);
  });
}

/**
 * Test-only: replace the underlying Dexie instance. Lets tests inject a
 * fresh DB per test without leaking state.
 */
export function _setDbForTest(db) {
  _db = db;
}

/**
 * Fetch all stored sessions whose date falls within [from, to] inclusive.
 * Sorted by date ascending, then morning before afternoon.
 */
export async function getSessionsInRange(from, to) {
  const db = openDb();
  const rows = await db.table(SESSION_TABLE)
    .where('date').between(from, to, true, true)
    .toArray();
  return sortRows(rows);
}

/** Fetch every stored session row. Sorted as above. */
export async function getAllSessions() {
  const db = openDb();
  const rows = await db.table(SESSION_TABLE).toArray();
  return sortRows(rows);
}

function sortRows(rows) {
  return rows.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.session === b.session) return 0;
    return a.session === 'morning' ? -1 : 1;
  });
}

const REGIME_KEY = 'regime';

/**
 * Generic meta key/value access. Keep helpers like `getStoredRegime`
 * (below) for known keys, but new flags can use these directly.
 */
export async function getMeta(key) {
  const db = openDb();
  const row = await db.table(META_TABLE).get(key);
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  const db = openDb();
  await db.table(META_TABLE).put({ key, value });
}

export async function deleteMeta(key) {
  const db = openDb();
  await db.table(META_TABLE).delete(key);
}

/** Returns the user-pasted regime if one has been stored, else null. */
export async function getStoredRegime() {
  return getMeta(REGIME_KEY);
}

/** Persist a regime as the active regime. Caller is responsible for validating. */
export async function setStoredRegime(regime) {
  return setMeta(REGIME_KEY, regime);
}

/** Remove any user-pasted regime, reverting to the embedded default. */
export async function clearStoredRegime() {
  return deleteMeta(REGIME_KEY);
}

/** Delete every session row for a given date (both morning and afternoon). */
export async function clearSessionsForDate(date) {
  const db = openDb();
  await db.table(SESSION_TABLE).where('date').equals(date).delete();
}

/** Delete every session row across all dates. Destructive. */
export async function clearAllSessions() {
  const db = openDb();
  await db.table(SESSION_TABLE).clear();
}

/**
 * Store an image against an exercise name (US19). Replaces any existing
 * image for the same name.
 */
export async function putImage(name, blob, mime) {
  const db = openDb();
  await db.table(IMAGES_TABLE).put({
    name, blob, mime: mime ?? blob?.type ?? 'image/png', addedAt: Date.now()
  });
}

/** Fetch the image record for an exercise, or null if none stored. */
export async function getImage(name) {
  const db = openDb();
  const row = await db.table(IMAGES_TABLE).get(name);
  return row ?? null;
}

/** Remove the image for an exercise. */
export async function deleteImage(name) {
  const db = openDb();
  await db.table(IMAGES_TABLE).delete(name);
}

/** Return the set of exercise names that currently have a stored image. */
export async function listImageNames() {
  const db = openDb();
  const keys = await db.table(IMAGES_TABLE).toCollection().primaryKeys();
  return new Set(keys);
}

/** Wipe every stored image. Destructive. */
export async function clearAllImages() {
  const db = openDb();
  await db.table(IMAGES_TABLE).clear();
}

export const _internals = {
  DB_NAME,
  SESSION_TABLE,
  META_TABLE,
  IMAGES_TABLE
};
