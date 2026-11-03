import {composeGroundDecalTexture,type GroundDecalRecord} from './groundDecals';
import fieldMaterialFrames from './field-material-frames.yaml';
/** 게임·관리도구의 필드 재질 선택과 연결 텍스처 계약. */
import type Phaser from 'phaser';
import type {Position} from '../../client/types';
import {resolveFieldGroundMaterial} from '../../../packages/field-renderer/field-renderer.mjs';
import {resolveTownGroundFrame,resolveGrassFrameForMap,resolvePavingFrameForMap,resolveReedFrameForMap,CLIFF_WALL_TEXTURE,RAMP_TREAD_TEXTURE} from './textures';


// 모래 위 자갈 변형은 같은 지면이므로 재질 경계선을 만들지 않는다.
const SAND_GROUND_TEXTURE_KEYS=new Set(['pebble-natural-rounded-v1','pebble-coarse-0-v1','pebble-coarse-1-v1','pebble-coarse-2-v1','pebble-sand-base-v1','terrain-source-gravel','pebble-sand-sparse-v1','pebble-sand-medium-v1','pebble-sand-scattered-v1']);

// 짠물둔덕의 자갈 원본과 변형은 같은 지면 재질이다.
const BRINE_GRAVEL_MATERIAL_KEYS=new Set(['brine-bank-gravel-wide-sheet-v1','brine-bank-gravel-sparse-sheet-v1','brine-bank-saline-gravel-v1','brine-bank-saline-gravel-variant-v1','brine-bank-gravel-sheet-a-v1','brine-bank-gravel-sheet-b-v1']);
const BRINE_WATER_MATERIAL_KEYS=new Set(['salt-flat-calm-brine-v1','brine-bank-shallow-water-v1']);
const BRINE_GRAVEL_SHEET_KEYS=new Set(['brine-bank-gravel-wide-sheet-v1','brine-bank-gravel-sparse-sheet-v1','brine-bank-gravel-sheet-a-v1','brine-bank-gravel-sheet-b-v1','brine-bank-road-sheet-v1']);
const BRINE_GRAVEL_WIDE_SHEET_KEY='brine-bank-gravel-wide-sheet-v1';
const BRINE_GRAVEL_WIDE_GRID_SIZE=8;
const BRINE_GRAVEL_WIDE_PIXEL_SIZE=1024;
const BRINE_GRAVEL_SHEET_GRID_SIZE=4;
const BRINE_GRAVEL_SHEET_PIXEL_SIZE=512;
const BRINE_GRAVEL_CELL_PIXEL_SIZE=BRINE_GRAVEL_SHEET_PIXEL_SIZE/BRINE_GRAVEL_SHEET_GRID_SIZE;

const PEBBLE_GROUND_VARIANT_KEYS=new Set(['pebble-natural-rounded-v1','pebble-sand-sparse-v1','pebble-sand-medium-v1','pebble-sand-scattered-v1']);
const GROUND_VARIANT_QUARTER_TURN=Math.PI/2;
const PEBBLE_VARIANT_COLUMN_FACTOR=73856093;
const PEBBLE_VARIANT_ROW_FACTOR=19349663;
const PEBBLE_VARIANT_HASH_SHIFT=8;
const PEBBLE_VARIANT_DIRECTION_COUNT=4;

