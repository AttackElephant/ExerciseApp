// Entry point. Bootstraps the app and registers the service worker.

import { getActiveRegime, validateRegime } from './regime.js';
import { renderForDate } from './session.js';
import { renderExportPanel } from './export.js';
import { renderRegimePanel } from './regimePanel.js';
import { seedDefaultImagesIfNeeded } from './defaultImages.js';
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

  // First-launch only: write the bundled demonstration PNGs into IndexedDB
  // so each default exercise's ℹ button works on the very first render.
  // Awaited so renderForDate's listImageNames() sees the seeded entries.
  // Failures are logged and swallowed — the app still functions without
  // seeded images.
  try {
    await seedDefaultImagesIfNeeded();
  } catch (err) {
    console.error('seedDefaultImagesIfNeeded failed', err);
  }

  // The day view re-renders on date change or regime change; the export
  // and regime panels are mounted once so their state survives navigation.
  const dayContainer = el('div', { class: 'day-view' });
  const exportContainer = el('section', { class: 'export-view' });
  const regimeContainer = el('section', { class: 'regime-view' });
  const hintContainer = el('div', { class: 'hint-view' });
  mount(root, dayContainer, exportContainer, regimeContainer, hintContainer);

  let currentDate = new Date();
  const onDateChange = async (next) => {
    currentDate = next;
    await renderForDate(dayContainer, regime, currentDate, onDateChange);
  };
  const onRegimeChange = async (next) => {
    regime = next;
    await renderForDate(dayContainer, regime, currentDate, onDateChange);
  };

  await renderForDate(dayContainer, regime, currentDate, onDateChange);
  renderExportPanel(exportContainer);
  renderRegimePanel(regimeContainer, { onRegimeChange });
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
