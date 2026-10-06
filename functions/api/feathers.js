import { json, readJson, nowIso, jstDay, jstHour, ipHash, cleanText, looksLikeSpam, getSetting, noDb } from '../_lib/util.js';
import { getDb } from '../_lib/db.js';
import { allow } from '../_lib/rate.js';

const fmt = (iso) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '/') : '');

export async function onRequestGet({ env }) {
  const db = await getDb(env);
  if (!db) return json({ count: 0, items: [], disabled: true });
  const { results } = await db
    .prepare("SELECT id, nickname, message, event, created_at FROM feathers WHERE status = 'approved' ORDER BY id DESC LIMIT 200")
    .all();
  const count = await db.prepare("SELECT COUNT(*) AS n FROM feathers WHERE status = 'approved'").first();
  return json({
    count: count?.n ?? 0,
    items: results.map((r) => ({ id: r.id, nickname: r.nickname, message: r.message, event: r.event, date: fmt(r.created_at) })),
  }, 200, { 'Cache-Control': 'public, max-age=30' });
}

export async function onRequestPost({ request, env }) {
  const db = await getDb(env);
  if (!db) return noDb();
  const body = await readJson(request);
  const nickname = cleanText(body.nickname, 20);
  const message = cleanText(body.message, 60);
  const lang = body.lang === 'en' ? 'en' : 'ja';
  const msg = (ja, en) => (lang === 'en' ? en : ja);

  // honeypot: pretend success, store nothing
  if (typeof body.website === 'string' && body.website.trim() !== '') return json({ no: 0 });
  if (!nickname) return json({ message: msg('ニックネームを入れてください。', 'Please enter a nickname.') }, 400);
  if (looksLikeSpam(nickname) || looksLikeSpam(message)) {
    return json({ message: msg('URLやタグは入れられません。', 'Links and tags are not allowed.') }, 400);
  }
  const vid = typeof body.visitorId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.visitorId) ? body.visitorId : 'anon';
  const ip = await ipHash(request);
  if (!(await allow(db, `feather:v:${vid}`, jstDay(), 1))) {
    return json({ message: msg('羽根は1日1枚までです。また会えたらぜひ！', 'One feather per day. See you again!') }, 429);
  }
  if (!(await allow(db, `feather:ip:${ip}`, jstHour(), 5))) {
    return json({ message: msg('少し時間をおいてからお願いします。', 'Please try again a little later.') }, 429);
  }
  const event = await getSetting(db, lang === 'en' ? 'event_en' : 'event_ja');
  const row = await db
    .prepare("INSERT INTO feathers (created_at, nickname, message, event, lang, visitor_id, ip_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING id")
    .bind(nowIso(), nickname, message, event, lang, vid, ip)
    .first();
  return json({ no: row.id });
}
