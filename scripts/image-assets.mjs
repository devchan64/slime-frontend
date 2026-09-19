import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { parseDocument } from 'yaml';
const EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg', '.gif', '.ico', '.bmp', '.tif', '.tiff', '.avif', '.apng']);
const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) throw new Error(`${label}: 필수 필드·알 수 없는 필드를 확인하세요.`);
}
export function validateImages(root, areas = ['src', 'public']) {
  const document = parseDocument(readFileSync(resolve(root, 'image-assets.yaml'), 'utf8'), { uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors[0].message);
  const registry = document.toJS({ maxAliasCount: 0 });
  exact(registry, ['managementId', 'data'], '이미지 관리 목록');
  if (typeof registry.managementId !== 'string' || !ID.test(registry.managementId)) throw new Error('목록 관리 ID가 올바르지 않습니다.');
  exact(registry.data, ['version', 'images'], '이미지 목록 데이터');
  if (registry.data.version !== 1 || !Array.isArray(registry.data.images)) throw new Error('이미지 목록 버전·자료형이 올바르지 않습니다.');
  const ids = new Set([registry.managementId]), paths = new Set();
  for (const entry of registry.data.images) {
    exact(entry, ['managementId', 'path'], '이미지 항목');
    if (typeof entry.managementId !== 'string' || !ID.test(entry.managementId) || ids.has(entry.managementId)) throw new Error(`관리 ID 누락·형식 오류·중복: ${entry.managementId}`);
    ids.add(entry.managementId);
    const path = entry.path;
    if (typeof path !== 'string' || isAbsolute(path) || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..') || !EXTENSIONS.has(extname(path).toLowerCase()) || paths.has(path)) throw new Error(`이미지 경로 오류·중복: ${path}`);
    paths.add(path);
  }
  const actual = new Set();
  function walk(directory) {
    for (const name of readdirSync(directory)) {
      const path = resolve(directory, name), info = lstatSync(path);
      if (info.isSymbolicLink()) throw new Error(`이미지 검사 영역에 심볼릭 링크를 허용하지 않습니다: ${path}`);
      if (info.isDirectory()) walk(path);
      else if (info.isFile() && EXTENSIONS.has(extname(path).toLowerCase())) actual.add(relative(root, path).replaceAll('\\', '/'));
    }
  }
  for (const area of areas) walk(resolve(root, area));
  for (const path of actual) if (!paths.has(path)) throw new Error(`이미지 관리 ID 미등록: ${path}`);
  for (const path of paths) if (!actual.has(path)) throw new Error(`이미지 파일이 없거나 관리 영역 밖입니다: ${path}`);
  return paths.size;
}
