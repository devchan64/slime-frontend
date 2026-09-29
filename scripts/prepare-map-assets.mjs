import { readFileSync, mkdirSync, copyFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, sep } from 'node:path';
import { parseDocument } from 'yaml';

const frontendRootDirectory = fileURLToPath(new URL('../', import.meta.url));
const spriteAssetsSelected = process.argv.includes('--sprites');
const selectedLogArea = spriteAssetsSelected ? 'sprite-assets' : 'map-assets';
const selectedLockFilename = spriteAssetsSelected ? 'sprite-assets.lock.yaml' : 'map-assets.lock.yaml';
const selectedSourceDirectory = spriteAssetsSelected ? 'assets/sprites' : 'assets/tiles';
const allowedTargetPattern = spriteAssetsSelected ? /^src\/assets\/(characters|monsters)\/[\w./-]+$/ : /^src\/assets\/(terrain|world)\/[\w./-]+$/;
const allowedSourcePattern = spriteAssetsSelected ? /^assets\/sprites\/(characters|monsters)\/[\w./-]+$/ : /^assets\/tiles\/(terrain|buildings)\/[\w./-]+$/;

const assetRepositoryDirectory = realpathSync(process.env.SLIME_ASSETS_ROOT || resolve(frontendRootDirectory, '../slime-assets'));
function readUniqueDocument(documentFilePath) {
  const parsedYamlDocument = parseDocument(readFileSync(documentFilePath, 'utf8'), { uniqueKeys: true });
  if (parsedYamlDocument.errors.length) throw parsedYamlDocument.errors[0];
  return parsedYamlDocument.toJS({ maxAliasCount: 0 });
}
try {
  console.log(`${new Date().toISOString()}/${selectedLogArea}/start 원본 ${assetRepositoryDirectory}`);
  const assetRegistryRecord = readUniqueDocument(resolve(assetRepositoryDirectory, 'asset-registry.yaml'));
  const assetLockRecord = readUniqueDocument(resolve(frontendRootDirectory, selectedLockFilename));
  if (assetRegistryRecord.schema_version !== 1 || Object.keys(assetRegistryRecord).sort().join() !== 'assets,schema_version' || !Array.isArray(assetRegistryRecord.assets)) throw Error('에셋 등록부 계약 오류');
  if (assetLockRecord.schema_version !== 1 || assetLockRecord.repository !== 'slime-assets' || Object.keys(assetLockRecord).sort().join() !== 'files,repository,schema_version' || !Array.isArray(assetLockRecord.files)) throw Error('에셋 잠금 계약 오류');
  const registeredSourcePaths = new Map();
  const registeredVersionPairs = new Set();
  const allowedRegistryFields = new Set(['managementId', 'version', 'path', 'sha256', 'source', 'frontend_path', 'name', 'width', 'height', 'license']);
  for (const currentAssetRecord of assetRegistryRecord.assets) {
    if (!currentAssetRecord || Object.keys(currentAssetRecord).some(currentFieldName => !allowedRegistryFields.has(currentFieldName)) || ['managementId','version','path','sha256'].some(currentFieldName => typeof currentAssetRecord[currentFieldName] !== 'string' || !currentAssetRecord[currentFieldName]) || !currentAssetRecord.source || typeof currentAssetRecord.source !== 'object') throw Error('에셋 항목 계약 오류');
    const currentVersionPair = JSON.stringify([currentAssetRecord.managementId, currentAssetRecord.version]);
    if (registeredSourcePaths.has(currentAssetRecord.path) || registeredVersionPairs.has(currentVersionPair)) throw Error('에셋 경로 또는 ID·버전 중복');
    registeredSourcePaths.set(currentAssetRecord.path, currentAssetRecord);
    registeredVersionPairs.add(currentVersionPair);
  }
  const preparedAssetRecords = [];
  const registeredTargetPaths = new Set();
  for (const currentLockRecord of assetLockRecord.files) {
    if (!currentLockRecord || Object.keys(currentLockRecord).sort().join() !== 'path,sha256,source_path' || typeof currentLockRecord.path !== 'string' || typeof currentLockRecord.source_path !== 'string' || !allowedTargetPattern.test(currentLockRecord.path) || !allowedSourcePattern.test(currentLockRecord.source_path) || currentLockRecord.path.split('/').includes('..') || currentLockRecord.source_path.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(currentLockRecord.sha256) || registeredTargetPaths.has(currentLockRecord.path)) throw Error('에셋 잠금 항목 오류');
    registeredTargetPaths.add(currentLockRecord.path);
    const currentRegistryRecord = registeredSourcePaths.get(currentLockRecord.source_path);
    if (!currentRegistryRecord || currentRegistryRecord.sha256 !== currentLockRecord.sha256) throw Error(`에셋 등록·잠금 불일치: ${currentLockRecord.source_path}`);
    const currentSourcePath = realpathSync(resolve(assetRepositoryDirectory, currentLockRecord.source_path));
    if (!currentSourcePath.startsWith(resolve(assetRepositoryDirectory, selectedSourceDirectory) + sep)) throw Error('에셋 원본 경로 이탈');
    if (createHash('sha256').update(readFileSync(currentSourcePath)).digest('hex') !== currentLockRecord.sha256) throw Error(`에셋 원본 해시 불일치: ${currentLockRecord.source_path}`);
    preparedAssetRecords.push({ source: currentSourcePath, target: resolve(frontendRootDirectory, currentLockRecord.path) });
  }
  if (!process.argv.includes('--check')) for (const currentPreparedRecord of preparedAssetRecords) {
    mkdirSync(dirname(currentPreparedRecord.target), { recursive: true });
    copyFileSync(currentPreparedRecord.source, currentPreparedRecord.target);
  }
  console.log(`${new Date().toISOString()}/${selectedLogArea}/complete ${preparedAssetRecords.length}개 에셋 원본 ${process.argv.includes('--check') ? '검증' : '직접 참조·전달'} 완료`);
} catch (currentPrepareError) {
  console.error(`${new Date().toISOString()}/${selectedLogArea}/failed`, currentPrepareError);
  process.exitCode = 1;
}
