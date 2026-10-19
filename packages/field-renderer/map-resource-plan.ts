import {resolveBridgeTextureKeys} from './bridge-geometry.mjs';
import {resolveFieldTerrainFrame} from '../../src/game/terrain/fieldTileRendering';
import {resolveTownGroundFrame,resolveGrassFrameForMap,resolvePavingFrameForMap,resolveReedFrameForMap,CLIFF_WALL_TEXTURE,RAMP_TREAD_TEXTURE} from '../../src/game/terrain/textures';
export {loadMapResourceImages} from './map-resource-loader.mjs';
export type MapResourceSurface={bridges?:{material:'timber'|'stone'}[];id:string;safeTown?:boolean;terrainRows?:string[];terrainCodes?:Record<string,string>;cells?:{terrain:string;column:number;row:number}[];objects?:{kind:string;textureKey?:string}[];groundOverrides?:{textureKey:string}[];buildings?:{id:string;facilityKind:string;sprite:{textureKey:string}}[];connections?:unknown[];stairs?:unknown[]};
/** 렌더러의 재질 선택 함수를 재사용하여 선택 맵의 텍스처 키를 산출한다. */
export function collectMapResourceKeys(currentMapRecord:MapResourceSurface,currentMapKind:'field'|'town'|'battle'){
 if(!['field','town','battle'].includes(currentMapKind))throw Error('지원하지 않는 맵 종류');
 const currentTerrainNames=new Set<string>();
 if(currentMapKind==='battle'){
  if(!currentMapRecord.cells?.length)throw Error('전투필드 셀이 없습니다.');
  currentMapRecord.cells.forEach(currentCellRecord=>currentTerrainNames.add(resolveBattleTerrainResourceFrame(currentCellRecord.terrain,currentCellRecord.column,currentCellRecord.row)));
 }else{
  if(!currentMapRecord.terrainRows?.length||!currentMapRecord.terrainCodes)throw Error('맵 지형 행·코드가 없습니다.');
  for(const currentTerrainRow of currentMapRecord.terrainRows)for(const currentTerrainCode of currentTerrainRow){const currentTerrainName=currentMapRecord.terrainCodes[currentTerrainCode];if(!currentTerrainName)throw Error('등록되지 않은 지형 코드: '+currentTerrainCode);currentTerrainNames.add(currentTerrainName);}
 }
 const currentTextureKeys=new Set<string>();
 for(const currentBridgeRecord of currentMapRecord.bridges??[])for(const currentTextureKey of resolveBridgeTextureKeys(currentBridgeRecord.material))currentTextureKeys.add(currentTextureKey);
 if(currentMapKind!=='field')currentTextureKeys.add('terrain-source-grass');
 for(const currentTerrainName of currentTerrainNames){
  const currentTerrainFrame=currentMapKind==='field'?resolveFieldTerrainFrame(currentTerrainName,currentMapRecord.id):currentMapKind==='battle'?resolveFieldTerrainFrame(currentTerrainName,currentMapRecord.id):currentTerrainName==='grass'?resolveGrassFrameForMap(currentMapRecord.id):currentTerrainName==='paving'?resolvePavingFrameForMap(currentMapRecord.id):currentTerrainName==='reed-bed'?resolveReedFrameForMap(currentMapRecord.id):resolveTownGroundFrame(currentMapRecord.id,currentTerrainName);
  currentTextureKeys.add('terrain-source-'+currentTerrainFrame);
  if(['water','boulder','flowers'].includes(currentTerrainName))currentTextureKeys.add('terrain-source-grass');
 }
 // 고도 벽과 계단은 셀 렌더러의 명시적 종속성이다.
 currentTextureKeys.add(CLIFF_WALL_TEXTURE);
 if(currentMapRecord.stairs?.length)currentTextureKeys.add(RAMP_TREAD_TEXTURE);
 for(const currentObjectRecord of [...currentMapRecord.objects??[],...currentMapRecord.groundOverrides??[]])if(currentObjectRecord.textureKey)currentTextureKeys.add(currentObjectRecord.textureKey);
 if(currentMapRecord.connections?.length)currentTextureKeys.add('waypoint-guide-v1');
 for(const currentBuildingRecord of currentMapRecord.buildings??[]){
  if(!currentBuildingRecord.sprite?.textureKey)throw Error('건물 스프라이트 지정이 없습니다: '+currentBuildingRecord.id);
  currentTextureKeys.add(currentBuildingRecord.sprite.textureKey);
 }
 return [...currentTextureKeys].sort();
}

export function resolveBattleTerrainResourceFrame(currentTerrainName:string,currentCellColumn:number,currentCellRow:number){
 return currentTerrainName==='rock'?`battle-rock-${['a','b','c'][(currentCellColumn+currentCellRow)%3]}`:currentTerrainName==='thicket'?'battle-thicket':currentTerrainName;
}
