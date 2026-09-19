import { useEffect, useState } from 'preact/hooks';
import { parsePack, validatePair, formatMessage } from './catalog.mjs';
export type Locale = 'ko' | 'en';
const STORAGE_KEY = 'slime.locale';
const sources = import.meta.glob('./locales/*/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const catalogs: Record<Locale, Record<string, string>> = { ko: {}, en: {} };
for (const [path, source] of Object.entries(sources)) {
  const match = path.match(/^\.\/locales\/(ko|en)\/([a-z]+)\.yaml$/);
  if (!match) throw new Error(`지원하지 않는 언어팩 경로: ${path}`);
  const [, locale, domain] = match;
  for (const [key, value] of Object.entries(parsePack(source, path))) catalogs[locale as Locale][`${domain}.${key}`] = value;
}
validatePair(catalogs.ko, catalogs.en, 'en');
const saved = localStorage.getItem(STORAGE_KEY);
let locale: Locale = saved === null ? 'ko' : checkedLocale(saved);
function checkedLocale(value: string): Locale {
  if (value !== 'ko' && value !== 'en') throw new Error(`지원하지 않는 언어: ${value}`);
  return value;
}
document.documentElement.lang = locale;
const listeners = new Set<() => void>();
export function getLocale(): Locale { return locale; }
export function setLocale(value: Locale) {
  checkedLocale(value);
  localStorage.setItem(STORAGE_KEY, value);
  locale = value;
  document.documentElement.lang = value;
  listeners.forEach(listener => listener());
}
export function t(key: string, values?: Record<string, string | number>) {
  const message = catalogs[locale][key];
  if (message === undefined) throw new Error(`번역을 찾을 수 없습니다: ${locale}.${key}`);
  return formatMessage(message, values);
}
export function useTranslation() {
  const [current, update] = useState(locale);
  useEffect(() => {
    const listener = () => update(locale);
    listeners.add(listener);
    listener();
    return () => { listeners.delete(listener); };
  }, []);
  return { t, locale: current, setLocale };
}
