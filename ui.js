'use strict';

/* =====================================================================
   Pop-up windows (modals) and small messages (toasts) with "Undo"
   ===================================================================== */

const modalStack = [];            // open modals, last one is on top
const modalCloseHooks = {};       // id -> function run when that modal closes

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!modalStack.includes(id)) modalStack.push(id);
  el.hidden = false;
  el.style.zIndex = 50 + modalStack.length;
  syncBodyLock();
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return;
  el.hidden = true;
  const i = modalStack.indexOf(id);
  if (i >= 0) modalStack.splice(i, 1);
  modalCloseHooks[id]?.();
  syncBodyLock();
}

const topModal = () => modalStack[modalStack.length - 1] || null;

function syncBodyLock() {
  document.body.classList.toggle('modal-open', modalStack.length > 0);
}

/* ---------- Toasts ---------- */
function toast(message, { undo = null, duration = 5000 } = {}) {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${undo ? `<button type="button" class="toast-undo">${esc(t('undo'))}</button>` : ''}`;

  let timer;
  const remove = () => {
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };
  if (undo) {
    el.querySelector('.toast-undo').addEventListener('click', () => { undo(); remove(); });
  }
  // Only the most recent change can be undone, so older "Undo" messages are removed
  if (undo) wrap.querySelectorAll('.toast.has-undo').forEach((old) => old.remove());
  if (undo) el.classList.add('has-undo');
  wrap.appendChild(el);
  while (wrap.children.length > 3) wrap.firstElementChild.remove();
  timer = setTimeout(remove, undo ? duration + 2000 : duration);
}

// Run a change that can be undone: saves a copy first, shows a toast with "Undo"
function undoable(message, change) {
  const before = snapshot();
  change();
  saveDB();
  render();
  toast(message, {
    undo: () => {
      restoreSnapshot(before);
      render();
    }
  });
}
