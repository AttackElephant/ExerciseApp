// Today / historic-date view. Both morning and afternoon ALWAYS render.
// Phase 3 adds date navigation (date picker + prev/next/today). Future
// dates are blocked by capping the picker at today.

import { el, formatWeekday, formatDateLong, mount, clear } from './ui.js';
import { sessionsForDate } from './regime.js';
import { loadSession, saveExerciseValues, setSessionComplete, dateKey } from './db.js';
import { renderExerciseFields, isEntryComplete } from './log.js';

function exerciseTarget(def) {
  if (def.type === 'running') {
    return `Target: ${def.distance_km} km · ${def.duration_min} min · ${def.surface}`;
  }
  const parts = [`${def.sets} sets`];
  if (def.reps !== undefined) parts.push(`${def.reps} reps`);
  if (def.duration_s !== undefined) parts.push(`${def.duration_s}s hold`);
  return `Target: ${parts.join(' · ')}`;
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function isAfter(a, b) {
  return dateKey(a) > dateKey(b);
}

function renderExerciseRow(date, session, index, definition, values, regimeDefinitions) {
  const li = el('li', { class: `exercise exercise--${definition.type}` });

  const head = el('div', { class: 'exercise__head' }, [
    el('span', { class: 'exercise__name', text: definition.name }),
    el('span', { class: 'exercise__type', text: definition.type })
  ]);
  const target = el('p', { class: 'exercise__target', text: exerciseTarget(definition) });

  let currentValues = { ...values };

  const applyCompletionClass = () => {
    li.classList.toggle('exercise--logged', isEntryComplete(definition, currentValues));
  };

  const fields = renderExerciseFields(
    definition,
    currentValues,
    (patch) => {
      currentValues = { ...currentValues, ...patch };
      applyCompletionClass();
      saveExerciseValues(date, session, index, regimeDefinitions, patch).catch((err) => {
        console.error('saveExerciseValues failed', err);
      });
    },
    `${date}-${session}-${index}`
  );

  li.appendChild(head);
  li.appendChild(target);
  li.appendChild(fields);
  applyCompletionClass();
  return li;
}

async function renderSession(label, date, session, regimeDefinitions) {
  const sectionRoot = el('section', { class: 'session' });

  const stored = await loadSession(date, session, regimeDefinitions ?? []);
  const completeBtn = el('button', {
    type: 'button',
    class: 'session__complete-btn'
  });
  const updateButtonState = (complete) => {
    completeBtn.textContent = complete ? 'Marked complete ✓' : 'Mark complete';
    completeBtn.setAttribute('aria-pressed', complete ? 'true' : 'false');
    sectionRoot.classList.toggle('session--complete', complete);
  };
  updateButtonState(stored.complete);

  completeBtn.addEventListener('click', async () => {
    const next = !sectionRoot.classList.contains('session--complete');
    updateButtonState(next);
    try {
      await setSessionComplete(date, session, next, regimeDefinitions ?? []);
    } catch (err) {
      console.error('setSessionComplete failed', err);
      updateButtonState(!next);
    }
  });

  const header = el('div', { class: 'session__header' }, [
    el('h2', { class: 'session__title', text: label }),
    completeBtn
  ]);
  sectionRoot.appendChild(header);

  // Source of truth for what to render: the stored entries' own definition
  // snapshots when present, otherwise the regime template.
  const entriesToRender = stored.entries.length > 0
    ? stored.entries
    : (regimeDefinitions ?? []).map((def) => ({ definition: def, values: {} }));

  if (entriesToRender.length === 0) {
    sectionRoot.appendChild(
      el('p', { class: 'session__empty', text: 'No exercises scheduled.' })
    );
    return sectionRoot;
  }

  const list = el('ol', { class: 'exercise-list' });
  for (let i = 0; i < entriesToRender.length; i++) {
    const entry = entriesToRender[i];
    list.appendChild(renderExerciseRow(
      date, session, i, entry.definition, entry.values,
      // Pass the stored definitions back as regimeDefinitions so that any
      // edit re-saves with the snapshot intact (US12).
      entriesToRender.map((e) => e.definition)
    ));
  }
  sectionRoot.appendChild(list);
  return sectionRoot;
}

function renderDateNav(date, onDateChange) {
  const today = new Date();
  const todayKey = dateKey(today);
  const dKey = dateKey(date);
  const isToday = dKey === todayKey;
  const canGoForward = !isToday;

  const picker = el('input', {
    type: 'date',
    class: 'datenav__picker',
    value: dKey,
    max: todayKey,
    'aria-label': 'Select date'
  });
  picker.addEventListener('change', () => {
    if (!picker.value) return;
    // Build a local-time Date from YYYY-MM-DD so the weekday matches the
    // device-local interpretation rather than UTC midnight.
    const [y, m, d] = picker.value.split('-').map(Number);
    onDateChange(new Date(y, m - 1, d));
  });

  const prev = el('button', {
    type: 'button', class: 'datenav__btn', 'aria-label': 'Previous day', text: '‹'
  });
  prev.addEventListener('click', () => onDateChange(addDays(date, -1)));

  const next = el('button', {
    type: 'button',
    class: 'datenav__btn',
    'aria-label': 'Next day',
    text: '›',
    disabled: !canGoForward
  });
  if (canGoForward) {
    next.addEventListener('click', () => onDateChange(addDays(date, 1)));
  }

  const todayBtn = el('button', {
    type: 'button',
    class: 'datenav__btn datenav__btn--today',
    text: 'Today',
    disabled: isToday
  });
  if (!isToday) {
    todayBtn.addEventListener('click', () => onDateChange(new Date()));
  }

  return el('nav', { class: 'datenav', 'aria-label': 'Date navigation' }, [
    prev, picker, next, todayBtn
  ]);
}

/**
 * Render the view for an arbitrary date. `onDateChange` is called when the
 * user picks a different date from the navigation controls; the caller
 * re-invokes renderForDate with the new date.
 *
 * Future dates are not supported (PRD Phase 3 boundary): if a future date
 * is supplied it is clamped to today.
 */
export async function renderForDate(root, regime, date, onDateChange) {
  const today = new Date();
  if (isAfter(date, today)) date = today;

  const dKey = dateKey(date);
  const { weekday, morning, afternoon } = sessionsForDate(regime, date);
  const todayKey = dateKey(today);
  const isToday = dKey === todayKey;

  const header = el('header', { class: 'today' }, [
    renderDateNav(date, onDateChange),
    el('p', {
      class: 'today__date',
      text: (isToday ? 'Today · ' : '') + formatDateLong(date)
    }),
    el('h1', { class: 'today__weekday', text: formatWeekday(weekday) })
  ]);

  // Render header immediately; sessions stream in once IndexedDB resolves.
  clear(root);
  root.appendChild(header);
  const placeholder = el('p', { class: 'session__empty', text: 'Loading…' });
  root.appendChild(placeholder);

  const [amSection, pmSection] = await Promise.all([
    renderSession('Morning', dKey, 'morning', morning),
    renderSession('Afternoon', dKey, 'afternoon', afternoon)
  ]);

  mount(root, header, amSection, pmSection);
}
