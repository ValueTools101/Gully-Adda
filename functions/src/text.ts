/** Display-name and chat text cleanup with a small profanity mask. */
const BAD = [
  'fuck', 'shit', 'bitch', 'bastard', 'cunt', 'dick', 'asshole', 'slut', 'whore', 'nigger', 'faggot', 'retard',
  'chutiya', 'chutiye', 'madarchod', 'behenchod', 'bhenchod', 'bhosdike', 'bhosdi', 'gandu', 'randi', 'harami', 'lauda', 'lawda', 'lund',
];
const BAD_RE = new RegExp(`(${BAD.join('|')})`, 'gi');

export function maskProfanity(s: string): string {
  return s.replace(BAD_RE, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
}

export function containsProfanity(s: string): boolean {
  BAD_RE.lastIndex = 0;
  const hit = BAD_RE.test(s.replace(/[^a-z]/gi, ''));
  BAD_RE.lastIndex = 0;
  return hit;
}

const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g');

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (s.length < 1) return null;
  if (containsProfanity(s)) return null;
  return s;
}

export function cleanChat(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return s.length ? maskProfanity(s) : null;
}
