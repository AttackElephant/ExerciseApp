// Regime: schema, validation, default, and today-lookup.
// All other modules go through this for regime data.

import { defaultRegime } from './defaultRegime.js';
import { getStoredRegime, setStoredRegime } from './db.js';

const VALID_DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday'
];

const VALID_SESSIONS = ['morning', 'afternoon'];
const VALID_TYPES = ['running', 'resistance'];
const VALID_SURFACES = ['treadmill', 'outdoor'];

function fail(error) {
  return { valid: false, error };
}

function ok() {
  return { valid: true };
}

function isPositiveNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}

function validateExercise(ex, location) {
  if (!ex || typeof ex !== 'object') {
    return `Exercise at ${location} is not an object`;
  }
  if (typeof ex.name !== 'string' || ex.name.trim() === '') {
    return `Exercise at ${location} is missing a name`;
  }
  if (!VALID_TYPES.includes(ex.type)) {
    return `Exercise "${ex.name}" at ${location} has unknown type "${ex.type}"`;
  }

  if (ex.type === 'running') {
    if (!isPositiveNumber(ex.distance_km)) {
      return `Running exercise "${ex.name}" at ${location} requires numeric distance_km`;
    }
    if (!isPositiveNumber(ex.duration_min)) {
      return `Running exercise "${ex.name}" at ${location} requires numeric duration_min`;
    }
    if (!VALID_SURFACES.includes(ex.surface)) {
      return `Running exercise "${ex.name}" at ${location} requires surface (treadmill|outdoor)`;
    }
    return null;
  }

  // resistance
  if (!isPositiveInt(ex.sets)) {
    return `Resistance exercise "${ex.name}" at ${location} requires integer sets`;
  }
  const hasReps = ex.reps !== undefined;
  const hasDuration = ex.duration_s !== undefined;
  if (!hasReps && !hasDuration) {
    return `Resistance exercise "${ex.name}" at ${location} requires reps or duration_s`;
  }
  if (hasReps && !isPositiveInt(ex.reps)) {
    return `Resistance exercise "${ex.name}" at ${location} has invalid reps`;
  }
  if (hasDuration && !isPositiveNumber(ex.duration_s)) {
    return `Resistance exercise "${ex.name}" at ${location} has invalid duration_s`;
  }
  return null;
}

export function validateRegime(regime) {
  if (!regime || typeof regime !== 'object') {
    return fail('Regime must be an object');
  }
  if (!regime.days || typeof regime.days !== 'object') {
    return fail('Regime must contain a days object');
  }

  const dayKeys = Object.keys(regime.days);
  if (dayKeys.length === 0) {
    return fail('Regime must contain at least one day');
  }

  for (const day of dayKeys) {
    if (!VALID_DAYS.includes(day)) {
      return fail(`Unknown weekday "${day}"`);
    }
    const sessions = regime.days[day];
    if (!sessions || typeof sessions !== 'object') {
      return fail(`Day "${day}" must be an object`);
    }
    const sessionKeys = Object.keys(sessions);
    if (sessionKeys.length === 0) {
      return fail(`Day "${day}" has no sessions`);
    }
    for (const session of sessionKeys) {
      if (!VALID_SESSIONS.includes(session)) {
        return fail(`Day "${day}" has unknown session "${session}"`);
      }
      const exercises = sessions[session];
      if (!Array.isArray(exercises) || exercises.length === 0) {
        return fail(`Session "${session}" on ${day} must be a non-empty array`);
      }
      for (let i = 0; i < exercises.length; i++) {
        const err = validateExercise(exercises[i], `${day}.${session}[${i}]`);
        if (err) return fail(err);
      }
    }
  }

  return ok();
}

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
