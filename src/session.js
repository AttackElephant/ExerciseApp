// Today's-session display. Phase 1 = read-only render.

import { el, formatWeekday, formatDateLong, mount } from './ui.js';
import { sessionsForDate } from './regime.js';

function exerciseDetail(ex) {
  if (ex.type === 'running') {
    return `${ex.distance_km} km · ${ex.duration_min} min · ${ex.surface}`;
  }
  const parts = [`${ex.sets} sets`];
  if (ex.reps !== undefined) parts.push(`${ex.reps} reps`);
  if (ex.duration_s !== undefined) parts.push(`${ex.duration_s}s hold`);
  return parts.join(' · ');
}

function renderExercise(ex) {
  return el('li', { class: `exercise exercise--${ex.type}` }, [
    el('span', { class: 'exercise__name', text: ex.name }),
    el('span', { class: 'exercise__type', text: ex.type }),
    el('span', { class: 'exercise__detail', text: exerciseDetail(ex) })
  ]);
}

function renderSession(label, exercises) {
  if (!exercises) {
    return el('section', { class: 'session session--empty' }, [
      el('h2', { class: 'session__title', text: label }),
      el('p', { class: 'session__empty', text: 'No exercises scheduled.' })
    ]);
  }
  return el('section', { class: 'session' }, [
    el('h2', { class: 'session__title', text: label }),
    el('ol', { class: 'exercise-list' }, exercises.map(renderExercise))
  ]);
}

export function renderToday(root, regime, date = new Date()) {
  // Both morning and afternoon ALWAYS render. Visibility is never conditional
  // on the current time of day — only on whether the regime defines exercises.
  const { weekday, morning, afternoon } = sessionsForDate(regime, date);

  const header = el('header', { class: 'today' }, [
    el('p', { class: 'today__date', text: formatDateLong(date) }),
    el('h1', { class: 'today__weekday', text: formatWeekday(weekday) })
  ]);

  mount(root,
    header,
    renderSession('Morning', morning),
    renderSession('Afternoon', afternoon)
  );
}
