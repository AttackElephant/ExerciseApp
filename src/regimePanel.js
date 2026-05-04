// Paste-import UI for replacing the active regime (US17). Shown as a
// collapsed <details> panel below the export card. On apply: parse JSON,
// validate, persist, and notify the caller so the day view can re-render.

import { el } from './ui.js';
import { setActiveRegime, getActiveRegime } from './regime.js';

export function renderRegimePanel(root, { onRegimeChange } = {}) {
  const textarea = el('textarea', {
    class: 'regime__textarea',
    rows: '8',
    spellcheck: 'false',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    placeholder: 'Paste regime JSON here…',
    'aria-label': 'Regime JSON'
  });

  const status = el('p', {
    class: 'regime__status',
    role: 'status',
    'aria-live': 'polite'
  });
  const setStatus = (text, kind = 'info') => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  const button = el('button', {
    type: 'button', class: 'regime__apply-btn', text: 'Apply regime'
  });

  button.addEventListener('click', async () => {
    const raw = textarea.value.trim();
    if (!raw) {
      setStatus('Paste a regime JSON document first.', 'error');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      setStatus(`Not valid JSON: ${err.message}`, 'error');
      return;
    }

    button.disabled = true;
    setStatus('Applying…');
    try {
      await setActiveRegime(parsed);
      // Re-fetch through the public API so the caller gets exactly what
      // future getActiveRegime calls will return — including any default
      // fallback if the round-trip somehow normalised differently.
      const next = await getActiveRegime();
      if (typeof onRegimeChange === 'function') {
        await onRegimeChange(next);
      }
      setStatus('Regime applied. Today’s view updated.', 'success');
    } catch (err) {
      // setActiveRegime throws an Error whose message is the validation
      // failure straight from validateRegime — show it verbatim (US17).
      setStatus(err.message || 'Could not apply regime.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  const summary = el('summary', { class: 'regime__summary', text: 'Regime' });
  const help = el('p', { class: 'regime__help' }, [
    'Paste a regime JSON document and tap Apply. Invalid input is reported ' +
    'inline; the existing regime is unchanged. Historic logs keep the ' +
    'regime that was active when they were saved.'
  ]);

  const details = el('details', { class: 'regime' }, [
    summary,
    help,
    textarea,
    el('div', { class: 'regime__actions' }, [button]),
    status
  ]);

  root.appendChild(details);
}
