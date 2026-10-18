import Phaser from 'phaser';
import type {CityBuilding,Position} from '../../client/types';
import {markFieldOcclusionObject} from '../../../packages/field-renderer/field-renderer.mjs';
import {CITY_BUILDING_STYLE} from '../../../packages/field-renderer/render-constants.mjs';
import {TERRAIN_DEPTH} from './elevation';
import {t} from '../../i18n';

const BUILDING_LABEL_STYLE = {fontFamily:'sans-serif',fontSize:'20px',color:'#fff7de',backgroundColor:'#39362d',padding:{x:8,y:4},resolution:2};
const BUILDING_LABEL_GAP = 8;
const BUILDING_ALPHA_THRESHOLD = 16;
const BUILDING_VISIBLE_BOUNDS = new WeakMap<Phaser.Textures.Texture,{centerX:number;top:number}>();

/** 투명 여백을 제외한 그림의 상단 중앙을 텍스처당 한 번 계산한다. */
function readBuildingVisibleBounds(currentBuildingTexture:Phaser.Textures.Texture):{centerX:number;top:number} {
 const currentCachedBounds=BUILDING_VISIBLE_BOUNDS.get(currentBuildingTexture);
 if(currentCachedBounds)return currentCachedBounds;
 const currentSourceImage=currentBuildingTexture.getSourceImage();
 const currentMeasureCanvas=document.createElement('canvas');
 currentMeasureCanvas.width=currentSourceImage.width;currentMeasureCanvas.height=currentSourceImage.height;
 const currentMeasureContext=currentMeasureCanvas.getContext('2d',{willReadFrequently:true});
 if(!currentMeasureContext)throw Error('건물 라벨의 투명 영역 측정 캔버스를 준비하지 못했습니다.');
 currentMeasureContext.drawImage(currentSourceImage as CanvasImageSource,0,0);
 const currentImagePixels=currentMeasureContext.getImageData(0,0,currentMeasureCanvas.width,currentMeasureCanvas.height).data;
 let currentLeftPixel=currentMeasureCanvas.width,currentRightPixel=-1,currentTopPixel=currentMeasureCanvas.height;
 for(let currentRowIndex=0;currentRowIndex<currentMeasureCanvas.height;currentRowIndex++){
  for(let currentColumnIndex=0;currentColumnIndex<currentMeasureCanvas.width;currentColumnIndex++){
   if(currentImagePixels[(currentRowIndex*currentMeasureCanvas.width+currentColumnIndex)*4+3]<=BUILDING_ALPHA_THRESHOLD)continue;
   currentLeftPixel=Math.min(currentLeftPixel,currentColumnIndex);currentRightPixel=Math.max(currentRightPixel,currentColumnIndex);currentTopPixel=Math.min(currentTopPixel,currentRowIndex);
  }
 }
 if(currentRightPixel<0)throw Error('건물 스프라이트에 표시할 픽셀이 없습니다.');
 const currentVisibleBounds={centerX:(currentLeftPixel+currentRightPixel+1)/2,top:currentTopPixel};
 BUILDING_VISIBLE_BOUNDS.set(currentBuildingTexture,currentVisibleBounds);
 return currentVisibleBounds;
}
const BUILDING_HALF_CELL = 0.5;
const BUILDING_FOOTPRINT_MARGIN = 1.04;
type CityScreenPoint = {x:number;y:number};
export type CityBuildingRegion = {appliedTextureIdentifiers:string[];position:Position;depth:number;polygons:Phaser.Geom.Polygon[];left:number;right:number;top:number;bottom:number};

/** 건물의 깊이는 점유 영역의 셀 최대값이 아니라 실제 전면 접지 앵커를 기준으로 정렬한다. */
export function resolveCityBuildingFrontDepth(currentFrontPosition:Position,calculateTerrainDepth:(currentCellPosition:Position)=>number):number {
 return calculateTerrainDepth(currentFrontPosition)+TERRAIN_DEPTH.overlay;
}

