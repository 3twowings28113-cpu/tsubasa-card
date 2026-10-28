import { getContent, getLang, L, t, el, onLang, reducedMotion } from './i18n.js';

/* ---------- audience ---------- */
let audience = null;
function readAudience() {
  const q = new URLSearchParams(location.search).get('for');
  if (['engineer', 'hr', 'exec', 'student'].includes(q)) return q;
  try { return localStorage.getItem('tc_for'); } catch (e) { return null; }
}

function highlightCard(h, pick) {
  const media = h.photo
    ? el('img', { class: 'hl__img', src: h.photo, alt: '', loading: 'lazy', decoding: 'async' })
    : el('div', { class: 'hl__img--none' }, el('img', { src: 'assets/brand/wing-mark.svg', alt: '' }));
  return el('article', { class: `hl${pick ? ' hl--pick' : ''}`, 'data-id': h.id, 'data-flip-id': h.id }, media,
    pick ? el('span', { class: 'hl__pick', text: t('ui.pick') }) : null,
    el('div', { class: 'hl__body' }, el('h3', { text: h.title }), el('p', { text: h.sub })));
}

function renderHighlights(animate) {
  const host = document.querySelector('[data-highlights]');
  const data = L();
  const opt = data.audiences.options.find((o) => o.id === (audience || 'engineer'));
  const byId = Object.fromEntries(data.highlights.map((h) => [h.id, h]));
  const ids = opt.order.filter((id) => byId[id]);
  document.querySelector('[data-audience-message]').textContent = audience ? opt.message : '';
  const pointsHost = document.querySelector('[data-audience-points]');
  if (pointsHost) pointsHost.replaceChildren(...(audience && opt.points ? opt.points.map((p) => el('li', { text: p })) : []));
  const Flip = window.Flip;
  const canFlip = animate && Flip && window.gsap && !reducedMotion();
  const state = canFlip ? Flip.getState(host.querySelectorAll('.hl')) : null;
  const existing = animate ? new Map([...host.querySelectorAll('.hl')].map((n) => [n.dataset.id, n])) : new Map();
  host.replaceChildren(...ids.map((id, i) => {
    const node = existing.get(id) || highlightCard(byId[id], !!audience && i === 0);
    node.classList.toggle('hl--pick', !!audience && i === 0);
    if (audience && i === 0 && !node.querySelector('.hl__pick')) node.append(el('span', { class: 'hl__pick', text: t('ui.pick') }));
    if (!audience || i !== 0) node.querySelector('.hl__pick')?.remove();
    return node;
  }));
  host.scrollTo({ left: 0 });
  if (state) {
    Flip.from(state, {
      targets: host.querySelectorAll('.hl'), duration: 0.6, ease: 'power3.inOut',
      onEnter: (els) => window.gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.45 }),
    });
  }
}

function renderAudience() {
  const data = L();
  const chips = document.querySelector('[data-audience-chips]');
  const who = el('span', { class: 'who', text: data.ui.whoAreYou });
  const buttons = data.audiences.options.map((o) => el('button', {
    class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(audience === o.id), 'data-for': o.id, text: o.label,
    onclick: () => {
      audience = o.id;
      try { localStorage.setItem('tc_for', o.id); } catch (e) { /* ignore */ }
      chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.for === o.id)));
      renderHighlights(true);
    },
  }));
  chips.replaceChildren(who, ...buttons);
  renderHighlights(false);
}

/* ---------- philosophy ---------- */
function renderPhilosophy() {
  document.querySelector('[data-philosophy-chips]').replaceChildren(...L().philosophy.chips.map((c) => el('li', { text: c })));
}

/* ---------- story ---------- */
function renderStory() {
  const host = document.querySelector('[data-story]');
  const lang = getLang();
  const ja = getContent().ja.story.chapters;
  const chapters = L().story.chapters.map((ch, ci) => {
    const entries = ch.entries.map((e0, ei) => {
      // English entries fall back to the Japanese text when left blank in the editor
      const base = ja[ci]?.entries?.[ei] || {};
      const e = lang === 'ja' ? e0 : { ...base, ...Object.fromEntries(Object.entries(e0).filter(([, v]) => v !== '' && v != null)) };
      const link = e.link || base.link;
      return el('div', { class: `entry${e.hot ? ' is-hot' : ''}` },
        el('p', { class: 'entry__date', text: e.date }),
        el('span', { class: 'entry__dot', 'aria-hidden': 'true' }),
        el('div', { class: 'entry__body' },
          el('h3', { class: 'entry__title' }, e.title, e.badge ? el('span', { class: 'entry__badge', text: e.badge }) : null),
          el('p', { class: 'entry__sub', text: e.sub }),
          storyPhoto(e.photo || base.photo, link, e.title),
          link ? el('a', { class: 'entry__link', href: link, target: '_blank', rel: 'noopener' }, el('span', { class: 'entry__in', 'aria-hidden': 'true', text: 'in' }), t('ui.linkedinPost')) : null));
    });
    return el('div', { class: 'chapter', 'data-chapter': ci },
      el('div', { class: 'chapter__head' }, el('h3', { class: 'chapter__title', text: ch.title || ja[ci]?.title }), el('span', { class: 'chapter__span', text: ch.span || ja[ci]?.span })),
      el('div', { class: 'timeline' }, el('div', { class: 'timeline__rail', 'aria-hidden': 'true' }, el('div', { class: 'timeline__fill' })), ...entries));
  });
  host.replaceChildren(...chapters);
  wireStory();
}

