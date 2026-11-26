#!/usr/bin/env node
/**
 * Packs the single-bundle web export (SINGLE_BUNDLE=true expo export) into ONE
 * self-contained HTML body (JS, fonts and sounds inlined as data URIs) so the
 * app can be shared as a private preview page with no other files.
 * Usage: node scripts/pack-single-html.mjs dist-artifact out.html
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const [dir, out] = process.argv.slice(2);
const jsDir = join(dir, '_expo/static/js/web');
const entry = readdirSync(jsDir).find((f) => f.startsWith('entry-') && f.endsWith('.js'));
let js = readFileSync(join(jsDir, entry), 'utf8');
const MIME = { '.ttf': 'font/ttf', '.wav': 'audio/wav', '.png': 'image/png' };
let inlined = 0;
js = js.replace(/"\/assets\/([^"]+)"/g, (m, rel) => {
  const file = join(dir, 'assets', rel);
  if (!existsSync(file)) return m;
  inlined++;
  return `"data:${MIME[extname(file)] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}"`;
});
js = js.replace(/<\/script/gi, '<\\/script');
const html = `<title>Gully Adda</title>
<style>
  html, body { height: 100%; background: #FFF4DC; }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>
  // The app's router expects to start at "/": normalise the preview page's path first.
  try { if (location.pathname !== '/') history.replaceState(null, '', '/' + location.hash); } catch (e) {}
</script>
<script>${js}</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1e6).toFixed(2)} MB, ${inlined} assets inlined)`);
