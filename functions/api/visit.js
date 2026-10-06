import { json, readJson, nowIso, jstDay, jstHour, ipHash, getSetting, noDb } from '../_lib/util.js';
import { getDb } from '../_lib/db.js';
import { allow } from '../_lib/rate.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const id = typeof body.visitorId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.visitorId) ? body.visitorId : null;
  if (!id) return json({ error: 'bad_request' }, 400);
  const via = ['nfc', 'qr', 'pwa'].includes(body.via) ? body.via : 'direct';
  const lang = body.lang === 'en' ? 'en' : 'ja';
  const db = await getDb(env);
  if (!db) return noDb();
  const event = await getSetting(db, 'event_ja');

  await db.prepare('INSERT OR IGNORE INTO visitors (visitor_id, first_at, via, event, lang) VALUES (?, ?, ?, ?, ?)')
    .bind(id, nowIso(), via, event, lang).run();
  const row = await db.prepare('SELECT no FROM visitors WHERE visitor_id = ?').bind(id).first();
  const total = await db.prepare('SELECT COUNT(*) AS n FROM visitors').first();

  const ip = await ipHash(request);
  if (await allow(db, `visit:${ip}`, jstHour(), 120)) {
    await db.prepare('INSERT INTO visits (at, day, via, event, lang) VALUES (?, ?, ?, ?, ?)')
      .bind(nowIso(), jstDay(), via, event, lang).run();
  }
  return json({ no: row?.no ?? null, total: total?.n ?? 0 });
}
