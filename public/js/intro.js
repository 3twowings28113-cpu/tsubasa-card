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

  /* overlay — v5 "the pair approaches": BOTH wings, far away at the back-right,
     banking left and right as they flap straight at the viewer. They grow
     until the feathers fill the screen, give one last flap, then sweep past
     the camera to the back-left — revealing the hero card. */
  const fx = el('canvas', { class: 'intro__fx' });
  const glow = el('div', { class: 'intro__glow' });
  const mkWing = (side) => {
    const inner = el('div', { class: 'intro__artwing-in' }, el('img', { src: 'assets/brand/wing-art.webp', alt: '' }));
    if (side === 'l') inner.style.transform = 'scaleX(-1)';
    return el('div', { class: `intro__artwing intro__artwing--${side} intro__pairwing` }, inner);
  };
  const wingL = mkWing('l'), wingR = mkWing('r');
  const pairIn = el('div', { class: 'intro__pair-in' }, wingL, wingR);
  const pair = el('div', { class: 'intro__pair' }, pairIn);
  const P = Math.min(vw * 1.55, 1050);
  pair.style.width = `${P}px`;
  pair.style.height = `${P * 0.35}px`;
  pair.style.left = `${vw * 0.70 - P / 2}px`;
  pair.style.top = `${vh * 0.32 - (P * 0.35) / 2}px`;
  const skip = el('p', { class: 'intro__skip', text: t('ui.skip') || 'タップでスキップ' });
  const sky = el('div', { class: 'intro__sky' });
  const overlay = el('div', { class: 'intro', 'aria-hidden': 'true' }, sky, glow, pair, fx, skip);
  document.body.append(overlay);
  unboot();
  document.body.style.overflow = 'hidden';

  const fxSys = featherImg ? particleSystem(fx, featherImg) : null;
  const hero = document.querySelector('main .hero');

  // distant start: small pair, back-right, banked, slightly out of focus
  gsap.set(pair, { transformOrigin: '50% 55%', scale: 0.16, x: vw * 0.10, y: -vh * 0.10, rotation: -6, opacity: 0, filter: 'blur(5px)' });
  gsap.set(pairIn, { rotation: -5 });
  gsap.set(wingL, { rotation: -7, transformOrigin: '96% 88%' });
  gsap.set(wingR, { rotation: 7, transformOrigin: '4% 88%' });
  gsap.set(glow, { left: '70%', top: '32%', scale: 0.4, opacity: 0 });
  if (hero) gsap.set(hero, { scale: 0.92, y: 20, transformOrigin: '50% 26%' });
  gsap.set(['main .namecard__name', 'main .namecard__hello', 'main .namecard__kana', 'main .namecard__aff', 'main .hero__statement'], { opacity: 0 });

  const S = full ? 1 : 0.55;
  const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

  // flapping + banking sway + bob for the whole approach (killed at the exit)
  const flapL = gsap.to(wingL, { rotation: -27, duration: 0.30 * S, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  const flapR = gsap.to(wingR, { rotation: 27, duration: 0.30 * S, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  const bank = gsap.to(pairIn, { rotation: 5, duration: 0.55 * S, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  const bob = gsap.to(pairIn, { y: 9, duration: 0.45 * S, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  // 1) APPROACH: far back-right -> at the viewer, banking the other way
  const approachAt = 0.12 * S, approachDur = 1.7 * S;
  tl.to(pair, { opacity: 1, duration: 0.3 * S, ease: 'power1.out' }, approachAt)
    .to(glow, { opacity: 0.55, duration: 0.7 * S }, approachAt)
    .to(pair, { scale: 0.98, x: vw * 0.01, y: vh * 0.03, rotation: 9, filter: 'blur(0px)', duration: approachDur, ease: 'power1.in' }, approachAt);

  // 2) CLOSE-UP: feathers fill the whole screen for one beat
  const macroAt = approachAt + approachDur;
  tl.add(() => fxSys?.burst(full ? 16 : 7, { cx, cy, w: vw * 0.9, h: 200 }), macroAt)
    .to(pair, { scale: 2.9, x: -vw * 0.08, y: vh * 0.07, rotation: 2, duration: 0.55 * S, ease: 'power2.in' }, macroAt)
    .to(glow, { opacity: 0, scale: 1.6, duration: 0.5 * S }, macroAt);

  // 3) LAST FLAP -> past the camera to the back-left, sky fades, hero emerges
  const exitAt = macroAt + 0.55 * S + 0.22 * S;
  tl.add(() => {
      flapL.kill(); flapR.kill(); bank.kill(); bob.kill();
      fxSys?.burst(full ? 26 : 10, { cx, cy: cy - 40, w: vw * 0.95, h: 200 });
      gsap.fromTo(overlay, { y: 0 }, { y: 3, duration: 0.07, yoyo: true, repeat: 1, clearProps: 'transform' });
      gsap.to(wingL, { rotation: -40, duration: 0.16 * S, ease: 'power2.out' });
      gsap.to(wingR, { rotation: 40, duration: 0.16 * S, ease: 'power2.out' });
    }, exitAt)
    .to(pair, { x: -vw * 1.35, y: -vh * 0.30, rotation: -16, scale: 2.35, opacity: 0, duration: 0.8 * S, ease: 'power2.in', delay: 0.14 * S }, exitAt)
    .to(sky, { opacity: 0, duration: 0.95 * S, ease: 'power1.inOut' }, exitAt + 0.25 * S)
    .to(skip, { opacity: 0, duration: 0.25 }, exitAt)
    .add(() => { overlay.style.pointerEvents = 'none'; document.body.style.overflow = ''; }, exitAt + 0.5 * S);
  if (hero) {
    tl.to(hero, { scale: 1, y: 0, duration: 1.3 * S, ease: 'power3.out', clearProps: 'transform' }, exitAt + 0.25 * S);
  }
  tl.add(() => revealHero(gsap), exitAt + 0.55 * S);

  let landingTargets = [];
  const landAt = exitAt + 0.8 * S;
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
      tl.kill(); flapL.kill(); flapR.kill(); bank.kill(); bob.kill();
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
    if (tl.time() < exitAt) finish(true);
  };
  const removeSkip = () => { overlay.removeEventListener('pointerdown', onSkip); window.removeEventListener('keydown', onSkip); };
  overlay.addEventListener('pointerdown', onSkip);
  window.addEventListener('keydown', onSkip);

  return done;
}
