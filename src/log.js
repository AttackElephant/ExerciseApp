// Logging form. Pure UI — the caller wires persistence via onChange.

import { el } from './ui.js';

function isFilledNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function parseNumber(raw) {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** True if `values` was written under the pre-per-set schema. */
function isLegacyResistanceShape(values) {
  if (!values) return false;
  return typeof values.sets === 'number'
    || typeof values.reps === 'number'
    || typeof values.duration_s === 'number';
}

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

  // Resistance — legacy single-number shape stays single-number, new shape
  // requires every per-set slot filled (length === definition.sets).
  if (isLegacyResistanceShape(values)) {
    const setsOk = isFilledNumber(values.sets);
    const repsOk = definition.reps === undefined || isFilledNumber(values.reps);
    const holdOk = definition.duration_s === undefined || isFilledNumber(values.duration_s);
    return setsOk && repsOk && holdOk;
  }

  const N = definition.sets;
  const arrayComplete = (arr) =>
    Array.isArray(arr) && arr.length === N && arr.every(isFilledNumber);
  const repsOk = definition.reps === undefined || arrayComplete(values.reps);
  const holdOk = definition.duration_s === undefined || arrayComplete(values.duration_s);
  return repsOk && holdOk;
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

function asArrayWithLength(maybeArr, n) {
  const out = Array.isArray(maybeArr) ? maybeArr.slice(0, n) : [];
  while (out.length < n) out.push(undefined);
  return out;
}

function renderRunningFields(definition, values, onChange, groupId) {
  const fields = el('div', { class: 'fields' });
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

function renderResistanceLegacy(definition, values, onChange) {
  // Pre per-set entries render with their original UI so we honour
  // "leave it" — editing a legacy entry stays in the legacy shape.
  const fields = el('div', { class: 'fields' });
  fields.appendChild(fieldRow('Sets',
    numberInput({
      name: 'sets', value: values.sets, step: '1',
      onChange: (v) => onChange({ sets: v })
    })
  ));
  if (definition.reps !== undefined) {
    fields.appendChild(fieldRow('Reps',
      numberInput({
        name: 'reps', value: values.reps, step: '1',
        onChange: (v) => onChange({ reps: v })
      })
    ));
  }
  if (definition.duration_s !== undefined) {
    fields.appendChild(fieldRow('Hold (sec)',
      numberInput({
        name: 'duration_s', value: values.duration_s, step: '1',
        onChange: (v) => onChange({ duration_s: v })
      })
    ));
  }
  return fields;
}

function renderResistancePerSet(definition, getValues, onChange) {
  const N = definition.sets;
  const wrap = el('div', { class: 'fields fields--sets' });

  const writeSlot = (key, i, v) => {
    const cur = getValues();
    const arr = asArrayWithLength(cur[key], N);
    arr[i] = v;
    onChange({ [key]: arr });
  };

  const initial = getValues();
  for (let i = 0; i < N; i++) {
    const row = el('div', { class: 'set-row' });
    row.appendChild(
      el('span', { class: 'set-row__label', text: `Set ${i + 1}` })
    );
    const metrics = el('div', { class: 'set-row__metrics' });

    if (definition.reps !== undefined) {
      metrics.appendChild(fieldRow('Reps',
        numberInput({
          name: `reps-${i}`,
          value: Array.isArray(initial.reps) ? initial.reps[i] : undefined,
          step: '1',
          onChange: (v) => writeSlot('reps', i, v)
        })
      ));
    }
    if (definition.duration_s !== undefined) {
      metrics.appendChild(fieldRow('Hold (sec)',
        numberInput({
          name: `duration_s-${i}`,
          value: Array.isArray(initial.duration_s) ? initial.duration_s[i] : undefined,
          step: '1',
          onChange: (v) => writeSlot('duration_s', i, v)
        })
      ));
    }

    row.appendChild(metrics);
    wrap.appendChild(row);
  }

  return wrap;
}

/**
 * Build the input fields for one exercise.
 * @param {Object} definition exercise definition from the regime
 * @param {() => Object} getValues callback that returns the current
 *        values object; per-set inputs read this at change time so they
 *        can mutate the right slot of an array without stale closures.
 * @param {(patch: Object) => void} onChange called with the partial update
 *        each time a field changes; caller persists it.
 * @param {string} groupId stable id used to disambiguate radio groups
 */
export function renderExerciseFields(definition, getValues, onChange, groupId) {
  const values = getValues();

  if (definition.type === 'running') {
    return renderRunningFields(definition, values, onChange, groupId);
  }

  if (isLegacyResistanceShape(values)) {
    return renderResistanceLegacy(definition, values, onChange);
  }
  return renderResistancePerSet(definition, getValues, onChange);
}