/** 시트 한 장의 영역을 맵 좌표에 맞춰 읽고 셀 이미지는 한 번만 생성한다. */
export function resolveBrineGravelSheetTexture(currentGameScene:Phaser.Scene,currentSourceTexture:string,currentCellPosition:Position):string{
 if(!BRINE_GRAVEL_SHEET_KEYS.has(currentSourceTexture))return currentSourceTexture;
 const currentWideSheet=currentSourceTexture===BRINE_GRAVEL_WIDE_SHEET_KEY;
 const currentGridSize=currentWideSheet?BRINE_GRAVEL_WIDE_GRID_SIZE:BRINE_GRAVEL_SHEET_GRID_SIZE;
 const currentPixelSize=currentWideSheet?BRINE_GRAVEL_WIDE_PIXEL_SIZE:BRINE_GRAVEL_SHEET_PIXEL_SIZE;
 const currentCellColumn=currentCellPosition.column%currentGridSize,currentCellRow=currentCellPosition.row%currentGridSize;
 if(!Number.isInteger(currentCellColumn)||!Number.isInteger(currentCellRow)||currentCellColumn<0||currentCellRow<0)throw new Error('자갈 시트 타일 좌표 오류');
 const currentFrameKey=`${currentSourceTexture}-cell-${currentCellColumn}-${currentCellRow}`;
 if(currentGameScene.textures.exists(currentFrameKey))return currentFrameKey;
 const currentSheetImage=currentGameScene.textures.get(currentSourceTexture).getSourceImage() as HTMLImageElement;
 if(currentSheetImage.width!==currentPixelSize||currentSheetImage.height!==currentPixelSize)throw new Error('자갈 시트 크기 오류: '+currentSourceTexture);
 const currentCellTexture=currentGameScene.textures.createCanvas(currentFrameKey,BRINE_GRAVEL_CELL_PIXEL_SIZE,BRINE_GRAVEL_CELL_PIXEL_SIZE);
 if(!currentCellTexture)throw new Error('자갈 시트 타일 생성 실패: '+currentSourceTexture);
 currentCellTexture.context.drawImage(currentSheetImage,currentCellColumn*BRINE_GRAVEL_CELL_PIXEL_SIZE,currentCellRow*BRINE_GRAVEL_CELL_PIXEL_SIZE,BRINE_GRAVEL_CELL_PIXEL_SIZE,BRINE_GRAVEL_CELL_PIXEL_SIZE,0,0,BRINE_GRAVEL_CELL_PIXEL_SIZE,BRINE_GRAVEL_CELL_PIXEL_SIZE);
 currentCellTexture.refresh();return currentFrameKey;
}

/** 자갈만 셀별 고정 방향을 사용하며 원본과 통행 데이터는 유지한다. */
function resolvePebbleGroundVariant(currentGameScene:Phaser.Scene,currentSourceTexture:string,currentCellPosition:Position):string{
 if(!PEBBLE_GROUND_VARIANT_KEYS.has(currentSourceTexture))return currentSourceTexture;
 const currentPositionHash=((currentCellPosition.column*PEBBLE_VARIANT_COLUMN_FACTOR)^(currentCellPosition.row*PEBBLE_VARIANT_ROW_FACTOR))>>>0;
 const currentRotationIndex=(currentPositionHash^(currentPositionHash>>>PEBBLE_VARIANT_HASH_SHIFT))%PEBBLE_VARIANT_DIRECTION_COUNT;
 if(currentRotationIndex===0)return currentSourceTexture;
 const currentVariantKey=`${currentSourceTexture}-quarter-${currentRotationIndex}`;
 if(currentGameScene.textures.exists(currentVariantKey))return currentVariantKey;
 const currentSourceImage=currentGameScene.textures.get(currentSourceTexture).getSourceImage() as HTMLImageElement;
 const currentSourceWidth=currentSourceImage.width;
 const currentSourceHeight=currentSourceImage.height;
 if(currentSourceWidth!==currentSourceHeight)throw new Error('자갈 변형은 정사각형 원본이 필요합니다: '+currentSourceTexture);
 const currentVariantTexture=currentGameScene.textures.createCanvas(currentVariantKey,currentSourceWidth,currentSourceHeight);
 if(!currentVariantTexture)throw new Error('자갈 방향 변형 텍스처 생성 실패: '+currentVariantKey);
 const currentDrawingContext=currentVariantTexture.context;
 currentDrawingContext.translate(currentSourceWidth/2,currentSourceHeight/2);
 currentDrawingContext.rotate(currentRotationIndex*GROUND_VARIANT_QUARTER_TURN);
 currentDrawingContext.drawImage(currentSourceImage,-currentSourceWidth/2,-currentSourceHeight/2);
 currentVariantTexture.refresh();
 return currentVariantKey;
}

/** 야외의 지형 코드와 실제 표시 원본 선택을 함께 제공한다. */
export function resolveFieldTerrainFrame(currentTerrainName:string,currentMapIdentifier:string):string {
 const currentMaterialFrame=(fieldMaterialFrames as Record<string,string>)[currentTerrainName];
 if(!currentMaterialFrame)throw new Error('등록되지 않은 필드 재질 코드: '+currentTerrainName);
 return currentMaterialFrame;
}

