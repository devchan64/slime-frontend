import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';

function readCatalogYamlDocument(currentSourcePath) {
  const currentYamlDocument = parseDocument(readFileSync(currentSourcePath, 'utf8'), { uniqueKeys: true });
  if (currentYamlDocument.errors.length) throw currentYamlDocument.errors[0];
  return currentYamlDocument.toJS();
}

export function loadBillboardCatalogRecord(currentAssetRoot) {
  const currentCatalogDirectory = resolve(currentAssetRoot, 'assets/billboards');
  const currentIndexRecord = readCatalogYamlDocument(resolve(currentCatalogDirectory, 'catalog.yaml'));
  if (currentIndexRecord.schema_version === 1) return currentIndexRecord;
  if (currentIndexRecord.schema_version !== 2 || !currentIndexRecord.catalog_files || Object.keys(currentIndexRecord.catalog_files).sort().join() !== Object.keys(currentIndexRecord.review_categories).sort().join()) throw Error('빌보드 카탈로그 색인 오류');
  const currentMergedRecord = { ...currentIndexRecord, families: {}, billboards: [] };
  const currentTextureKeys = new Set();
  for (const [currentCategoryName, currentRelativePath] of Object.entries(currentIndexRecord.catalog_files)) {
    if (currentRelativePath !== `catalogs/${currentCategoryName}.yaml`) throw Error('빌보드 카탈로그 경로 오류');
    const currentPartitionRecord = readCatalogYamlDocument(resolve(currentCatalogDirectory, currentRelativePath));
    if (currentPartitionRecord.schema_version !== 1 || currentPartitionRecord.category !== currentCategoryName || Object.keys(currentPartitionRecord).sort().join() !== 'billboards,category,families,schema_version') throw Error('빌보드 타입 파일 오류');
    for (const [currentFamilyName, currentFamilyRecord] of Object.entries(currentPartitionRecord.families)) {
      if (currentMergedRecord.families[currentFamilyName] || currentFamilyRecord.review_category !== currentCategoryName) throw Error('빌보드 계열 중복·타입 오류');
      currentMergedRecord.families[currentFamilyName] = currentFamilyRecord;
    }
    for (const currentAssetRecord of currentPartitionRecord.billboards) {
      if (!currentPartitionRecord.families[currentAssetRecord.family] || currentTextureKeys.has(currentAssetRecord.texture_key)) throw Error('빌보드 중복·계열 오류');
      currentTextureKeys.add(currentAssetRecord.texture_key);
      currentMergedRecord.billboards.push(currentAssetRecord);
    }
  }
  return currentMergedRecord;
}
