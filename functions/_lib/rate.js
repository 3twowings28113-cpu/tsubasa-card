// Fixed-window counter in D1. Returns true when the call is allowed.
export async function allow(db, key, window, limit) {
  const row = await db
    .prepare('INSERT INTO rate (key, window, count) VALUES (?, ?, 1) ON CONFLICT(key, window) DO UPDATE SET count = count + 1 RETURNING count')
    .bind(key, window)
    .first();
  if (Math.random() < 0.02) {
    // occasional cleanup of old windows
    await db.prepare("DELETE FROM rate WHERE window < ?").bind(new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)).run();
  }
  return (row?.count ?? 1) <= limit;
}
