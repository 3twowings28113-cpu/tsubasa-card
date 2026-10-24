// First-visit gate: before the intro plays, ask who is visiting and arrange
// the page for them (section order + tailored highlights). The choice is
// remembered; the chips further down the page can change it any time.
import { L, el } from './i18n.js';
import { savedAudience, chooseAudience } from './sections.js?v=20251025f';

/* Move sections around so the most relevant story comes first. */
export function applyLayout(id) {
  const main = document.querySelector('main');
  if (!main || !id) return;
  const q = (s) => main.querySelector(s);
  const contact = q('.contact'), orgs = q('.orgs'), venture = q('.venture'), audience = q('.audience');
  if (!contact || !orgs || !venture || !audience) return;
  if (id === 'exec' || id === 'hr') {
    // venture (StuVation) right after the contacts
    main.insertBefore(venture, orgs);
  } else if (id === 'engineer') {
    // highlights first, venture after
    main.insertBefore(audience, venture);
  } else if (id === 'student') {
    // highlights (events & community) right after the contacts
    main.insertBefore(audience, orgs);
    main.insertBefore(venture, audience.nextSibling);
  }
}

export function gateIfNeeded() {
  const saved = savedAudience();
  if (saved) { applyLayout(saved); return Promise.resolve(); }
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
    if (window.gsap && !reduced) {
      window.gsap.fromTo(gate.querySelector('.gate__inner'), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: 0.1 });
      window.gsap.fromTo(host.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.09, delay: 0.35, clearProps: 'all' });
      window.gsap.fromTo(gate.querySelector('.gate__wing'), { opacity: 0, x: 60 }, { opacity: 0.5, x: 0, duration: 1.4, ease: 'power2.out' });
    }
    let closed = false;
    function done(id) {
      if (closed) return;
      closed = true;
      if (id) { chooseAudience(id); applyLayout(id); }
      document.body.style.overflow = '';
      if (window.gsap && !reduced) {
        window.gsap.to(gate, { opacity: 0, duration: 0.45, ease: 'power1.in', onComplete: () => { gate.hidden = true; gate.style.opacity = ''; resolve(); } });
      } else { gate.hidden = true; resolve(); }
    }
    gate.querySelector('[data-gate-skip]')?.addEventListener('click', () => done(null));
  });
}
