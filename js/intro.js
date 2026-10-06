// Opening: the wing mark from the business card grows wings, flaps once, and flies off to open the site.
import { el, reducedMotion, t } from './i18n.js';

const SEEN_KEY = 'tc_seen';
const VB = { w: 840, h: 560, sx: 30, sy: 300 }; // wing-right.svg viewBox + shoulder

function splitName() {
  const name = document.querySelector('.namecard__name');
  if (!name || name.dataset.split === name.textContent) return [...(name?.querySelectorAll('.ch') || [])];
  const text = name.textContent;
  name.textContent = '';
  const chars = [];
  for (const c of text) {
    if (c === ' ') { name.append(' '); continue; } // keep a real space so long names can wrap
    const s = el('span', { class: 'ch', text: c });
    name.append(s);
    chars.push(s);
  }
  name.setAttribute('aria-label', text);
  name.dataset.split = name.textContent;
  return chars;
}

function revealHero(gsap, delay = 0) {
  if (!gsap) return;
  const chars = splitName();
  gsap.set('.namecard__name', { opacity: 1 });
  gsap.fromTo(chars, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.045, delay });
  gsap.fromTo(['.namecard__hello', '.namecard__kana', '.namecard__aff', '.hero__statement'], { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06, delay: delay + 0.15, clearProps: 'transform' });
}

function seenRecently() {
  try {
    const v = Number(localStorage.getItem(SEEN_KEY));
    return v && Date.now() - v < 30 * 864e5;
  } catch (e) { return false; }
}

/* ---------- feather particles (canvas) ---------- */
function particleSystem(canvas, img) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const parts = [];
  let raf = 0, last = 0;
  const step = (now) => {
    const dt = Math.min(48, now - (last || now)) / 16.7; last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.age += dt;
      p.vy += 0.035 * dt; p.vx *= 0.992; p.vy *= 0.992;
      p.x += (p.vx + Math.sin(p.age / 14 + p.seed) * 0.6) * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      p.alpha = Math.max(0, 1 - Math.max(0, p.age - 70) / 50);
      if (p.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.drawImage(img, -p.s / 2, -p.s * 0.17, p.s, p.s * 0.34);
      ctx.restore();
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].alpha <= 0) parts.splice(i, 1);
    raf = parts.length ? requestAnimationFrame(step) : 0;
  };
  return {
    burst(n, box) {
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        parts.push({
          x: box.cx + side * (Math.random() * box.w * 0.5), y: box.cy + Math.random() * box.h * 0.4,
          vx: side * (0.6 + Math.random() * 3.2), vy: -1.6 + Math.random() * 2.4,
          r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.08,
          s: 34 + Math.random() * 38, age: Math.random() * 10, seed: Math.random() * 6, alpha: 1,
        });
      }
      if (!raf) { last = 0; raf = requestAnimationFrame(step); }
    },
    stop() { cancelAnimationFrame(raf); parts.length = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); },
  };
}

