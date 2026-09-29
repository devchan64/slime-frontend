import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';

const frontendRootDirectory = fileURLToPath(new URL('../', import.meta.url));
const interfaceAssetsSelected = process.argv.includes('--ui');
const spriteAssetsSelected = process.argv.includes('--sprites');
const selectedLogArea = interfaceAssetsSelected ? 'ui-assets' : spriteAssetsSelected ? 'sprite-assets' : 'map-assets';
const selectedLockFilename = interfaceAssetsSelected ? 'ui-assets.lock.yaml' : spriteAssetsSelected ? 'sprite-assets.lock.yaml' : 'map-assets.lock.yaml';
const selectedSourceDirectory = interfaceAssetsSelected ? 'assets/ui' : spriteAssetsSelected ? 'assets/sprites' : 'assets/tiles';
const allowedTargetPattern = interfaceAssetsSelected ? /^assets\/ui\/[\w./-]+$/ : spriteAssetsSelected ? /^assets\/(characters|monsters|structures)\/[\w./-]+$/ : /^assets\/(terrain|world)\/[\w./-]+$/;
const allowedSourcePattern = interfaceAssetsSelected ? /^assets\/ui\/[\w./-]+$/ : spriteAssetsSelected ? /^assets\/sprites\/(characters|monsters|structures)\/[\w./-]+$/ : /^assets\/tiles\/(terrain|buildings)\/[\w./-]+$/;

const assetLockDocument = parseDocument(readFileSync(resolve(frontendRootDirectory, selectedLockFilename), 'utf8'), { uniqueKeys: true });
if (assetLockDocument.errors.length) throw assetLockDocument.errors[0];
const assetLockRecord = assetLockDocument.toJS();
if (assetLockRecord.schema_version !== 1 || assetLockRecord.repository !== 'slime-assets' || !Array.isArray(assetLockRecord.files)
    || Object.keys(assetLockRecord).sort().join() !== 'files,repository,schema_version') throw new Error('에셋 잠금 파일 계약 오류');
const registeredAssetPaths = new Set();
for (const currentAssetRecord of assetLockRecord.files) {
  if (Object.keys(currentAssetRecord).sort().join() !== 'path,sha256,source_path'
      || typeof currentAssetRecord.path !== 'string' || typeof currentAssetRecord.source_path !== 'string'
      || !allowedTargetPattern.test(currentAssetRecord.path)
      || currentAssetRecord.path.split('/').includes('..')
      || !allowedSourcePattern.test(currentAssetRecord.source_path)
      || currentAssetRecord.source_path.split('/').includes('..')
      || !/^[a-f0-9]{64}$/.test(currentAssetRecord.sha256) || registeredAssetPaths.has(currentAssetRecord.path)) throw new Error('에셋 항목 계약 오류');
  registeredAssetPaths.add(currentAssetRecord.path);
  const currentAssetDigest = createHash('sha256').update(readFileSync(resolve(frontendRootDirectory, '../slime-assets', currentAssetRecord.source_path))).digest('hex');
  if (currentAssetDigest !== currentAssetRecord.sha256) throw new Error(`slime-assets 원본 해시 불일치: ${currentAssetRecord.path}`);
}
console.log(`${new Date().toISOString()}/${selectedLogArea}/complete ${registeredAssetPaths.size}개 원본 검증 완료`);
