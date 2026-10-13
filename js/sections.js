import { getContent, getLang, L, t, el, onLang, reducedMotion } from './i18n.js';

/* ---------- audience ---------- */
let audience = null;
function readAudience() {
  const q = new URLSearchParams(location.search).get('for');
  if (['engineer', 'hr', 'exec', 'student'].includes(q)) return q;
  try { return localStorage.getItem('tc_for'); } catch (e) { return null; }
}

function highlightCard(h) {
  const media = h.photo
    ? el('img', { class: 'hl__img', src: h.photo, alt: '', loading: 'lazy', decoding: 'async' })
    : el('div', { class: 'hl__img--none' }, el('img', { src: 'assets/brand/wing-mark.svg', alt: '' }));
  return el('article', { class: 'hl', 'data-id': h.id, 'data-flip-id': h.id }, media,
    el('div', { class: 'hl__body' }, el('h3', { text: h.title }), el('p', { text: h.sub })));
}

function renderHighlights(animate) {
  const host = document.querySelector('[data-highlights]');
  const data = L();
  const opt = data.audiences.options.find((o) => o.id === (audience || 'engineer'));
  const byId = Object.fromEntries(data.highlights.map((h) => [h.id, h]));
  const ids = opt.order.filter((id) => byId[id]);
  document.querySelector('[data-audience-message]').textContent = audience ? opt.message : '';
  const Flip = window.Flip;
  const canFlip = animate && Flip && window.gsap && !reducedMotion();
  const state = canFlip ? Flip.getState(host.querySelectorAll('.hl')) : null;
  const existing = animate ? new Map([...host.querySelectorAll('.hl')].map((n) => [n.dataset.id, n])) : new Map();
  host.replaceChildren(...ids.map((id) => existing.get(id) || highlightCard(byId[id])));
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
  cta.href = r.url || '#';
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
      el('span', { class: 'org__role', text: [t.role, o.since ? (lang === 'en' ? `since ${o.since}` : `${o.since}〜`) : ''].filter(Boolean).join(lang === 'en' ? ' · ' : '　') }));
    const usable = typeof o.url === 'string' && /^https?:\/\//.test(o.url);
    const inner = usable
      ? el('a', { class: 'org', href: o.url, target: '_blank', rel: 'noopener' }, mark, body, el('span', { class: 'org__go', 'aria-hidden': 'true', text: '↗' }))
      : el('div', { class: 'org' }, mark, body);
    return el('li', {}, inner);
  }));
}

/* ---------- now ---------- */
function renderNow() {
  document.querySelector('[data-now]').replaceChildren(...L().now.items.map((n) => el('li', { class: 'now__item' },
    el('span', { class: 'now__tag', text: n.tag }), el('h3', { class: 'now__title', text: n.title }), el('p', { class: 'now__body', text: n.body }))));
}

/* ---------- slides ---------- */
let slideIndex = 0;
function renderSlides() {
  const items = L().slides.items;
  const track = document.querySelector('[data-slides]');
  track.replaceChildren(...items.map((s, i) => el('button', { class: 'slide', type: 'button', 'data-i': i, 'aria-label': s.alt, onclick: () => openLightbox(i) },
    el('img', { src: s.src, alt: s.alt, loading: i === 0 ? 'eager' : 'lazy', decoding: 'async', width: 1600, height: 900 }))));
  updateCount();
}
function updateCount() {
  const n = L().slides.items.length;
  document.querySelector('[data-slides-count]').textContent = `${slideIndex + 1} / ${n}`;
}
function goSlide(i) {
  const track = document.querySelector('[data-slides]');
  const n = L().slides.items.length;
  slideIndex = (i + n) % n;
  const target = track.children[slideIndex];
  track.scrollTo({ left: target.offsetLeft - (track.clientWidth - target.clientWidth) / 2, behavior: reducedMotion() ? 'auto' : 'smooth' });
  updateCount();
}
function initSlides() {
  const track = document.querySelector('[data-slides]');
  document.querySelector('[data-slides-prev]').addEventListener('click', () => goSlide(slideIndex - 1));
  document.querySelector('[data-slides-next]').addEventListener('click', () => goSlide(slideIndex + 1));
  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bestD = Infinity;
      [...track.children].forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      slideIndex = best; updateCount();
    });
  }, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') goSlide(slideIndex + 1);
    if (e.key === 'ArrowLeft') goSlide(slideIndex - 1);
  });
  // lightbox
  const box = document.querySelector('[data-lightbox]');
  document.querySelector('[data-lightbox-close]').addEventListener('click', closeLightbox);
  document.querySelector('[data-lightbox-prev]').addEventListener('click', () => showLightbox(lbIndex - 1));
  document.querySelector('[data-lightbox-next]').addEventListener('click', () => showLightbox(lbIndex + 1));
  box.addEventListener('click', (e) => { if (e.target === box) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showLightbox(lbIndex + 1);
    if (e.key === 'ArrowLeft') showLightbox(lbIndex - 1);
  });
  let sx = 0;
  box.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) showLightbox(lbIndex + (dx < 0 ? 1 : -1));
  });
}
let lbIndex = 0, lastFocus = null;
function showLightbox(i) {
  const items = L().slides.items;
  lbIndex = (i + items.length) % items.length;
  const img = document.querySelector('[data-lightbox-img]');
  img.src = items[lbIndex].src; img.alt = items[lbIndex].alt;
}
function openLightbox(i) {
  lastFocus = document.activeElement;
  showLightbox(i);
  const box = document.querySelector('[data-lightbox]');
  box.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('[data-lightbox-close]').focus();
}
function closeLightbox() {
  document.querySelector('[data-lightbox]').hidden = true;
  document.body.style.overflow = '';
  lastFocus?.focus();
}

export function initSections() {
  audience = readAudience();
  initSlides();
  const renderAll = () => { renderOrgs(); renderAudience(); renderPhilosophy(); renderStory(); renderNow(); renderSlides(); renderCardRequest(); };
  onLang(renderAll);
}
