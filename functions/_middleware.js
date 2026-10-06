// Make OGP image/url absolute for the current host (link previews on LINE, Slack, X need absolute URLs).
export async function onRequest({ request, next }) {
  const res = await next();
  if (!(res.headers.get('Content-Type') || '').includes('text/html')) return res;
  const origin = new URL(request.url).origin;
  const abs = (v) => (v && !/^https?:/i.test(v) ? new URL(v.replace(/^\/?/, '/'), origin).toString() : v);
  return new HTMLRewriter()
    .on('meta[property="og:image"]', { element(e) { e.setAttribute('content', abs(e.getAttribute('content'))); } })
    .on('head', { element(e) { e.append(`<meta property="og:url" content="${origin}/">`, { html: true }); } })
    .transform(res);
}
