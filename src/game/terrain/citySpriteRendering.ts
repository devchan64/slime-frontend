import Phaser from 'phaser';
import type {CityBuilding,Position} from '../../client/types';
import {markFieldOcclusionObject} from '../../../packages/field-renderer/field-renderer.mjs';
import {CITY_BUILDING_STYLE} from '../../../packages/field-renderer/render-constants.mjs';
import {cityBuildingCells} from './cityBuildings';
import {TERRAIN_DEPTH} from './elevation';
import {t} from '../../i18n';

const BUILDING_HALF_CELL = 0.5;
const BUILDING_FOOTPRINT_MARGIN = 1.04;
type CityScreenPoint = {x:number;y:number};
export type CityBuildingRegion = {appliedTextureIdentifiers:string[];position:Position;depth:number;polygons:Phaser.Geom.Polygon[];left:number;right:number;top:number;bottom:number};

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
 const currentBuildingDepth=Math.max(...cityBuildingCells(currentCityBuilding).map(calculateTerrainDepth))+TERRAIN_DEPTH.overlay;
 const currentBuildingImage=currentMapScene.add.image(currentFrontPoint.x,currentFrontPoint.y,currentSpriteRecord.textureKey)
  .setOrigin(currentSpriteRecord.anchorX,currentSpriteRecord.anchorY).setDepth(currentBuildingDepth);
 const currentDisplayWidth=Math.abs(currentRightPoint.x-currentLeftPoint.x)*BUILDING_FOOTPRINT_MARGIN/currentSpriteRecord.contentWidth;
 currentBuildingImage.setScale(currentDisplayWidth/currentBuildingImage.width);
 markFieldOcclusionObject(currentBuildingImage);
 const currentImageBounds=currentBuildingImage.getBounds();
 const currentImagePolygon=new Phaser.Geom.Polygon([
  {x:currentImageBounds.left,y:currentImageBounds.top},{x:currentImageBounds.right,y:currentImageBounds.top},
  {x:currentImageBounds.right,y:currentImageBounds.bottom},{x:currentImageBounds.left,y:currentImageBounds.bottom}]);
 const currentEntrancePoint=projectTerrainPosition(currentCityBuilding.entrance);
 const currentEntranceMarker=currentMapScene.add.graphics().setDepth(currentAnnotationDepth);
 currentEntranceMarker.lineStyle(currentBuildingSelected?CITY_BUILDING_STYLE.selectedWidth:CITY_BUILDING_STYLE.outlineWidth,currentBuildingSelected?CITY_BUILDING_STYLE.selectedColor:CITY_BUILDING_STYLE.wallLight);
 currentEntranceMarker.strokeCircle(currentEntrancePoint.x,currentEntrancePoint.y,CITY_BUILDING_STYLE.entranceRadius);
 currentMapScene.add.text(currentEntrancePoint.x,currentEntrancePoint.y+CITY_BUILDING_STYLE.labelOffset,t(`city.${currentCityBuilding.facilityKind}`),
  {fontFamily:'sans-serif',fontSize:CITY_BUILDING_STYLE.labelFont,color:'#fff7de',stroke:'#39362d',strokeThickness:4})
  .setOrigin(BUILDING_HALF_CELL,0).setDepth(currentAnnotationDepth);
 return {appliedTextureIdentifiers:[currentSpriteRecord.textureKey],position:currentOriginPosition,depth:currentBuildingDepth,polygons:[currentImagePolygon],left:currentImageBounds.left,right:currentImageBounds.right,top:currentImageBounds.top,bottom:currentImageBounds.bottom};
}
