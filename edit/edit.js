// 編集画面: site.json を GitHub に直接保存する（サーバー不要。GitHub Pages でも Cloudflare でも動く）
const CFG = {
  owner: '3twowings28113-cpu',
  repo: 'tsubasa-card',
  // main は元データ、gh-pages は GitHub Pages の公開用。無いブランチは自動でスキップ
  targets: [
    { branch: 'main', prefix: 'public/' },
    { branch: 'gh-pages', prefix: '' },
  ],
};
const TOKEN_KEY = 'tc_gh_token';
const $ = (s) => document.querySelector(s);

let token = '';
let data = null;
let saved = '';            // JSON of the last published state
let targets = [];          // targets whose branch exists
const shas = {};           // `${branch}:${path}` -> sha
let tab = 'story';
const openKeys = new Set(); // which <details> stay open across re-renders

/* ---------- small helpers ---------- */
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const b64FromBytes = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const b64enc = (str) => b64FromBytes(new TextEncoder().encode(str));
const b64dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}

function markDirty() {
  const changed = data && JSON.stringify(data) !== saved;
  const d = $('#dirty');
  d.textContent = changed ? '未公開の変更があります' : '変更なし';
  d.classList.toggle('is-dirty', changed);
  $('#publish').disabled = !changed;
}

/* ---------- GitHub ---------- */
async function gh(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}
const repoPath = (p) => `/repos/${CFG.owner}/${CFG.repo}${p}`;
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

async function getFile(branch, path) {
  const r = await gh(repoPath(`/contents/${enc(path)}?ref=${encodeURIComponent(branch)}`));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.json.message || `読み込みに失敗しました（${r.status}）`);
  shas[`${branch}:${path}`] = r.json.sha;
  return r.json.content ? b64dec(r.json.content) : '';
}

async function putFile(branch, path, b64, message) {
  const key = `${branch}:${path}`;
  const body = { message, content: b64, branch };
  if (shas[key]) body.sha = shas[key];
  let r = await gh(repoPath(`/contents/${enc(path)}`), { method: 'PUT', body });
  if (r.status === 422 && !body.sha) {
    // the file exists but we did not know its sha yet
    await getFile(branch, path);
    body.sha = shas[key];
    r = await gh(repoPath(`/contents/${enc(path)}`), { method: 'PUT', body });
  }
  if (!r.ok) {
    const e = new Error(r.status === 409 ? '別の場所で更新されていました。ページを読み込み直してから、もう一度直してください。' : (r.json.message || `保存に失敗しました（${r.status}）`));
    e.status = r.status;
    throw e;
  }
  shas[key] = r.json.content.sha;
}

async function putEverywhere(relPath, b64, message) {
  for (const t of targets) await putFile(t.branch, t.prefix + relPath, b64, message);
}

/* ---------- images ---------- */
async function shrink(file, max) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.82));
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)); ext = 'jpg'; }
  return { blob, ext };
}

