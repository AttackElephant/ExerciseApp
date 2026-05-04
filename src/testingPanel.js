// TESTING PANEL — REMOVE BEFORE PUBLIC RELEASE.
// Provides destructive reset buttons so the regime / logging paths can be
// validated from a known clean state without dropping into devtools.
//
// To remove at go-live:
//   1. Delete this file.
//   2. Delete the import + renderTestingPanel call in src/app.js.
//   3. Delete the testing-panel CSS block in styles.css.
//   4. Drop testingPanel.js from sw.js precache and bump CACHE_VERSION.

import { el } from './ui.js';
import {
  dateKey,
  clearSessionsForDate,
  clearAllSessions,
  clearStoredRegime
} from './db.js';

export function renderTestingPanel(root, { onReset } = {}) {
  const status = el('p', {
    class: 'testing__status', role: 'status', 'aria-live': 'polite'
  });
  const setStatus = (text, kind = 'info') => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  const resetTodayBtn = el('button', {
    type: 'button', class: 'testing__btn', text: "Reset today's session"
  });
  resetTodayBtn.addEventListener('click', async () => {
    if (!confirm("Delete today's logged values and complete state?")) return;
    resetTodayBtn.disabled = true;
    try {
      await clearSessionsForDate(dateKey(new Date()));
      if (typeof onReset === 'function') await onReset();
      setStatus("Today's session cleared.", 'success');
    } catch (err) {
      console.error('reset today failed', err);
      setStatus('Reset failed.', 'error');
    } finally {
      resetTodayBtn.disabled = false;
    }
  });

  const wipeBtn = el('button', {
    type: 'button', class: 'testing__btn testing__btn--danger', text: 'Wipe all data'
  });
  wipeBtn.addEventListener('click', async () => {
    if (!confirm('Delete ALL logged sessions and any pasted regime? This cannot be undone.')) {
      return;
    }
    wipeBtn.disabled = true;
    try {
      await clearAllSessions();
      await clearStoredRegime();
      if (typeof onReset === 'function') await onReset();
      setStatus('All data wiped. Default regime is active.', 'success');
    } catch (err) {
      console.error('wipe failed', err);
      setStatus('Wipe failed.', 'error');
    } finally {
      wipeBtn.disabled = false;
    }
  });

  const summary = el('summary', { class: 'testing__summary', text: 'Testing tools' });
  const note = el('p', { class: 'testing__note' }, [
    'Destructive — for development only. Remove this panel before public release.'
  ]);

  const details = el('details', { class: 'testing' }, [
    summary,
    note,
    el('div', { class: 'testing__actions' }, [resetTodayBtn, wipeBtn]),
    status
  ]);

  root.appendChild(details);
}
