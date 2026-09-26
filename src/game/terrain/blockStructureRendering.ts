import {buildBlockSurfaceFaces} from './blockGeometry';
import Phaser from 'phaser';
import type {CityBuilding,Position} from '../../client/types';
import {t} from '../../i18n';
import {cityBuildingCells} from './cityBuildings';
import {resolveMapTileSize} from './renderMetrics';
import {TERRAIN_DEPTH} from './elevation';

const CITY_BUILDING_STYLE = {
  wallLight:0xc8b68d, wallDark:0x8f8067,
  outlineColor:0x453d35, outlineWidth:2, selectedColor:0xffdd78, selectedWidth:4,
  roofAlpha:0.9, labelFont:'17px', labelOffset:12, entranceRadius:7,
  roofColors:{guild:0x467c75,bookshop:0x755c84,inn:0xa56f54,workshop:0x626f7a,market:0xd4ad63},
};
const CITY_PAVING_STYLE = {fill:0xc8c4a4,edge:0xa4a28b,lineWidth:1,alpha:0.95};
const CITY_HALF_TILE = 0.5;
type CityScreenPoint = {x:number;y:number};
export type CityBuildingRegion = {position:Position;depth:number;polygons:Phaser.Geom.Polygon[];left:number;right:number;top:number;bottom:number};

export function drawCityPaving(currentTileGraphic: Phaser.GameObjects.Graphics,currentTilePosition:CityScreenPoint,currentTileDimensions = resolveMapTileSize({safeTown:true})) {
  const currentTileCorners = [{x:currentTilePosition.x,y:currentTilePosition.y-currentTileDimensions.height/2},
    {x:currentTilePosition.x+currentTileDimensions.width/2,y:currentTilePosition.y},{x:currentTilePosition.x,y:currentTilePosition.y+currentTileDimensions.height/2},
    {x:currentTilePosition.x-currentTileDimensions.width/2,y:currentTilePosition.y}];
  currentTileGraphic.fillStyle(CITY_PAVING_STYLE.fill,CITY_PAVING_STYLE.alpha).fillPoints(currentTileCorners,true);
  currentTileGraphic.lineStyle(CITY_PAVING_STYLE.lineWidth,CITY_PAVING_STYLE.edge).strokePoints(currentTileCorners,true);
  currentTileGraphic.lineBetween(currentTileCorners[0].x,currentTileCorners[0].y,currentTileCorners[2].x,currentTileCorners[2].y);
}

