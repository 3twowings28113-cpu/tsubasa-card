import { json, readJson, cleanText, jstDay } from '../../_lib/util.js';
import { getDb } from '../../_lib/db.js';

async function authorized(request, env) {
  const given = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const expected = env.ADMIN_TOKEN || '';
  if (!expected || !given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(a, b) : equal(new Uint8Array(a), new Uint8Array(b));
}
function equal(x, y) { let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]; return d === 0; }

export async function onRequest({ request, env, params }) {
  if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
  const db = await getDb(env);
  if (!db) return json({ error: 'db_unavailable', message: 'D1データベースがまだつながっていません（設定 → バインディング → D1 で DB を追加）' }, 503);
  const path = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const [resource, id] = path;
  const method = request.method;
  const url = new URL(request.url);

  if (resource === 'settings') {
    if (method === 'GET') {
      const { results } = await db.prepare("SELECT key, value FROM settings WHERE key IN ('event_ja', 'event_en')").all();
      return json(Object.fromEntries(results.map((r) => [r.key, r.value])));
    }
    if (method === 'PUT') {
      const body = await readJson(request);
      const ja = cleanText(body.event_ja || '', 60);
      const en = cleanText(body.event_en || '', 80);
      await db.batch([
        db.prepare("INSERT INTO settings (key, value) VALUES ('event_ja', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(ja),
        db.prepare("INSERT INTO settings (key, value) VALUES ('event_en', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(en),
      ]);
      return json({ ok: true });
    }
  }

  if (resource === 'feathers') {
    if (method === 'GET') {
      const status = ['pending', 'approved', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';
      const { results } = await db.prepare('SELECT id, created_at, nickname, message, event, lang FROM feathers WHERE status = ? ORDER BY id DESC LIMIT 200').bind(status).all();
      return json({ items: results });
    }
    if (method === 'POST' && id) {
      const body = await readJson(request);
      if (!['approved', 'rejected', 'pending'].includes(body.status)) return json({ error: 'bad_status' }, 400);
      await db.prepare('UPDATE feathers SET status = ? WHERE id = ?').bind(body.status, Number(id)).run();
      return json({ ok: true });
    }
  }

  if (resource === 'stats' && method === 'GET') {
    const since = new Date(Date.now() - 13 * 864e5 + 9 * 3600e3).toISOString().slice(0, 10);
    const [guests, byDay, byVia, byEvent, ai] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM visitors').first(),
      db.prepare('SELECT day, COUNT(*) AS n FROM visits WHERE day >= ? GROUP BY day ORDER BY day DESC').bind(since).all(),
      db.prepare('SELECT via, COUNT(*) AS n FROM visitors GROUP BY via ORDER BY n DESC').all(),
      db.prepare("SELECT COALESCE(NULLIF(event, ''), '（なし）') AS event, COUNT(*) AS n FROM visitors GROUP BY 1 ORDER BY n DESC LIMIT 20").all(),
      db.prepare('SELECT count FROM ai_usage WHERE day = ?').bind(jstDay()).first(),
    ]);
    return json({ guests: guests?.n ?? 0, byDay: byDay.results, byVia: byVia.results, byEvent: byEvent.results, aiToday: ai?.count ?? 0 });
  }

  return json({ error: 'not_found' }, 404);
}
