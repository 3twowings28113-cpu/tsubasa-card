import { loadContent, initialLang, setLang, getLang, t, onLang } from './i18n.js';
import { api, visitorId, via } from './api.js?v=20251029a';
import { whenContacts, initDock } from './contact.js?v=20251029a';
import { initSections } from './sections.js?v=20251029a';
import { initMotion } from './motion.js?v=20251029a';
import { initWingWall } from './wingwall.js?v=20251029a';
import { initAsk } from './ask.js?v=20251029a';
import { runIntro } from './intro.js?v=20251029a';
import { initFun } from './fun.js?v=20251029a';
import { gateIfNeeded, prepareAudience, initGateUi } from './gate.js?v=20251029a';

async function guestNumber() {
  const r = await api('/api/visit', { method: 'POST', body: { visitorId: visitorId(), via: via(), lang: getLang() } });
  const pill = document.querySelector('[data-guest]');
  if (!r.ok || !r.data.no) return;
  const n = r.data.no;
  const render = (v) => {
    const s = t('ui.tapCount', { n: '\u0000' }).split('\u0000');
    pill.replaceChildren(s[0], Object.assign(document.createElement('b'), { textContent: v }), s[1] || '');
  };
  if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const o = { v: 0 };
    const introOn = !!document.querySelector('.intro');
    window.gsap.to(o, { v: n, duration: 1.2, delay: introOn ? 2.2 : 0.2, ease: 'power2.out', onStart: () => { pill.hidden = false; }, onUpdate: () => render(Math.round(o.v)) });
  } else { pill.hidden = false; render(n); }
  onLang(() => render(n));
}

async function features() {
  // Which server features are live? (static previews have no API at all)
  const r = await api('/api/settings');
  const live = r.ok && r.data && typeof r.data === 'object' && 'event_ja' in r.data;
  window.__apiOk = live;
  if (!live) {
    // static hosting: server-only sections stay hidden
    document.querySelector('#feathers')?.setAttribute('hidden', '');
    document.querySelector('#ask')?.setAttribute('hidden', '');
    document.querySelectorAll('[data-save]').forEach((a) => { a.href = `contact/tsubasa-yamashita-${getLang()}.vcf`; });
    return;
  }
  const f = r.data.features || {};
  if (f.db === false) document.querySelector('#feathers')?.setAttribute('hidden', '');
  if (f.ai === false || f.db === false) document.querySelector('#ask')?.setAttribute('hidden', '');
}

async function boot() {
  let resolveContacts;
  const contactsReady = new Promise((r) => { resolveContacts = r; });
  try {
    await loadContent();
  } catch (e) {
    document.documentElement.classList.remove('booting');
    return;
  }
  initSections();
  initAsk();
  initFun();
  setLang(initialLang(), { persist: false });
  document.querySelectorAll('[data-lang-toggle]').forEach((b) => b.addEventListener('click', () => setLang(getLang() === 'ja' ? 'en' : 'ja')));
  prepareAudience();
  initGateUi();
  const introDone = Promise.resolve(runIntro({ contactsReady })).catch(() => {});
  // contacts are rendered by the onLang listener in contact.js; wait for the first render
  await whenContacts();
  resolveContacts();
  initDock();
  initWingWall();
  features().then(() => { if (window.__apiOk) guestNumber(); });
  let gateShown = false;
  const showGate = () => { if (gateShown) return; gateShown = true; gateIfNeeded().catch(() => {}); };
  window.addEventListener('tc:revealed', showGate, { once: true });
  introDone.then(() => setTimeout(showGate, 800));
  introDone.then(() => initMotion());
}

boot();
