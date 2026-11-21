// "Add to Home Screen" for the card: Chromium gets the native install prompt,
// iOS / in-app browsers get a short illustrated guide sheet instead.
import { t, onLang } from './i18n.js';

export function initInstall() {
  const btn = document.querySelector('[data-install]');
  const sheet = document.querySelector('[data-install-sheet]');
  if (!btn || !sheet) return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) return; // already on the home screen

  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const inApp = /Line\/|FBAN|FBAV|Instagram|Twitter/i.test(ua);
  const isMobile = isIOS || isAndroid || /mobile/i.test(ua);

  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  // iOS never fires beforeinstallprompt, and some Android browsers don't either:
  // on phones the button is useful anyway because the sheet explains the steps.
  if (isMobile) btn.hidden = false;

  const stepsEl = sheet.querySelector('[data-install-steps]');
  const noteEl = sheet.querySelector('[data-install-note]');
  const fill = () => {
    const steps = t(isIOS ? 'ui.installStepsIos' : 'ui.installStepsAndroid');
    stepsEl.innerHTML = '';
    (Array.isArray(steps) ? steps : []).forEach((s) => {
      const li = document.createElement('li');
      li.textContent = s;
      stepsEl.appendChild(li);
    });
    if (noteEl) noteEl.hidden = !inApp;
  };
  fill();
  onLang(fill);

  const open = () => { fill(); sheet.hidden = false; };
  const close = () => { sheet.hidden = true; };
  btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) { /* dismissed */ }
      deferred = null;
      btn.hidden = true;
      return;
    }
    open();
  });
  sheet.querySelector('[data-install-close]')?.addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  window.addEventListener('appinstalled', () => { btn.hidden = true; close(); });
}
