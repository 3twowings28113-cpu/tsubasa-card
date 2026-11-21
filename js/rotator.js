// Hero "what I'm up to" board: cycles the current activities like a train
// destination sign — each line flips in with a split-flap scramble and settles.
import { t, onLang } from './i18n.js';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CYCLE_MS = 2300;

export function initRotator() {
  const board = document.querySelector('[data-rotator]');
  if (!board) return;
  const numEl = board.querySelector('[data-rotator-num]');
  const textEl = board.querySelector('[data-rotator-text]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let items = [];
  let idx = 0;
  let cycle = null;
  let flap = null;

  function render(i, animate) {
    const text = items[i];
    if (!text) return;
    numEl.textContent = String(i + 1);
    clearInterval(flap);
    if (!animate || reduced) { textEl.textContent = text; return; }
    const chars = [...text];
    const t0 = performance.now();
    flap = setInterval(() => {
      const now = performance.now() - t0;
      let done = true;
      textEl.textContent = chars.map((c, k) => {
        if (c === ' ' || c === '　') return c;
        if (now >= 180 + k * 30) return c; // each flap locks in, left to right
        done = false;
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }).join('');
      if (done) { clearInterval(flap); textEl.textContent = text; }
    }, 40);
  }

  function start() {
    if (cycle || items.length < 2) return;
    cycle = setInterval(() => { idx = (idx + 1) % items.length; render(idx, true); }, CYCLE_MS);
  }
  function stop() { clearInterval(cycle); cycle = null; }

  function load() {
    const v = t('hero.activities');
    items = Array.isArray(v) ? v : [];
    idx = 0;
    render(0, false);
  }
  load();
  onLang(load);
  render(0, true);
  start();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
}
