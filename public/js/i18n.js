// Language handling + text lookup from /content/site.json
let content = null;
let lang = 'ja';
const listeners = new Set();

export async function loadContent() {
  const res = await fetch('content/site.json', { cache: 'no-cache' });
  content = await res.json();
  return content;
}

export function initialLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'ja' || q === 'en') return q;
  try {
    const saved = localStorage.getItem('tc_lang');
    if (saved === 'ja' || saved === 'en') return saved;
  } catch (e) { /* ignore */ }
  return (navigator.language || 'ja').toLowerCase().startsWith('en') ? 'en' : 'ja';
}

export const getContent = () => content;
export const getLang = () => lang;
export const L = () => content[lang];

export function t(path, vars) {
  const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), content[lang]);
  if (typeof v !== 'string') return v;
  return vars ? v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : v;
}

export function setLang(next, { persist = true } = {}) {
  lang = next === 'en' ? 'en' : 'ja';
  if (persist) { try { localStorage.setItem('tc_lang', lang); } catch (e) { /* ignore */ } }
  document.documentElement.lang = lang;
  const meta = content[lang].meta;
  document.title = meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
  document.querySelectorAll('[data-t]').forEach((el) => {
    const v = t(el.dataset.t);
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-t-alt]').forEach((el) => {
    const v = t(el.dataset.tAlt);
    if (typeof v === 'string') el.setAttribute('alt', v);
  });
  document.querySelectorAll('[data-lang-toggle]').forEach((b) => { b.textContent = t('ui.langToggle'); });
  listeners.forEach((fn) => fn(lang));
}

export function onLang(fn) { listeners.add(fn); }

export const isUsable = (url) => typeof url === 'string' && url.trim() !== '' && !url.startsWith('TODO_');

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
