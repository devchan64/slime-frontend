import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseDocument} from 'yaml';

/** YAML 에셋 목록을 두 빌드 경로가 공유하는 정적 이미지 import로 변환한다. */
export function buildAssetListModule(currentSourceText,currentAssetRoot){
 const currentYamlDocument=parseDocument(currentSourceText,{uniqueKeys:true});
 if(currentYamlDocument.errors.length)throw Error('에셋 YAML 오류: '+currentYamlDocument.errors.map(currentYamlError=>currentYamlError.message).join('; '));
 const currentAssetRecords=currentYamlDocument.toJS();
 if(!currentAssetRecords||Array.isArray(currentAssetRecords)||typeof currentAssetRecords!=='object')throw Error('에셋 YAML은 이름과 경로의 매핑이어야 합니다.');
 const currentImportStatements=[];
 const currentExportEntries=[];
 for(const [currentAssetName,currentAssetPath] of Object.entries(currentAssetRecords)){
  if(!/^[A-Za-z_$][\w$]*$/.test(currentAssetName)||typeof currentAssetPath!=='string'||!/^assets\/(?:tiles|billboards|buildings|sprites\/(?:structures|effects))\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.png$/.test(currentAssetPath))throw Error('잘못된 에셋 목록 항목: '+currentAssetName);
  const currentImportName='registeredTileAsset'+currentExportEntries.length;
  currentImportStatements.push('import '+currentImportName+' from '+JSON.stringify(currentAssetRoot+'/'+currentAssetPath)+';');
  currentExportEntries.push(JSON.stringify(currentAssetName)+': '+currentImportName);
 }
 if(!currentExportEntries.length)throw Error('에셋 목록이 비어 있습니다.');
 return currentImportStatements.join('\n')+'\nexport default {'+currentExportEntries.join(',')+'};';
}

export function createAssetListPlugin(){
 return {name:'registered-tile-yaml',async load(currentModuleId){
  if(currentModuleId.endsWith('/world-map/thumbnails.yaml')){this.addWatchFile(currentModuleId);return buildWorldThumbnailModule(await readFile(currentModuleId,'utf8'),fileURLToPath(new URL('../../slime-assets',import.meta.url)));}
  if(currentModuleId.endsWith('/field-material-frames.yaml')){this.addWatchFile(currentModuleId);return buildMaterialFrameModule(await readFile(currentModuleId,'utf8'));}
  if(!currentModuleId.endsWith('.asset-list.yaml'))return null;
  this.addWatchFile(currentModuleId);
  return buildAssetListModule(await readFile(currentModuleId,'utf8'),fileURLToPath(new URL('../../slime-assets',import.meta.url)));
 }};
}

/** 공통 재질 코드와 프레임의 문자열 매핑을 검증한다. */
export function buildMaterialFrameModule(currentSourceText){
 const currentYamlDocument=parseDocument(currentSourceText,{uniqueKeys:true});
 if(currentYamlDocument.errors.length)throw Error('재질 YAML 오류: '+currentYamlDocument.errors.map(currentYamlError=>currentYamlError.message).join('; '));
 const currentMaterialRecords=currentYamlDocument.toJS();
 if(!currentMaterialRecords||Array.isArray(currentMaterialRecords)||typeof currentMaterialRecords!=='object'||!Object.keys(currentMaterialRecords).length)throw Error('재질 매핑이 비어 있거나 형식이 잘못되었습니다.');
 for(const [currentMaterialName,currentFrameName] of Object.entries(currentMaterialRecords)){
  if(!/^[a-z][a-z0-9-]*$/.test(currentMaterialName)||typeof currentFrameName!=='string'||!/^[a-z][a-z0-9-]*$/.test(currentFrameName))throw Error('잘못된 재질 매핑: '+currentMaterialName);
 }
 if(new Set(Object.values(currentMaterialRecords)).size!==Object.keys(currentMaterialRecords).length)throw Error('다른 지형 코드가 같은 프레임을 참조합니다.');
 return 'export default '+JSON.stringify(currentMaterialRecords)+';';
}


/** 등록된 정사각형 썸네일을 해시 파일명으로 번들링한다. */
export function buildWorldThumbnailModule(currentSourceText,currentAssetRoot){
 const currentYamlDocument=parseDocument(currentSourceText,{uniqueKeys:true});
 if(currentYamlDocument.errors.length)throw Error('월드맵 썸네일 YAML 오류');
 const currentCatalogRecord=currentYamlDocument.toJS();
 if(!currentCatalogRecord||Object.keys(currentCatalogRecord).sort().join()!=='maps,schema_version'||currentCatalogRecord.schema_version!==1||!currentCatalogRecord.maps||Array.isArray(currentCatalogRecord.maps)||typeof currentCatalogRecord.maps!=='object'||!Object.keys(currentCatalogRecord.maps).length)throw Error('월드맵 썸네일 목록 오류');
 const currentImportStatements=[],currentExportEntries=[],currentThumbnailIdentifiers=new Set();
 for(const [currentMapIdentifier,currentThumbnailRecord] of Object.entries(currentCatalogRecord.maps)){
  if(!/^[a-z0-9-]+$/.test(currentMapIdentifier)||!currentThumbnailRecord||Object.keys(currentThumbnailRecord).sort().join()!=='height,managementId,path,sha256,version,width'||currentThumbnailRecord.managementId!=='image.ui.world-map.'+currentMapIdentifier||typeof currentThumbnailRecord.version!=='string'||!currentThumbnailRecord.version||typeof currentThumbnailRecord.sha256!=='string'||!/^[a-f0-9]{64}$/.test(currentThumbnailRecord.sha256)||typeof currentThumbnailRecord.path!=='string'||!/^assets\/ui\/world-map\/thumbnails\/[a-z0-9-]+\.png$/.test(currentThumbnailRecord.path)||currentThumbnailRecord.width!==256||currentThumbnailRecord.height!==256||currentThumbnailIdentifiers.has(currentThumbnailRecord.managementId))throw Error('월드맵 썸네일 항목 오류: '+currentMapIdentifier);
  currentThumbnailIdentifiers.add(currentThumbnailRecord.managementId);
  const currentImportIdentifier='worldThumbnailImage'+currentExportEntries.length;
  currentImportStatements.push('import '+currentImportIdentifier+' from '+JSON.stringify(currentAssetRoot+'/'+currentThumbnailRecord.path)+';');
  currentExportEntries.push(JSON.stringify(currentThumbnailRecord.managementId)+':'+currentImportIdentifier);
 }
 return currentImportStatements.join('\n')+'\nexport default {'+currentExportEntries.join(',')+'};';
}
