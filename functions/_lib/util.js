export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

// Japan time helpers
const jst = (d = new Date()) => new Date(d.getTime() + 9 * 3600 * 1000);
export const jstDay = (d) => jst(d).toISOString().slice(0, 10); // 2026-10-09
export const jstSlash = (d) => jstDay(d).replace(/-/g, '/'); // 2026/10/09
export const nowIso = () => new Date().toISOString();
export const jstHour = (d) => jst(d).toISOString().slice(0, 13); // 2026-10-09T14

export async function ipHash(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const data = new TextEncoder().encode(`${ip}|${jstDay()}|tsubasa-card`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function cleanText(s, max) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, '').trim().slice(0, max);
}

export const looksLikeSpam = (s) => /<[^>]+>|https?:|www\.|\.(com|net|org|jp|io|xyz|ru|cn)\b/i.test(s);

export async function readJson(request) {
  try { return await request.json(); } catch (e) { return {}; }
}

export async function getSetting(db, key) {
  if (!db) return '';
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row?.value || '';
}

export const noDb = () => json({ error: 'db_unavailable' }, 503);

export async function siteContent(env, request) {
  const res = await env.ASSETS.fetch(new URL('/content/site.json', request.url));
  return res.json();
}
