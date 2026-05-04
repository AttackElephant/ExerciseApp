// Today's-session view. Both morning and afternoon ALWAYS render.
// Phase 2 adds input fields, persistence, per-session "mark complete".

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

function renderExerciseRow(date, session, index, definition, values) {
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
      saveExerciseValues(date, session, index, [definition], patch).catch((err) => {
        console.error('saveExerciseValues failed', err);
      });
    },
    `${session}-${index}`
  );

  li.appendChild(head);
  li.appendChild(target);
  li.appendChild(fields);
  applyCompletionClass();
  return li;
}

async function renderSession(label, date, session, definitions) {
  const sectionRoot = el('section', { class: 'session' });

  const stored = await loadSession(date, session, definitions ?? []);
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

  // Persist all current definitions when toggling so a fresh row is seeded
  // with the right shape.
  completeBtn.addEventListener('click', async () => {
    const next = !sectionRoot.classList.contains('session--complete');
    updateButtonState(next);
    try {
      await setSessionComplete(date, session, next, definitions ?? []);
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

  if (!definitions || definitions.length === 0) {
    sectionRoot.appendChild(
      el('p', { class: 'session__empty', text: 'No exercises scheduled.' })
    );
    return sectionRoot;
  }

  const list = el('ol', { class: 'exercise-list' });
  for (let i = 0; i < definitions.length; i++) {
    list.appendChild(renderExerciseRow(
      date, session, i, definitions[i], stored.entries[i]?.values ?? {}
    ));
  }
  sectionRoot.appendChild(list);
  return sectionRoot;
}

export async function renderToday(root, regime, date = new Date()) {
  // Both morning and afternoon ALWAYS render. Visibility is never conditional
  // on the current time of day — only on whether the regime defines exercises.
  const dKey = dateKey(date);
  const { weekday, morning, afternoon } = sessionsForDate(regime, date);

  const header = el('header', { class: 'today' }, [
    el('p', { class: 'today__date', text: formatDateLong(date) }),
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
