// "Wing of Encounters": every approved feather someone leaves lights up one feather of this wing.
import { t, getLang, el, onLang, reducedMotion } from './i18n.js';
import { api, visitorId } from './api.js?v=20251026g';

const PALETTE = ['#0A66C2', '#1F7AE0', '#4FA3FF', '#7FB8F5', '#FF8A3D', '#2E7DD1', '#9CC3EA', '#FFB27A'];
const NS = 'http://www.w3.org/2000/svg';
let slots = [];
let items = [];
let total = 0;

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; }

async function buildWing(stage) {
  const text = await fetch('assets/brand/wing-right.svg').then((r) => r.text()).catch(() => null);
  if (!text) return;
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const wing = doc.querySelector('#wing-right');
  const defs = doc.querySelector('defs');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1660 600');
  svg.setAttribute('class', 'wingwall__svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('feathers.title'));
  if (defs) svg.append(document.importNode(defs, true));
  const right = document.importNode(wing, true);
  right.removeAttribute('id');
  right.setAttribute('transform', 'translate(806 30)');
  const left = document.importNode(wing, true);
  left.removeAttribute('id');
  left.setAttribute('transform', 'translate(854 30) scale(-1 1)');
  svg.append(left, right);
  const order = (g) => [...g.querySelectorAll('.feather')].map((f) => ({
    f, d: Math.hypot(+f.dataset.ax - 30, +f.dataset.ay - 300) + (f.dataset.row === 'primary' ? 120 : 0),
  })).sort((a, b) => a.d - b.d).map((x) => x.f);
  const R = order(right), Lw = order(left);
  slots = [];
  for (let i = 0; i < Math.max(R.length, Lw.length); i++) { if (R[i]) slots.push(R[i]); if (Lw[i]) slots.push(Lw[i]); }
  slots.forEach((s, i) => { s.classList.add('slot'); s.dataset.slot = i; });
  svg.addEventListener('click', (e) => {
    const s = e.target.closest('.slot.is-on');
    if (s) showPop(items[Number(s.dataset.slot)]);
  });
  stage.prepend(svg);
}

function paint() {
  slots.forEach((s, i) => {
    const it = items[i];
    const path = s.querySelector('path');
    s.classList.toggle('is-on', !!it);
    if (it) {
      path.style.fill = PALETTE[hash(it.nickname) % PALETTE.length];
      path.style.fillOpacity = '0.85';
      s.setAttribute('tabindex', '0');
      s.setAttribute('role', 'button');
      s.setAttribute('aria-label', it.nickname);
    } else {
      path.style.fill = ''; path.style.fillOpacity = '';
      s.removeAttribute('tabindex'); s.removeAttribute('role'); s.removeAttribute('aria-label');
    }
  });
  const count = document.querySelector('[data-wingwall-count]');
  count.textContent = total ? t('feathers.count', { n: total }) : t('feathers.empty');
}

function showPop(it) {
  if (!it) return;
  const pop = document.querySelector('[data-wingwall-pop]');
  const meta = [it.event, it.date].filter(Boolean).join(' / ');
  pop.replaceChildren(el('b', { text: it.nickname }), it.message ? el('p', { text: it.message }) : null, meta ? el('small', { text: meta }) : null);
  pop.hidden = false;
}

async function load() {
  const r = await api('/api/feathers');
  if (r.ok) {
    // oldest first so the wing grows from the shoulder
    items = (r.data.items || []).slice().reverse();
    total = r.data.count || items.length;
  }
  paint();
}

function flyFeather(from) {
  if (reducedMotion() || !window.gsap) return;
  const stage = document.querySelector('[data-wingwall]');
  const a = from.getBoundingClientRect(), b = stage.getBoundingClientRect();
  const f = el('img', { class: 'landing-feather', src: 'assets/brand/feather.svg', alt: '' });
  document.body.append(f);
  const g = window.gsap;
  g.set(f, { x: a.left + a.width / 2 - 22, y: a.top, rotation: -20 });
  g.to(f, { x: b.left + b.width / 2 - 22, duration: 1, ease: 'power1.inOut' });
  g.to(f, { y: b.top + b.height * 0.35, rotation: 30, duration: 1, ease: 'power2.inOut' });
  g.to(f, { opacity: 0, duration: 0.3, delay: 0.9, onComplete: () => f.remove() });
}

function wireForm() {
  const form = document.querySelector('[data-feather-form]');
  const status = document.querySelector('[data-feather-status]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    status.textContent = '';
    const r = await api('/api/feathers', {
      method: 'POST',
      body: { nickname: fd.get('nickname'), message: fd.get('message'), website: fd.get('website'), visitorId: visitorId(), lang: getLang() },
    });
    btn.disabled = false;
    if (r.ok && r.data.no) {
      status.textContent = t('feathers.thanks', { n: r.data.no });
      flyFeather(btn);
      form.reset();
    } else {
      status.textContent = r.data.message || t('feathers.error');
    }
  });
}

export async function initWingWall() {
  const stage = document.querySelector('[data-wingwall]');
  if (!stage) return;
  await buildWing(stage);
  wireForm();
  onLang(paint);
  // load when the section gets close, to keep first paint light
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '400px' });
  io.observe(stage);
  paint();
}