async function uploadImage(file, max = 1400) {
  toast('写真をアップロードしています…', 60000);
  const { blob, ext } = await shrink(file, max);
  const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rel = `assets/uploads/${stamp}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const b64 = b64FromBytes(new Uint8Array(await blob.arrayBuffer()));
  await putEverywhere(rel, b64, `写真を追加: ${rel}`);
  toast('写真を追加しました（公開ボタンで反映）');
  return rel;
}

function photoPicker(current, onChange, { max = 1400, round = false } = {}) {
  const input = h('input', { type: 'file', accept: 'image/*', class: 'sr-only' });
  const img = current ? h('img', { class: round ? 'logo-thumb' : 'thumb', src: `../${current}`, alt: '' }) : null;
  const pick = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: current ? '写真を変える' : '写真を選ぶ', onclick: () => input.click() });
  const clear = current ? h('button', { class: 'btn btn--danger btn--sm', type: 'button', text: '写真を外す', onclick: () => onChange('') }) : null;
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    try { onChange(await uploadImage(f, max)); } catch (e) { toast(e.message, 6000); }
  });
  return h('div', { class: 'row' }, img, pick, clear, input);
}

/* ---------- form bits ---------- */
function field(label, value, onInput, { type = 'text', area = false, hint = '', placeholder = '' } = {}) {
  const input = area
    ? h('textarea', { placeholder }, value || '')
    : h('input', { type, value: value || '', placeholder });
  input.addEventListener('input', () => { onInput(input.value); markDirty(); });
  return h('label', { class: 'field' }, h('span', {}, label, hint ? h('small', {}, `　${hint}`) : null), input);
}
function check(label, value, onChange) {
  const c = h('input', { type: 'checkbox' });
  c.checked = !!value;
  c.addEventListener('change', () => { onChange(c.checked); markDirty(); });
  return h('label', { class: 'check' }, c, label);
}
function tools({ onUp, onDown, onDelete, extra }) {
  let armed = false;
  const del = h('button', { class: 'btn btn--danger btn--sm', type: 'button', text: '削除' });
  del.addEventListener('click', () => {
    if (!armed) { armed = true; del.textContent = 'もう一度押すと削除'; setTimeout(() => { armed = false; del.textContent = '削除'; }, 3000); return; }
    onDelete();
  });
  return h('div', { class: 'item__tools' },
    h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '↑ 上へ', onclick: onUp }),
    h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '↓ 下へ', onclick: onDown }),
    extra, del);
}
function details(key, summaryKids, bodyKids, { fresh = false } = {}) {
  const d = h('details', { class: `item${fresh ? ' new' : ''}` }, h('summary', {}, ...summaryKids), h('div', { class: 'item__body' }, ...bodyKids));
  if (openKeys.has(key)) d.open = true;
  d.addEventListener('toggle', () => { if (d.open) openKeys.add(key); else openKeys.delete(key); });
  return d;
}
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };

/* ---------- story ---------- */
function ensureEn(ci) {
  const E = data.en.story.chapters;
  if (!E[ci]) E[ci] = { title: '', span: '', entries: [] };
  const n = data.ja.story.chapters[ci].entries.length;
  while (E[ci].entries.length < n) E[ci].entries.push({});
  return E[ci];
}

let freshKey = '';
function addEntry(ci, fill = {}) {
  const J = data.ja.story.chapters[ci];
  ensureEn(ci);
  const ja = { date: fill.date || '', title: fill.ja?.title || '', sub: fill.ja?.sub || '' };
  const en = { date: fill.date || '', title: fill.en?.title || '', sub: fill.en?.sub || '' };
  if (fill.ja?.badge) ja.badge = fill.ja.badge;
  if (fill.en?.badge) en.badge = fill.en.badge;
  if (fill.link) { ja.link = fill.link; en.link = fill.link; }
  J.entries.push(ja);
  data.en.story.chapters[ci].entries.push(en);
  const key = `s:${ci}:${J.entries.length - 1}`;
  openKeys.add(key); freshKey = key;
  markDirty(); render();
  setTimeout(() => document.querySelector('.item.new')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
}

function draftCard() {
  const text = h('textarea', { placeholder: 'LinkedInの投稿の本文をそのまま貼る' });
  const url = h('input', { type: 'url', placeholder: '投稿のURL（任意）https://www.linkedin.com/posts/…' });
  const reply = h('textarea', { placeholder: 'Claudeの返事（{ から } まで）をここに貼る' });
  const lastCi = () => data.ja.story.chapters.length - 1;
  const prompt = () => [
    '次のLinkedIn投稿を、個人サイトの年表に載せる1項目にまとめてください。',
    '出力はJSONだけ（説明文やコードブロック不要）。形式：',
    '{"date":"YYYY.M","ja":{"title":"25字以内","sub":"35字以内","badge":"受賞・役割などがあれば4字程度、なければ空"},"en":{"title":"English, under 60 chars","sub":"English, under 90 chars","badge":""}}',
    'ルール：投稿に書かれた事実だけを使う。誇張しない。dateは出来事の年月（分からなければ投稿の年月）。',
    '', '--- 投稿 ---', text.value.trim(), url.value ? `URL: ${url.value.trim()}` : '',
  ].join('\n');
  const take = (obj) => {
    if (!obj || typeof obj !== 'object' || !obj.ja) throw new Error('形式が違います');
    addEntry(lastCi(), { ...obj, link: url.value.trim() || obj.link || '' });
    text.value = ''; url.value = ''; reply.value = '';
    toast('最後の章に追加しました。内容を確認してから「公開する」');
  };
  const ai = h('button', { class: 'btn', type: 'button', text: 'AIで下書き' });
  ai.addEventListener('click', async () => {
    if (!text.value.trim()) return toast('先に投稿の本文を貼ってください');
    ai.disabled = true; ai.textContent = '作成中…';
    try {
      const res = await fetch('../api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text: text.value, url: url.value }) });
      if (!res.ok) throw new Error(res.status === 404 || res.status === 405 ? 'none' : `AIの下書きに失敗しました（${res.status}）`);
      take(await res.json());
    } catch (e) {
      toast(e.message === 'none' ? 'AI下書きはサーバー版（Cloudflare）で使えます。いまは下の「Claudeに頼む」を使ってください。' : e.message, 7000);
    } finally { ai.disabled = false; ai.textContent = 'AIで下書き'; }
  });
  const copy = h('button', { class: 'btn btn--ghost', type: 'button', text: 'Claudeに頼む文をコピー' });
  copy.addEventListener('click', async () => {
    if (!text.value.trim()) return toast('先に投稿の本文を貼ってください');
    try { await navigator.clipboard.writeText(prompt()); toast('コピーしました。Claudeに貼って、返ってきた内容を下に貼ってください', 6000); }
    catch (e) { reply.value = prompt(); reply.select(); toast('自動コピーできなかったので、下の欄の文を手でコピーしてください', 6000); }
  });
  const importBtn = h('button', { class: 'btn btn--ghost', type: 'button', text: '取り込む' });
  importBtn.addEventListener('click', () => {
    try {
      const m = reply.value.match(/\{[\s\S]*\}/);
      take(JSON.parse(m ? m[0] : reply.value));
    } catch (e) { toast(`読み取れませんでした：${e.message}`, 6000); }
  });
  return h('div', { class: 'group draft' },
    h('div', { class: 'group__head' }, h('h2', { text: 'LinkedInの投稿から追加' })),
    h('p', { class: 'hint', text: '投稿を貼ると、年表の1項目（日本語・英語）を下書きします。最後の章に追加されるので、確認してから公開してください。' }),
    text, url, h('div', { class: 'row' }, ai, copy),
    reply, h('div', { class: 'row' }, importBtn));
}

function storyPanel() {
  const J = data.ja.story.chapters;
  const out = [draftCard()];
  J.forEach((ch, ci) => {
    const E = ensureEn(ci);
    const entries = ch.entries.map((ja, ei) => {
      const en = E.entries[ei];
      const key = `s:${ci}:${ei}`;
      const both = (k, v) => { ja[k] = v; en[k] = v; };
      const setOpt = (o, k, v) => { if (v) o[k] = v; else delete o[k]; };
      const chapterSel = h('select', { 'aria-label': '章を移動' }, ...J.map((c, i) => { const o = h('option', { value: i, text: `第${i + 1}章へ移動` }); if (i === ci) o.selected = true; return o; }));
      chapterSel.addEventListener('change', () => {
        const to = Number(chapterSel.value);
        if (to === ci) return;
        ensureEn(to);
        J[to].entries.push(...J[ci].entries.splice(ei, 1));
        data.en.story.chapters[to].entries.push(...E.entries.splice(ei, 1));
        openKeys.clear(); markDirty(); render();
      });
      return details(key,
        [h('span', { class: 'item__date', text: ja.date || '日付なし' }), h('span', { class: 'item__title', text: ja.title || '（タイトル未入力）' }), h('span', { class: 'item__tag', text: [ja.badge, ja.photo ? '写真' : '', ja.link ? '投稿' : ''].filter(Boolean).join('・') })],
        [
          field('日付', ja.date, (v) => both('date', v), { hint: '例：2026.10', placeholder: '2026.10' }),
          h('div', { class: 'grid2' },
            field('タイトル（日本語）', ja.title, (v) => { ja.title = v; }),
            field('Title (English)', en.title, (v) => { en.title = v; }, { hint: '空なら日本語を表示' })),
          h('div', { class: 'grid2' },
            field('説明（日本語）', ja.sub, (v) => { ja.sub = v; }, { area: true }),
            field('Description (English)', en.sub, (v) => { en.sub = v; }, { area: true })),
          h('div', { class: 'grid2' },
            field('バッジ（日本語）', ja.badge, (v) => setOpt(ja, 'badge', v), { hint: '例：優勝、主催' }),
            field('Badge (English)', en.badge, (v) => setOpt(en, 'badge', v))),
          check('目立たせる（点がオレンジになる）', ja.hot, (v) => { setOpt(ja, 'hot', v); setOpt(en, 'hot', v); }),
          field('LinkedIn投稿のURL', ja.link, (v) => { setOpt(ja, 'link', v.trim()); setOpt(en, 'link', v.trim()); }, { type: 'url', placeholder: 'https://www.linkedin.com/posts/…' }),
          photoPicker(ja.photo, (p) => { setOpt(ja, 'photo', p); setOpt(en, 'photo', p); markDirty(); render(); }),
          tools({
            onUp: () => { if (move(J[ci].entries, ei, -1)) { move(E.entries, ei, -1); openKeys.clear(); markDirty(); render(); } },
            onDown: () => { if (move(J[ci].entries, ei, 1)) { move(E.entries, ei, 1); openKeys.clear(); markDirty(); render(); } },
            onDelete: () => { J[ci].entries.splice(ei, 1); E.entries.splice(ei, 1); openKeys.clear(); markDirty(); render(); },
            extra: chapterSel,
          }),
        ], { fresh: key === freshKey });
    });
    const enHead = h('details', {}, h('summary', { class: 'hint', text: '章の英語タイトル' }),
      h('div', { class: 'grid2' }, field('Chapter title', E.title, (v) => { E.title = v; }), field('Period', E.span, (v) => { E.span = v; })));
    out.push(h('div', { class: 'group' },
      h('div', { class: 'group__head' }, h('h2', { text: `第${ci + 1}章` }),
        ch.entries.length === 0 ? h('button', { class: 'btn btn--danger btn--sm', type: 'button', text: '空の章を消す', onclick: () => { J.splice(ci, 1); data.en.story.chapters.splice(ci, 1); markDirty(); render(); } }) : null),
      h('div', { class: 'grid2' }, field('章のタイトル', ch.title, (v) => { ch.title = v; }), field('期間', ch.span, (v) => { ch.span = v; }, { placeholder: '2026.10 – ' })),
      enHead,
      ...entries,
      h('button', { class: 'btn btn--ghost', type: 'button', text: '＋ この章に出来事を追加', onclick: () => addEntry(ci) })));
  });
  out.push(h('button', { class: 'btn btn--ghost', type: 'button', text: '＋ 新しい章をつくる', onclick: () => {
    J.push({ title: '', span: '', entries: [] });
    data.en.story.chapters.push({ title: '', span: '', entries: [] });
    markDirty(); render();
  } }));
  return out;
}

/* ---------- affiliations ---------- */
function orgsPanel() {
  data.affiliations = data.affiliations || { items: [] };
  const items = data.affiliations.items;
  const list = items.map((o, i) => {
    o.ja = o.ja || {}; o.en = o.en || {};
    const key = `o:${i}`;
    return details(key,
      [o.logo ? h('img', { class: 'logo-thumb', src: `../${o.logo}`, alt: '' }) : h('span', { class: 'item__date', text: o.mono || '―' }), h('span', { class: 'item__title', text: o.ja.name || '（名前未入力）' }), h('span', { class: 'item__tag', text: o.since || '' })],
      [
        h('div', { class: 'grid2' }, field('名前（日本語）', o.ja.name, (v) => { o.ja.name = v; }), field('Name (English)', o.en.name, (v) => { o.en.name = v; })),
        h('div', { class: 'grid2' }, field('役割（日本語）', o.ja.role, (v) => { o.ja.role = v; }), field('Role (English)', o.en.role, (v) => { o.en.role = v; })),
        h('div', { class: 'grid2' }, field('いつから', o.since, (v) => { o.since = v; }, { placeholder: '2025.10' }), field('ロゴがないときの略称', o.mono, (v) => { o.mono = v; }, { hint: '2〜4文字' })),
        field('押したら開くURL', o.url, (v) => { o.url = v.trim(); }, { type: 'url', hint: '空なら押せない表示', placeholder: 'https://' }),
        photoPicker(o.logo, (p) => { o.logo = p || null; markDirty(); render(); }, { max: 320, round: true }),
        tools({
          onUp: () => { if (move(items, i, -1)) { openKeys.clear(); markDirty(); render(); } },
          onDown: () => { if (move(items, i, 1)) { openKeys.clear(); markDirty(); render(); } },
          onDelete: () => { items.splice(i, 1); openKeys.clear(); markDirty(); render(); },
        }),
      ], { fresh: key === freshKey });
  });
  return [h('div', { class: 'group' },
    h('div', { class: 'group__head' }, h('h2', { text: '所属しているところ' })),
    h('p', { class: 'hint', text: '上から順にサイトに表示されます。ロゴは丸く切り抜かれます。' }),
    ...list,
    h('button', { class: 'btn btn--ghost', type: 'button', text: '＋ 所属を追加', onclick: () => {
      items.push({ id: `org-${Date.now()}`, url: '', logo: null, mono: '', since: '', ja: { name: '', role: '' }, en: { name: '', role: '' } });
      const key = `o:${items.length - 1}`; openKeys.add(key); freshKey = key; markDirty(); render();
    } }))];
}

/* ---------- now ---------- */
function nowPanel() {
  const J = data.ja.now.items, E = data.en.now.items;
  while (E.length < J.length) E.push({});
  const list = J.map((ja, i) => {
    const en = E[i];
    return details(`n:${i}`,
      [h('span', { class: 'item__date', text: ja.tag || '' }), h('span', { class: 'item__title', text: ja.title || '（未入力）' }), h('span', {})],
      [
        h('div', { class: 'grid2' }, field('ラベル（日本語）', ja.tag, (v) => { ja.tag = v; }, { hint: '例：開発中' }), field('Label (English)', en.tag, (v) => { en.tag = v; })),
        h('div', { class: 'grid2' }, field('名前（日本語）', ja.title, (v) => { ja.title = v; }), field('Name (English)', en.title, (v) => { en.title = v; })),
        h('div', { class: 'grid2' }, field('ひとこと（日本語）', ja.body, (v) => { ja.body = v; }, { area: true }), field('One line (English)', en.body, (v) => { en.body = v; }, { area: true })),
        tools({
          onUp: () => { if (move(J, i, -1)) { move(E, i, -1); openKeys.clear(); markDirty(); render(); } },
          onDown: () => { if (move(J, i, 1)) { move(E, i, 1); openKeys.clear(); markDirty(); render(); } },
          onDelete: () => { J.splice(i, 1); E.splice(i, 1); openKeys.clear(); markDirty(); render(); },
        }),
      ]);
  });
  return [h('div', { class: 'group' },
    h('div', { class: 'group__head' }, h('h2', { text: 'いま、本気で取り組んでいること' })),
    ...list,
    h('button', { class: 'btn btn--ghost', type: 'button', text: '＋ 追加', onclick: () => { J.push({ tag: '', title: '', body: '' }); E.push({ tag: '', title: '', body: '' }); openKeys.add(`n:${J.length - 1}`); markDirty(); render(); } }))];
}

/* ---------- contacts ---------- */
function contactsPanel() {
  const v = data.vcard;
  const list = data.contacts.map((c) => h('div', { class: 'grid2' },
    field(`${c.labelJa || c.label}のURL`, c.url, (val) => { c.url = val.trim(); }, { type: 'url', hint: '空にすると非表示' })));
  return [
    h('div', { class: 'group' }, h('div', { class: 'group__head' }, h('h2', { text: 'SNS・リンク' })), ...list),
    h('div', { class: 'group' }, h('div', { class: 'group__head' }, h('h2', { text: '「連絡先に保存」の中身' })),
      h('p', { class: 'hint', text: 'サイトを見た人が電話帳に保存する情報です。空にした項目は入りません。' }),
      h('div', { class: 'grid2' }, field('メール', v.email, (val) => { v.email = val.trim(); }, { type: 'email' }), field('電話', v.tel, (val) => { v.tel = val.trim(); }, { type: 'tel' })),
      h('div', { class: 'grid2' }, field('所属', v.org, (val) => { v.org = val; }), field('学部など', v.orgUnit, (val) => { v.orgUnit = val; })),
      field('肩書き', v.title, (val) => { v.title = val; })),
  ];
}

/* ---------- raw JSON ---------- */
function jsonPanel() {
  const ta = h('textarea', { class: 'json', spellcheck: 'false' }, JSON.stringify(data, null, 2));
  const apply = h('button', { class: 'btn', type: 'button', text: 'この内容を反映' });
  apply.addEventListener('click', () => {
    try {
      const next = JSON.parse(ta.value);
      if (!next.ja || !next.en || !next.contacts) throw new Error('ja / en / contacts が見つかりません');
      data = next; markDirty(); toast('反映しました。「公開する」で保存されます');
    } catch (e) { toast(`JSONの形が正しくありません：${e.message}`, 7000); }
  });
  return [h('div', { class: 'group' },
    h('div', { class: 'group__head' }, h('h2', { text: 'まとめて編集（上級者向け）' })),
    h('p', { class: 'hint', text: 'サイトの全データです。ハイライトや「あなたは？」の文章もここで直せます。' }),
    ta, h('div', { class: 'row' }, apply))];
}

/* ---------- render ---------- */
function render() {
  const panel = $('#panel');
  const y = window.scrollY;
  const views = { story: storyPanel, orgs: orgsPanel, now: nowPanel, contacts: contactsPanel, json: jsonPanel };
  panel.replaceChildren(...views[tab]());
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  window.scrollTo(0, y);
  freshKey = '';
}

/* ---------- vCard (static copy for hosts without the API) ---------- */
async function buildVcards() {
  const usable = (x) => typeof x === 'string' && x.trim() !== '' && !x.startsWith('TODO_');
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const fold = (line) => { const e = new TextEncoder(); const out = []; let cur = '', b = 0; for (const ch of line) { const n = e.encode(ch).length; if (b + n > 75) { out.push(cur); cur = ' '; b = 1; } cur += ch; b += n; } out.push(cur); return out.join('\r\n'); };
  const photo = b64FromBytes(new Uint8Array(await (await fetch('../assets/photos/vcard-photo.jpg')).arrayBuffer()));
  const v = data.vcard;
  const res = {};
  for (const lang of ['ja', 'en']) {
    const L = ['BEGIN:VCARD', 'VERSION:3.0'];
    if (lang === 'en') L.push(`N:${esc(v.familyNameEn)};${esc(v.givenNameEn)};;;`, `FN:${esc(`${v.givenNameEn} ${v.familyNameEn}`)}`, 'ORG:Kansai University;Faculty of Business Data Science', 'TITLE:Student (1st cohort)');
    else L.push(`N;CHARSET=UTF-8:${esc(v.familyName)};${esc(v.givenName)};;;`, `FN;CHARSET=UTF-8:${esc(`${v.familyName} ${v.givenName}`)}`, `ORG;CHARSET=UTF-8:${esc(v.org)};${esc(v.orgUnit)}`, `TITLE;CHARSET=UTF-8:${esc(v.title)}`);
    L.push(`X-PHONETIC-LAST-NAME;CHARSET=UTF-8:${esc(v.familyNameKana)}`, `X-PHONETIC-FIRST-NAME;CHARSET=UTF-8:${esc(v.givenNameKana)}`);
    if (usable(v.email)) L.push(`EMAIL;TYPE=INTERNET:${v.email}`);
    if (usable(v.tel)) L.push(`TEL;TYPE=CELL:${v.tel}`);
    if (usable(data.site?.url)) L.push(`URL:${data.site.url}`);
    for (const c of data.contacts) if (usable(c.url) && /^https?:/i.test(c.url)) L.push(`X-SOCIALPROFILE;TYPE=${c.id}:${c.url}`);
    L.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photo}`, 'END:VCARD');
    res[lang] = L.map(fold).join('\r\n') + '\r\n';
  }
  return res;
}

