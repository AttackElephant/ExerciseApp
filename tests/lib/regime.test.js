// tests/lib/regime.test.js
import 'fake-indexeddb/auto';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import Dexie from 'dexie';
import {
  validateRegime,
  getActiveRegime,
  setActiveRegime
} from '../../src/regime.js';
import { _setDbForTest, _internals } from '../../src/db.js';
import { defaultRegime } from '../../src/defaultRegime.js';

function freshDb() {
  const name = `${_internals.DB_NAME}-${Math.random().toString(36).slice(2)}`;
  const db = new Dexie(name);
  db.version(1).stores({
    [_internals.SESSION_TABLE]: '[date+session], date, session, complete',
    [_internals.META_TABLE]: 'key'
  });
  _setDbForTest(db);
  return db;
}

const VALID_REGIME = {
  name: 'Test',
  days: {
    monday: {
      morning: [{ name: '3k Run', type: 'running', distance_km: 3, duration_min: 18, surface: 'outdoor' }]
    }
  }
};

// --- Structural validation ---

test('rejects null input', () => {
  const result = validateRegime(null);
  assert.is(result.valid, false);
  assert.ok(result.error.toLowerCase().includes('regime'));
});

test('rejects regime with no days', () => {
  const result = validateRegime({ days: {} });
  assert.is(result.valid, false);
});

test('rejects regime where a day has no sessions', () => {
  const result = validateRegime({
    days: {
      monday: {}
    }
  });
  assert.is(result.valid, false);
});

// --- Exercise type validation ---

test('rejects unknown exercise type', () => {
  const result = validateRegime({
    days: {
      monday: {
        morning: [{ name: 'Plank', type: 'yoga' }]
      }
    }
  });
  assert.is(result.valid, false);
  assert.ok(result.error.toLowerCase().includes('type'));
});

test('rejects running exercise missing required fields', () => {
  const result = validateRegime({
    days: {
      monday: {
        morning: [{ name: '5k Run', type: 'running' }]
      }
    }
  });
  assert.is(result.valid, false);
});

test('rejects resistance exercise with neither reps nor duration_s', () => {
  const result = validateRegime({
    days: {
      monday: {
        morning: [{ name: 'Plank', type: 'resistance', sets: 3 }]
      }
    }
  });
  assert.is(result.valid, false);
});

// --- Valid input ---

test('accepts valid running exercise', () => {
  const result = validateRegime({
    days: {
      monday: {
        morning: [{
          name: '5k Run',
          type: 'running',
          distance_km: 5,
          duration_min: 30,
          surface: 'outdoor'
        }]
      }
    }
  });
  assert.is(result.valid, true);
});

test('accepts resistance exercise with reps only', () => {
  const result = validateRegime({
    days: {
      monday: {
        morning: [{
          name: 'Push-up',
          type: 'resistance',
          sets: 3,
          reps: 15
        }]
      }
    }
  });
  assert.is(result.valid, true);
});

test('accepts resistance exercise with duration_s only (timed hold)', () => {
  const result = validateRegime({
    days: {
      monday: {
        morning: [{
          name: 'Plank',
          type: 'resistance',
          sets: 3,
          duration_s: 60
        }]
      }
    }
  });
  assert.is(result.valid, true);
});

test('accepts regime with multiple days and mixed session types', () => {
  const result = validateRegime({
    days: {
      monday: {
        morning: [{ name: '5k Run', type: 'running', distance_km: 5, duration_min: 30, surface: 'treadmill' }],
        afternoon: [{ name: 'Plank', type: 'resistance', sets: 3, duration_s: 60 }]
      },
      wednesday: {
        morning: [{ name: 'Push-up', type: 'resistance', sets: 3, reps: 15 }]
      }
    }
  });
  assert.is(result.valid, true);
});

// --- Active regime persistence (Phase 5a, US17/US18) ---

test('getActiveRegime returns the embedded default when nothing stored', async () => {
  freshDb();
  const r = await getActiveRegime();
  assert.is(r, defaultRegime);
});

test('setActiveRegime rejects invalid input with a plain-text error (US17)', async () => {
  freshDb();
  let err;
  try { await setActiveRegime({ days: {} }); } catch (e) { err = e; }
  assert.ok(err);
  assert.type(err.message, 'string');
  // Default still wins after the failed write.
  const r = await getActiveRegime();
  assert.is(r, defaultRegime);
});

test('setActiveRegime persists; getActiveRegime returns the stored regime (US17)', async () => {
  freshDb();
  await setActiveRegime(VALID_REGIME);
  const r = await getActiveRegime();
  assert.equal(r, VALID_REGIME);
});

test('getActiveRegime falls back to default when the stored regime is invalid', async () => {
  // Simulate a corrupted regime by writing past validation directly via db.
  freshDb();
  const { setStoredRegime } = await import('../../src/db.js');
  await setStoredRegime({ days: {} });    // empty, invalid
  const r = await getActiveRegime();
  assert.is(r, defaultRegime);
});

test.run();