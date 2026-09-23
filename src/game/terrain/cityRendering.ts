import Phaser from 'phaser';
import type {CityBuilding,Position} from '../../client/types';
import {t} from '../../i18n';
import {cityBuildingCells} from './cityBuildings';
import {TILE_W,TILE_H} from './meadow';
import {TERRAIN_DEPTH} from './elevation';
import iseulonRoofSource from '../../assets/world/isloon/buildings/roof-timber-v1.png';
import iseulonWallSource from '../../assets/world/isloon/buildings/wall-timber-v1.png';

const CITY_BUILDING_STYLE = {
  wallHeight:36, canopyHeight:18, wallLight:0xc8b68d, wallDark:0x8f8067,
  outlineColor:0x453d35, outlineWidth:1.5, selectedColor:0xffdd78, selectedWidth:3,
  roofAlpha:0.9, labelFont:'13px', labelOffset:9, entranceRadius:5,
  roofColors:{guild:0x467c75,bookshop:0x755c84,inn:0xa56f54,workshop:0x626f7a,market:0xd4ad63},
};
const CITY_PAVING_STYLE = {fill:0xc8c4a4,edge:0xa4a28b,lineWidth:0.6,alpha:0.95};
const CITY_HALF_TILE = 0.5;
const ISLOON_BUILDING_TEXTURES = { roof: 'iseulon-roof-timber-v1', wall: 'iseulon-wall-timber-v1' };
type CityScreenPoint = {x:number;y:number};
export type CityBuildingRegion = {position:Position;depth:number;polygons:Phaser.Geom.Polygon[];left:number;right:number;top:number;bottom:number};

export function preloadCityBuildingTextures(currentMapScene: Phaser.Scene) {
  currentMapScene.load.image(ISLOON_BUILDING_TEXTURES.roof, iseulonRoofSource);
  currentMapScene.load.image(ISLOON_BUILDING_TEXTURES.wall, iseulonWallSource);
}

export function drawCityPaving(currentTileGraphic: Phaser.GameObjects.Graphics,currentTilePosition:CityScreenPoint) {
  const currentTileCorners = [{x:currentTilePosition.x,y:currentTilePosition.y-TILE_H/2},
    {x:currentTilePosition.x+TILE_W/2,y:currentTilePosition.y},{x:currentTilePosition.x,y:currentTilePosition.y+TILE_H/2},
    {x:currentTilePosition.x-TILE_W/2,y:currentTilePosition.y}];
  currentTileGraphic.fillStyle(CITY_PAVING_STYLE.fill,CITY_PAVING_STYLE.alpha).fillPoints(currentTileCorners,true);
  currentTileGraphic.lineStyle(CITY_PAVING_STYLE.lineWidth,CITY_PAVING_STYLE.edge).strokePoints(currentTileCorners,true);
  currentTileGraphic.lineBetween(currentTileCorners[0].x,currentTileCorners[0].y,currentTileCorners[2].x,currentTileCorners[2].y);
}

