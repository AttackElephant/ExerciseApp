// Run db.js operations against a fresh fake-indexeddb per test.
import 'fake-indexeddb/auto';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import Dexie from 'dexie';

import {
  dateKey,
  loadSession,
  saveExerciseValues,
  setSessionComplete,
  _setDbForTest,
  _internals
} from '../../src/db.js';

const RUN_DEF = {
  name: '5k Run', type: 'running',
  distance_km: 5, duration_min: 30, surface: 'outdoor'
};
const PLANK_DEF = { name: 'Plank', type: 'resistance', sets: 3, duration_s: 60 };
const PUSHUP_DEF = { name: 'Push-up', type: 'resistance', sets: 3, reps: 15 };

function freshDb() {
  // New DB name per test so we get isolated state without manual teardown.
  const name = `${_internals.DB_NAME}-${Math.random().toString(36).slice(2)}`;
  const db = new Dexie(name);
  db.version(1).stores({
    [_internals.SESSION_TABLE]: '[date+session], date, session, complete'
  });
  _setDbForTest(db);
  return db;
}

test('dateKey formats device-local YYYY-MM-DD', () => {
  assert.is(dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.is(dateKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('loadSession returns empty skeleton when nothing stored', async () => {
  freshDb();
  const s = await loadSession('2026-05-04', 'morning', [RUN_DEF]);
  assert.is(s.complete, false);
  assert.is(s.entries.length, 1);
  assert.equal(s.entries[0].values, {});
  assert.equal(s.entries[0].definition, RUN_DEF);
});

test('saveExerciseValues persists values across loads', async () => {
  freshDb();
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF],
    { distance_km: 5.2, duration_min: 31, surface: 'outdoor' });
  const s = await loadSession('2026-05-04', 'morning', [RUN_DEF]);
  assert.equal(s.entries[0].values, { distance_km: 5.2, duration_min: 31, surface: 'outdoor' });
});

test('saveExerciseValues merges with existing values', async () => {
  freshDb();
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF],
    { distance_km: 5.2 });
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF],
    { duration_min: 31 });
  const s = await loadSession('2026-05-04', 'morning', [RUN_DEF]);
  assert.equal(s.entries[0].values, { distance_km: 5.2, duration_min: 31 });
});

test('morning and afternoon are stored independently (US8)', async () => {
  freshDb();
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF],
    { distance_km: 5 });
  await saveExerciseValues('2026-05-04', 'afternoon', 0, [PLANK_DEF],
    { sets: 3, duration_s: 60 });

  const am = await loadSession('2026-05-04', 'morning', [RUN_DEF]);
  const pm = await loadSession('2026-05-04', 'afternoon', [PLANK_DEF]);

  assert.equal(am.entries[0].values, { distance_km: 5 });
  assert.equal(pm.entries[0].values, { sets: 3, duration_s: 60 });
});

test('setSessionComplete toggles flag and timestamp (US9)', async () => {
  freshDb();
  await setSessionComplete('2026-05-04', 'morning', true, [RUN_DEF]);
  let s = await loadSession('2026-05-04', 'morning', [RUN_DEF]);
  assert.is(s.complete, true);
  assert.ok(typeof s.completedAt === 'number');

  await setSessionComplete('2026-05-04', 'morning', false, [RUN_DEF]);
  s = await loadSession('2026-05-04', 'morning', [RUN_DEF]);
  assert.is(s.complete, false);
  assert.is(s.completedAt, null);
});

test('completed sessions remain editable (US9)', async () => {
  freshDb();
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF],
    { distance_km: 5 });
  await setSessionComplete('2026-05-04', 'morning', true, [RUN_DEF]);
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF],
    { duration_min: 30 });

  const s = await loadSession('2026-05-04', 'morning', [RUN_DEF]);
  assert.is(s.complete, true);
  assert.equal(s.entries[0].values, { distance_km: 5, duration_min: 30 });
});

test('reconcile preserves values when regime changes order or adds entries', async () => {
  freshDb();
  await saveExerciseValues('2026-05-04', 'afternoon', 0, [PUSHUP_DEF, PLANK_DEF],
    { sets: 3, reps: 15 });
  await saveExerciseValues('2026-05-04', 'afternoon', 1, [PUSHUP_DEF, PLANK_DEF],
    { sets: 3, duration_s: 60 });

  // Regime now has Plank first, Push-up second, plus a new exercise at the end.
  const NEW = { name: 'Squat', type: 'resistance', sets: 4, reps: 12 };
  const s = await loadSession('2026-05-04', 'afternoon', [PLANK_DEF, PUSHUP_DEF, NEW]);
  assert.is(s.entries.length, 3);
  assert.equal(s.entries[0].values, { sets: 3, duration_s: 60 });   // plank
  assert.equal(s.entries[1].values, { sets: 3, reps: 15 });         // push-up
  assert.equal(s.entries[2].values, {});                            // new
});

test.run();
