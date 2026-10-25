// Playful + practical extras: card flip, big-QR mode, share, feather burst,
// and the dismissible "you can have a card like this" popup for the ordermade site.
import { el, t, onLang, getContent, getLang, L } from './i18n.js';

const POPUP_HIDE_KEY = 'tc_popup_hide_until';

function toast(msg) {
  const host = document.querySelector('[data-toast]');
  if (!host) return;
  host.textContent = msg;
  host.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { host.hidden = true; }, 2400);
}

function featherBurst(x, y, n = 12) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < n; i++) {
    const f = el('img', { class: 'landing-feather', src: 'assets/brand/feather.svg', alt: '' });
    document.body.append(f);
    const dx = (Math.random() - 0.5) * 260;
    const dy = -60 - Math.random() * 140;
    const rot = (Math.random() - 0.5) * 260;
    f.animate([
      { transform: `translate(${x - 22}px, ${y - 10}px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x - 22 + dx}px, ${y - 10 + dy + 190}px) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => f.remove();
  }
}

function flipCard(sourceEl) {
  const card = document.querySelector('[data-namecard]');
  if (!card) return;
  card.classList.toggle('is-flipped');
  const back = card.querySelector('.namecard__back');
  const front = card.querySelector('.namecard__front');
  const flipped = card.classList.contains('is-flipped');
  back?.setAttribute('aria-hidden', flipped ? 'false' : 'true');
  front?.setAttribute('aria-hidden', flipped ? 'true' : 'false');
  if (sourceEl) {
    const r = sourceEl.getBoundingClientRect();
    featherBurst(r.left + r.width / 2, r.top + r.height / 3, flipped ? 14 : 6);
  }
}

function initFlip() {
  const card = document.querySelector('[data-namecard]');
  if (!card) return;
  card.addEventListener('click', () => flipCard(card));
  document.querySelector('[data-flip-btn]')?.addEventListener('click', (e) => { e.stopPropagation(); flipCard(card); });
}

function initQr() {
  const modal = document.querySelector('[data-qr-modal]');
  if (!modal) return;
  const img = modal.querySelector('.qr-modal__img');
  const open = () => {
    document.body.style.removeProperty('transform'); // a transformed body breaks fixed positioning
    modal.hidden = false;
    modal.style.display = 'flex';
    if (img && !img.complete) { const s = img.src; img.src = ''; img.src = s; }
    document.body.style.overflow = 'hidden';
  };
  const close = () => { modal.hidden = true; modal.style.display = ''; document.body.style.overflow = ''; };
  document.querySelector('[data-qr-btn]')?.addEventListener('click', open);
  modal.querySelector('[data-qr-close]')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
}

function initShare() {
  document.querySelector('[data-share-btn]')?.addEventListener('click', async () => {
    const url = getContent()?.site?.url || location.href;
    const title = document.title;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      throw new Error('no share');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(url); toast(t('ui.copied')); }
      catch (e2) { toast(url); }
    }
  });
}

/* ---------- ordermade popup: center modal when the story comes into view ---------- */
function initPopup() {
  const popup = document.querySelector('[data-popup]');
  if (!popup) return;
  const hideUntil = Number(localStorage.getItem('tc_popup_hide_until') || 0);
  if (Date.now() < hideUntil) return;
  const card = popup.querySelector('.popup__card');
  let shown = false;
  const show = () => {
    if (shown) return; shown = true;
    popup.hidden = false;
    document.body.style.overflow = 'hidden';
    if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) window.gsap.fromTo(card, { scale: 0.92, opacity: 0, y: 14 }, { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' });
  };
  const dismiss = (days) => {
    localStorage.setItem('tc_popup_hide_until', String(Date.now() + days * 864e5));
    document.body.style.overflow = '';
    if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) window.gsap.to(card, { scale: 0.94, opacity: 0, duration: 0.25, onComplete: () => { popup.hidden = true; } });
    else popup.hidden = true;
  };
  popup.querySelector('[data-popup-close]')?.addEventListener('click', () => dismiss(7));
  popup.addEventListener('click', (e) => { if (e.target === popup) dismiss(7); });
  popup.querySelector('[data-popup-cta]')?.addEventListener('click', () => dismiss(30));
  const story = document.querySelector('.story');
  if (story && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); show(); } }, { threshold: 0.08 });
    io.observe(story);
  } else {
    window.addEventListener('scroll', function onS() { if (scrollY > innerHeight * 1.5) { window.removeEventListener('scroll', onS); show(); } }, { passive: true });
  }
}

/* ---------- sky changes with the time of day ---------- */
function initSkyTime() {
  const h = new Date().getHours();
  const sky = h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
  document.documentElement.dataset.sky = sky;
}

/* ---------- card exchange mode: big name + big QR, stays awake ---------- */
function initExchange() {
  const box = document.querySelector('[data-exchange]');
  if (!box) return;
  let lock = null;
  const open = async () => {
    document.body.style.removeProperty('transform');
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    try { lock = await navigator.wakeLock?.request('screen'); } catch (e) { /* ignore */ }
    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.gsap.fromTo(box, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      window.gsap.fromTo(box.querySelector('.exchange__qr'), { scale: 0.9 }, { scale: 1, duration: 0.45, ease: 'back.out(1.8)' });
    }
  };
  const close = () => {
    box.hidden = true;
    document.body.style.overflow = '';
    try { lock?.release(); } catch (e) { /* ignore */ }
    lock = null;
  };
  document.querySelector('[data-exchange-btn]')?.addEventListener('click', open);
  box.querySelector('[data-exchange-close]')?.addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });
}

/* ---------- today's wing fortune (same fortune all day) ---------- */
function initFortune() {
  const host = document.querySelector('[data-fortune]');
  if (!host) return;
  const btn = host.querySelector('[data-fortune-btn]');
  const result = host.querySelector('[data-fortune-result]');
  const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const pick = () => {
    const items = L().fortune?.items || [];
    if (!items.length) return -1;
    let idx = -1;
    try {
      const saved = JSON.parse(localStorage.getItem('tc_fortune') || 'null');
      if (saved && saved.day === dayKey() && saved.idx < items.length) idx = saved.idx;
    } catch (e) { /* ignore */ }
    if (idx < 0) {
      let h = 0; const s = dayKey();
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      idx = h % items.length;
      try { localStorage.setItem('tc_fortune', JSON.stringify({ day: dayKey(), idx })); } catch (e) { /* ignore */ }
    }
    return idx;
  };
  const render = (animate) => {
    const f = (L().fortune?.items || [])[pick()];
    if (!f) return;
    host.querySelector('[data-fortune-rank]').textContent = f.rank;
    host.querySelector('[data-fortune-text]').textContent = f.text;
    host.querySelector('[data-fortune-lucky]').textContent = (getLang() === 'ja' ? 'ラッキーアイテム：' : 'Lucky item: ') + f.lucky;
    result.hidden = false;
    if (animate && window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.gsap.fromTo(result, { opacity: 0, y: 14, rotateX: -30 }, { opacity: 1, y: 0, rotateX: 0, duration: 0.6, ease: 'back.out(1.6)' });
      const r = btn.getBoundingClientRect();
      featherBurst(r.left + r.width / 2, r.top + r.height / 2, 10);
    }
  };
  btn?.addEventListener('click', () => { btn.classList.add('is-used'); render(true); });
  onLang(() => { if (!result.hidden) render(false); });
}

export function initFun() {
  initFlip();
  initQr();
  initShare();
  initPopup();
  initSkyTime();
  initExchange();
  initFortune();
}
