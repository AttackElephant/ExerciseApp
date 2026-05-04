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
  getSessionsInRange,
  getAllSessions,
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

test('loadSession returns stored entries verbatim — ignores supplied defaults', async () => {
  freshDb();
  await saveExerciseValues('2026-05-04', 'afternoon', 0, [PUSHUP_DEF, PLANK_DEF],
    { sets: 3, reps: 15 });
  await saveExerciseValues('2026-05-04', 'afternoon', 1, [PUSHUP_DEF, PLANK_DEF],
    { sets: 3, duration_s: 60 });

  // Caller passes a different default order plus a new exercise — should be
  // ignored because a stored row exists. Historic display reflects the
  // snapshot, not today's regime (US12).
  const NEW = { name: 'Squat', type: 'resistance', sets: 4, reps: 12 };
  const s = await loadSession('2026-05-04', 'afternoon', [PLANK_DEF, PUSHUP_DEF, NEW]);
  assert.is(s.entries.length, 2);
  assert.is(s.entries[0].definition.name, 'Push-up');
  assert.is(s.entries[1].definition.name, 'Plank');
});

test('definition snapshot is preserved across subsequent saves (US12)', async () => {
  freshDb();
  // Initial save with the original definition.
  const v1Definition = { ...RUN_DEF, distance_km: 5, duration_min: 30 };
  await saveExerciseValues('2026-05-04', 'morning', 0, [v1Definition],
    { distance_km: 5.0 });

  // Regime is updated locally — caller passes a different definition for
  // the same exercise name. The stored snapshot must NOT be overwritten.
  const v2Definition = { ...RUN_DEF, distance_km: 7, duration_min: 45 };
  await saveExerciseValues('2026-05-04', 'morning', 0, [v2Definition],
    { duration_min: 31 });

  const s = await loadSession('2026-05-04', 'morning', [v2Definition]);
  assert.is(s.entries[0].definition.distance_km, 5);   // original snapshot
  assert.is(s.entries[0].definition.duration_min, 30); // original snapshot
  assert.equal(s.entries[0].values, { distance_km: 5.0, duration_min: 31 });
});

test('loadSession on unlogged date seeds from supplied defaults (US10)', async () => {
  freshDb();
  const s = await loadSession('2026-04-25', 'morning', [RUN_DEF]);
  assert.is(s.complete, false);
  assert.is(s.entries.length, 1);
  assert.is(s.entries[0].definition.name, '5k Run');
  assert.equal(s.entries[0].values, {});
});

test('historic dates and today are stored independently', async () => {
  freshDb();
  await saveExerciseValues('2026-04-27', 'morning', 0, [RUN_DEF], { distance_km: 4.5 });
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF], { distance_km: 5.2 });

  const past = await loadSession('2026-04-27', 'morning', [RUN_DEF]);
  const today = await loadSession('2026-05-04', 'morning', [RUN_DEF]);
  assert.equal(past.entries[0].values, { distance_km: 4.5 });
  assert.equal(today.entries[0].values, { distance_km: 5.2 });
});

test('getSessionsInRange returns rows within [from, to] inclusive, sorted', async () => {
  freshDb();
  await saveExerciseValues('2026-04-25', 'morning', 0, [RUN_DEF], { distance_km: 4 });
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF], { distance_km: 5 });
  await saveExerciseValues('2026-05-04', 'afternoon', 0, [PLANK_DEF], { sets: 3, duration_s: 60 });
  await saveExerciseValues('2026-05-10', 'morning', 0, [RUN_DEF], { distance_km: 6 });

  const rows = await getSessionsInRange('2026-05-01', '2026-05-09');
  assert.is(rows.length, 2);
  assert.is(rows[0].date, '2026-05-04');
  assert.is(rows[0].session, 'morning');
  assert.is(rows[1].date, '2026-05-04');
  assert.is(rows[1].session, 'afternoon');
});

test('getSessionsInRange single-day (from = to) returns just that day (US16)', async () => {
  freshDb();
  await saveExerciseValues('2026-05-03', 'morning', 0, [RUN_DEF], { distance_km: 4 });
  await saveExerciseValues('2026-05-04', 'morning', 0, [RUN_DEF], { distance_km: 5 });
  await saveExerciseValues('2026-05-05', 'morning', 0, [RUN_DEF], { distance_km: 6 });

  const rows = await getSessionsInRange('2026-05-04', '2026-05-04');
  assert.is(rows.length, 1);
  assert.is(rows[0].date, '2026-05-04');
});

test('getAllSessions returns every row sorted asc (US16.5)', async () => {
  freshDb();
  await saveExerciseValues('2026-05-10', 'morning', 0, [RUN_DEF], { distance_km: 6 });
  await saveExerciseValues('2026-04-25', 'morning', 0, [RUN_DEF], { distance_km: 4 });
  await saveExerciseValues('2026-05-04', 'afternoon', 0, [PLANK_DEF], { sets: 3, duration_s: 60 });

  const rows = await getAllSessions();
  assert.is(rows.length, 3);
  assert.is(rows[0].date, '2026-04-25');
  assert.is(rows[1].date, '2026-05-04');
  assert.is(rows[2].date, '2026-05-10');
});

test.run();
