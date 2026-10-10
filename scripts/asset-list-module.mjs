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
  if(!/^[A-Za-z_$][\w$]*$/.test(currentAssetName)||typeof currentAssetPath!=='string'||!/^assets\/tiles\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.png$/.test(currentAssetPath))throw Error('잘못된 에셋 목록 항목: '+currentAssetName);
  const currentImportName='registeredTileAsset'+currentExportEntries.length;
  currentImportStatements.push('import '+currentImportName+' from '+JSON.stringify(currentAssetRoot+'/'+currentAssetPath)+';');
  currentExportEntries.push(JSON.stringify(currentAssetName)+': '+currentImportName);
 }
 if(!currentExportEntries.length)throw Error('에셋 목록이 비어 있습니다.');
 return currentImportStatements.join('\n')+'\nexport default {'+currentExportEntries.join(',')+'};';
}

export function createAssetListPlugin(){
 return {name:'registered-tile-yaml',async load(currentModuleId){
  if(!currentModuleId.endsWith('.asset-list.yaml'))return null;
  this.addWatchFile(currentModuleId);
  return buildAssetListModule(await readFile(currentModuleId,'utf8'),fileURLToPath(new URL('../../slime-assets',import.meta.url)));
 }};
}
