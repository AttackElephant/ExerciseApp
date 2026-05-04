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

test.run();
