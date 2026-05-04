// tests/ui/session.test.js
// jsdom-backed UI tests for session.js. Wires fake-indexeddb so the db
// layer works in Node, and a real jsdom Document so DOM ops behave as
// they would on a device — which is the only way to catch bugs like
// insertBefore-against-non-child that don't show up in unit tests.

import 'fake-indexeddb/auto';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { JSDOM } from 'jsdom';
import Dexie from 'dexie';

// jsdom MUST install its globals before any module that touches `document`
// loads. globalThis.navigator is a read-only getter on modern Node, so we
// install it via defineProperty instead of plain assignment.
const dom = new JSDOM('<!DOCTYPE html><body><main id="app"></main></body>', {
  url: 'https://example.com/'
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;

// Dynamic imports so the modules see the globals above.
const { renderForDate } = await import('../../src/session.js');
const { _setDbForTest, _internals } = await import('../../src/db.js');

// --- Fixtures ---

const RUN = {
  name: '5k Run', type: 'running',
  distance_km: 5, duration_min: 30, surface: 'outdoor'
};
const PUSHUP = { name: 'Push-up', type: 'resistance', sets: 3, reps: 15 };
const PLANK  = { name: 'Plank', type: 'resistance', sets: 3, duration_s: 60 };

const MONDAY_REGIME = {
  days: {
    monday: { morning: [RUN], afternoon: [PUSHUP, PLANK] }
  }
};

const REST_DAY_REGIME = { days: {} };

const MONDAY = new Date(2026, 4, 4); // 2026-05-04 is a Monday
const SUNDAY = new Date(2026, 4, 3);

function freshDb() {
  const name = `${_internals.DB_NAME}-${Math.random().toString(36).slice(2)}`;
  const db = new Dexie(name);
  db.version(3).stores({
    [_internals.SESSION_TABLE]: '[date+session], date, session, complete',
    [_internals.META_TABLE]: 'key',
    [_internals.IMAGES_TABLE]: 'name'
  });
  _setDbForTest(db);
  return db;
}

function freshRoot() {
  const root = document.getElementById('app');
  while (root.firstChild) root.removeChild(root.firstChild);
  return root;
}

// --- Structure ---

test('renderForDate replaces the Loading placeholder with the day view', async () => {
  freshDb();
  const root = freshRoot();
  await renderForDate(root, MONDAY_REGIME, MONDAY, () => {});
  // The placeholder text must NOT survive — that's the iPhone "stuck on
  // Loading…" symptom we're guarding against.
  const empties = [...root.querySelectorAll('.session__empty')]
    .map((n) => n.textContent);
  assert.not.ok(empties.includes('Loading…'),
    'page should not be stuck on Loading…');
});

test('renders header with date nav, date string, and weekday heading', async () => {
  freshDb();
  const root = freshRoot();
  await renderForDate(root, MONDAY_REGIME, MONDAY, () => {});
  assert.ok(root.querySelector('header.today'));
  assert.ok(root.querySelector('.datenav'));
  assert.ok(root.querySelector('.today__date'));
  assert.ok(root.querySelector('.today__weekday'));
  assert.ok(root.querySelector('.today__weekday').textContent
    .toLowerCase().includes('monday'));
});

test('renders both Morning and Afternoon sessions on a training day', async () => {
  freshDb();
  const root = freshRoot();
  await renderForDate(root, MONDAY_REGIME, MONDAY, () => {});
  const titles = [...root.querySelectorAll('.session__title')]
    .map((n) => n.textContent);
  assert.equal(titles, ['Morning', 'Afternoon']);
});

test('rest day still renders both sessions, each with empty-state copy', async () => {
  // Phase 1's `.rest-day` short-circuit was removed; both sessions always
  // render so the user can register exercises on a non-training day.
  freshDb();
  const root = freshRoot();
  await renderForDate(root, REST_DAY_REGIME, SUNDAY, () => {});
  const sessions = root.querySelectorAll('section.session');
  assert.is(sessions.length, 2);
  const empties = [...root.querySelectorAll('.session__empty')]
    .map((n) => n.textContent);
  assert.ok(empties.every((t) => t === 'No exercises scheduled.'));
});

// --- Per-exercise rendering ---

test('running exercise shows distance / duration / surface in its target line', async () => {
  freshDb();
  const root = freshRoot();
  await renderForDate(root, MONDAY_REGIME, MONDAY, () => {});
  const target = root.querySelector('.exercise--running .exercise__target');
  assert.ok(target);
  assert.ok(target.textContent.includes('5 km'));
  assert.ok(target.textContent.includes('30 min'));
  assert.ok(target.textContent.includes('outdoor'));
});

test('resistance with reps shows sets and reps in its target line', async () => {
  freshDb();
  const root = freshRoot();
  await renderForDate(root, MONDAY_REGIME, MONDAY, () => {});
  const items = [...root.querySelectorAll('.exercise--resistance')];
  const pushup = items.find((n) =>
    n.querySelector('.exercise__name').textContent === 'Push-up');
  const target = pushup.querySelector('.exercise__target');
  assert.ok(target.textContent.includes('3 sets'));
  assert.ok(target.textContent.includes('15 reps'));
});

test('resistance with duration_s shows hold time, no reps', async () => {
  freshDb();
  const root = freshRoot();
  await renderForDate(root, MONDAY_REGIME, MONDAY, () => {});
  const items = [...root.querySelectorAll('.exercise--resistance')];
  const plank = items.find((n) =>
    n.querySelector('.exercise__name').textContent === 'Plank');
  const target = plank.querySelector('.exercise__target');
  assert.ok(target.textContent.includes('60s hold'));
  assert.not.ok(target.textContent.includes('reps'));
});

// --- Phase 5b regression: image affordance must not throw ---

test('resistance exercise renders the paste-image affordance', async () => {
  freshDb();
  const root = freshRoot();
  await renderForDate(root, MONDAY_REGIME, MONDAY, () => {});
  const aff = root.querySelectorAll('.exercise--resistance .image-aff');
  assert.is(aff.length, 2, 'one image affordance per resistance exercise');
  // Each affordance should have a button child plus the status span.
  for (const a of aff) {
    assert.ok(a.querySelector('.image-aff__btn'));
    assert.ok(a.querySelector('.image-aff__status'));
  }
});

test('running exercise does NOT render the image affordance (US19)', async () => {
  freshDb();
  const root = freshRoot();
  await renderForDate(root, MONDAY_REGIME, MONDAY, () => {});
  const runRow = root.querySelector('.exercise--running');
  assert.not.ok(runRow.querySelector('.image-aff'),
    'running exercises should not get an image affordance');
});

test.run();
