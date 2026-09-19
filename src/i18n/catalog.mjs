import { parseDocument } from 'yaml';

export function parsePack(source, name) {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length) throw new Error(`${name}: ${document.errors[0].message}`);
  const data = document.toJS({ maxAliasCount: 0 });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${name}: 번역 객체가 필요합니다.`);
  for (const [key, value] of Object.entries(data)) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(key) || typeof value !== 'string' || !value.trim()) throw new Error(`${name}: 잘못된 번역 ${key}`);
  }
  return data;
}
const parameters = text => [...new Set([...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map(match => match[1]))].sort();
export function validatePair(base, translated, name) {
  if (Object.keys(base).sort().join('\n') !== Object.keys(translated).sort().join('\n')) throw new Error(`${name}: 번역 키가 일치하지 않습니다.`);
  for (const key of Object.keys(base)) {
    if (parameters(base[key]).join() !== parameters(translated[key]).join()) throw new Error(`${name}.${key}: 치환 변수가 일치하지 않습니다.`);
  }
}
export function formatMessage(message, values = {}) {
  if (parameters(message).join() !== Object.keys(values).sort().join()) throw new Error('번역 치환 변수가 일치하지 않습니다.');
  return message.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, key) => String(values[key]));
}
