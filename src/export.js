// Clipboard export: build TSV from stored sessions and copy to clipboard.
// One row per (date, session, exercise). Header is always present.

import { el } from './ui.js';
import { dateKey, getAllSessions, getSessionsInRange } from './db.js';

export const HEADERS = [
  'date', 'session', 'exercise_name', 'type',
  'sets', 'reps', 'duration_s',
  'distance_km', 'duration_min', 'surface'
];

function escapeCell(v) {
  if (v == null || v === '') return '';
  // Tabs and newlines would break TSV. Replace with single spaces — values
  // that legitimately need them aren't expected in this app's data.
  return String(v).replace(/[\t\r\n]/g, ' ');
}

function rowFor(date, session, definition, values) {
  const v = values ?? {};
  const isResistance = definition.type === 'resistance';
  const isRunning = definition.type === 'running';
  return [
    date,
    session,
    definition.name,
    definition.type,
    isResistance ? v.sets : '',
    isResistance ? v.reps : '',
    isResistance ? v.duration_s : '',
    isRunning ? v.distance_km : '',
    isRunning ? v.duration_min : '',
    isRunning ? v.surface : ''
  ].map(escapeCell).join('\t');
}

/**
 * Build the TSV string for the supplied session rows.
 * @param {Array<{date:string, session:string, entries:Array<{definition,values}>}>} sessionRows
 */
export function sessionsToTSV(sessionRows) {
  const lines = [HEADERS.join('\t')];
  let dataRows = 0;
  for (const s of sessionRows) {
    for (const e of s.entries ?? []) {
      if (!e?.definition) continue;
      lines.push(rowFor(s.date, s.session, e.definition, e.values));
      dataRows += 1;
    }
  }
  return { tsv: lines.join('\n'), dataRows };
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Legacy fallback for older browsers without async clipboard.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('Clipboard write failed');
}

async function buildAndCopy({ all, from, to }) {
  const rows = all
    ? await getAllSessions()
    : await getSessionsInRange(from, to);
  const { tsv, dataRows } = sessionsToTSV(rows);
  await writeToClipboard(tsv);
  return { sessionCount: rows.length, dataRows };
}

export function renderExportPanel(root) {
  const today = dateKey(new Date());

  const fromInput = el('input', {
    type: 'date', class: 'datenav__picker', value: today, max: today,
    'aria-label': 'Export from date'
  });
  const toInput = el('input', {
    type: 'date', class: 'datenav__picker', value: today, max: today,
    'aria-label': 'Export to date'
  });

  const allCheckbox = el('input', { type: 'checkbox', id: 'export-all' });
  const allLabel = el('label', { for: 'export-all', text: 'All dates' });

  const setRangeDisabled = (disabled) => {
    fromInput.toggleAttribute('disabled', disabled);
    toInput.toggleAttribute('disabled', disabled);
  };
  allCheckbox.addEventListener('change', () => setRangeDisabled(allCheckbox.checked));

  const status = el('p', { class: 'export__status', role: 'status', 'aria-live': 'polite' });
  const setStatus = (message, kind = 'info') => {
    status.textContent = message;
    status.dataset.kind = kind;
  };

  const button = el('button', {
    type: 'button', class: 'export__copy-btn', text: 'Copy to clipboard'
  });
  button.addEventListener('click', async () => {
    button.disabled = true;
    setStatus('Copying…');
    try {
      const all = allCheckbox.checked;
      // Swap from/to if user inverted them — match user intent rather than
      // returning empty.
      let from = fromInput.value;
      let to = toInput.value;
      if (!all && from && to && from > to) [from, to] = [to, from];

      if (!all && (!from || !to)) {
        setStatus('Pick both from and to dates, or tick "All dates".', 'error');
        return;
      }

      const result = await buildAndCopy({ all, from, to });
      const scope = all ? 'all dates' : (from === to ? from : `${from} → ${to}`);
      setStatus(
        `Copied ${result.dataRows} row${result.dataRows === 1 ? '' : 's'} (${scope}).`,
        'success'
      );
    } catch (err) {
      console.error('export failed', err);
      setStatus('Copy failed — clipboard permission denied?', 'error');
    } finally {
      button.disabled = false;
    }
  });

  const heading = el('h2', { class: 'export__title', text: 'Export' });
  const rangeRow = el('div', { class: 'export__range' }, [
    el('label', { class: 'export__field' }, [
      el('span', { class: 'field__label', text: 'From' }), fromInput
    ]),
    el('label', { class: 'export__field' }, [
      el('span', { class: 'field__label', text: 'To' }), toInput
    ])
  ]);
  const allRow = el('div', { class: 'export__all' }, [allCheckbox, allLabel]);
  const actions = el('div', { class: 'export__actions' }, [button]);

  root.appendChild(heading);
  root.appendChild(rangeRow);
  root.appendChild(allRow);
  root.appendChild(actions);
  root.appendChild(status);
}
