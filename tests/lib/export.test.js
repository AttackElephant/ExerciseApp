import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { sessionsToTSV, HEADERS } from '../../src/export.js';

const RUN = {
  name: '5k Run', type: 'running',
  distance_km: 5, duration_min: 30, surface: 'outdoor'
};
const PUSHUP = { name: 'Push-up', type: 'resistance', sets: 3, reps: 15 };
const PLANK = { name: 'Plank', type: 'resistance', sets: 3, duration_s: 60 };

function rows(tsv) {
  return tsv.split('\n').map((l) => l.split('\t'));
}

test('always emits header row, even with zero data rows (US14)', () => {
  const { tsv, dataRows } = sessionsToTSV([]);
  assert.is(dataRows, 0);
  assert.is(rows(tsv).length, 1);
  assert.equal(rows(tsv)[0], HEADERS);
});

test('header order: set column sits between type and sets', () => {
  assert.equal(HEADERS, [
    'date', 'session', 'exercise_name', 'type',
    'set', 'sets', 'reps', 'duration_s',
    'distance_km', 'duration_min', 'surface'
  ]);
});

test('running row leaves both set and resistance columns empty', () => {
  const { tsv } = sessionsToTSV([{
    date: '2026-05-04', session: 'morning',
    entries: [{ definition: RUN, values: { distance_km: 5.2, duration_min: 31, surface: 'outdoor' } }]
  }]);
  assert.equal(rows(tsv)[1], [
    '2026-05-04', 'morning', '5k Run', 'running',
    '', '',                                  // set, sets
    '', '',                                  // reps, duration_s
    '5.2', '31', 'outdoor'
  ]);
});

test('legacy resistance row: set blank, sets populated', () => {
  const { tsv } = sessionsToTSV([{
    date: '2026-05-04', session: 'afternoon',
    entries: [{ definition: PLANK, values: { sets: 3, duration_s: 60 } }]
  }]);
  assert.equal(rows(tsv)[1], [
    '2026-05-04', 'afternoon', 'Plank', 'resistance',
    '', '3',                                 // set blank for legacy, sets total
    '', '60',
    '', '', ''
  ]);
});

test('per-set reps: emits one row per set with set index 1..N', () => {
  const { tsv, dataRows } = sessionsToTSV([{
    date: '2026-05-04', session: 'afternoon',
    entries: [{ definition: PUSHUP, values: { reps: [14, 12, 10] } }]
  }]);
  const r = rows(tsv);
  assert.is(dataRows, 3);
  assert.is(r.length, 4); // 1 header + 3
  assert.equal(r[1].slice(4, 8), ['1', '3', '14', '']);
  assert.equal(r[2].slice(4, 8), ['2', '3', '12', '']);
  assert.equal(r[3].slice(4, 8), ['3', '3', '10', '']);
});

test('per-set hold-time: emits one row per set with duration_s populated', () => {
  const { tsv, dataRows } = sessionsToTSV([{
    date: '2026-05-04', session: 'afternoon',
    entries: [{ definition: PLANK, values: { duration_s: [60, 55, 50] } }]
  }]);
  const r = rows(tsv);
  assert.is(dataRows, 3);
  assert.equal(r[1].slice(4, 8), ['1', '3', '', '60']);
  assert.equal(r[3].slice(4, 8), ['3', '3', '', '50']);
});

test('per-set with sparse array: empty slots still emit a row with blank value', () => {
  const { tsv, dataRows } = sessionsToTSV([{
    date: '2026-05-04', session: 'afternoon',
    entries: [{ definition: PUSHUP, values: { reps: [14, undefined, 10] } }]
  }]);
  const r = rows(tsv);
  assert.is(dataRows, 3);
  assert.equal(r[1].slice(4, 8), ['1', '3', '14', '']);
  assert.equal(r[2].slice(4, 8), ['2', '3', '', '']);
  assert.equal(r[3].slice(4, 8), ['3', '3', '10', '']);
});

test('exercise_name and type always populated even with zero values (US15)', () => {
  const { tsv } = sessionsToTSV([{
    date: '2026-05-04', session: 'morning',
    entries: [{ definition: PUSHUP, values: {} }]
  }]);
  // No reps/duration_s array yet — emits a single shape-agnostic row so
  // the row is still type-tagged.
  const r = rows(tsv);
  assert.is(r[1][2], 'Push-up');
  assert.is(r[1][3], 'resistance');
});

test('multi-day mixed-type export still emits one TSV per call (US14)', () => {
  const { tsv, dataRows } = sessionsToTSV([
    {
      date: '2026-05-04', session: 'morning',
      entries: [{ definition: RUN, values: { distance_km: 5, duration_min: 30, surface: 'outdoor' } }]
    },
    {
      date: '2026-05-04', session: 'afternoon',
      entries: [
        { definition: PUSHUP, values: { reps: [15, 13, 11] } },
        { definition: PLANK, values: { duration_s: [60, 50, 40] } }
      ]
    },
    {
      date: '2026-05-06', session: 'morning',
      entries: [{ definition: RUN, values: { distance_km: 5.5, duration_min: 33, surface: 'treadmill' } }]
    }
  ]);
  // 1 (run) + 3 (push-ups per-set) + 3 (plank per-set) + 1 (run) = 8 data rows
  assert.is(dataRows, 8);
  assert.is(rows(tsv).length, 9);
});

test('single-day copy from=to uses the same format (US16)', () => {
  const { tsv, dataRows } = sessionsToTSV([{
    date: '2026-05-04', session: 'morning',
    entries: [{ definition: RUN, values: { distance_km: 5, duration_min: 30, surface: 'outdoor' } }]
  }]);
  assert.is(dataRows, 1);
  assert.equal(rows(tsv)[0], HEADERS);
});

test('escapes tabs/newlines in user-entered values', () => {
  const naughty = { ...PUSHUP, name: 'Push-up\twith\ntabs' };
  const { tsv } = sessionsToTSV([{
    date: '2026-05-04', session: 'morning',
    entries: [{ definition: naughty, values: { reps: [15, 13, 11] } }]
  }]);
  // Cell 2 (exercise_name) must not contain raw tabs/newlines
  const cells = tsv.split('\n')[1].split('\t');
  assert.is(cells[2].includes('\t'), false);
  assert.is(cells[2].includes('\n'), false);
});

test.run();
