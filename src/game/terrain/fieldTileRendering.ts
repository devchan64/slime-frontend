/** 게임·관리도구의 필드 재질 선택과 연결 텍스처 계약. */
import type Phaser from 'phaser';
import type {Position} from '../../client/types';
import {prepareFieldConnectedTexture} from '../../../packages/field-renderer/field-renderer.mjs';
import {selectFieldRoadFrame} from './roadTiles';
import {CLIFF_WALL_TEXTURE,RAMP_TREAD_TEXTURE} from './textures';

const ROCK_FACE_FIELD_IDENTIFIERS = new Set(['boar-ridge','broken-quarry','crystal-cut','cinder-path','dawn-overlook','dry-creek','mill-ridge','brine-bank','wind-hills']);

/** 야외의 지형 코드와 실제 표시 원본 선택을 함께 제공한다. */
export function resolveFieldTerrainFrame(currentTerrainName:string,currentMapIdentifier:string):string {
 if(currentMapIdentifier==='old-orchard'&&currentTerrainName==='leaf-litter')return 'fallen-orchard-fruit-v1';
 if(currentMapIdentifier==='granary-flats'){
  const currentFarmMaterial=({flowers:'golden-grain-field-v1',mud:'tilled-furrows-v1','dry-soil-branches':'farm-embankment-v1'} as Record<string,string>)[currentTerrainName];
  if(currentFarmMaterial)return currentFarmMaterial;
 }
 if(currentTerrainName==='road')return selectFieldRoadFrame(0,{column:0,row:0},false,currentMapIdentifier);
 if(currentTerrainName==='boulder'&&ROCK_FACE_FIELD_IDENTIFIERS.has(currentMapIdentifier))return 'wall';
 if(currentTerrainName==='flowers'&&currentMapIdentifier==='meadow')return 'meadow-flowers';
 return currentTerrainName;
}

export function resolveFieldTileTextures(currentGameScene:Phaser.Scene,currentTerrainName:string,currentCellPosition:Position,currentMapIdentifier:string,currentConnectionMask:number,resolveGroundMaterial:(currentCellPosition:Position)=>string){
 const currentSelectedFrame=currentTerrainName==='water'?`water-${currentConnectionMask}`:resolveFieldTerrainFrame(currentTerrainName,currentMapIdentifier);
 const currentConnectedFrame=/^(water)-(\d+)$/.exec(currentSelectedFrame);
 const currentGroundKey=currentConnectedFrame?prepareFieldConnectedTexture(currentGameScene,`terrain-source-${currentConnectedFrame[1]}`,'terrain-source-grass',Number(currentConnectedFrame[2])):`terrain-source-${currentSelectedFrame}`;
 return {ground:currentGroundKey,resolveGroundMaterial,cliff:CLIFF_WALL_TEXTURE,tread:RAMP_TREAD_TEXTURE,underlay:['boulder','tree-base'].includes(currentTerrainName)?'terrain-source-grass':undefined};
}
