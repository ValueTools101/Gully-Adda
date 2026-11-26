#!/usr/bin/env node
/**
 * Builds the public GitHub Pages site in /docs from the Markdown in /store:
 *   docs/privacy.html, docs/delete-account.html, docs/house-rules.html, docs/index.html
 * Run: npm run store:pages   (then commit /docs; Pages serves main:/docs)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const docs = join(root, 'docs');
mkdirSync(docs, { recursive: true });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');

function md(src) {
  const lines = src.split('\n');
  const out = [];
  let list = null;
  let table = [];
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((r) => !/^\|[\s:|-]+\|$/.test(r)).map((r) => r.slice(1, -1).split('|').map((c) => inline(c.trim())));
    out.push('<table><thead><tr>' + rows[0].map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' + rows.slice(1).map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
    table = [];
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (l.startsWith('|')) { flushList(); table.push(l); continue; }
    flushTable();
    let m;
    if ((m = l.match(/^(#{1,3}) (.*)/))) { flushList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = l.match(/^\s*[-*] (.*)/))) { if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^\s*\d+\. (.*)/))) { if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (!l.trim()) flushList();
    else { flushList(); out.push(`<p>${inline(l)}</p>`); }
  }
  flushList();
  flushTable();
  return out.join('\n');
}

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="icon.png">
<style>
:root{--cream:#FFF4DC;--ink:#2B1B17;--maroon:#7A1F3D;--saffron:#FF9933;--teal:#1FA2A6}
body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 64px}
header{background:var(--saffron);border-bottom:4px solid var(--ink);padding:14px 16px}
header a{color:var(--ink);font-weight:800;font-size:22px;text-decoration:none}
h1{color:var(--maroon);line-height:1.2}h2{margin-top:32px}
a{color:#0b6e71}code{background:#fff;padding:1px 5px;border-radius:4px;border:1px solid #e6d7b8}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}th,td{border:1px solid #d9c7a2;padding:8px;text-align:left;vertical-align:top}
nav a{margin-right:14px}
</style></head>
<body><header><a href="./">🪁 Gully Adda</a></header><main>
<nav><a href="privacy.html">Privacy</a><a href="delete-account.html">Delete data</a><a href="house-rules.html">House rules</a></nav>
${body}
</main></body></html>
`;

const pages = [
  ['privacy.html', 'Gully Adda – Privacy Policy', 'PRIVACY_POLICY.md'],
  ['delete-account.html', 'Gully Adda – Delete your data', 'DELETE_ACCOUNT.md'],
  ['house-rules.html', 'Gully Adda – House Rules & Terms', 'HOUSE_RULES.md'],
];
for (const [file, title, src] of pages) {
  writeFileSync(join(docs, file), page(title, md(readFileSync(join(root, 'store', src), 'utf8'))));
  console.log('wrote docs/' + file);
}
writeFileSync(
  join(docs, 'index.html'),
  page('Gully Adda: 90s Retro Games', md(`# Gully Adda: 90s Retro Games

Play 90s retro adda games with bots, friends on one phone, or online: Raja Mantri Chor Sipahi, Mafia, Name Place Animal Thing, Dots and Boxes and Ludo.

No ads. No coins. No sign-up.

- [Privacy policy](https://valuetools101.github.io/Gully-Adda/privacy.html)
- [Delete your data](https://valuetools101.github.io/Gully-Adda/delete-account.html)
- [House rules and terms](https://valuetools101.github.io/Gully-Adda/house-rules.html)

Contact: valuetools101@gmail.com`)),
);
copyFileSync(join(root, 'store', 'graphics', 'icon-512.png'), join(docs, 'icon.png'));
writeFileSync(join(docs, '.nojekyll'), '');
console.log('wrote docs/index.html');
