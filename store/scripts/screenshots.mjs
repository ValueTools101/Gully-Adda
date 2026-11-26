#!/usr/bin/env node
/**
 * Captures Play Store phone screenshots (1080x1920) from the REAL app screens
 * (the Expo web build of the same code). Regenerate with:
 *   npm run store:screenshots
 * which runs `expo export --platform web` first.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'store', 'screenshots');
mkdirSync(out, { recursive: true });

const { server, url } = await serve(join(root, 'apps', 'mobile', 'dist-web'));
const browser = await chromium.launch();
// 360x640 CSS px at 3x = 1080x1920 device pixels (a typical phone).
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, name) });
  console.log('wrote store/screenshots/' + name);
};
async function startGame(game, setup = async () => {}) {
  await page.goto(url);
  await page.getByTestId(`game-${game}`).click();
  await setup();
  await page.getByTestId('setup-start').click();
  await page.getByTestId(`play-${game}`).waitFor();
  await page.waitForTimeout(600);
}

// 1. Home
await page.goto(url);
await page.getByTestId('home').waitFor();
await shot('01-home.png');

// 2. Ludo vs bots, a few turns in
await startGame('ludo', async () => {
  await page.getByTestId('players-plus').click();
  await page.getByTestId('players-plus').click();
});
for (let i = 0; i < 40; i++) {
  const roll = page.getByTestId('ludo-roll');
  if (await roll.count()) await roll.click().catch(() => {});
  const tok = page.locator('[data-testid^="token-"]');
  if (await tok.count()) await tok.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(450);
}
await page.evaluate(() => window.scrollTo(0, 0));
await shot('02-ludo.png');

// 3. Mafia: secret role at night (vs bots)
await startGame('mafia', async () => {
  await page.getByTestId('players-plus').click();
});
await page.getByTestId('mafia-ack').click();
await page.waitForTimeout(1200);
await shot('03-mafia-night.png');

// 4. Raja Mantri Chor Sipahi, pass & play private reveal
await startGame('rmcs', async () => {
  await page.getByText('📱 Pass & play').click();
  for (let i = 0; i < 2; i++) await page.getByTestId('humans-plus').click();
  const names = ['Asha', 'Bunty', 'Chintu', 'Dolly'];
  for (let i = 0; i < 4; i++) await page.getByPlaceholder(`Player ${i + 1}`).fill(names[i]).catch(() => {});
});
await shot('04-rmcs-pass-phone.png');
await page.getByTestId('pass-gate').click();
await page.waitForTimeout(500);
await shot('05-rmcs-chit.png');

// 5. Name Place Animal Thing challenge round
await startGame('npat');
const letter = (await page.getByTestId('npat-letter').textContent()).trim();
const words = { A: ['Asha', 'Agra', 'Antelope', 'Almirah'], B: ['Bunty', 'Bhopal', 'Bear', 'Bucket'] };
const mine = words[letter] ?? [`${letter}ishaan`, `${letter}aranagar`, `${letter}ulbul`, `${letter}ottle`];
const cats = ['name', 'place', 'animal', 'thing'];
for (let i = 0; i < 4; i++) await page.getByTestId(`npat-input-${cats[i]}`).fill(mine[i]);
await page.waitForTimeout(300);
await page.getByTestId('npat-submit').click();
await page.waitForTimeout(1500);
await shot('06-npat-challenge.png');

// 6. Dots and Boxes
await startGame('dots');
for (let i = 0; i < 14; i++) {
  const l = page.locator('[data-testid^="line-"]');
  const n = await l.count();
  if (n) await l.nth((i * 7) % n).click({ force: true }).catch(() => {});
  await page.waitForTimeout(900);
}
await shot('07-dots.png');

await browser.close();
server.close();