/** 건물 이미지는 단일 스프라이트, 점유·출입구는 서버의 논리 영역을 따른다. */
export function drawCityBuildingSprite(currentMapScene:Phaser.Scene,currentCityBuilding:CityBuilding,
 projectTerrainPosition:(currentCellPosition:Position)=>CityScreenPoint,
 calculateTerrainDepth:(currentCellPosition:Position)=>number,currentAnnotationDepth:number,currentBuildingSelected:boolean):CityBuildingRegion {
 const currentSpriteRecord=currentCityBuilding.sprite;
 if(!currentSpriteRecord || !currentMapScene.textures.exists(currentSpriteRecord.textureKey))throw Error('도시 건물 스프라이트 누락: '+currentCityBuilding.id);
 const currentOriginPosition=currentCityBuilding.origin;
 const currentFrontPosition={column:currentOriginPosition.column+currentCityBuilding.width-BUILDING_HALF_CELL,row:currentOriginPosition.row+currentCityBuilding.height-BUILDING_HALF_CELL};
 const currentFrontPoint=projectTerrainPosition(currentFrontPosition);
 const currentLeftPoint=projectTerrainPosition({column:currentOriginPosition.column-BUILDING_HALF_CELL,row:currentFrontPosition.row});
 const currentRightPoint=projectTerrainPosition({column:currentFrontPosition.column,row:currentOriginPosition.row-BUILDING_HALF_CELL});
 const currentBuildingDepth=resolveCityBuildingFrontDepth(currentFrontPosition,calculateTerrainDepth);
 const currentBuildingImage=currentMapScene.add.image(currentFrontPoint.x,currentFrontPoint.y,currentSpriteRecord.textureKey)
  .setOrigin(currentSpriteRecord.anchorX,currentSpriteRecord.anchorY).setDepth(currentBuildingDepth);
 const currentDisplayWidth=Math.abs(currentRightPoint.x-currentLeftPoint.x)*BUILDING_FOOTPRINT_MARGIN/currentSpriteRecord.contentWidth;
 currentBuildingImage.setScale(currentDisplayWidth/currentBuildingImage.width);
 markFieldOcclusionObject(currentBuildingImage);
 const currentImageBounds=currentBuildingImage.getBounds();
 const currentImagePolygon=new Phaser.Geom.Polygon([
  {x:currentImageBounds.left,y:currentImageBounds.top},{x:currentImageBounds.right,y:currentImageBounds.top},
  {x:currentImageBounds.right,y:currentImageBounds.bottom},{x:currentImageBounds.left,y:currentImageBounds.bottom}]);
 if(currentCityBuilding.facilityKind === 'residence') {
 return {appliedTextureIdentifiers:[currentSpriteRecord.textureKey],position:currentOriginPosition,depth:currentBuildingDepth,polygons:[currentImagePolygon],left:currentImageBounds.left,right:currentImageBounds.right,top:currentImageBounds.top,bottom:currentImageBounds.bottom};
 }
 const currentEntrancePoint=projectTerrainPosition(currentCityBuilding.entrance);
 const currentEntranceMarker=currentMapScene.add.graphics().setDepth(currentAnnotationDepth);
 currentEntranceMarker.lineStyle(currentBuildingSelected?CITY_BUILDING_STYLE.selectedWidth:CITY_BUILDING_STYLE.outlineWidth,currentBuildingSelected?CITY_BUILDING_STYLE.selectedColor:CITY_BUILDING_STYLE.wallLight);
 currentEntranceMarker.strokeCircle(currentEntrancePoint.x,currentEntrancePoint.y,CITY_BUILDING_STYLE.entranceRadius);
 const currentVisibleBounds=readBuildingVisibleBounds(currentBuildingImage.texture);
 const currentLabelPositionX=currentBuildingImage.x+(currentVisibleBounds.centerX-currentBuildingImage.displayOriginX)*currentBuildingImage.scaleX;
 const currentLabelPositionY=currentBuildingImage.y+(currentVisibleBounds.top-currentBuildingImage.displayOriginY)*currentBuildingImage.scaleY-BUILDING_LABEL_GAP;
 currentMapScene.add.text(currentLabelPositionX,currentLabelPositionY,t(`city.${currentCityBuilding.facilityKind}`),BUILDING_LABEL_STYLE)
  .setOrigin(BUILDING_HALF_CELL,1).setDepth(currentAnnotationDepth);
 return {appliedTextureIdentifiers:[currentSpriteRecord.textureKey],position:currentOriginPosition,depth:currentBuildingDepth,polygons:[currentImagePolygon],left:currentImageBounds.left,right:currentImageBounds.right,top:currentImageBounds.top,bottom:currentImageBounds.bottom};
}
