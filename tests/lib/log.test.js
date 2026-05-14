import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { isEntryComplete } from '../../src/log.js';

const RUN_DEF = {
  name: '5k Run', type: 'running',
  distance_km: 5, duration_min: 30, surface: 'outdoor'
};
const PLANK_DEF = { name: 'Plank', type: 'resistance', sets: 3, duration_s: 60 };
const PUSHUP_DEF = { name: 'Push-up', type: 'resistance', sets: 3, reps: 15 };

test('running: incomplete when any field missing', () => {
  assert.is(isEntryComplete(RUN_DEF, {}), false);
  assert.is(isEntryComplete(RUN_DEF, { distance_km: 5 }), false);
  assert.is(isEntryComplete(RUN_DEF, { distance_km: 5, duration_min: 30 }), false);
});

test('running: complete when all three filled', () => {
  assert.is(isEntryComplete(RUN_DEF,
    { distance_km: 5, duration_min: 30, surface: 'outdoor' }), true);
  assert.is(isEntryComplete(RUN_DEF,
    { distance_km: 5.2, duration_min: 31, surface: 'treadmill' }), true);
});

test('running: rejects unknown surface', () => {
  assert.is(isEntryComplete(RUN_DEF,
    { distance_km: 5, duration_min: 30, surface: 'gravel' }), false);
});

test('resistance reps: incomplete without reps filled', () => {
  assert.is(isEntryComplete(PUSHUP_DEF, { sets: 3 }), false);
  assert.is(isEntryComplete(PUSHUP_DEF, { sets: 3, reps: 15 }), true);
});

test('resistance hold: incomplete without duration filled', () => {
  assert.is(isEntryComplete(PLANK_DEF, { sets: 3 }), false);
  assert.is(isEntryComplete(PLANK_DEF, { sets: 3, duration_s: 60 }), true);
});

test('zero or non-finite values are not complete', () => {
  assert.is(isEntryComplete(RUN_DEF,
    { distance_km: 0, duration_min: 30, surface: 'outdoor' }), false);
  assert.is(isEntryComplete(PUSHUP_DEF, { sets: 3, reps: NaN }), false);
});

// --- per-set shape ---

test('per-set reps: complete when all N slots filled', () => {
  assert.is(isEntryComplete(PUSHUP_DEF, { reps: [14, 12, 10] }), true);
});

test('per-set reps: incomplete when fewer than N slots', () => {
  assert.is(isEntryComplete(PUSHUP_DEF, { reps: [14, 12] }), false);
  assert.is(isEntryComplete(PUSHUP_DEF, { reps: [] }), false);
});

test('per-set reps: incomplete when any slot is undefined', () => {
  assert.is(isEntryComplete(PUSHUP_DEF, { reps: [14, undefined, 10] }), false);
});

test('per-set hold: complete when all N hold-times filled', () => {
  assert.is(isEntryComplete(PLANK_DEF, { duration_s: [60, 55, 50] }), true);
});

test('per-set hold: incomplete with one missing slot', () => {
  assert.is(isEntryComplete(PLANK_DEF, { duration_s: [60, 55] }), false);
});

test('per-set: 1-set exercise complete with a one-element array', () => {
  const SINGLE = { name: 'arm-circles', type: 'resistance', sets: 1, reps: 20 };
  assert.is(isEntryComplete(SINGLE, { reps: [20] }), true);
  assert.is(isEntryComplete(SINGLE, { reps: [] }), false);
});

test('mixed legacy/new shape: presence of numeric `sets` keeps legacy semantics', () => {
  // Legacy entries kept their `sets` scalar; we shouldn't treat them as
  // per-set just because the reps field is missing.
  assert.is(isEntryComplete(PUSHUP_DEF, { sets: 3, reps: 14 }), true);
  assert.is(isEntryComplete(PUSHUP_DEF, { sets: 3 }), false);
});

test.run();