export function drawBlockStructure(currentMapScene:Phaser.Scene,currentCityBuilding:CityBuilding,
  projectTerrainPosition:(currentCellPosition:Position)=>CityScreenPoint,
  calculateTerrainDepth:(currentCellPosition:Position)=>number,currentAnnotationDepth:number,currentBuildingSelected:boolean):CityBuildingRegion {
  if(currentCityBuilding.blockSchemaVersion!==1)throw new Error('지원하지 않는 건물 블록 버전');
  const currentBuildingCorners = cityBuildingCells(currentCityBuilding).map(projectTerrainPosition);
  const currentBuildingDepth = Math.max(...cityBuildingCells(currentCityBuilding).map(calculateTerrainDepth))+TERRAIN_DEPTH.overlay;
  const currentSurfaceFaces=buildBlockSurfaceFaces(currentCityBuilding.blocks);
  const currentProjectedFaces=currentSurfaceFaces.map(currentSurfaceFace=>({surface:currentSurfaceFace,depth:currentSurfaceFace.vertices.reduce((currentDepthSum,currentVertexPoint)=>currentDepthSum+projectTerrainPosition({column:currentCityBuilding.origin.column+currentVertexPoint.column,row:currentCityBuilding.origin.row+currentVertexPoint.row}).y,0)/currentSurfaceFace.vertices.length,points:currentSurfaceFace.vertices.map(currentVertexPoint=>{
    const currentScreenPoint=projectTerrainPosition({column:currentCityBuilding.origin.column+currentVertexPoint.column,row:currentCityBuilding.origin.row+currentVertexPoint.row});
    return {x:currentScreenPoint.x,y:currentScreenPoint.y-currentVertexPoint.height};
  })}));
  // 외향 면의 화면 winding으로 뒷면을 제거한다. 상부 면은 항상 노출된다.
  const currentVisibleFaces=currentProjectedFaces.filter(currentProjectedFace=>currentProjectedFace.surface.top||currentProjectedFace.points.reduce((currentSignedArea,currentPointValue,currentPointIndex)=>{
    const nextPointValue=currentProjectedFace.points[(currentPointIndex+1)%currentProjectedFace.points.length];return currentSignedArea+currentPointValue.x*nextPointValue.y-nextPointValue.x*currentPointValue.y;
  },0)>0);
  currentVisibleFaces.sort((firstSurfaceFace,secondSurfaceFace)=>firstSurfaceFace.depth-secondSurfaceFace.depth);
  const currentBuildingGraphic=currentMapScene.add.graphics().setDepth(currentBuildingDepth);
  for(const currentProjectedFace of currentVisibleFaces) {
    currentBuildingGraphic.fillStyle(currentProjectedFace.surface.material==='roof'?CITY_BUILDING_STYLE.roofColors[currentCityBuilding.facilityKind]:CITY_BUILDING_STYLE.wallLight,1).fillPoints(currentProjectedFace.points,true);
    currentBuildingGraphic.lineStyle(1,CITY_BUILDING_STYLE.outlineColor,.35).strokePoints(currentProjectedFace.points,true);
  }
  const currentRoofCorners=currentVisibleFaces.flatMap(currentProjectedFace=>currentProjectedFace.points);
  const currentEntrancePoint = projectTerrainPosition(currentCityBuilding.entrance);
  const currentMarkerGraphic = currentMapScene.add.graphics().setDepth(currentAnnotationDepth);
  currentMarkerGraphic.lineStyle(currentBuildingSelected?CITY_BUILDING_STYLE.selectedWidth:CITY_BUILDING_STYLE.outlineWidth,
    currentBuildingSelected?CITY_BUILDING_STYLE.selectedColor:CITY_BUILDING_STYLE.wallLight);
  currentMarkerGraphic.strokeCircle(currentEntrancePoint.x,currentEntrancePoint.y,CITY_BUILDING_STYLE.entranceRadius);
  if(currentBuildingSelected)currentMarkerGraphic.strokePoints(currentBuildingCorners,true);
  const currentRoofCenter = {x:currentRoofCorners.reduce((currentTotalValue,currentCornerPoint)=>currentTotalValue+currentCornerPoint.x,0)/currentRoofCorners.length,
    y:currentRoofCorners.reduce((currentTotalValue,currentCornerPoint)=>currentTotalValue+currentCornerPoint.y,0)/currentRoofCorners.length};
  currentMapScene.add.text(currentRoofCenter.x,currentRoofCenter.y-CITY_BUILDING_STYLE.labelOffset,t(`city.${currentCityBuilding.facilityKind}`),
    {fontFamily:'sans-serif',fontSize:CITY_BUILDING_STYLE.labelFont,color:'#fff7de',stroke:'#39362d',strokeThickness:4})
    .setOrigin(CITY_HALF_TILE).setDepth(currentAnnotationDepth);
  const currentVisiblePoints = [...currentBuildingCorners,...currentRoofCorners];
  return {position:currentCityBuilding.origin,depth:currentBuildingDepth,
    polygons:currentVisibleFaces.map(currentFaceValue=>new Phaser.Geom.Polygon(currentFaceValue.points)),
    left:Math.min(...currentVisiblePoints.map(currentPointValue=>currentPointValue.x)),right:Math.max(...currentVisiblePoints.map(currentPointValue=>currentPointValue.x)),
    top:Math.min(...currentVisiblePoints.map(currentPointValue=>currentPointValue.y)),bottom:Math.max(...currentVisiblePoints.map(currentPointValue=>currentPointValue.y))};
}
