import { readdirSync, readFileSync } from 'node:fs';
import { parsePack, validatePair } from '../src/i18n/catalog.mjs';
const root = new URL('../src/i18n/locales/', import.meta.url);
const locales = readdirSync(root).sort();
if (locales.join() !== 'en,ko') throw new Error('지원 언어 목록과 디렉터리가 일치하지 않습니다.');
const domains = readdirSync(new URL('ko/', root)).sort();
for (const locale of locales) {
  const files = readdirSync(new URL(`${locale}/`, root)).sort();
  if (domains.join() !== files.join()) throw new Error(`${locale}: 언어팩 파일 구성이 다릅니다.`);
  for (const file of files) {
    const base = parsePack(readFileSync(new URL(`ko/${file}`, root), 'utf8'), `ko/${file}`);
    const pack = parsePack(readFileSync(new URL(`${locale}/${file}`, root), 'utf8'), `${locale}/${file}`);
    validatePair(base, pack, `${locale}/${file}`);
  }
}
console.log(`[${new Date().toISOString()}/i18n/validate] ${locales.length}개 언어 · ${domains.length}개 영역 검증 완료`);
