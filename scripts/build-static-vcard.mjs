// Static vCards for hosts without the API (GitHub Pages, previews). Same fields as /api/vcard, minus the "met on" date.
import fs from 'node:fs';
const root = new URL('../public/', import.meta.url);
const site = JSON.parse(fs.readFileSync(new URL('content/site.json', root), 'utf8'));
const v = site.vcard;
const usable = (x) => typeof x === 'string' && x.trim() !== '' && !x.startsWith('TODO_');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
function fold(line) {
  const enc = new TextEncoder(); const out = []; let cur = '', bytes = 0;
  for (const ch of line) { const n = enc.encode(ch).length; if (bytes + n > 75) { out.push(cur); cur = ' '; bytes = 1; } cur += ch; bytes += n; }
  out.push(cur); return out.join('\r\n');
}
const photo = fs.readFileSync(new URL('assets/photos/vcard-photo.jpg', root)).toString('base64');
for (const lang of ['ja', 'en']) {
  const url = usable(site.site?.url) ? site.site.url : '';
  const L = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (lang === 'en') {
    L.push(`N:${esc(v.familyNameEn)};${esc(v.givenNameEn)};;;`, `FN:${esc(`${v.givenNameEn} ${v.familyNameEn}`)}`, 'ORG:Kansai University;Faculty of Business Data Science', 'TITLE:Student (1st cohort)');
  } else {
    L.push(`N;CHARSET=UTF-8:${esc(v.familyName)};${esc(v.givenName)};;;`, `FN;CHARSET=UTF-8:${esc(`${v.familyName} ${v.givenName}`)}`, `ORG;CHARSET=UTF-8:${esc(v.org)};${esc(v.orgUnit)}`, `TITLE;CHARSET=UTF-8:${esc(v.title)}`);
  }
  L.push(`X-PHONETIC-LAST-NAME;CHARSET=UTF-8:${esc(v.familyNameKana)}`, `X-PHONETIC-FIRST-NAME;CHARSET=UTF-8:${esc(v.givenNameKana)}`);
  if (usable(v.email)) L.push(`EMAIL;TYPE=INTERNET:${v.email}`);
  if (usable(v.tel)) L.push(`TEL;TYPE=CELL:${v.tel}`);
  if (url) L.push(`URL:${url}`);
  for (const c of site.contacts) if (usable(c.url) && /^https?:/i.test(c.url)) L.push(`X-SOCIALPROFILE;TYPE=${c.id}:${c.url}`);
  L.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photo}`, 'END:VCARD');
  fs.writeFileSync(new URL(`contact/tsubasa-yamashita-${lang}.vcf`, root), L.map(fold).join('\r\n') + '\r\n');
}
console.log('static vcards written');