// Photos of entries that came from a LinkedIn post open that post when tapped.
function storyPhoto(src, link, title) {
  if (!src) return null;
  const img = el('img', { class: 'entry__photo', src, alt: '', loading: 'lazy', decoding: 'async' });
  if (!link) return img;
  return el('a', { class: 'entry__shot', href: link, target: '_blank', rel: 'noopener', 'aria-label': `${title} — ${t('ui.linkedinPost')}` },
    img, el('span', { class: 'entry__shot-tag', 'aria-hidden': 'true' }, el('span', { class: 'entry__in', text: 'in' }), t('ui.openPost')));
}

/* ---------- original card requests ---------- */
function renderCardRequest() {
  const host = document.querySelector('[data-card-request]');
  const r = L().cardRequest;
  if (!host) return;
  host.hidden = !r;
  if (!r) return;
  host.querySelector('[data-cr-points]').replaceChildren(...(r.points || []).map((p) => el('li', { text: p })));
  const cta = host.querySelector('[data-cr-cta]');
  // land on the ordermade site, routed by the audience picked at the gate
  const routeCr = (a) => { if (a) a.href = 'https://ordermade-meishi.3twowings28113.workers.dev/try?aud=' + (localStorage.getItem('tc_for') === 'student' ? 'student' : 'general'); };
  routeCr(cta);
  if (!renderCardRequest._w) { renderCardRequest._w = 1; window.addEventListener('tc:audience', () => routeCr(document.querySelector('[data-cr-cta]'))); }
  cta.textContent = r.cta || '';
}

let storyTriggers = [];
function wireStory() {
  storyTriggers.forEach((st) => st.kill());
  storyTriggers = [];
  const { gsap, ScrollTrigger } = window;
  const lightAll = () => document.querySelectorAll('.entry').forEach((n) => n.classList.add('is-lit'));
  if (!gsap || !ScrollTrigger || reducedMotion()) {
    lightAll();
    document.querySelectorAll('.timeline__fill').forEach((f) => { f.style.transform = 'scaleY(1)'; });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  document.querySelectorAll('.timeline').forEach((tl) => {
    const fill = tl.querySelector('.timeline__fill');
    storyTriggers.push(ScrollTrigger.create({
      trigger: tl, start: 'top 70%', end: 'bottom 70%', scrub: 0.4,
      animation: gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: 'none' }),
    }));
    tl.querySelectorAll('.entry').forEach((entry) => {
      storyTriggers.push(ScrollTrigger.create({
        trigger: entry, start: 'top 70%',
        onEnter: () => entry.classList.add('is-lit'),
        onLeaveBack: () => entry.classList.remove('is-lit'),
      }));
    });
  });
}

/* ---------- affiliations ---------- */
function renderOrgs() {
  const host = document.querySelector('[data-orgs]');
  if (!host) return;
  const lang = getLang();
  const items = (getContent().affiliations?.items || []);
  host.replaceChildren(...items.map((o) => {
    const t = o[lang] || o.ja || {};
    const mark = o.logo
      ? el('img', { class: 'org__logo', src: o.logo, alt: '', loading: 'lazy', width: 48, height: 48 })
      : el('span', { class: 'org__logo org__logo--mono', 'aria-hidden': 'true', text: o.mono || (t.name || '?').slice(0, 2) });
    const body = el('span', { class: 'org__body' },
      el('span', { class: 'org__name', text: t.name || '' }),
      el('span', { class: 'org__role', text: [t.role, o.since ? (lang === 'en' ? `since ${o.since}` : `${o.since}〜`) : ''].filter(Boolean).join(lang === 'en' ? ' · ' : '　') }),
      t.desc ? el('span', { class: 'org__desc', text: t.desc }) : null);
    const usable = typeof o.url === 'string' && /^https?:\/\//.test(o.url);
    const inner = usable
      ? el('a', { class: 'org', href: o.url, target: '_blank', rel: 'noopener' }, mark, body, el('span', { class: 'org__go', 'aria-hidden': 'true', text: '↗' }))
      : el('div', { class: 'org' }, mark, body);
    return el('li', {}, inner);
  }));
}

/* ---------- works (things actually built) ---------- */
function renderWorks() {
  const host = document.querySelector('[data-works]');
  if (!host) return;
  host.replaceChildren(...(L().works?.items || []).map((w) => el('article', { class: 'work' },
    el('img', { class: 'work__icon', src: w.icon || '', alt: '', loading: 'lazy' }),
    el('div', { class: 'work__body' },
      el('h3', { class: 'work__name', text: w.name }),
      el('p', { class: 'work__desc', text: w.desc }),
      el('div', { class: 'work__links' }, ...(w.links || []).map((l) => el('a', { class: 'work__btn', href: l.url, target: '_blank', rel: 'noopener' }, l.label, el('span', { 'aria-hidden': 'true', text: ' ↗' }))))))));
}

export function initSections() {
  audience = readAudience();
  const renderAll = () => { renderOrgs(); renderAudience(); renderPhilosophy(); renderStory(); renderWorks(); renderCardRequest();  };
  onLang(renderAll);
}

/* ---------- gate hooks (used by gate.js) ---------- */
export function savedAudience() { return readAudience(); }
export function chooseAudience(id) {
  audience = id;
  try { localStorage.setItem('tc_for', id); } catch (e) { /* ignore */ }
  window.dispatchEvent(new CustomEvent('tc:audience', { detail: id }));
  document.querySelectorAll('[data-audience-chips] .chip').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.for === id)));
  renderHighlights(true);
}
export function currentAudience() { return audience; }
