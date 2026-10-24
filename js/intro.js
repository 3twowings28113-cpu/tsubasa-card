// Opening v2: two giant painted wings fill the screen, tilt open like a gate,
// and the business card flips out from between them — then the wings fly off
// and feathers land on the contact buttons.
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

/* ---------- the card that flips out of the wings ---------- */
function buildIntroCard(vw) {
  const src = document.querySelector('[data-namecard]');
  if (!src) return null;
  const clone = src.cloneNode(true);
  clone.removeAttribute('data-namecard');
  clone.querySelector('.namecard__back')?.remove();
  clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  clone.querySelectorAll('[data-t]').forEach((n) => n.removeAttribute('data-t'));
  const w = Math.min(vw * 0.88, 520);
  const wrap = el('div', { class: 'intro__card' }, clone);
  wrap.style.width = `${w}px`;
  wrap.style.left = `${(vw - w) / 2}px`;
  wrap.style.top = '50%';
  return wrap;
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
  const WING = Math.min(vw * 1.55, 1050);
  const mkWing = (side) => {
    const inner = el('div', { class: 'intro__artwing-in' }, el('img', { src: 'assets/brand/wing-art.webp', alt: '' }));
    if (side === 'l') inner.style.transform = 'scaleX(-1)';
    const w = el('div', { class: `intro__artwing intro__artwing--${side}` }, inner);
    w.style.width = `${WING}px`;
    w.style.left = `${cx - (side === 'r' ? 0.06 : 0.94) * WING}px`;
    w.style.top = `${cy - 0.9 * WING}px`;
    return w;
  };
  const wr = mkWing('r'), wl = mkWing('l');
  const card = buildIntroCard(vw);
  const skip = el('p', { class: 'intro__skip', text: t('ui.skip') || 'タップでスキップ' });
  const sky = el('div', { class: 'intro__sky' });
  const overlay = el('div', { class: 'intro', 'aria-hidden': 'true' }, sky, glow, wl, wr, ...(card ? [card] : []), fx, skip);
  document.body.append(overlay);
  unboot();
  document.body.style.overflow = 'hidden';

  const fxSys = featherImg ? particleSystem(fx, featherImg) : null;

  gsap.set(wr, { transformOrigin: '6% 90%', rotation: 30, scale: 0.94, opacity: 0 });
  gsap.set(wl, { transformOrigin: '94% 90%', rotation: -30, scale: 0.94, opacity: 0 });
  gsap.set(glow, { scale: 0.4, opacity: 0 });
  if (card) gsap.set(card, { yPercent: -50, transformPerspective: 1100, rotationY: -82, rotation: -7, scale: 0.55, opacity: 0 });
  // hide only the real hero's text (main), never the intro card clone's
  gsap.set(['main .namecard__name', 'main .namecard__hello', 'main .namecard__kana', 'main .namecard__aff', 'main .hero__statement'], { opacity: 0 });

  const S = full ? 1 : 0.55; // timeline speed factor
  const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

  // 1) giant wings fade in, closed and tilted down over the whole screen
  tl.to([wr, wl], { opacity: 1, duration: 0.45 * S, ease: 'power2.out' }, 0)
    .to(wr, { rotation: 24, duration: 0.5 * S, ease: 'sine.inOut' }, 0)
    .to(wl, { rotation: -24, duration: 0.5 * S, ease: 'sine.inOut' }, 0);

  // 2) THE TILT: both wings sweep up and outward, opening like a gate
  const tiltAt = 0.55 * S;
  tl.to(wr, { rotation: -17, scale: 1.04, duration: 0.85 * S, ease: 'power3.inOut' }, tiltAt)
    .to(wl, { rotation: 17, scale: 1.04, duration: 0.85 * S, ease: 'power3.inOut' }, tiltAt)
    .to(glow, { scale: 1, opacity: 1, duration: 0.7 * S, ease: 'power2.out' }, tiltAt + 0.15 * S)
    .add(() => fxSys?.burst(full ? 22 : 10, { cx, cy, w: vw * 0.7, h: 120 }), tiltAt + 0.55 * S);

  // 3) the card flips out from the tilted opening
  const cardAt = tiltAt + 0.55 * S;
  if (card) {
    tl.to(card, { opacity: 1, rotationY: 0, rotation: 0, scale: 1, duration: 0.75 * S, ease: 'back.out(1.3)' }, cardAt)
      .to(card, { y: '-=10', duration: 0.5 * S, ease: 'sine.inOut', yoyo: true, repeat: 1 }, cardAt + 0.8 * S);
  }

  // 4) one big flap, then the wings fly away and the real hero takes over
  const flyAt = cardAt + (full ? 1.35 : 0.8);
  tl.to(wr, { rotation: -26, duration: 0.22, ease: 'power2.in' }, flyAt)
    .to(wl, { rotation: 26, duration: 0.22, ease: 'power2.in' }, flyAt)
    .add(() => {
      fxSys?.burst(full ? 36 : 14, { cx, cy: cy + 10, w: vw * 0.9, h: 160 });
      // shake the overlay, never <body>: a leftover transform on body would
      // become the containing block for every position:fixed element (QR modal, popup, dock)
      gsap.fromTo(overlay, { y: 0 }, { y: 4, duration: 0.08, yoyo: true, repeat: 1, clearProps: 'transform' });
    }, flyAt + 0.22)
    .to(wr, { x: vw * 0.22, y: -vh * 0.62, rotation: -34, opacity: 0, duration: 0.6, ease: 'power2.in' }, flyAt + 0.24)
    .to(wl, { x: -vw * 0.22, y: -vh * 0.62, rotation: 34, opacity: 0, duration: 0.6, ease: 'power2.in' }, flyAt + 0.24)
    .to(glow, { opacity: 0, duration: 0.4 }, flyAt + 0.3)
    .to(skip, { opacity: 0, duration: 0.2 }, flyAt + 0.24)
    .to(sky, { opacity: 0, duration: 0.45, ease: 'power1.out' }, flyAt + 0.35)
    .add(() => { overlay.style.pointerEvents = 'none'; document.body.style.overflow = ''; }, flyAt + 0.5);

  const revealAt = flyAt + 0.55;
  if (card) tl.to(card, { scale: 1.07, opacity: 0, duration: 0.35, ease: 'power1.in' }, revealAt);
  tl.add(() => revealHero(gsap), revealAt + 0.1);

  // feathers land on the contact buttons (full version only)
  let landingTargets = [];
  const landAt = revealAt + 0.15;
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
    if (tl.time() < flyAt) finish(true);
  };
  const removeSkip = () => { overlay.removeEventListener('pointerdown', onSkip); window.removeEventListener('keydown', onSkip); };
  overlay.addEventListener('pointerdown', onSkip);
  window.addEventListener('keydown', onSkip);

  return done;
}
