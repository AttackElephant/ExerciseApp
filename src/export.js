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

/**
 * Write text to the clipboard, called synchronously inside a click handler.
 * Accepts a Promise<string> so the underlying ClipboardItem can be created
 * inside the user-gesture window even when the data is fetched async — this
 * is the only pattern iOS Safari accepts when the source data isn't already
 * resolved at click time.
 */
async function writeTextToClipboard(textPromise) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = textPromise.then((t) => new Blob([t], { type: 'text/plain' }));
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    return;
  }
  // Older async clipboard: gesture must still be intact when this resolves.
  const text = await textPromise;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Final legacy fallback (deprecated execCommand).
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
  button.addEventListener('click', () => {
    // Validate synchronously so we don't burn the user gesture on a
    // failure case, and so we can hand a Promise to ClipboardItem below.
    const all = allCheckbox.checked;
    let from = fromInput.value;
    let to = toInput.value;
    if (!all && from && to && from > to) [from, to] = [to, from];

    if (!all && (!from || !to)) {
      setStatus('Pick both from and to dates, or tick "All dates".', 'error');
      return;
    }

    button.disabled = true;
    setStatus('Copying…');

    // Kick off the data fetch synchronously; pass the resulting Promise
    // straight to writeTextToClipboard so iOS Safari sees the clipboard
    // call inside the click gesture.
    const dataPromise = (async () => {
      const rows = all
        ? await getAllSessions()
        : await getSessionsInRange(from, to);
      const { tsv, dataRows } = sessionsToTSV(rows);
      const scope = all ? 'all dates' : (from === to ? from : `${from} → ${to}`);
      return { tsv, dataRows, scope };
    })();
    const tsvPromise = dataPromise.then((d) => d.tsv);

    writeTextToClipboard(tsvPromise)
      .then(() => dataPromise)
      .then((d) => {
        setStatus(
          `Copied ${d.dataRows} row${d.dataRows === 1 ? '' : 's'} (${d.scope}).`,
          'success'
        );
      })
      .catch((err) => {
        console.error('export failed', err);
        setStatus('Copy failed — try again.', 'error');
      })
      .finally(() => {
        button.disabled = false;
      });
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
