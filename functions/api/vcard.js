import { jstDay, jstSlash, getSetting, siteContent } from '../_lib/util.js';
import { getDb } from '../_lib/db.js';

const usable = (v) => typeof v === 'string' && v.trim() !== '' && !v.startsWith('TODO_');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

// Fold to 75 octets per RFC 2425/6350 without splitting UTF-8 characters.
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

async function photoBase64(env, request, src) {
  try {
    const res = await env.ASSETS.fetch(new URL(src, request.url));
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch (e) { return null; }
}

export async function onRequestGet({ request, env }) {
  const lang = new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'ja';
  const site = await siteContent(env, request);
  const v = site.vcard;
  const url = usable(site.site?.url) ? site.site.url : new URL(request.url).origin;
  const event = await getSetting(await getDb(env).catch(() => null), lang === 'en' ? 'event_en' : 'event_ja');
  const L = [];
  L.push('BEGIN:VCARD', 'VERSION:3.0');
  if (lang === 'en') {
    L.push(`N:${esc(v.familyNameEn)};${esc(v.givenNameEn)};;;`, `FN:${esc(`${v.givenNameEn} ${v.familyNameEn}`)}`);
    L.push('ORG:Kansai University;Faculty of Business Data Science', 'TITLE:Student (1st cohort)');
  } else {
    L.push(`N;CHARSET=UTF-8:${esc(v.familyName)};${esc(v.givenName)};;;`, `FN;CHARSET=UTF-8:${esc(`${v.familyName} ${v.givenName}`)}`);
    L.push(`ORG;CHARSET=UTF-8:${esc(v.org)};${esc(v.orgUnit)}`, `TITLE;CHARSET=UTF-8:${esc(v.title)}`);
  }
  L.push(`X-PHONETIC-LAST-NAME;CHARSET=UTF-8:${esc(v.familyNameKana)}`, `X-PHONETIC-FIRST-NAME;CHARSET=UTF-8:${esc(v.givenNameKana)}`);
  if (usable(v.email)) L.push(`EMAIL;TYPE=INTERNET:${v.email}`);
  if (usable(v.tel)) L.push(`TEL;TYPE=CELL:${v.tel}`);
  L.push(`URL:${url}`);
  for (const c of site.contacts || []) if (usable(c.url) && /^https?:/i.test(c.url)) L.push(`X-SOCIALPROFILE;TYPE=${c.id}:${c.url}`);
  const note = lang === 'en'
    ? (event ? `We met at ${event} on ${jstDay()}. Tsubasa's card: ${url}` : `We met on ${jstDay()}. Tsubasa's card: ${url}`)
    : (event ? `${jstSlash()} ${event}で出会いました。山下翼の電子名刺：${url}` : `${jstSlash()} に出会いました。山下翼の電子名刺：${url}`);
  L.push(`NOTE${lang === 'en' ? '' : ';CHARSET=UTF-8'}:${esc(note)}`);
  const photo = await photoBase64(env, request, '/assets/photos/vcard-photo.jpg');
  if (photo) L.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photo}`);
  L.push('END:VCARD');
  const body = L.map(fold).join('\r\n') + '\r\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tsubasa-yamashita.vcf"',
      'Cache-Control': 'no-store',
    },
  });
}
