// tests/ui/session.test.js
// jsdom-backed tests for session rendering (session.js + ui.js)

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { JSDOM } from 'jsdom';

// --- jsdom setup ---
// Must run before importing modules that touch `document` or `window`.

const dom = new JSDOM('<!DOCTYPE html><body><main id="app"></main></body>', {
  url: 'https://example.com'
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Dynamic import after globals are set
const { el, mount, formatWeekday, formatDateLong } = await import('../../src/session.js');
const { renderToday } = await import('../../src/session.js');

// --- Helpers ---

const MONDAY_REGIME = {
  days: {
    monday: {
      morning: [
        { name: '5k Run', type: 'running', distance_km: 5, duration_min: 30, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'Push-up', type: 'resistance', sets: 3, reps: 15 },
        { name: 'Plank', type: 'resistance', sets: 3, duration_s: 60 }
      ]
    }
  }
};

const MONDAY = new Date('2026-05-04T09:00:00'); // Known Monday

function freshRoot() {
  const root = document.getElementById('app');
  while (root.firstChild) root.removeChild(root.firstChild);
  return root;
}

// --- renderToday: structure ---

test('renders a header with date and weekday', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const header = root.querySelector('header.today');
  assert.ok(header, 'header.today should exist');
  assert.ok(header.querySelector('.today__weekday'), '.today__weekday should exist');
  assert.ok(header.querySelector('.today__date'), '.today__date should exist');
});

test('weekday heading contains Monday', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const heading = root.querySelector('.today__weekday');
  assert.ok(heading.textContent.toLowerCase().includes('monday'));
});

test('renders both morning and afternoon sessions on a training day', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const sessions = root.querySelectorAll('section.session');
  assert.is(sessions.length, 2, 'should render exactly 2 sessions');
});

test('session titles are Morning and Afternoon', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const titles = [...root.querySelectorAll('.session__title')].map(n => n.textContent);
  assert.ok(titles.includes('Morning'), 'Morning title should be present');
  assert.ok(titles.includes('Afternoon'), 'Afternoon title should be present');
});

// --- renderToday: rest day ---

test('renders rest day message when no sessions scheduled', () => {
  const root = freshRoot();
  const sundayRegime = { days: {} };
  const SUNDAY = new Date('2026-05-03T09:00:00');
  renderToday(root, sundayRegime, SUNDAY);
  const restDay = root.querySelector('.rest-day');
  assert.ok(restDay, '.rest-day section should exist');
  assert.not.ok(root.querySelector('section.session'), 'no session sections on rest day');
});

// --- renderToday: exercise rendering ---

test('running exercise shows distance, duration, and surface', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const detail = root.querySelector('.exercise--running .exercise__detail');
  assert.ok(detail, 'running exercise detail should exist');
  assert.ok(detail.textContent.includes('5 km'));
  assert.ok(detail.textContent.includes('30 min'));
  assert.ok(detail.textContent.includes('outdoor'));
});

test('resistance exercise with reps shows sets and reps', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const items = [...root.querySelectorAll('.exercise--resistance')];
  const pushup = items.find(n => n.querySelector('.exercise__name').textContent === 'Push-up');
  assert.ok(pushup, 'Push-up exercise should be in DOM');
  const detail = pushup.querySelector('.exercise__detail');
  assert.ok(detail.textContent.includes('3 sets'));
  assert.ok(detail.textContent.includes('15 reps'));
});

test('resistance exercise with duration_s shows hold time', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const items = [...root.querySelectorAll('.exercise--resistance')];
  const plank = items.find(n => n.querySelector('.exercise__name').textContent === 'Plank');
  assert.ok(plank, 'Plank exercise should be in DOM');
  const detail = plank.querySelector('.exercise__detail');
  assert.ok(detail.textContent.includes('60s hold'));
  assert.not.ok(detail.textContent.includes('reps'), 'reps should not appear on timed hold');
});

test('exercise name is rendered in .exercise__name', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const names = [...root.querySelectorAll('.exercise__name')].map(n => n.textContent);
  assert.ok(names.includes('5k Run'));
  assert.ok(names.includes('Push-up'));
  assert.ok(names.includes('Plank'));
});

test('exercise type badge is rendered in .exercise__type', () => {
  const root = freshRoot();
  renderToday(root, MONDAY_REGIME, MONDAY);
  const types = [...root.querySelectorAll('.exercise__type')].map(n => n.textContent);
  assert.ok(types.includes('running'));
  assert.ok(types.includes('resistance'));
});

// --- renderToday: session with no exercises ---

test('session with no exercises renders empty state', () => {
  const root = freshRoot();
  const regime = {
    days: {
      monday: {
        morning: null,
        afternoon: [{ name: 'Push-up', type: 'resistance', sets: 3, reps: 15 }]
      }
    }
  };
  renderToday(root, regime, MONDAY);
  const empty = root.querySelector('.session--empty');
  assert.ok(empty, 'empty session section should exist when morning is null');
  assert.ok(empty.querySelector('.session__empty'), '.session__empty message should exist');
});

// --- formatWeekday ---

test('formatWeekday capitalises first letter', () => {
  assert.is(formatWeekday('monday'), 'Monday');
  assert.is(formatWeekday('friday'), 'Friday');
});

test.run();