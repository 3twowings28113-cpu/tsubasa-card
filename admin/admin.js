const $ = (s) => document.querySelector(s);
const KEY = 'tc_admin';
const token = () => sessionStorage.getItem(KEY) || '';

async function call(path, opts = {}) {
  const res = await fetch(`/api/admin/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 401) { sessionStorage.removeItem(KEY); show(false); throw new Error('unauthorized'); }
  return res.json();
}

function li(f, actions) {
  const n = document.createElement('li');
  const b = document.createElement('b'); b.textContent = f.nickname;
  const p = document.createElement('div'); p.textContent = f.message || '';
  const m = document.createElement('div'); m.className = 'meta'; m.textContent = `#${f.id} ${f.created_at || ''} ${f.event || ''}`;
  n.append(b, p, m);
  if (actions) {
    const row = document.createElement('div'); row.className = 'row';
    for (const [label, status, cls] of actions) {
      const btn = document.createElement('button'); btn.textContent = label; if (cls) btn.className = cls;
      btn.onclick = async () => { await call(`feathers/${f.id}`, { method: 'POST', body: JSON.stringify({ status }) }); load(); };
      row.append(btn);
    }
    n.append(row);
  }
  return n;
}

async function load() {
  const [s, pend, appr, st] = await Promise.all([call('settings'), call('feathers?status=pending'), call('feathers?status=approved'), call('stats')]);
  $('#event [name=event_ja]').value = s.event_ja || '';
  $('#event [name=event_en]').value = s.event_en || '';
  $('#pending-n').textContent = `(${pend.items.length})`;
  $('#pending').replaceChildren(...pend.items.map((f) => li(f, [['承認', 'approved'], ['却下', 'rejected', 'ng']])));
  $('#approved').replaceChildren(...appr.items.map((f) => li(f, [['非表示にする', 'rejected', 'ng']])));
  const rows = (arr, k) => arr.map((r) => `<tr><td>${esc(r[k] ?? '-')}</td><td>${r.n}</td></tr>`).join('');
  $('#stats').innerHTML = `
    <p>ゲスト総数 <span class="big">${st.guests}</span>　今日のAI質問 <b>${st.aiToday}</b></p>
    <h3>直近14日の来訪</h3><table>${rows(st.byDay, 'day')}</table>
    <h3>入口別</h3><table>${rows(st.byVia, 'via')}</table>
    <h3>イベント別</h3><table>${rows(st.byEvent, 'event')}</table>`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function show(on) { $('#app').hidden = !on; $('#login').hidden = on; }

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  sessionStorage.setItem(KEY, new FormData(e.target).get('token'));
  try { await load(); show(true); $('#login-err').textContent = ''; } catch (err) { $('#login-err').textContent = 'トークンが違います'; }
});
$('#event').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await call('settings', { method: 'PUT', body: JSON.stringify({ event_ja: fd.get('event_ja'), event_en: fd.get('event_en') }) });
  $('#event-ok').textContent = '保存しました';
  setTimeout(() => { $('#event-ok').textContent = ''; }, 2000);
});
$('#logout').addEventListener('click', () => { sessionStorage.removeItem(KEY); show(false); });
if (token()) load().then(() => show(true)).catch(() => show(false));
