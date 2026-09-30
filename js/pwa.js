'use strict';

/* =====================================================================
   Installable app (PWA): offline cache + "Install" button in Settings
   ===================================================================== */

let installPrompt = null;
let appInstalled = window.matchMedia?.('(display-mode: standalone)').matches || false;

// The service worker only works on a real website (https), e.g. GitHub Pages
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  renderInstallSetting();
});

window.addEventListener('appinstalled', () => {
  appInstalled = true;
  installPrompt = null;
  renderInstallSetting();
});

function renderInstallSetting() {
  const btn = $('#installBtn');
  const note = $('#installNote');
  if (!btn) return;
  if (appInstalled) {
    btn.hidden = true;
    note.textContent = t('installedMsg');
  } else if (installPrompt) {
    btn.hidden = false;
    note.textContent = t('sInstallHint');
  } else {
    btn.hidden = true;
    note.textContent = t('installManual');
  }
}

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (e) { /* ignore */ }
  installPrompt = null;
  renderInstallSetting();
}
