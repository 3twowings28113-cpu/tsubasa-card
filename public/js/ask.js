// "Ask Tsubasa AI": answers from the public knowledge file on the server.
import { t, L, getLang, el, onLang, reducedMotion } from './i18n.js';
import { api } from './api.js?v=20251026a';

const history = [];
let busy = false;

function bubble(who, text) {
  const b = el('div', { class: `bubble bubble--${who}`, text });
  document.querySelector('[data-ask-log]').append(b);
  return b;
}

function typeInto(node, text) {
  if (reducedMotion()) { node.textContent = text; return; }
  let i = 0;
  node.textContent = '';
  const step = () => {
    i = Math.min(text.length, i + 3);
    node.textContent = text.slice(0, i);
    if (i < text.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function ask(q) {
  q = (q || '').trim().slice(0, 200);
  if (!q || busy) return;
  busy = true;
  bubble('me', q);
  const thinking = bubble('ai', '…');
  thinking.classList.add('is-thinking');
  const r = await api('/api/ask', { method: 'POST', body: { q, lang: getLang(), history: history.slice(-4) }, timeout: 30000 });
  thinking.classList.remove('is-thinking');
  if (r.ok && r.data.answer) {
    typeInto(thinking, r.data.answer);
    history.push({ role: 'user', content: q }, { role: 'assistant', content: r.data.answer });
  } else if (r.status === 429) {
    thinking.textContent = t('ai.limit');
  } else {
    thinking.textContent = t('ai.error');
  }
  busy = false;
}

function renderSuggest() {
  const host = document.querySelector('[data-ask-suggest]');
  host.replaceChildren(...L().ai.suggestions.map((s) => el('button', { class: 'chip', type: 'button', text: s, onclick: () => ask(s) })));
  const input = document.querySelector('#ask-q');
  input.placeholder = t('ai.placeholder');
}

export function initAsk() {
  const form = document.querySelector('[data-ask-form]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    ask(input.value);
    input.value = '';
  });
  onLang(renderSuggest);
}