export function drawCityBuilding(currentMapScene:Phaser.Scene,currentCityBuilding:CityBuilding,
  projectTerrainPosition:(currentCellPosition:Position)=>CityScreenPoint,
  calculateTerrainDepth:(currentCellPosition:Position)=>number,currentAnnotationDepth:number,currentBuildingSelected:boolean):CityBuildingRegion {
  const currentBuildingHeight = currentCityBuilding.facilityKind==='market'?CITY_BUILDING_STYLE.canopyHeight:CITY_BUILDING_STYLE.wallHeight;
  const currentBuildingCorners = [
    {column:currentCityBuilding.origin.column-CITY_HALF_TILE,row:currentCityBuilding.origin.row-CITY_HALF_TILE},
    {column:currentCityBuilding.origin.column+currentCityBuilding.width-CITY_HALF_TILE,row:currentCityBuilding.origin.row-CITY_HALF_TILE},
    {column:currentCityBuilding.origin.column+currentCityBuilding.width-CITY_HALF_TILE,row:currentCityBuilding.origin.row+currentCityBuilding.height-CITY_HALF_TILE},
    {column:currentCityBuilding.origin.column-CITY_HALF_TILE,row:currentCityBuilding.origin.row+currentCityBuilding.height-CITY_HALF_TILE},
  ].map(projectTerrainPosition);
  const currentLeftCorner = currentBuildingCorners.reduce((previousCornerPoint,currentCornerPoint)=>previousCornerPoint.x<currentCornerPoint.x?previousCornerPoint:currentCornerPoint);
  const currentRightCorner = currentBuildingCorners.reduce((previousCornerPoint,currentCornerPoint)=>previousCornerPoint.x>currentCornerPoint.x?previousCornerPoint:currentCornerPoint);
  const currentFrontCorner = currentBuildingCorners.reduce((previousCornerPoint,currentCornerPoint)=>previousCornerPoint.y>currentCornerPoint.y?previousCornerPoint:currentCornerPoint);
  const currentRoofCorners = currentBuildingCorners.map(currentCornerPoint=>({x:currentCornerPoint.x,y:currentCornerPoint.y-currentBuildingHeight}));
  const currentLeftWall = [currentLeftCorner,currentFrontCorner,{x:currentFrontCorner.x,y:currentFrontCorner.y-currentBuildingHeight},{x:currentLeftCorner.x,y:currentLeftCorner.y-currentBuildingHeight}];
  const currentRightWall = [currentFrontCorner,currentRightCorner,{x:currentRightCorner.x,y:currentRightCorner.y-currentBuildingHeight},{x:currentFrontCorner.x,y:currentFrontCorner.y-currentBuildingHeight}];
  const currentBuildingDepth = Math.max(...cityBuildingCells(currentCityBuilding).map(calculateTerrainDepth))+TERRAIN_DEPTH.overlay;
  const currentBuildingGraphic = currentMapScene.add.graphics().setDepth(currentBuildingDepth);
  currentBuildingGraphic.fillStyle(CITY_BUILDING_STYLE.wallLight).fillPoints(currentLeftWall,true);
  currentBuildingGraphic.fillStyle(CITY_BUILDING_STYLE.wallDark).fillPoints(currentRightWall,true);
  currentBuildingGraphic.fillStyle(CITY_BUILDING_STYLE.roofColors[currentCityBuilding.facilityKind],CITY_BUILDING_STYLE.roofAlpha).fillPoints(currentRoofCorners,true);
  currentBuildingGraphic.lineStyle(CITY_BUILDING_STYLE.outlineWidth,CITY_BUILDING_STYLE.outlineColor).strokePoints(currentRoofCorners,true);
  const currentEntrancePoint = projectTerrainPosition(currentCityBuilding.entrance);
  const currentMarkerGraphic = currentMapScene.add.graphics().setDepth(currentAnnotationDepth);
  currentMarkerGraphic.lineStyle(currentBuildingSelected?CITY_BUILDING_STYLE.selectedWidth:CITY_BUILDING_STYLE.outlineWidth,
    currentBuildingSelected?CITY_BUILDING_STYLE.selectedColor:CITY_BUILDING_STYLE.wallLight);
  currentMarkerGraphic.strokeCircle(currentEntrancePoint.x,currentEntrancePoint.y,CITY_BUILDING_STYLE.entranceRadius);
  if(currentBuildingSelected)currentMarkerGraphic.strokePoints(currentBuildingCorners,true);
  const currentRoofCenter = {x:currentRoofCorners.reduce((currentTotalValue,currentCornerPoint)=>currentTotalValue+currentCornerPoint.x,0)/currentRoofCorners.length,
    y:currentRoofCorners.reduce((currentTotalValue,currentCornerPoint)=>currentTotalValue+currentCornerPoint.y,0)/currentRoofCorners.length};
  currentMapScene.add.text(currentRoofCenter.x,currentRoofCenter.y-CITY_BUILDING_STYLE.labelOffset,t(`city.${currentCityBuilding.facilityKind}`),
    {fontFamily:'sans-serif',fontSize:CITY_BUILDING_STYLE.labelFont,color:'#fff7de',stroke:'#39362d',strokeThickness:3})
    .setOrigin(CITY_HALF_TILE).setDepth(currentAnnotationDepth);
  const currentVisiblePoints = [...currentBuildingCorners,...currentRoofCorners];
  return {position:currentCityBuilding.origin,depth:currentBuildingDepth,
    polygons:[currentRoofCorners,currentLeftWall,currentRightWall].map(currentFacePoints=>new Phaser.Geom.Polygon(currentFacePoints)),
    left:Math.min(...currentVisiblePoints.map(currentPointValue=>currentPointValue.x)),right:Math.max(...currentVisiblePoints.map(currentPointValue=>currentPointValue.x)),
    top:Math.min(...currentVisiblePoints.map(currentPointValue=>currentPointValue.y)),bottom:Math.max(...currentVisiblePoints.map(currentPointValue=>currentPointValue.y))};
}
