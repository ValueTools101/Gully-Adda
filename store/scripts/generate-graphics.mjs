#!/usr/bin/env node
/**
 * Renders the app icon, adaptive icon, splash, favicon and Play Store graphics
 * from the original SVG art in art.mjs using the preinstalled Chromium.
 * Run from repo root: node store/scripts/generate-graphics.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { iconSvg, featureSvg, splashSvg } from './art.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const appImg = join(root, 'apps', 'mobile', 'assets', 'images');
const storeImg = join(root, 'store', 'graphics');
mkdirSync(appImg, { recursive: true });
mkdirSync(storeImg, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

// Embed the app's own OFL fonts so store art uses Baloo 2 / Poppins, not system fallbacks.
import { readFileSync } from 'node:fs';
const fontFace = (family, weight, file) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(require.resolve(file)).toString('base64')}) format('truetype');}`;
const FONTS = `<style>${fontFace('Baloo 2', 800, '@expo-google-fonts/baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf')}${fontFace('Poppins', 700, '@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf')}</style>`;

async function render(svg, w, h, out, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><head>${FONTS}</head><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  writeFileSync(out, buf);
  console.log('wrote', out.replace(root + '/', ''));
}

await render(iconSvg(1024), 1024, 1024, join(appImg, 'icon.png'));
await render(iconSvg(1024, { background: false, safe: 0.62 }), 1024, 1024, join(appImg, 'adaptive-icon.png'), true);
await render(splashSvg(), 800, 800, join(appImg, 'splash.png'), true);
await render(iconSvg(48), 48, 48, join(appImg, 'favicon.png'));
await render(iconSvg(512), 512, 512, join(storeImg, 'icon-512.png'));
await render(featureSvg(), 1024, 500, join(storeImg, 'feature-graphic-1024x500.png'));
await browser.close();
