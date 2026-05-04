// Entry point. Bootstraps the app and registers the service worker.

import { getActiveRegime, validateRegime } from './regime.js';
import { renderForDate } from './session.js';
import { renderExportPanel } from './export.js';
import { renderRegimePanel } from './regimePanel.js';
import { renderTestingPanel } from './testingPanel.js'; // TESTING ONLY — remove at go-live
import { el, mount } from './ui.js';

function renderError(root, message) {
  mount(root,
    el('section', { class: 'error' }, [
      el('h1', { text: 'Regime error' }),
      el('p', { text: message })
    ])
  );
}

function renderInstallHint(root) {
  // iOS Safari does not surface an install prompt — instruct the user manually.
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone) return;
  const hint = el('aside', { class: 'install-hint' }, [
    el('p', { text: 'Install: tap Share, then Add to Home Screen.' })
  ]);
  root.appendChild(hint);
}

async function boot() {
  const root = document.getElementById('app');
  let regime = await getActiveRegime();
  const result = validateRegime(regime);
  if (!result.valid) {
    renderError(root, result.error);
    return;
  }

  // The day view re-renders on date change or regime change; the export
  // and regime panels are mounted once so their state survives navigation.
  const dayContainer = el('div', { class: 'day-view' });
  const exportContainer = el('section', { class: 'export-view' });
  const regimeContainer = el('section', { class: 'regime-view' });
  const testingContainer = el('section', { class: 'testing-view' }); // TESTING ONLY
  const hintContainer = el('div', { class: 'hint-view' });
  mount(root, dayContainer, exportContainer, regimeContainer, testingContainer, hintContainer);

  let currentDate = new Date();
  const onDateChange = async (next) => {
    currentDate = next;
    await renderForDate(dayContainer, regime, currentDate, onDateChange);
  };
  const onRegimeChange = async (next) => {
    regime = next;
    await renderForDate(dayContainer, regime, currentDate, onDateChange);
  };

  // After a destructive reset the active regime may have reverted to the
  // default and stored sessions may be gone — re-fetch and re-render.
  const onReset = async () => {
    regime = await getActiveRegime();
    await renderForDate(dayContainer, regime, currentDate, onDateChange);
  };

  await renderForDate(dayContainer, regime, currentDate, onDateChange);
  renderExportPanel(exportContainer);
  renderRegimePanel(regimeContainer, { onRegimeChange });
  renderTestingPanel(testingContainer, { onReset }); // TESTING ONLY — remove at go-live
  renderInstallHint(hintContainer);
}


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/ExerciseApp/sw.js').catch(() => {
      // Offline-first still works; just log silently in console.
    });
  });
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
