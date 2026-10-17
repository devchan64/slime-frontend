import fieldMaterialFrames from './field-material-frames.yaml';
/** 게임·관리도구의 필드 재질 선택과 연결 텍스처 계약. */
import type Phaser from 'phaser';
import type {Position} from '../../client/types';
import {resolveFieldGroundMaterial} from '../../../packages/field-renderer/field-renderer.mjs';
import {resolveTownGroundFrame,resolveGrassFrameForMap,resolvePavingFrameForMap,resolveReedFrameForMap,CLIFF_WALL_TEXTURE,RAMP_TREAD_TEXTURE} from './textures';


/** 야외의 지형 코드와 실제 표시 원본 선택을 함께 제공한다. */
export function resolveFieldTerrainFrame(currentTerrainName:string,currentMapIdentifier:string):string {
 const currentMaterialFrame=(fieldMaterialFrames as Record<string,string>)[currentTerrainName];
 if(!currentMaterialFrame)throw new Error('등록되지 않은 필드 재질 코드: '+currentTerrainName);
 return currentMaterialFrame;
}

export function resolveFieldTileTextures(currentGameScene:Phaser.Scene,currentTerrainName:string,currentCellPosition:Position,currentMapIdentifier:string,currentConnectionMask:number,resolveGroundMaterial:(currentCellPosition:Position)=>string,currentGroundOverrides:readonly {position:Position;textureKey:string}[]=[]){
 const resolveDisplayedGroundMaterial=(currentNeighborPosition:Position):string=>resolveFieldGroundMaterial(currentNeighborPosition,currentGroundOverrides,currentTerrainPosition=>resolveFieldTerrainFrame(resolveGroundMaterial(currentTerrainPosition),currentMapIdentifier));
 const currentOverrideRecord=currentGroundOverrides.find(currentGroundRecord=>currentGroundRecord.position.column===currentCellPosition.column&&currentGroundRecord.position.row===currentCellPosition.row);
 if(currentOverrideRecord){
  if(!currentGameScene.textures.exists(currentOverrideRecord.textureKey))throw new Error('등록 지면 텍스처 누락: '+currentOverrideRecord.textureKey);
  return {ground:currentOverrideRecord.textureKey,resolveGroundMaterial:resolveDisplayedGroundMaterial,cliff:CLIFF_WALL_TEXTURE,tread:RAMP_TREAD_TEXTURE};
 }
 const currentGroundKey='terrain-source-'+resolveFieldTerrainFrame(currentTerrainName,currentMapIdentifier);
 return {ground:currentGroundKey,resolveGroundMaterial:resolveDisplayedGroundMaterial,cliff:CLIFF_WALL_TEXTURE,tread:RAMP_TREAD_TEXTURE,underlay:['boulder'].includes(currentTerrainName)?'terrain-source-grass':undefined};
}

export function resolveCityTileTextures(currentGameScene:Phaser.Scene,currentTerrainName:string,currentMapIdentifier:string,currentConnectionMask:number){
 const currentTerrainFrame=currentTerrainName==='grass'?resolveGrassFrameForMap(currentMapIdentifier):currentTerrainName==='paving'?resolvePavingFrameForMap(currentMapIdentifier):currentTerrainName==='reed-bed'?resolveReedFrameForMap(currentMapIdentifier):resolveTownGroundFrame(currentMapIdentifier,currentTerrainName);
 const currentGroundKey='terrain-source-'+currentTerrainFrame;
 return {ground:currentGroundKey,cliff:CLIFF_WALL_TEXTURE,tread:RAMP_TREAD_TEXTURE};
}
