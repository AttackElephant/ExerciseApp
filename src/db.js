// IndexedDB access. Single source of truth for logged session state.
// Schema: one row per (date, session). Each row carries a snapshot of the
// regime exercises that applied at log time (groundwork for US12) plus the
// values the user entered.

import Dexie from 'dexie';

const DB_NAME = 'exerciseapp';
const SESSION_TABLE = 'sessions';

let _db = null;

function openDb() {
  if (_db) return _db;
  _db = new Dexie(DB_NAME);
  _db.version(1).stores({
    [SESSION_TABLE]: '[date+session], date, session, complete'
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
 * Load the stored session record for a given (date, session). If no record
 * exists, returns a fresh skeleton seeded from the supplied regime
 * definitions but does NOT persist it.
 *
 * @param {string} date YYYY-MM-DD
 * @param {'morning' | 'afternoon'} session
 * @param {Array} definitions regime exercises for that session
 */
export async function loadSession(date, session, definitions) {
  const db = openDb();
  const stored = await db.table(SESSION_TABLE).get([date, session]);
  if (stored) {
    // Reconcile: if the regime definitions don't match what was stored
    // (count or names changed since last visit), keep the stored entries
    // for any matching name and append fresh skeletons for new ones.
    return {
      date,
      session,
      complete: !!stored.complete,
      completedAt: stored.completedAt ?? null,
      entries: reconcileEntries(stored.entries, definitions)
    };
  }
  return {
    date,
    session,
    complete: false,
    completedAt: null,
    entries: emptyEntries(definitions)
  };
}

function reconcileEntries(storedEntries, definitions) {
  const byName = new Map();
  for (const e of storedEntries ?? []) {
    if (e?.definition?.name) byName.set(e.definition.name, e);
  }
  return definitions.map((def) => {
    const prior = byName.get(def.name);
    return {
      definition: def,
      values: prior ? prior.values : {}
    };
  });
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
    // Ensure the entries array is long enough and definitions are present.
    while (base.entries.length < definitions.length) {
      base.entries.push({ definition: definitions[base.entries.length], values: {} });
    }
    base.entries[index] = {
      definition: definitions[index],
      values: { ...base.entries[index].values, ...values }
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

export const _internals = {
  DB_NAME,
  SESSION_TABLE
};
