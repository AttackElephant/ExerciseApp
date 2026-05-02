// Entry point. Bootstraps the app and registers the service worker.

import { getActiveRegime, validateRegime } from './regime.js';
import { renderToday } from './session.js';
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

function boot() {
  const root = document.getElementById('app');
  const regime = getActiveRegime();
  const result = validateRegime(regime);
  if (!result.valid) {
    renderError(root, result.error);
    return;
  }
  renderToday(root, regime);
  renderInstallHint(root);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline-first still works; just log silently in console.
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
