// Small fetch helpers. Every call fails soft: the site must keep working without the API.
export async function api(path, { method = 'GET', body, timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: {} };
  } finally {
    clearTimeout(timer);
  }
}

export function visitorId() {
  try {
    let id = localStorage.getItem('tc_vid');
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
      localStorage.setItem('tc_vid', id);
    }
    return id;
  } catch (e) {
    return 'anon';
  }
}

export function via() {
  const v = new URLSearchParams(location.search).get('via');
  return v === 'nfc' || v === 'qr' ? v : 'direct';
}
