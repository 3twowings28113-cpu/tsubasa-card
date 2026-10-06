import { json, getSetting } from '../_lib/util.js';
import { getDb } from '../_lib/db.js';

export async function onRequestGet({ env }) {
  const db = await getDb(env);
  const [event_ja, event_en] = await Promise.all([getSetting(db, 'event_ja'), getSetting(db, 'event_en')]);
  return json({ event_ja, event_en, features: { db: !!db, ai: !!env.AI } });
}
