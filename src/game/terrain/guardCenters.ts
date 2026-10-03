import type Phaser from 'phaser';
import {parseDocument} from 'yaml';
import guardCenterCatalogSource from '../../../../slime-assets/assets/ui/guard-centers.yaml?raw';

const GUARD_CENTER_IMAGE_URLS: Record<string,string> = {
  wood: new URL('../../../../slime-assets/assets/sprites/structures/guard-center-wood-v1.png',import.meta.url).href,
  'red-tile': new URL('../../../../slime-assets/assets/sprites/structures/guard-center-red-tile-v1.png',import.meta.url).href,
  teal: new URL('../../../../slime-assets/assets/sprites/structures/guard-center-teal-v1.png',import.meta.url).href,
};
type GuardCenterStyleRecord = {path:string;anchorX:number;anchorY:number;displayWidth:number;offsetX:number;offsetY:number};
function parseGuardCenterCatalog(currentCatalogSource:string): {cities:Record<string,string>;styles:Record<string,GuardCenterStyleRecord>} {
  const currentYamlDocument = parseDocument(currentCatalogSource,{uniqueKeys:true});
  if(currentYamlDocument.errors.length) throw new Error('경비센터 YAML 구문 오류');
  const currentCatalogRecord = currentYamlDocument.toJS({maxAliasCount:0});
  if(!currentCatalogRecord || Object.keys(currentCatalogRecord).sort().join()!=='cities,schema_version,styles' || currentCatalogRecord.schema_version!==1) throw new Error('경비센터 카탈로그 형식 오류');
  for(const currentCollectionName of ['cities','styles']) if(!currentCatalogRecord[currentCollectionName] || typeof currentCatalogRecord[currentCollectionName]!=='object' || Array.isArray(currentCatalogRecord[currentCollectionName])) throw new Error('경비센터 목록 형식 오류');
  if(Object.keys(currentCatalogRecord.styles).sort().join()!==Object.keys(GUARD_CENTER_IMAGE_URLS).sort().join()) throw new Error('경비센터 외형 목록 오류');
  for(const [currentStyleName,currentStyleValue] of Object.entries(currentCatalogRecord.styles)) {
    const currentStyleRecord = currentStyleValue as GuardCenterStyleRecord;
    if(!currentStyleRecord || Object.keys(currentStyleRecord).sort().join()!=='anchorX,anchorY,displayWidth,offsetX,offsetY,path' || currentStyleRecord.path!==`assets/sprites/structures/guard-center-${currentStyleName}-v1.png`) throw new Error('경비센터 외형 필드 오류');
    for(const currentNumericField of ['anchorX','anchorY','displayWidth','offsetX','offsetY'] as const) if(!Number.isFinite(currentStyleRecord[currentNumericField])) throw new Error('경비센터 표시 수치 오류');
    if(currentStyleRecord.displayWidth<=0 || currentStyleRecord.anchorX<0 || currentStyleRecord.anchorX>1 || currentStyleRecord.anchorY<0 || currentStyleRecord.anchorY>1) throw new Error('경비센터 표시 범위 오류');
  }
  if(!Object.keys(currentCatalogRecord.cities).length) throw new Error('경비센터 도시 목록이 비었습니다.');
  for(const [currentCityName,currentStyleName] of Object.entries(currentCatalogRecord.cities)) if(!/^[a-z][a-z0-9-]*$/.test(currentCityName) || typeof currentStyleName!=='string' || !Object.hasOwn(GUARD_CENTER_IMAGE_URLS,currentStyleName)) throw new Error('경비센터 도시 외형 오류');
  return currentCatalogRecord;
}
const GUARD_CENTER_VISUAL_CATALOG = parseGuardCenterCatalog(guardCenterCatalogSource);
export function preloadGuardCenterSprites(currentGameScene:Phaser.Scene) {
  for(const [currentStyleName,currentImageUrl] of Object.entries(GUARD_CENTER_IMAGE_URLS)) currentGameScene.load.image(`guard-center-${currentStyleName}`,currentImageUrl);
}
export function drawGuardCenterSprite(currentGameScene:Phaser.Scene,currentCityIdentifier:string,currentScreenPosition:{x:number;y:number}) {
  const currentStyleName = GUARD_CENTER_VISUAL_CATALOG.cities[currentCityIdentifier];
  if(!currentStyleName) throw new Error(`경비센터 외형 미등록: ${currentCityIdentifier}`);
  const currentStyleRecord = GUARD_CENTER_VISUAL_CATALOG.styles[currentStyleName];
  const currentTextureKey = `guard-center-${currentStyleName}`;
  if(!currentGameScene.textures.exists(currentTextureKey)) throw new Error('경비센터 이미지 로드 실패');
  const currentGuardImage = currentGameScene.add.image(currentScreenPosition.x+currentStyleRecord.offsetX,currentScreenPosition.y+currentStyleRecord.offsetY,currentTextureKey);
  return currentGuardImage.setOrigin(currentStyleRecord.anchorX,currentStyleRecord.anchorY).setScale(currentStyleRecord.displayWidth/currentGuardImage.width);
}

/** 관문 좌표는 유지하며 경계의 구조물 표시만 안쪽 셀에 둔다. */
export function resolveGuardDisplayPosition(currentGatePosition:{column:number;row:number},currentMapDimensions:{columns:number;rows:number}) {
  return {column:Math.max(1,Math.min(currentMapDimensions.columns-2,currentGatePosition.column)),row:Math.max(1,Math.min(currentMapDimensions.rows-2,currentGatePosition.row))};
}
