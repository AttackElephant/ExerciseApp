// Single source of truth for every persisted data shape in the app.
// Holds:
//   - the constant value-sets a regime can contain (weekdays, exercise
//     types, surfaces);
//   - the runtime validator `validateRegime`;
//   - JSDoc typedefs for the regime, the logged-session row that lives
//     in the `sessions` IndexedDB store, and the image record that lives
//     in the `images` IndexedDB store.
//
// Every other module imports from here when it needs to know what a
// "valid X" looks like. See ADR-003.

export const WEEKDAYS = Object.freeze([
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday'
]);

export const SESSIONS = Object.freeze(['morning', 'afternoon']);
export const EXERCISE_TYPES = Object.freeze(['running', 'resistance']);
export const SURFACES = Object.freeze(['treadmill', 'outdoor']);

// ---------- JSDoc typedefs (no runtime cost) ----------

/**
 * @typedef {'running' | 'resistance'} ExerciseType
 * @typedef {'morning' | 'afternoon'} SessionName
 * @typedef {'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'} Weekday
 * @typedef {'treadmill' | 'outdoor'} Surface
 */

/**
 * @typedef {Object} RunningExercise
 * @property {string} name
 * @property {'running'} type
 * @property {number} distance_km   positive, 1 dp supported
 * @property {number} duration_min  positive
 * @property {Surface} surface
 */

/**
 * @typedef {Object} ResistanceExercise
 * @property {string} name
 * @property {'resistance'} type
 * @property {number} sets          positive integer
 * @property {number} [reps]        positive integer; either reps or
 *                                  duration_s must be present
 * @property {number} [duration_s]  positive
 */

/** @typedef {RunningExercise | ResistanceExercise} Exercise */

/**
 * @typedef {Object} DayEntry
 * @property {Exercise[]} [morning]   non-empty if present
 * @property {Exercise[]} [afternoon] non-empty if present
 */

/**
 * @typedef {Object} Regime
 * @property {string} [name]
 * @property {Partial<Record<Weekday, DayEntry>>} days  must contain at
 *           least one weekday with at least one session.
 */

/**
 * @typedef {{ valid: true } | { valid: false, error: string }} ValidationResult
 */

/**
 * Per-exercise log entry stored alongside the rest of a session row.
 * `definition` is the regime snapshot at first-write time (US12); it is
 * never overwritten by later edits. `values` are whatever the user
 * entered, and may be partial.
 *
 * Resistance reps and hold-time are stored as arrays — one slot per set —
 * so a 3-set push-up exercise records {14, 12, 10} individually. Slots
 * may be undefined for sets the user hasn't filled in. Legacy entries
 * (pre per-set support) keep their scalar shape and are read/displayed
 * as a single value; no in-place migration.
 *
 * @typedef {Object} LoggedEntry
 * @property {Exercise} definition
 * @property {{
 *   distance_km?: number,
 *   duration_min?: number,
 *   surface?: Surface,
 *   sets?: number,                    // legacy only
 *   reps?: number | number[],         // array = per-set; number = legacy
 *   duration_s?: number | number[]    // array = per-set; number = legacy
 * }} values
 */

/**
 * One row in the `sessions` IndexedDB store. Keyed by the composite
 * `[date, session]`.
 *
 * @typedef {Object} LoggedSession
 * @property {string}  date         YYYY-MM-DD device-local
 * @property {SessionName} session
 * @property {boolean} complete
 * @property {number|null} completedAt  ms-since-epoch when last marked complete
 * @property {LoggedEntry[]} entries
 */

/**
 * One row in the `images` IndexedDB store. Keyed by the exercise name
 * so that regime updates that retain the name retain the image (US21).
 *
 * @typedef {Object} StoredImage
 * @property {string} name
 * @property {Blob}   blob
 * @property {string} mime
 * @property {number} addedAt   ms-since-epoch
 */

// ---------- Runtime validator ----------

function fail(error) { return { valid: false, error }; }
function ok() { return { valid: true }; }

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
  if (!EXERCISE_TYPES.includes(ex.type)) {
    return `Exercise "${ex.name}" at ${location} has unknown type "${ex.type}"`;
  }

  if (ex.type === 'running') {
    if (!isPositiveNumber(ex.distance_km)) {
      return `Running exercise "${ex.name}" at ${location} requires numeric distance_km`;
    }
    if (!isPositiveNumber(ex.duration_min)) {
      return `Running exercise "${ex.name}" at ${location} requires numeric duration_min`;
    }
    if (!SURFACES.includes(ex.surface)) {
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

/**
 * @param {unknown} regime
 * @returns {ValidationResult}
 */
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
    if (!WEEKDAYS.includes(day)) {
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
      if (!SESSIONS.includes(session)) {
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
