// Per-exercise demonstration images: clipboard-paste capture, modal
// viewer, and the inline button that toggles between "Paste" and "View".
// Resistance exercises only.

import { el } from './ui.js';
import { getImage, putImage, deleteImage } from './db.js';

/**
 * Read the system clipboard for an image. Returns { blob, mime } or null
 * if the clipboard contained no image. Throws on permission denial or
 * unsupported environment.
 */
export async function readImageFromClipboard() {
  if (!navigator.clipboard?.read) {
    throw new Error('Clipboard read not supported in this browser.');
  }
  const items = await navigator.clipboard.read();
  for (const item of items) {
    for (const type of item.types) {
      if (type.startsWith('image/')) {
        const blob = await item.getType(type);
        return { blob, mime: type };
      }
    }
  }
  return null;
}

/**
 * Show the stored image for `name` in a full-screen modal. Tap anywhere
 * to dismiss (US20). A small Delete button is offered so the user can
 * replace a wrongly-pasted image without devtools — its click does not
 * dismiss the modal.
 *
 * @param {string} name exercise name
 * @param {() => void} [onDelete] called after a successful delete so the
 *        caller can refresh its affordance state.
 */
export async function showImageModal(name, onDelete) {
  const record = await getImage(name);
  if (!record) return;
  const url = URL.createObjectURL(record.blob);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    URL.revokeObjectURL(url);
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') dismiss(); };

  const img = el('img', { class: 'img-modal__img', src: url, alt: name });

  const closeBtn = el('button', {
    type: 'button', class: 'img-modal__btn img-modal__btn--close',
    'aria-label': 'Close', text: '×'
  });
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); dismiss(); });

  const deleteBtn = el('button', {
    type: 'button', class: 'img-modal__btn img-modal__btn--delete',
    'aria-label': 'Delete image', text: 'Delete'
  });
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete image for "${name}"?`)) return;
    try {
      await deleteImage(name);
      if (typeof onDelete === 'function') onDelete();
    } catch (err) {
      console.error('delete image failed', err);
    } finally {
      dismiss();
    }
  });

  const overlay = el('div', {
    class: 'img-modal', role: 'dialog', 'aria-modal': 'true',
    'aria-label': `Demonstration image for ${name}`
  }, [
    el('div', { class: 'img-modal__bar' }, [deleteBtn, closeBtn]),
    img
  ]);
  overlay.addEventListener('click', dismiss);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKey);
}

/**
 * Build the inline "paste image" / "view image" affordance for a single
 * resistance exercise. Self-contained: re-renders itself when the stored
 * state changes.
 *
 * @param {string} name
 * @param {boolean} initiallyHasImage
 */
export function renderImageAffordance(name, initiallyHasImage) {
  const wrapper = el('span', { class: 'image-aff' });
  const status = el('span', {
    class: 'image-aff__status', role: 'status', 'aria-live': 'polite'
  });
  let hasImage = !!initiallyHasImage;

  const setStatus = (text, kind = 'info') => {
    status.textContent = text;
    status.dataset.kind = kind;
    if (text) {
      // Auto-clear after a few seconds so the row doesn't stay cluttered.
      const t = setTimeout(() => {
        if (status.textContent === text) {
          status.textContent = '';
          delete status.dataset.kind;
        }
      }, 4000);
      // Keep last timer reference so a rapid second message replaces cleanly.
      wrapper._statusTimer && clearTimeout(wrapper._statusTimer);
      wrapper._statusTimer = t;
    }
  };

  const onAfterDelete = () => {
    hasImage = false;
    render();
    setStatus('Image deleted.', 'success');
  };

  const renderViewBtn = () => {
    const btn = el('button', {
      type: 'button', class: 'image-aff__btn',
      title: `View image for ${name}`,
      'aria-label': `View image for ${name}`,
      text: 'ℹ'
    });
    btn.addEventListener('click', () => {
      showImageModal(name, onAfterDelete).catch((err) => {
        console.error('show image failed', err);
        setStatus('Could not open image.', 'error');
      });
    });
    return btn;
  };

  const renderPasteBtn = () => {
    const btn = el('button', {
      type: 'button', class: 'image-aff__btn image-aff__btn--paste',
      title: `Paste image for ${name}`,
      'aria-label': `Paste image for ${name}`,
      text: '📋'
    });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      setStatus('Reading clipboard…');
      try {
        const result = await readImageFromClipboard();
        if (!result) {
          setStatus('No image in clipboard.', 'error');
          return;
        }
        await putImage(name, result.blob, result.mime);
        hasImage = true;
        render();
        setStatus('Image saved.', 'success');
      } catch (err) {
        console.error('paste image failed', err);
        setStatus(err.message || 'Paste failed.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
    return btn;
  };

  const render = () => {
    // Replace the button child while keeping the persistent status node.
    while (wrapper.firstChild && wrapper.firstChild !== status) {
      wrapper.removeChild(wrapper.firstChild);
    }
    const btn = hasImage ? renderViewBtn() : renderPasteBtn();
    wrapper.insertBefore(btn, status);
  };

  render();
  wrapper.appendChild(status);
  return wrapper;
}
