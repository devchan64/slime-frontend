import fieldMaterialFrames from './field-material-frames.yaml';
/** 게임·관리도구의 필드 재질 선택과 연결 텍스처 계약. */
import type Phaser from 'phaser';
import type {Position} from '../../client/types';
import {prepareFieldConnectedTexture} from '../../../packages/field-renderer/field-renderer.mjs';
import {CLIFF_WALL_TEXTURE,RAMP_TREAD_TEXTURE} from './textures';


/** 야외의 지형 코드와 실제 표시 원본 선택을 함께 제공한다. */
export function resolveFieldTerrainFrame(currentTerrainName:string,currentMapIdentifier:string):string {
 const currentMaterialFrame=(fieldMaterialFrames as Record<string,string>)[currentTerrainName];
 if(!currentMaterialFrame)throw new Error('등록되지 않은 필드 재질 코드: '+currentTerrainName);
 return currentMaterialFrame;
}

export function resolveFieldTileTextures(currentGameScene:Phaser.Scene,currentTerrainName:string,currentCellPosition:Position,currentMapIdentifier:string,currentConnectionMask:number,resolveGroundMaterial:(currentCellPosition:Position)=>string){
 const currentSelectedFrame=currentTerrainName==='water'?`water-${currentConnectionMask}`:resolveFieldTerrainFrame(currentTerrainName,currentMapIdentifier);
 const currentConnectedFrame=/^(water)-(\d+)$/.exec(currentSelectedFrame);
 const currentGroundKey=currentConnectedFrame?prepareFieldConnectedTexture(currentGameScene,`terrain-source-${currentConnectedFrame[1]}`,'terrain-source-grass',Number(currentConnectedFrame[2])):`terrain-source-${currentSelectedFrame}`;
 return {ground:currentGroundKey,resolveGroundMaterial,cliff:CLIFF_WALL_TEXTURE,tread:RAMP_TREAD_TEXTURE,underlay:['boulder','tree-base'].includes(currentTerrainName)?'terrain-source-grass':undefined};
}
