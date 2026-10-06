// D1 is optional: the site works without it, and the tables are created on first use.
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS visitors (no INTEGER PRIMARY KEY AUTOINCREMENT, visitor_id TEXT NOT NULL UNIQUE, first_at TEXT NOT NULL, via TEXT, event TEXT, lang TEXT)',
  'CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, day TEXT NOT NULL, via TEXT, event TEXT, lang TEXT)',
  'CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day)',
  "CREATE TABLE IF NOT EXISTS feathers (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, nickname TEXT NOT NULL, message TEXT, event TEXT, lang TEXT, visitor_id TEXT, ip_hash TEXT, status TEXT NOT NULL DEFAULT 'pending')",
  'CREATE INDEX IF NOT EXISTS idx_feathers_status ON feathers(status, id)',
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)',
  'CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS rate (key TEXT NOT NULL, window TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (key, window))',
];

let ready = null;
export async function getDb(env) {
  if (!env.DB) return null;
  if (!ready) {
    ready = env.DB.batch(SCHEMA.map((q) => env.DB.prepare(q))).catch((e) => { ready = null; throw e; });
  }
  await ready;
  return env.DB;
}
