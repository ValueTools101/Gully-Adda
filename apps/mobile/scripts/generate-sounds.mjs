#!/usr/bin/env node
/**
 * Generates the app's small sound effects as 16-bit mono WAV files.
 * These are original, procedurally generated sounds (released CC0 by the
 * project), used because Kenney/Freesound were unreachable from the build
 * machine. Replace any file in assets/sounds with a CC0 pack sound of the same
 * name if you prefer (and update CREDITS.md).
 *
 * Run: node scripts/generate-sounds.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
mkdirSync(out, { recursive: true });

let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

function env(i, n, attack = 0.01, release = 0.3) {
  const t = i / RATE;
  const total = n / RATE;
  const a = Math.min(1, t / attack);
  const r = Math.min(1, (total - t) / (total * release));
  return Math.max(0, Math.min(a, r));
}

function tone(freqs, dur, { type = 'sine', vol = 0.5, slide = 0 } = {}) {
  const n = Math.floor(dur * RATE);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (const f0 of freqs) {
      const f = f0 + slide * t;
      const ph = 2 * Math.PI * f * t;
      v += type === 'square' ? Math.sign(Math.sin(ph)) * 0.5 : type === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
    }
    buf[i] = (v / freqs.length) * vol * env(i, n);
  }
  return buf;
}

function noise(dur, vol = 0.4, decay = 30) {
  const n = Math.floor(dur * RATE);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = rand() * vol * Math.exp((-decay * i) / RATE);
  return buf;
}

function concat(...parts) {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const o = new Float32Array(len);
  let k = 0;
  for (const p of parts) {
    o.set(p, k);
    k += p.length;
  }
  return o;
}

function silence(dur) {
  return new Float32Array(Math.floor(dur * RATE));
}

function writeWav(name, data) {
  const n = data.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  writeFileSync(join(out, `${name}.wav`), b);
  console.log('wrote', name);
}

writeWav('tap', tone([880], 0.06, { type: 'tri', vol: 0.4 }));
writeWav('dice', concat(...Array.from({ length: 6 }, (_, i) => concat(noise(0.045, 0.5 - i * 0.05, 60), silence(0.02 + i * 0.008)))));
writeWav('move', tone([520], 0.08, { type: 'tri', vol: 0.4, slide: 900 }));
writeWav('capture', concat(tone([660], 0.07, { type: 'square', vol: 0.3 }), tone([330], 0.14, { type: 'square', vol: 0.3, slide: -600 })));
writeWav('box', concat(tone([784], 0.07, { vol: 0.45 }), tone([1046], 0.1, { vol: 0.45 })));
writeWav('phase', concat(tone([392, 494], 0.18, { vol: 0.4 }), tone([523, 659], 0.25, { vol: 0.4 })));
writeWav('reveal', tone([600], 0.25, { type: 'sine', vol: 0.35, slide: 800 }));
writeWav('stop', concat(tone([988], 0.09, { type: 'square', vol: 0.3 }), silence(0.03), tone([988], 0.12, { type: 'square', vol: 0.3 })));
writeWav('win', concat(...[523, 659, 784, 1046].map((f, i) => tone([f, f * 1.5], i === 3 ? 0.4 : 0.12, { type: 'tri', vol: 0.45 }))));
writeWav('lose', concat(...[440, 392, 349, 262].map((f, i) => tone([f], i === 3 ? 0.4 : 0.15, { type: 'tri', vol: 0.4 }))));
writeWav('tick', tone([1500], 0.03, { type: 'square', vol: 0.15 }));
