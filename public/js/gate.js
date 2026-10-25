// Audience picker: shown as a sheet the moment the intro hands over to the
// hero card. The choice reorders the page and retunes the highlights; it is
// remembered, and the chips further down can change it any time.
import { L, el } from './i18n.js';
import { savedAudience, chooseAudience } from './sections.js?v=20251026e';

/* Move sections around so the most relevant story comes first. */
export function applyLayout(id) {
  const main = document.querySelector('main');
  if (!main || !id) return;
  const q = (s) => main.querySelector(s);
  const contact = q('.contact'), orgs = q('.orgs'), audience = q('.audience'), works = q('.works');
  if (!contact || !orgs || !audience || !works) return;
  if (id === 'exec' || id === 'hr') {
    main.insertBefore(works, orgs); // built products right after the contacts
  } else if (id === 'engineer') {
    main.insertBefore(audience, orgs); // highlights first
  } else if (id === 'student') {
    main.insertBefore(audience, orgs); // events & community up top
    main.insertBefore(works, audience.nextSibling);
  }
}

/* At boot: a remembered choice only rearranges the page — no sheet. */
export function prepareAudience() {
  const saved = savedAudience();
  if (saved) applyLayout(saved);
  return saved;
}

function syncForYou(id) {
  const line = document.querySelector('[data-foryou]');
  const btn = document.querySelector('[data-gate-open]');
  const data = L();
  const opt = data.audiences.options.find((o) => o.id === id);
  if (line) {
    line.hidden = !opt;
    line.textContent = opt ? opt.message : '';
  }
  if (btn) btn.textContent = opt
    ? (data.gate.currentLabel || '').replace('{label}', opt.label)
    : (data.gate.openLabel || '');
}

export function initGateUi() {
  window.addEventListener('tc:audience', (e) => syncForYou(e.detail));
  const saved = savedAudience();
  if (saved) syncForYou(saved);
  else syncForYou(null);
  document.querySelector('[data-gate-open]')?.addEventListener('click', () => { showGateSheet().catch(() => {}); });
}

export function gateIfNeeded() {
  if (savedAudience()) return Promise.resolve();
  return showGateSheet();
}

function showGateSheet() {
  const gate = document.querySelector('[data-gate]');
  if (!gate) return Promise.resolve();
  return new Promise((resolve) => {
    const host = gate.querySelector('[data-gate-options]');
    const data = L();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    host.replaceChildren(...data.audiences.options.map((o) => el('button', {
      class: 'gate__opt', type: 'button', 'data-for': o.id,
      onclick: () => done(o.id),
    },
      el('img', { class: 'gate__opt-mark', src: 'assets/brand/wing-mark.svg', alt: '' }),
      el('span', { class: 'gate__opt-body' },
        el('span', { class: 'gate__opt-label', text: o.label }),
        el('span', { class: 'gate__opt-desc', text: o.desc || '' })))));
    gate.hidden = false;
    document.body.style.overflow = 'hidden';
    const sheet = gate.querySelector('.gate__sheet');
    if (window.gsap && !reduced) {
      window.gsap.fromTo(sheet, { y: '106%' }, { y: '0%', duration: 0.65, ease: 'power3.out', delay: 0.15 });
      window.gsap.fromTo(host.children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.07, delay: 0.45, clearProps: 'all' });
    }
    let closed = false;
    function done(id) {
      if (closed) return;
      closed = true;
      if (id) { chooseAudience(id); applyLayout(id); }
      document.body.style.overflow = '';
      if (window.gsap && !reduced) {
        window.gsap.to(sheet, { y: '106%', duration: 0.4, ease: 'power2.in', onComplete: () => { gate.hidden = true; resolve(); } });
      } else { gate.hidden = true; resolve(); }
    }
    gate.querySelector('[data-gate-skip]')?.addEventListener('click', () => done(null));
  });
}
