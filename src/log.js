// Logging form. Pure UI — the caller wires persistence via onChange.

import { el } from './ui.js';

/**
 * Decide whether the user has filled every field expected for this exercise.
 * Used purely for visual state — completion is never enforced.
 */
export function isEntryComplete(definition, values) {
  if (!values) return false;
  if (definition.type === 'running') {
    return isFilledNumber(values.distance_km)
      && isFilledNumber(values.duration_min)
      && (values.surface === 'treadmill' || values.surface === 'outdoor');
  }
  // resistance — match whichever fields the regime expects
  const setsOk = isFilledNumber(values.sets);
  const repsOk = definition.reps === undefined || isFilledNumber(values.reps);
  const durationOk = definition.duration_s === undefined || isFilledNumber(values.duration_s);
  return setsOk && repsOk && durationOk;
}

function isFilledNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function parseNumber(raw) {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function fieldLabel(text) {
  return el('span', { class: 'field__label', text });
}

function numberInput({ name, value, step, onChange }) {
  const input = el('input', {
    class: 'field__input',
    type: 'number',
    inputmode: 'decimal',
    step,
    name,
    value: value ?? ''
  });
  input.addEventListener('change', () => onChange(parseNumber(input.value)));
  return input;
}

function radioGroup({ name, value, options, onChange }) {
  const group = el('div', { class: 'field__radio-group', role: 'radiogroup' });
  for (const opt of options) {
    const id = `${name}-${opt}`;
    const input = el('input', {
      type: 'radio',
      name,
      id,
      value: opt,
      checked: value === opt
    });
    input.addEventListener('change', () => {
      if (input.checked) onChange(opt);
    });
    const label = el('label', { for: id, class: 'field__radio-label', text: opt });
    group.appendChild(input);
    group.appendChild(label);
  }
  return group;
}

function fieldRow(label, control) {
  return el('label', { class: 'field' }, [fieldLabel(label), control]);
}

/**
 * Build the input fields for one exercise.
 * @param {Object} definition exercise definition from the regime
 * @param {Object} values previously stored values (may be {})
 * @param {(patch: Object) => void} onChange called with the partial update
 *        each time a field changes; caller persists it.
 * @param {string} groupId stable id used to disambiguate radio groups
 */
export function renderExerciseFields(definition, values, onChange, groupId) {
  const fields = el('div', { class: 'fields' });

  if (definition.type === 'running') {
    fields.appendChild(fieldRow('Distance (km)',
      numberInput({
        name: 'distance_km',
        value: values.distance_km,
        step: '0.1',
        onChange: (v) => onChange({ distance_km: v })
      })
    ));
    fields.appendChild(fieldRow('Duration (min)',
      numberInput({
        name: 'duration_min',
        value: values.duration_min,
        step: '1',
        onChange: (v) => onChange({ duration_min: v })
      })
    ));
    fields.appendChild(fieldRow('Surface',
      radioGroup({
        name: `surface-${groupId}`,
        value: values.surface,
        options: ['treadmill', 'outdoor'],
        onChange: (v) => onChange({ surface: v })
      })
    ));
    return fields;
  }

  // resistance
  fields.appendChild(fieldRow('Sets',
    numberInput({
      name: 'sets',
      value: values.sets,
      step: '1',
      onChange: (v) => onChange({ sets: v })
    })
  ));
  if (definition.reps !== undefined) {
    fields.appendChild(fieldRow('Reps',
      numberInput({
        name: 'reps',
        value: values.reps,
        step: '1',
        onChange: (v) => onChange({ reps: v })
      })
    ));
  }
  if (definition.duration_s !== undefined) {
    fields.appendChild(fieldRow('Hold (sec)',
      numberInput({
        name: 'duration_s',
        value: values.duration_s,
        step: '1',
        onChange: (v) => onChange({ duration_s: v })
      })
    ));
  }
  return fields;
}
