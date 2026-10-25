import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseDocument} from 'yaml';

const REGISTERED_ASSET_ROOT = fileURLToPath(new URL('../../slime-assets/', import.meta.url));
function readStrictYamlFile(currentFilePath) {
  const currentYamlDocument = parseDocument(readFileSync(currentFilePath, 'utf8'), {uniqueKeys: true});
  if (currentYamlDocument.errors.length) throw Error('BGM YAML 오류: ' + currentFilePath);
  return currentYamlDocument.toJS();
}
export function createMapMusicPlugin() {
  return {name: 'registered-map-music', load(currentModulePath) {
    if (!currentModulePath.endsWith('/audio/map-bgm.yaml')) return null;
    const currentCatalogRecord = readStrictYamlFile(currentModulePath);
    const currentRegistryPath = REGISTERED_ASSET_ROOT + 'asset-registry.yaml';
    const currentRegistryEntries = readStrictYamlFile(currentRegistryPath).assets;
    const currentImportStatements = [], currentMapEntries = [];
    this.addWatchFile(currentModulePath);
    this.addWatchFile(currentRegistryPath);
    if (!currentCatalogRecord || Object.keys(currentCatalogRecord).sort().join() !== 'maps,schema_version' || currentCatalogRecord.schema_version !== 2 || !currentCatalogRecord.maps || typeof currentCatalogRecord.maps !== 'object' || Array.isArray(currentCatalogRecord.maps)) throw Error('BGM 카탈로그 형식 오류');
    for (const [currentMapIdentifier, currentVariantRecords] of Object.entries(currentCatalogRecord.maps)) {
      if (!/^[a-z0-9-]+$/.test(currentMapIdentifier) || !currentVariantRecords || typeof currentVariantRecords !== 'object' || Array.isArray(currentVariantRecords) || !Object.keys(currentVariantRecords).length) throw Error('BGM 맵 항목 오류');
      const currentVariantEntries = [];
      for (const [currentVariantName, currentAssetRecord] of Object.entries(currentVariantRecords)) {
        if (!['vocal','instrumental'].includes(currentVariantName) || !currentAssetRecord || Object.keys(currentAssetRecord).sort().join() !== 'management_id,path,sha256,version' || typeof currentAssetRecord.management_id !== 'string' || !currentAssetRecord.management_id.startsWith('audio.bgm.'+currentMapIdentifier+'.') || !/^v[1-9][0-9]*$/.test(currentAssetRecord.version) || !/^[a-f0-9]{64}$/.test(currentAssetRecord.sha256) || typeof currentAssetRecord.path !== 'string' || !/^assets\/audio\/bgm\/[a-z0-9-]+\/v[1-9][0-9]*\/[a-z0-9-]+\.mp3$/.test(currentAssetRecord.path)) throw Error('BGM 버전 항목 오류: '+currentMapIdentifier);
        const currentMatchingEntries = currentRegistryEntries.filter(currentRegisteredEntry => currentRegisteredEntry.managementId === currentAssetRecord.management_id);
        if (currentMatchingEntries.length !== 1 || ['path','sha256','version'].some(currentFieldName => currentMatchingEntries[0][currentFieldName] !== currentAssetRecord[currentFieldName])) throw Error('BGM 등록 정보 불일치: '+currentMapIdentifier);
        const currentAudioPath = REGISTERED_ASSET_ROOT + currentAssetRecord.path;
        if (createHash('sha256').update(readFileSync(currentAudioPath)).digest('hex') !== currentAssetRecord.sha256) throw Error('BGM SHA-256 불일치: '+currentAudioPath);
        this.addWatchFile(currentAudioPath);
        const currentImportIdentifier = 'registeredMusicTrack'+currentImportStatements.length;
        currentImportStatements.push('import '+currentImportIdentifier+' from '+JSON.stringify(currentAudioPath)+';');
        currentVariantEntries.push(JSON.stringify(currentVariantName)+':'+currentImportIdentifier);
      }
      currentMapEntries.push(JSON.stringify(currentMapIdentifier)+':{'+currentVariantEntries.join(',')+'}');
    }
    return currentImportStatements.join('\n')+'\nexport default {'+currentMapEntries.join(',')+'};';
  }};
}