export function resolveFieldTileTextures(currentGameScene:Phaser.Scene,currentTerrainName:string,currentCellPosition:Position,currentMapIdentifier:string,currentConnectionMask:number,resolveGroundMaterial:(currentCellPosition:Position)=>string,currentGroundOverrides:readonly {position:Position;textureKey:string}[]=[],currentGroundDecals:readonly GroundDecalRecord[]=[],currentCliffTextureKey:string=CLIFF_WALL_TEXTURE,currentCliffOverrides:readonly {position:Position;textureKey:string}[]=[]){
 currentCliffTextureKey=currentCliffOverrides.find(currentWallRecord=>currentWallRecord.position.column===currentCellPosition.column&&currentWallRecord.position.row===currentCellPosition.row)?.textureKey??currentCliffTextureKey;
 if(!currentGameScene.textures.exists(currentCliffTextureKey))throw new Error("등록 벽면 텍스처 누락: "+currentCliffTextureKey);
 const resolveDisplayedGroundMaterial=(currentNeighborPosition:Position):string=>{
  const currentSourceTexture=resolveFieldGroundMaterial(currentNeighborPosition,currentGroundOverrides,currentTerrainPosition=>'terrain-source-'+resolveFieldTerrainFrame(resolveGroundMaterial(currentTerrainPosition),currentMapIdentifier));
  if(!currentGameScene.textures.exists(currentSourceTexture))throw new Error('경계 판정용 지면 텍스처 누락: '+currentSourceTexture);
  const currentSourceImage=currentGameScene.textures.get(currentSourceTexture).getSourceImage() as HTMLImageElement;
  if(!currentSourceImage.src)throw new Error('경계 판정용 지면 원본 경로 누락: '+currentSourceTexture);
  if(BRINE_GRAVEL_MATERIAL_KEYS.has(currentSourceTexture))return 'brine-gravel-ground-material';
  if(currentMapIdentifier==='brine-bank' && BRINE_WATER_MATERIAL_KEYS.has(currentSourceTexture))return 'brine-water-ground-material';
  return SAND_GROUND_TEXTURE_KEYS.has(currentSourceTexture)?'sand-ground-material':currentSourceImage.src;
 };
 const currentOverrideRecord=currentGroundOverrides.find(currentGroundRecord=>currentGroundRecord.position.column===currentCellPosition.column&&currentGroundRecord.position.row===currentCellPosition.row);
 if(currentOverrideRecord){
  if(!currentGameScene.textures.exists(currentOverrideRecord.textureKey))throw new Error('등록 지면 텍스처 누락: '+currentOverrideRecord.textureKey);
  return {ground:composeGroundDecalTexture(currentGameScene,resolvePebbleGroundVariant(currentGameScene,resolveBrineGravelSheetTexture(currentGameScene,currentOverrideRecord.textureKey,currentCellPosition),currentCellPosition),currentCellPosition,currentGroundDecals),resolveGroundMaterial:resolveDisplayedGroundMaterial,cliff:currentCliffTextureKey,tread:RAMP_TREAD_TEXTURE};
 }
 const currentGroundKey='terrain-source-'+resolveFieldTerrainFrame(currentTerrainName,currentMapIdentifier);
 return {ground:composeGroundDecalTexture(currentGameScene,currentGroundKey,currentCellPosition,currentGroundDecals),resolveGroundMaterial:resolveDisplayedGroundMaterial,cliff:currentCliffTextureKey,tread:RAMP_TREAD_TEXTURE,underlay:['boulder'].includes(currentTerrainName)?'terrain-source-grass':undefined};
}

export function resolveCityTileTextures(currentGameScene:Phaser.Scene,currentTerrainName:string,currentMapIdentifier:string,currentConnectionMask:number){
 const currentTerrainFrame=currentTerrainName==='grass'?resolveGrassFrameForMap(currentMapIdentifier):currentTerrainName==='paving'?resolvePavingFrameForMap(currentMapIdentifier):currentTerrainName==='reed-bed'?resolveReedFrameForMap(currentMapIdentifier):resolveTownGroundFrame(currentMapIdentifier,currentTerrainName);
 const currentGroundKey='terrain-source-'+currentTerrainFrame;
 return {ground:currentGroundKey,cliff:CLIFF_WALL_TEXTURE,tread:RAMP_TREAD_TEXTURE};
}
