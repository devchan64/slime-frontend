import Phaser from 'phaser';
import type {CityBuilding,Position} from '../../client/types';
import {applyTerrainAmbientTint,markFieldOcclusionObject} from '../../../packages/field-renderer/field-renderer.mjs';
import {CITY_BUILDING_STYLE} from '../../../packages/field-renderer/render-constants.mjs';
import {TERRAIN_DEPTH} from './elevation';
import {t} from '../../i18n';
import {calculateBuildingDisplaySize} from './buildingDisplaySize';
import {MAP_LABEL_FONT_SIZE} from './mapLabelStyle';

const BUILDING_LABEL_STYLE = {fontFamily:'sans-serif',fontSize:MAP_LABEL_FONT_SIZE,color:'#fff7de',backgroundColor:'#39362d',padding:{x:8,y:4},resolution:2};
const BUILDING_LABEL_ANCHOR_OFFSET = 100;
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
 calculateTerrainDepth:(currentCellPosition:Position)=>number,currentAnnotationDepth:number,currentBuildingSelected:boolean,currentAmbientSurface?:{ambientTint?:string}):CityBuildingRegion {
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
 const currentAdjustedSize=calculateBuildingDisplaySize(currentDisplayWidth,currentBuildingImage.width,currentBuildingImage.height,currentSpriteRecord.displayWidthAdjustment,currentSpriteRecord.displayHeightAdjustment);
 currentBuildingImage.setScale(currentAdjustedSize.width/currentBuildingImage.width,currentAdjustedSize.height/currentBuildingImage.height);
 markFieldOcclusionObject(currentBuildingImage);
 applyTerrainAmbientTint(currentBuildingImage,currentAmbientSurface);
 const currentImageBounds=currentBuildingImage.getBounds();
 // 건물 전면 양쪽 가장자리의 소품은 건물의 최전면 모서리 깊이보다 앞에 둔다.
 for(const currentSceneObject of currentMapScene.children.list){
  const currentSceneryPosition=currentSceneObject.getData('sceneryGroundPosition') as Position|undefined;
  if(!currentSceneryPosition)continue;
  const currentFrontColumn=currentOriginPosition.column+currentCityBuilding.width-BUILDING_HALF_CELL;
  const currentFrontRow=currentOriginPosition.row+currentCityBuilding.height-BUILDING_HALF_CELL;
  const currentBehindBuilding=currentSceneryPosition.column<currentOriginPosition.column-BUILDING_HALF_CELL||currentSceneryPosition.row<currentOriginPosition.row-BUILDING_HALF_CELL;
  if(currentBehindBuilding||(currentSceneryPosition.column<=currentFrontColumn&&currentSceneryPosition.row<=currentFrontRow))continue;
  const currentScenerySprite=currentSceneObject as Phaser.GameObjects.Image;
  const currentSceneryBounds=currentScenerySprite.getBounds();
  if(currentSceneryBounds.right<=currentImageBounds.left||currentSceneryBounds.left>=currentImageBounds.right||currentSceneryBounds.bottom<=currentImageBounds.top||currentSceneryBounds.top>=currentImageBounds.bottom)continue;
  currentScenerySprite.setDepth(Math.max(currentScenerySprite.depth,currentBuildingDepth+1));
 }

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
 const currentLabelPositionX=currentFrontPoint.x;
 const currentLabelPositionY=currentFrontPoint.y-BUILDING_LABEL_ANCHOR_OFFSET;
 currentMapScene.add.text(currentLabelPositionX,currentLabelPositionY,t(`city.${currentCityBuilding.facilityKind}`),BUILDING_LABEL_STYLE)
  .setOrigin(BUILDING_HALF_CELL,1).setDepth(currentAnnotationDepth);
 return {appliedTextureIdentifiers:[currentSpriteRecord.textureKey],position:currentOriginPosition,depth:currentBuildingDepth,polygons:[currentImagePolygon],left:currentImageBounds.left,right:currentImageBounds.right,top:currentImageBounds.top,bottom:currentImageBounds.bottom};
}
