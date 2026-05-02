// JSDoc typedefs only — no runtime code.

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
 * @property {number} distance_km
 * @property {number} duration_min
 * @property {Surface} surface
 */

/**
 * @typedef {Object} ResistanceExercise
 * @property {string} name
 * @property {'resistance'} type
 * @property {number} sets
 * @property {number} [reps]
 * @property {number} [duration_s]
 */

/**
 * @typedef {RunningExercise | ResistanceExercise} Exercise
 */

/**
 * @typedef {Object} DayEntry
 * @property {Exercise[]} [morning]
 * @property {Exercise[]} [afternoon]
 */

/**
 * @typedef {Object} Regime
 * @property {string} [name]
 * @property {Partial<Record<Weekday, DayEntry>>} days
 */

/**
 * @typedef {{ valid: true } | { valid: false, error: string }} ValidationResult
 */

export {}; // module marker
