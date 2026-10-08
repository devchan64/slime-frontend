/** 게임·관리도구의 필드 재질 선택과 연결 텍스처 계약. */
import type Phaser from 'phaser';
import type {Position} from '../../client/types';
import {prepareFieldConnectedTexture} from '../../../packages/field-renderer/field-renderer.mjs';
import {selectFieldRoadFrame} from './roadTiles';
import {CLIFF_WALL_TEXTURE,RAMP_TREAD_TEXTURE} from './textures';

export function resolveFieldTileTextures(currentGameScene:Phaser.Scene,currentTerrainName:string,currentCellPosition:Position,currentMapIdentifier:string,currentConnectionMask:number,resolveGroundMaterial:(currentCellPosition:Position)=>string){
 const currentSelectedFrame=currentTerrainName==='water'?`water-${currentConnectionMask}`
  :currentTerrainName==='road'?selectFieldRoadFrame(currentConnectionMask,currentCellPosition,false,currentMapIdentifier)
  :currentTerrainName==='flowers'&&currentMapIdentifier==='meadow'?'meadow-flowers':currentTerrainName;
 const currentConnectedFrame=/^(water|road|dirt-road|stone-road)-(\d+)$/.exec(currentSelectedFrame);
 const currentGroundKey=currentConnectedFrame?prepareFieldConnectedTexture(currentGameScene,`terrain-source-${currentConnectedFrame[1]}`,'terrain-source-grass',Number(currentConnectedFrame[2])):`terrain-source-${currentSelectedFrame}`;
 return {ground:currentGroundKey,resolveGroundMaterial,cliff:CLIFF_WALL_TEXTURE,tread:RAMP_TREAD_TEXTURE,roadConnectionMask:currentTerrainName==='road'?currentConnectionMask:undefined,fullTileRoad:currentTerrainName==='road'&&!currentConnectedFrame,underlay:['boulder','tree-base'].includes(currentTerrainName)?'terrain-source-grass':undefined};
}
