// Opening v3: two giant painted wings start CLOSED over the whole screen,
// flap in place, then sweep open like curtains — the real hero card is already
// behind them, emerging toward the viewer and becoming usable. Feathers land
// on the contact buttons at the end.
import { el, reducedMotion, t } from './i18n.js';

const SEEN_KEY = 'tc_seen';

function splitName() {
  const name = document.querySelector('.namecard__name');
  if (!name || name.dataset.split === name.textContent) return [...(name?.querySelectorAll('.ch') || [])];
  const text = name.textContent;
  name.textContent = '';
  const chars = [];
  for (const c of text) {
    if (c === ' ') { name.append(' '); continue; }
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

  if (reducedMotion() || !gsap) { unboot(); return; }

  const full = new URLSearchParams(location.search).get('via') === 'nfc' || !seenRecently();
  try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (e) { /* ignore */ }

  const featherImg = await loadImage('assets/brand/feather.svg');
  const vw = innerWidth, vh = innerHeight;
  const cx = vw / 2, cy = vh * 0.46;

  /* overlay */
  const fx = el('canvas', { class: 'intro__fx' });
  const glow = el('div', { class: 'intro__glow' });
  // Wing art: root (shoulder) sits at the image's bottom-left (~6% / ~90%).
  // The left wing is the same box mirrored via an inner scaleX(-1), so its
  // root lands at 94% — position and transform-origin account for that.
  // v3: wings are extra large and their roots sit near the top-center. In the
  // closed pose (rotated ~100 degrees) the pair forms a symmetric blanket of
  // feathers over the whole screen — verified visually against a pose grid.
  const WING = Math.min(Math.max(vw * 1.9, vh * 1.2), 1500);
  const rootY = vh * 0.34;
  const mkWing = (side) => {
    const inner = el('div', { class: 'intro__artwing-in' }, el('img', { src: 'assets/brand/wing-art.webp', alt: '' }));
    if (side === 'l') inner.style.transform = 'scaleX(-1)';
    const w = el('div', { class: `intro__artwing intro__artwing--${side}` }, inner);
    w.style.width = `${WING}px`;
    w.style.left = `${cx - (side === 'r' ? 0.06 : 0.94) * WING + (side === 'r' ? 8 : -8)}px`;
    w.style.top = `${rootY - 0.9 * WING}px`;
    return w;
  };
  const wr = mkWing('r'), wl = mkWing('l');
  const skip = el('p', { class: 'intro__skip', text: t('ui.skip') || 'タップでスキップ' });
  const sky = el('div', { class: 'intro__sky' });
  const overlay = el('div', { class: 'intro', 'aria-hidden': 'true' }, sky, glow, wl, wr, fx, skip);
  document.body.append(overlay);
  unboot();
  document.body.style.overflow = 'hidden';

  const fxSys = featherImg ? particleSystem(fx, featherImg) : null;
  const hero = document.querySelector('main .hero');

  // CLOSED pose: roots meet at the top-center, feather vanes fan down and
  // outward, overlapping at the center — the screen is wrapped in wings.
  gsap.set(wr, { transformOrigin: '6% 90%', rotation: 100, scale: 1.05, opacity: 0 });
  gsap.set(wl, { transformOrigin: '94% 90%', rotation: -100, scale: 1.05, opacity: 0 });
  gsap.set(glow, { scale: 0.5, opacity: 0 });
  if (hero) gsap.set(hero, { scale: 0.92, y: 20, transformOrigin: '50% 26%' });
  // hide only the real hero's text (main)
  gsap.set(['main .namecard__name', 'main .namecard__hello', 'main .namecard__kana', 'main .namecard__aff', 'main .hero__statement'], { opacity: 0 });

  const S = full ? 1 : 0.55; // timeline speed factor
  const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

  // 1) wings are already closed over the screen; they settle in
  tl.to([wr, wl], { opacity: 1, duration: 0.35 * S, ease: 'power2.out' }, 0)
    .to([wr, wl], { scale: 1, duration: 0.45 * S, ease: 'sine.out' }, 0)
    .to(glow, { opacity: 0.55, scale: 0.85, duration: 0.7 * S, ease: 'power2.out' }, 0.15 * S);

  // 2) FLAP in place while closed (はためき): wings flex out and back
  const flapAt = 0.5 * S;
  const flaps = full ? 3 : 1;
  tl.to(wr, { rotation: 88, duration: 0.24 * S, ease: 'sine.inOut', yoyo: true, repeat: flaps }, flapAt)
    .to(wl, { rotation: -88, duration: 0.24 * S, ease: 'sine.inOut', yoyo: true, repeat: flaps }, flapAt)
    .to([wr, wl], { y: '-=8', duration: 0.24 * S, ease: 'sine.inOut', yoyo: true, repeat: flaps }, flapAt)
    .add(() => fxSys?.burst(full ? 14 : 6, { cx, cy: cy + 60, w: vw * 0.8, h: 120 }), flapAt + 0.2 * S);

  // 3) CURTAIN OPEN: wings sweep up and out to the sides while the sky fades,
  //    revealing the real hero card, which comes toward the viewer
  const openAt = flapAt + 0.24 * S * (flaps + 1) + 0.25 * S;
  tl.add(() => {
      fxSys?.burst(full ? 30 : 12, { cx, cy, w: vw * 0.9, h: 180 });
      // shake the overlay, never <body>: a leftover transform on body would
      // become the containing block for every position:fixed element (QR modal, popup, dock)
      gsap.fromTo(overlay, { y: 0 }, { y: 3, duration: 0.07, yoyo: true, repeat: 1, clearProps: 'transform' });
    }, openAt)
    .to(wr, { rotation: -32, x: vw * 0.40, y: -vh * 0.14, scale: 0.8, opacity: 0, duration: 1.05 * S, ease: 'power3.inOut' }, openAt)
    .to(wl, { rotation: 32, x: -vw * 0.40, y: -vh * 0.14, scale: 0.8, opacity: 0, duration: 1.05 * S, ease: 'power3.inOut' }, openAt)
    .to(sky, { opacity: 0, duration: 0.75 * S, ease: 'power1.inOut' }, openAt + 0.18 * S)
    .to(glow, { opacity: 0, scale: 1.7, duration: 0.85 * S, ease: 'power1.out' }, openAt + 0.1 * S)
    .to(skip, { opacity: 0, duration: 0.25 }, openAt)
    .add(() => { overlay.style.pointerEvents = 'none'; document.body.style.overflow = ''; }, openAt + 0.35 * S);
  if (hero) {
    tl.to(hero, { scale: 1, y: 0, duration: 1.0 * S, ease: 'power3.out', clearProps: 'transform' }, openAt + 0.12 * S);
  }
  tl.add(() => revealHero(gsap), openAt + 0.42 * S);

  // feathers land on the contact buttons (full version only)
  let landingTargets = [];
  const landAt = openAt + 0.5 * S;
  tl.add(() => land(), landAt);
  tl.add(() => finish(false), landAt + (full ? 1.15 : 0.6));

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
      const x0 = cx + (Math.random() - 0.5) * vw * 0.6, y0 = cy - 120 + Math.random() * 40;
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
      if (hero) gsap.set(hero, { clearProps: 'transform,opacity' });
      document.querySelectorAll('.landing-feather').forEach((n) => n.remove());
      gsap.set(['.namecard__name', '.namecard__hello', '.namecard__kana', '.namecard__aff', '.hero__statement'], { clearProps: 'opacity,transform' });
      revealHero(gsap);
    }
    fxSys?.stop();
    overlay.remove();
    document.body.style.overflow = '';
    document.body.style.removeProperty('transform');
    removeSkip();
  }

  const onSkip = (e) => {
    if (e.type === 'keydown' && !['Enter', 'Escape', ' '].includes(e.key)) return;
    if (tl.time() < openAt) finish(true);
  };
  const removeSkip = () => { overlay.removeEventListener('pointerdown', onSkip); window.removeEventListener('keydown', onSkip); };
  overlay.addEventListener('pointerdown', onSkip);
  window.addEventListener('keydown', onSkip);

  return done;
}
