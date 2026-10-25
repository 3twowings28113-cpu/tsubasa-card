// Ambient feathers in the sky + the name card that tilts with the phone (gyro) or the mouse.
import { reducedMotion, t, onLang } from './i18n.js';

const tilt = { x: 0, y: 0, tx: 0, ty: 0 }; // -1..1
let gyroOn = false;

export function initMotion() {
  if (reducedMotion()) return;
  startFeathers();
  startCardTilt();
  setupTiltInputs();
}

function setupTiltInputs() {
  window.addEventListener('pointermove', (e) => {
    if (gyroOn || e.pointerType === 'touch') return;
    tilt.tx = (e.clientX / innerWidth) * 2 - 1;
    tilt.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const DOE = window.DeviceOrientationEvent;
  if (!DOE || !('ontouchstart' in window)) return;
  const listen = () => {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      gyroOn = true;
      tilt.tx = Math.max(-1, Math.min(1, e.gamma / 30));
      tilt.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    }, { passive: true });
  };
  if (typeof DOE.requestPermission === 'function') {
    // iOS only allows asking after a user gesture — use the first tap anywhere, no button
    document.addEventListener('pointerdown', async () => {
      try { if ((await DOE.requestPermission()) === 'granted') listen(); } catch (e) { /* declined */ }
    }, { once: true });
  } else {
    listen();
  }
}

function startCardTilt() {
  const card = document.querySelector('[data-namecard]');
  if (!card) return;
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(card);
  const loop = () => {
    tilt.x += (tilt.tx - tilt.x) * 0.08;
    tilt.y += (tilt.ty - tilt.y) * 0.08;
    if (visible) {
      card.style.transform = `perspective(900px) rotateY(${(tilt.x * 8).toFixed(2)}deg) rotateX(${(-tilt.y * 6).toFixed(2)}deg)`;
      card.style.setProperty('--sx', `${(50 + tilt.x * 40).toFixed(1)}%`);
      card.style.setProperty('--sy', `${(30 + tilt.y * 30).toFixed(1)}%`);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function startFeathers() {
  const canvas = document.querySelector('.sky-feathers');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = 'assets/brand/feather.svg';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const resize = () => {
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  let count = w < 760 ? 12 : 18;
  const spawn = (init) => ({
    x: Math.random() * w, y: init ? Math.random() * h : -40,
    z: 0.4 + Math.random() * 0.8, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.01,
    seed: Math.random() * 100, s: 38 + Math.random() * 38,
  });
  let feathers = Array.from({ length: count }, () => spawn(true));
  let last = 0, slow = 0, running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = 0; requestAnimationFrame(loop); }
  });
  function loop(now) {
    if (!running) return;
    const dt = Math.min(50, now - (last || now)); last = now;
    // drop feathers on slow devices
    if (dt > 30) { slow++; if (slow > 40 && feathers.length > 4) { feathers.pop(); slow = 0; } } else slow = Math.max(0, slow - 1);
    ctx.clearRect(0, 0, w, h);
    if (img.complete && img.naturalWidth) {
      const wind = Math.sin(now / 7000) * 0.35 + tilt.x * 0.9;
      for (const f of feathers) {
        f.y += (0.25 + f.z * 0.35) * dt / 16;
        f.x += (Math.sin((now / 1000) + f.seed) * 0.35 + wind * f.z) * dt / 16;
        f.r += f.vr * dt / 16 + wind * 0.002;
        if (f.y > h + 40 || f.x < -60 || f.x > w + 60) Object.assign(f, spawn(false), { x: Math.random() * w });
        ctx.save();
        ctx.globalAlpha = 0.4 + f.z * 0.35;
        ctx.translate(f.x + tilt.x * 12 * f.z, f.y + tilt.y * 8 * f.z);
        ctx.rotate(f.r);
        const s = f.s * f.z;
        ctx.drawImage(img, -s / 2, -s * 0.17, s, s * 0.34);
        ctx.restore();
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
