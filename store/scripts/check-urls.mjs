#!/usr/bin/env node
/** Checks that the public policy pages are reachable without login (what Play's reviewers need). */
const BASE = process.env.PAGES_BASE ?? 'https://valuetools101.github.io/Gully-Adda';
const urls = ['privacy.html', 'delete-account.html', 'house-rules.html'].map((p) => `${BASE}/${p}`);
let ok = true;
for (const u of urls) {
  try {
    const r = await fetch(u, { redirect: 'follow' });
    const text = await r.text();
    const good = r.status === 200 && text.includes('Gully Adda');
    ok &&= good;
    console.log(`${good ? 'OK  ' : 'FAIL'} ${r.status} ${u}`);
  } catch (e) {
    ok = false;
    console.log(`FAIL ${u} (${e.message})`);
  }
}
process.exit(ok ? 0 : 1);
