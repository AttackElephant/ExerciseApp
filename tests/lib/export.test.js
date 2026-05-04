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

test('header order matches PRD US14', () => {
  assert.equal(HEADERS, [
    'date', 'session', 'exercise_name', 'type',
    'sets', 'reps', 'duration_s',
    'distance_km', 'duration_min', 'surface'
  ]);
});

test('running row leaves resistance columns empty', () => {
  const { tsv } = sessionsToTSV([{
    date: '2026-05-04', session: 'morning',
    entries: [{ definition: RUN, values: { distance_km: 5.2, duration_min: 31, surface: 'outdoor' } }]
  }]);
  const r = rows(tsv);
  assert.equal(r[1], [
    '2026-05-04', 'morning', '5k Run', 'running',
    '', '', '',                         // sets, reps, duration_s
    '5.2', '31', 'outdoor'
  ]);
});

test('resistance row leaves running columns empty', () => {
  const { tsv } = sessionsToTSV([{
    date: '2026-05-04', session: 'afternoon',
    entries: [{ definition: PLANK, values: { sets: 3, duration_s: 60 } }]
  }]);
  const r = rows(tsv);
  assert.equal(r[1], [
    '2026-05-04', 'afternoon', 'Plank', 'resistance',
    '3', '', '60',
    '', '', ''
  ]);
});

test('exercise_name and type always populated even with zero values (US15)', () => {
  const { tsv } = sessionsToTSV([{
    date: '2026-05-04', session: 'morning',
    entries: [{ definition: PUSHUP, values: {} }]
  }]);
  const r = rows(tsv);
  assert.is(r[1][2], 'Push-up');
  assert.is(r[1][3], 'resistance');
  // sets/reps cells are empty but the row is still present
  assert.is(r[1][4], '');
  assert.is(r[1][5], '');
});

test('multi-day mixed-type export emits one row per exercise per session (US14)', () => {
  const { tsv, dataRows } = sessionsToTSV([
    {
      date: '2026-05-04', session: 'morning',
      entries: [{ definition: RUN, values: { distance_km: 5, duration_min: 30, surface: 'outdoor' } }]
    },
    {
      date: '2026-05-04', session: 'afternoon',
      entries: [
        { definition: PUSHUP, values: { sets: 3, reps: 15 } },
        { definition: PLANK, values: { sets: 3, duration_s: 60 } }
      ]
    },
    {
      date: '2026-05-06', session: 'morning',
      entries: [{ definition: RUN, values: { distance_km: 5.5, duration_min: 33, surface: 'treadmill' } }]
    }
  ]);
  assert.is(dataRows, 4);
  assert.is(rows(tsv).length, 5);    // 1 header + 4 data
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
    entries: [{ definition: naughty, values: { sets: 3, reps: 15 } }]
  }]);
  // Cell 2 (exercise_name) must not contain raw tabs/newlines
  const cells = tsv.split('\n')[1].split('\t');
  assert.is(cells[2].includes('\t'), false);
  assert.is(cells[2].includes('\n'), false);
});

test.run();
