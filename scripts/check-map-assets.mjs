import { loadBillboardCatalogRecord } from './billboard-catalog.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { createBillboardCategoryMap, readPngSourceDimensions, validateMapSpriteDimensions } from './map-sprite-dimensions.mjs';

const frontendRootDirectory = fileURLToPath(new URL('../', import.meta.url));
const interfaceAssetsSelected = process.argv.includes('--ui');
const spriteAssetsSelected = process.argv.includes('--sprites');
const selectedLogArea = interfaceAssetsSelected ? 'ui-assets' : spriteAssetsSelected ? 'sprite-assets' : 'map-assets';
const selectedLockFilename = interfaceAssetsSelected ? 'ui-assets.lock.yaml' : spriteAssetsSelected ? 'sprite-assets.lock.yaml' : 'map-assets.lock.yaml';
const selectedSourceDirectory = interfaceAssetsSelected ? 'assets/ui' : spriteAssetsSelected ? 'assets' : 'assets/tiles';
const allowedTargetPattern = interfaceAssetsSelected ? /^assets\/ui\/[\w./-]+$/ : spriteAssetsSelected ? /^assets\/(characters|effects|monsters|structures)\/[\w./-]+$/ : /^assets\/(terrain|world|backgrounds)\/[\w./-]+$/;
const allowedSourcePattern = interfaceAssetsSelected ? /^assets\/ui\/[\w./-]+$/ : spriteAssetsSelected ? /^assets\/(characters\/[\w-]+\/(animations|battle-cutins|emotion-cutins)|sprites\/(effects|monsters|structures)|billboards|buildings)\/[\w./-]+$/ : /^assets\/(tiles\/(terrain|buildings|decals)|backgrounds)\/[\w./-]+$/;

const assetLockDocument = parseDocument(readFileSync(resolve(frontendRootDirectory, selectedLockFilename), 'utf8'), { uniqueKeys: true });
if (assetLockDocument.errors.length) throw assetLockDocument.errors[0];
const assetLockRecord = assetLockDocument.toJS();
if (assetLockRecord.schema_version !== 1 || assetLockRecord.repository !== 'slime-assets' || !Array.isArray(assetLockRecord.files)
    || Object.keys(assetLockRecord).sort().join() !== 'files,repository,schema_version') throw new Error('에셋 잠금 파일 계약 오류');
const assetRepositoryDirectory = resolve(frontendRootDirectory, '../slime-assets');
const assetRegistryDocument = parseDocument(readFileSync(resolve(assetRepositoryDirectory, 'asset-registry.yaml'), 'utf8'), { uniqueKeys: true });
if (assetRegistryDocument.errors.length) throw assetRegistryDocument.errors[0];
const assetRegistryRecord = assetRegistryDocument.toJS();
if (assetRegistryRecord.schema_version !== 1 || !Array.isArray(assetRegistryRecord.assets)) throw new Error('에셋 등록부 계약 오류');
const registeredSourceAssets = new Map(assetRegistryRecord.assets.map(currentAssetRecord => [currentAssetRecord.path, currentAssetRecord]));
const billboardCatalogDocument = spriteAssetsSelected ? loadBillboardCatalogRecord(assetRepositoryDirectory) : null;
const billboardCategoryRecords = billboardCatalogDocument ? createBillboardCategoryMap(billboardCatalogDocument) : new Map();
  function readLockedAnimationMetadata(currentAssetPath) {
    const currentMetadataPath = currentAssetPath.replace(/\.png$/, '.animation.json');
    const currentMetadataLock = assetLockRecord.files.find(currentLockRecord => currentLockRecord.source_path === currentMetadataPath);
    if (!currentMetadataLock) return undefined;
    const currentMetadataRegistry = registeredSourceAssets.get(currentMetadataPath);
    const currentMetadataBytes = readFileSync(resolve(assetRepositoryDirectory, currentMetadataPath));
    if (!currentMetadataRegistry || currentMetadataRegistry.sha256 !== currentMetadataLock.sha256 || createHash('sha256').update(currentMetadataBytes).digest('hex') !== currentMetadataLock.sha256) throw Error(`애니메이션 메타데이터 해시 불일치: ${currentMetadataPath}`);
    return JSON.parse(currentMetadataBytes.toString('utf8'));
  }

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
  const currentSourceBytes = readFileSync(resolve(assetRepositoryDirectory, currentAssetRecord.source_path));
  const currentAssetDigest = createHash('sha256').update(currentSourceBytes).digest('hex');
  if (currentAssetDigest !== currentAssetRecord.sha256) throw new Error(`slime-assets 원본 해시 불일치: ${currentAssetRecord.path}`);
  if (spriteAssetsSelected && /\.png$/.test(currentAssetRecord.source_path) && (currentAssetRecord.source_path.startsWith('assets/billboards/') || currentAssetRecord.source_path.startsWith('assets/buildings/'))) {
    const currentRegistryAsset = registeredSourceAssets.get(currentAssetRecord.source_path);
    if (!currentRegistryAsset || currentRegistryAsset.sha256 !== currentAssetRecord.sha256) throw new Error(`스프라이트 등록·잠금 불일치: ${currentAssetRecord.source_path}`);
    const currentImageDimensions = readPngSourceDimensions(currentSourceBytes);
    if (currentRegistryAsset.width !== currentImageDimensions.width || currentRegistryAsset.height !== currentImageDimensions.height) throw new Error(`스프라이트 등록 크기 불일치: ${currentAssetRecord.source_path}`);
    const currentTextureKey = currentAssetRecord.source_path.slice('assets/billboards/'.length, -'.png'.length);
    validateMapSpriteDimensions(currentRegistryAsset, currentImageDimensions, billboardCategoryRecords.get(currentTextureKey), readLockedAnimationMetadata(currentRegistryAsset.path));
  }
}
if (spriteAssetsSelected) {
  for (const currentRegistryAsset of registeredSourceAssets.values()) {
    if (typeof currentRegistryAsset.path !== 'string' || !/\.png$/.test(currentRegistryAsset.path) || !(currentRegistryAsset.path.startsWith('assets/billboards/') || currentRegistryAsset.path.startsWith('assets/buildings/'))) continue;
    const currentSourceBytes = readFileSync(resolve(assetRepositoryDirectory, currentRegistryAsset.path));
    const currentImageDimensions = readPngSourceDimensions(currentSourceBytes);
    if (currentRegistryAsset.width !== currentImageDimensions.width || currentRegistryAsset.height !== currentImageDimensions.height) throw new Error(`스프라이트 등록 크기 불일치: ${currentRegistryAsset.path}`);
    const currentTextureKey = currentRegistryAsset.path.slice('assets/billboards/'.length, -'.png'.length);
    validateMapSpriteDimensions(currentRegistryAsset, currentImageDimensions, billboardCategoryRecords.get(currentTextureKey), readLockedAnimationMetadata(currentRegistryAsset.path));
  }
}
console.log(`${new Date().toISOString()}/${selectedLogArea}/complete ${registeredAssetPaths.size}개 원본 검증 완료`);
