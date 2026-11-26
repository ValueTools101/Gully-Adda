import { en } from './en';

type Dict = Record<string, string>;
const dicts: Record<string, Dict> = { en };
let current: Dict = en;

/** Switch language (add hi.ts with the same keys to support Hindi). */
export function setLanguage(lang: string): void {
  current = dicts[lang] ?? en;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const raw = current[key] ?? (en as Dict)[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export type { StringKey } from './en';
