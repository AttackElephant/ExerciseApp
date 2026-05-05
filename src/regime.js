// Regime helpers: active-regime read/write and weekday lookup. The shape
// of a Regime — and the rules a pasted JSON must satisfy — live in
// src/schema.js (see ADR-003). validateRegime is re-exported here for
// callers that already have `regime.js` imported.

import { defaultRegime } from './defaultRegime.js';
import { getStoredRegime, setStoredRegime } from './db.js';
import { validateRegime } from './schema.js';

export { validateRegime } from './schema.js';

/**
 * Returns the active regime: the user-pasted regime from IndexedDB if one
 * exists and is still valid, otherwise the embedded default. A stored
 * regime that fails validation (e.g. corruption) falls back silently to
 * the default — the user is never left with a broken view.
 */
export async function getActiveRegime() {
  const stored = await getStoredRegime();
  if (stored) {
    const v = validateRegime(stored);
    if (v.valid) return stored;
    console.error('Stored regime failed validation; using default.', v.error);
  }
  return defaultRegime;
}

/**
 * Validate and persist a new regime. Throws with a plain-text message if
 * the regime is invalid; callers display the message to the user (US17).
 * On success the regime becomes active immediately for any subsequent
 * `getActiveRegime` call.
 */
export async function setActiveRegime(regime) {
  const v = validateRegime(regime);
  if (!v.valid) throw new Error(v.error);
  await setStoredRegime(regime);
}

const WEEKDAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday'
];

export function weekdayFor(date) {
  return WEEKDAY_NAMES[date.getDay()];
}

export function sessionsForDate(regime, date) {
  const day = weekdayFor(date);
  const entry = regime.days[day];
  return {
    weekday: day,
    morning: entry?.morning ?? null,
    afternoon: entry?.afternoon ?? null
  };
}