/* ---------- publish ---------- */
async function publish() {
  const btn = $('#publish');
  btn.disabled = true; btn.textContent = '公開中…';
  try {
    const before = JSON.parse(saved);
    const text = `${JSON.stringify(data, null, 2)}\n`;
    await putEverywhere('content/site.json', b64enc(text), '編集画面から更新');
    if (JSON.stringify(before.contacts) !== JSON.stringify(data.contacts) || JSON.stringify(before.vcard) !== JSON.stringify(data.vcard)) {
      const vc = await buildVcards();
      for (const lang of ['ja', 'en']) await putEverywhere(`contact/tsubasa-yamashita-${lang}.vcf`, b64enc(vc[lang]), '連絡先データを更新');
    }
    saved = JSON.stringify(data);
    markDirty();
    toast('公開しました。1〜2分でサイトに反映されます', 6000);
  } catch (e) {
    toast(e.message, 8000);
    markDirty();
  } finally {
    btn.textContent = '公開する';
  }
}

/* ---------- start ---------- */
async function start() {
  const r = await gh(repoPath(''));
  if (!r.ok) throw new Error(r.status === 401 ? '鍵が正しくないか、期限切れです' : r.status === 404 ? 'tsubasa-card にアクセスできる鍵ではありません（Repository access を確認）' : `GitHubに接続できませんでした（${r.status}）`);
  if (r.json.permissions && !r.json.permissions.push) throw new Error('この鍵には書き込み権限がありません（Contents: Read and write）');
  targets = [];
  for (const t of CFG.targets) {
    const b = await gh(repoPath(`/branches/${encodeURIComponent(t.branch)}`));
    if (b.ok) targets.push(t);
  }
  if (!targets.length) throw new Error('保存先のブランチが見つかりません');
  const text = await getFile(targets[0].branch, `${targets[0].prefix}content/site.json`);
  if (!text) throw new Error('site.json が見つかりません');
  for (const t of targets.slice(1)) await getFile(t.branch, `${t.prefix}content/site.json`);
  data = JSON.parse(text);
  saved = JSON.stringify(data);
  $('#login').hidden = true; $('#app').hidden = false; $('#savebar').hidden = false; $('#logout').hidden = false;
  markDirty(); render();
}

function showLogin(msg = '') {
  $('#login').hidden = false; $('#app').hidden = true; $('#savebar').hidden = true; $('#logout').hidden = true;
  $('#login-msg').textContent = msg;
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  token = $('#token').value.trim();
  $('#login-msg').textContent = '確認しています…';
  try {
    await start();
    try { localStorage.setItem(TOKEN_KEY, token); } catch (err) { /* private mode */ }
    $('#token').value = '';
  } catch (err) { showLogin(err.message); }
});
$('#logout').addEventListener('click', () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  token = ''; data = null; showLogin('この端末から鍵を消しました');
});
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; openKeys.clear(); render(); window.scrollTo(0, 0); }));
$('#publish').addEventListener('click', publish);
window.addEventListener('beforeunload', (e) => { if (data && JSON.stringify(data) !== saved) { e.preventDefault(); e.returnValue = ''; } });

(async () => {
  try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { token = ''; }
  if (!token) return showLogin();
  try { await start(); } catch (err) { showLogin(err.message); }
})();
