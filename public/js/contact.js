import { getContent, getLang, t, el, isUsable, onLang } from './i18n.js';

const iconCache = new Map();
async function icon(src) {
  if (!iconCache.has(src)) {
    iconCache.set(src, fetch(src).then((r) => (r.ok ? r.text() : '')).catch(() => ''));
  }
  const svg = await iconCache.get(src);
  const span = el('span', { class: 'icon', 'aria-hidden': 'true' });
  span.innerHTML = svg.replace(/<title>.*?<\/title>/, ''); // trusted local asset
  return span;
}

export const vcardHref = () => `/api/vcard?lang=${getLang()}`;

// When the API is unreachable (e.g. static preview), build a vCard in the browser instead.
export function clientVcard() {
  const c = getContent();
  const v = c.vcard;
  const en = getLang() === 'en';
  const d = new Date(Date.now() + 9 * 3600e3);
  const ymd = en ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 10).replace(/-/g, '/');
  const url = isUsable(c.site.url) ? c.site.url : location.origin;
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    en ? `N:${v.familyNameEn};${v.givenNameEn};;;` : `N;CHARSET=UTF-8:${v.familyName};${v.givenName};;;`,
    en ? `FN:${v.givenNameEn} ${v.familyNameEn}` : `FN;CHARSET=UTF-8:${v.familyName} ${v.givenName}`,
    `X-PHONETIC-LAST-NAME:${v.familyNameKana}`, `X-PHONETIC-FIRST-NAME:${v.givenNameKana}`,
    en ? 'ORG:Kansai University;Faculty of Business Data Science' : `ORG;CHARSET=UTF-8:${v.org};${v.orgUnit}`,
    en ? 'TITLE:Student (1st cohort)' : `TITLE;CHARSET=UTF-8:${v.title}`,
  ];
  if (isUsable(v.email)) lines.push(`EMAIL;TYPE=INTERNET:${v.email}`);
  if (isUsable(v.tel)) lines.push(`TEL;TYPE=CELL:${v.tel}`);
  lines.push(`URL:${url}`);
  for (const s of c.contacts) if (isUsable(s.url)) lines.push(`X-SOCIALPROFILE;TYPE=${s.id}:${s.url}`);
  lines.push(en ? `NOTE:We met on ${ymd}. Tsubasa's card: ${url}` : `NOTE;CHARSET=UTF-8:${ymd} に出会いました。山下翼の電子名刺：${url}`);
  lines.push('END:VCARD');
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/vcard;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'tsubasa-yamashita.vcf' });
  document.body.append(a); a.click(); a.remove();
}

function saveButton(extraClass = '') {
  const a = el('a', { class: `btn btn--line ${extraClass}`, href: vcardHref(), 'data-save': '' });
  a.append(el('span', { 'aria-hidden': 'true', text: '＋' }), el('span', { text: t('ui.saveContact') }));
  a.addEventListener('click', (e) => {
    if (window.__apiOk === false) { e.preventDefault(); clientVcard(); }
  });
  return a;
}

async function primaryButton(c) {
  const a = el('a', { class: 'btn btn--blue btn--primary', href: c.url, target: '_blank', rel: 'noopener', 'data-contact': c.id });
  const ic = await icon(c.icon);
  a.append(ic, el('span', { text: t('connect.cta') }));
  return a;
}

export async function renderContacts() {
  const host = document.querySelector('[data-contacts]');
  const list = getContent().contacts.filter((c) => isUsable(c.url));
  const primary = list.find((c) => c.primary);
  const others = list.filter((c) => !c.primary);
  const stack = el('div', { class: 'contact__stack' });
  if (primary) stack.append(await primaryButton(primary));
  const tiles = el('div', { class: 'tiles' });
  for (const c of others) {
    const label = getLang() === 'ja' && c.labelJa ? c.labelJa : c.label;
    const a = el('a', { class: 'tile', href: c.url, target: '_blank', rel: 'noopener', 'data-contact': c.id });
    const ic = await icon(c.icon);
    ic.style.color = c.color;
    a.append(ic, el('span', { text: label }));
    tiles.append(a);
  }
  stack.append(tiles);
  const save = el('div', { class: 'save' }, saveButton(), el('small', { text: t('ui.saveContactSub') }));
  stack.append(save);
  host.replaceChildren(stack);
  renderDock(primary);
}

function renderDock(primary) {
  const dock = document.querySelector('[data-dock]');
  const kids = [];
  if (primary) {
    const a = el('a', { class: 'btn btn--blue', href: primary.url, target: '_blank', rel: 'noopener', text: 'LinkedIn' });
    kids.push(a);
  }
  kids.push(saveButton());
  dock.replaceChildren(...kids);
}

export function initDock() {
  const dock = document.querySelector('[data-dock]');
  const contact = document.querySelector('#contact');
  if (!dock || !contact || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(([entry]) => {
    const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    dock.classList.toggle('is-on', past);
    dock.setAttribute('aria-hidden', past ? 'false' : 'true');
  });
  io.observe(contact);
}

export function renderConnect() {
  const L = getContent()[getLang()];
  const list = document.querySelector('[data-connect]');
  list.replaceChildren(...L.connect.items.map((s) => el('li', { text: s })));
  const actions = document.querySelector('[data-connect-actions]');
  const li = getContent().contacts.find((c) => c.primary && isUsable(c.url));
  const kids = [];
  if (li) kids.push(el('a', { class: 'btn btn--blue', href: li.url, target: '_blank', rel: 'noopener', text: L.connect.cta }));
  kids.push(saveButton());
  actions.replaceChildren(...kids);
}

let lastRender = Promise.resolve();
export const whenContacts = () => lastRender;
onLang(() => { lastRender = renderContacts(); renderConnect(); });
