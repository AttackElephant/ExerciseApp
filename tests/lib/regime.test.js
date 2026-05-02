// tests/lib/regime.test.js
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { validateRegime } from '../../src/regime.js';

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

test.run();