function loadImage(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/* ---------- main ---------- */
export async function runIntro({ contactsReady }) {
  const root = document.documentElement;
  const gsap = window.gsap;
  const unboot = () => root.classList.remove('booting');

  if (reducedMotion() || !gsap) {
    unboot();
    return;
  }

  const full = new URLSearchParams(location.search).get('via') === 'nfc' || !seenRecently();
  try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (e) { /* ignore */ }

  const [svgText, featherImg] = await Promise.all([
    fetch('assets/brand/wing-right.svg').then((r) => (r.ok ? r.text() : null)).catch(() => null),
    loadImage('assets/brand/feather.svg'),
  ]);
  if (!svgText) { unboot(); revealHero(gsap); return; }

  /* overlay */
  const vw = innerWidth, vh = innerHeight;
  const portrait = vh > vw;
  const W = portrait ? vw * 0.8 : Math.max(280, Math.min(vw * 0.42, 760));
  const lift = portrait ? 26 : 10; // wings raised in a V on phones
  const H = W * VB.h / VB.w;
  const sx = W * VB.sx / VB.w, sy = H * VB.sy / VB.h;
  const cx = vw / 2, cy = vh * 0.46;

  const fx = el('canvas', { class: 'intro__fx' });
  const mark = el('img', { class: 'intro__mark', src: 'assets/brand/wing-mark.svg', alt: '' });
  const makeWing = (side) => {
    const wrap = el('div', { class: `intro__wing intro__wing--${side}` });
    const inner = el('div', { class: 'intro__inner' });
    inner.innerHTML = svgText; // trusted local asset
    wrap.append(inner);
    wrap.style.width = `${W}px`;
    wrap.style.top = `${cy - sy - 6}px`;
    wrap.style.left = side === 'r' ? `${cx - sx + 4}px` : `${cx - (W - sx) - 4}px`;
    return wrap;
  };
  const wr = makeWing('r'), wl = makeWing('l');
  const skip = el('p', { class: 'intro__skip', text: t('ui.skip') || 'タップでスキップ' });
  const sky = el('div', { class: 'intro__sky' });
  const overlay = el('div', { class: 'intro', 'aria-hidden': 'true' }, sky, wl, wr, mark, fx, skip);
  document.body.append(overlay);
  unboot();
  document.body.style.overflow = 'hidden';

  const fxSys = featherImg ? particleSystem(fx, featherImg) : null;
  gsap.set(wr, { transformOrigin: `${sx}px ${sy}px`, opacity: 0, scale: 0.25, rotation: -lift });
  gsap.set(wl, { transformOrigin: `${W - sx}px ${sy}px`, opacity: 0, scale: 0.25, rotation: lift });
  gsap.set(['.namecard__name', '.namecard__hello', '.namecard__kana', '.namecard__aff', '.hero__statement'], { opacity: 0 });

  // feathers: tween a proxy angle and write the SVG transform attribute (keeps each feather pinned at its root)
  const proxies = [];
  for (const wing of [wr, wl]) {
    const feathers = [...wing.querySelectorAll('.feather')].map((f) => {
      const p = { el: f, ax: +f.dataset.ax, ay: +f.dataset.ay, to: +f.dataset.angle, a: +f.dataset.fold };
      p.d = Math.hypot(p.ax - VB.sx, p.ay - VB.sy) + (f.dataset.row === 'primary' ? 120 : 0);
      return p;
    }).sort((a, b) => a.d - b.d);
    feathers.forEach((p) => p.el.setAttribute('transform', `translate(${p.ax} ${p.ay}) rotate(${p.a})`));
    proxies.push(feathers);
  }
  const write = (p) => p.el.setAttribute('transform', `translate(${p.ax} ${p.ay}) rotate(${p.a.toFixed(2)})`);

  // contact buttons wait for their feathers (full version only)
  let landingTargets = [];
  const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
  const speed = full ? 1 : 0.55;

  tl.fromTo(mark, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4 * speed, ease: 'back.out(2)' }, 0);
  const spreadAt = 0.35 * speed;
  tl.to([wr, wl], { opacity: 1, scale: 1, duration: 0.6 * speed, ease: 'power3.out' }, spreadAt);
  proxies.forEach((feathers) => feathers.forEach((p, i) => {
    tl.to(p, { a: p.to, duration: 0.55 * speed, ease: 'power3.out', onUpdate: () => write(p) }, spreadAt + i * 0.012 * speed);
  }));
  tl.to(mark, { scale: 0.8, opacity: 0.85, duration: 0.3 * speed }, spreadAt + 0.2 * speed);

  const flapAt = full ? 1.0 : 0.62;
  tl.to(wr, { rotation: 18, scaleY: 0.86, duration: 0.22, ease: 'power2.in' }, flapAt)
    .to(wl, { rotation: -18, scaleY: 0.86, duration: 0.22, ease: 'power2.in' }, flapAt)
    .add(() => {
      fxSys?.burst(full ? 36 : 14, { cx, cy: cy + 10, w: W * 2, h: H });
      gsap.fromTo(document.body, { y: 0 }, { y: 4, duration: 0.08, yoyo: true, repeat: 1, clearProps: 'transform' });
    }, flapAt + 0.22)
    .to(wr, { rotation: -lift - 6, scaleY: 1.04, duration: 0.32, ease: 'power2.out' }, flapAt + 0.22)
    .to(wl, { rotation: lift + 6, scaleY: 1.04, duration: 0.32, ease: 'power2.out' }, flapAt + 0.22);

  const flyAt = full ? 1.7 : 1.08;
  tl.to([wr, wl, mark], { y: -vh * 0.6, scale: 1.15, opacity: 0, duration: 0.55, ease: 'power2.in' }, flyAt)
    .to(skip, { opacity: 0, duration: 0.2 }, flyAt)
    .to(sky, { opacity: 0, duration: 0.4, ease: 'power1.out' }, flyAt + 0.05)
    .add(() => { overlay.style.pointerEvents = 'none'; document.body.style.overflow = ''; }, flyAt + 0.25);

  const landAt = full ? 1.9 : 1.2;
  tl.add(() => land(), landAt);
  tl.add(() => revealHero(gsap), full ? 2.35 : 1.3);
  tl.add(() => finish(false), full ? 3.4 : 2.4);

  // hide contact buttons until their feather lands
  if (full) {
    contactsReady.then(() => {
      if (tl.time() >= landAt) return;
      landingTargets = [...document.querySelectorAll('#contact [data-contact], #contact [data-save]')]
        .filter((n) => { const r = n.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      gsap.set(landingTargets, { opacity: 0, scale: 0.6 });
    });
  }

  function land() {
    if (!full || !landingTargets.length) return;
    landingTargets.forEach((target, i) => {
      const r = target.getBoundingClientRect();
      const f = el('img', { class: 'landing-feather', src: 'assets/brand/feather.svg', alt: '' });
      document.body.append(f);
      const x0 = cx + (Math.random() - 0.5) * W, y0 = cy - H * 0.2 + Math.random() * 40;
      const x1 = r.left + r.width / 2 - 22, y1 = r.top + r.height / 2 - 8;
      gsap.set(f, { x: x0, y: y0, rotation: -40 + Math.random() * 80, opacity: 1 });
      const d = 0.6, delay = i * 0.05;
      gsap.to(f, { x: x1, duration: d, delay, ease: 'power1.inOut' });
      gsap.to(f, { y: y1, rotation: 0, duration: d, delay, ease: 'back.in(1.4)' });
      gsap.to(f, { opacity: 0, scale: 0.5, duration: 0.18, delay: delay + d, onComplete: () => f.remove() });
      gsap.to(target, { opacity: 1, scale: 1, duration: 0.45, delay: delay + d - 0.05, ease: 'back.out(3)', clearProps: 'opacity,transform' });
    });
  }

  let finished = false;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  function finish(skipped) {
    if (finished) return;
    finished = true;
    setTimeout(resolveDone, skipped ? 0 : 50);
    if (skipped) {
      tl.kill();
      gsap.killTweensOf(landingTargets);
      gsap.set(landingTargets, { clearProps: 'opacity,transform' });
      document.querySelectorAll('.landing-feather').forEach((n) => n.remove());
      gsap.set(['.namecard__name', '.namecard__hello', '.namecard__kana', '.namecard__aff', '.hero__statement'], { clearProps: 'opacity,transform' });
      revealHero(gsap);
    }
    fxSys?.stop();
    overlay.remove();
    document.body.style.overflow = '';
    removeSkip();
  }

  const onSkip = (e) => {
    if (e.type === 'keydown' && !['Enter', 'Escape', ' '].includes(e.key)) return;
    if (tl.time() < flyAt) finish(true);
  };
  const removeSkip = () => { overlay.removeEventListener('pointerdown', onSkip); window.removeEventListener('keydown', onSkip); };
  overlay.addEventListener('pointerdown', onSkip);
  window.addEventListener('keydown', onSkip);

  return done;
}
