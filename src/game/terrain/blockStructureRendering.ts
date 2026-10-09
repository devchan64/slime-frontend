import {drawFieldElevationOutline} from '../../../packages/field-renderer/field-renderer.mjs';
import {RED_BRICK_WALL_TEXTURE,RED_BRICK_DOOR_TEXTURE,RED_BRICK_WINDOW_TEXTURE} from "./textures";
import {CITY_BUILDING_STYLE,BUILDING_BOUNDARY_ENABLED,BUILDING_ROOF_TEXTURE_ROTATION_RADIANS} from '../../../packages/field-renderer/render-constants.mjs';
export {CITY_BUILDING_STYLE} from '../../../packages/field-renderer/render-constants.mjs';
import {STONEWARM_ROOF_TEXTURE,STONEWARM_GUILD_ROOF_TEXTURE,UNIFIED_WOOD_WALL_TEXTURE,WOOD_WINDOW_WALL_TEXTURE,WOOD_DOOR_WALL_TEXTURE,WOOD_CROSSBAR_WALL_TEXTURE,UNIFIED_WOOD_ROOF_TEXTURE} from "./textures";
import {buildRenderedBlockFaces} from './blockGeometry';
import Phaser from 'phaser';
import type {CityBuilding,Position} from '../../client/types';
import {t} from '../../i18n';
import {cityBuildingCells} from './cityBuildings';
import {TERRAIN_DEPTH} from './elevation';

const CITY_HALF_TILE = 0.5;
const WALL_ENTRANCE_POSITION_TOLERANCE = 0.01;
type CityScreenPoint = {x:number;y:number};
export type CityBuildingRegion = {position:Position;depth:number;polygons:Phaser.Geom.Polygon[];left:number;right:number;top:number;bottom:number};

export function drawBlockStructure(currentMapScene:Phaser.Scene,currentCityBuilding:CityBuilding,
  projectTerrainPosition:(currentCellPosition:Position)=>CityScreenPoint,
  calculateTerrainDepth:(currentCellPosition:Position)=>number,currentAnnotationDepth:number,currentBuildingSelected:boolean):CityBuildingRegion {
  if(currentCityBuilding.blockSchemaVersion!==1)throw new Error('지원하지 않는 건물 블록 버전');
  const currentBuildingCorners = cityBuildingCells(currentCityBuilding).map(projectTerrainPosition);
  const currentBuildingDepth = Math.max(...cityBuildingCells(currentCityBuilding).map(calculateTerrainDepth))+TERRAIN_DEPTH.overlay;
  const currentSurfaceFaces=buildRenderedBlockFaces(currentCityBuilding.blocks);
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
  const usesRedBrickExterior=currentCityBuilding.id==='iseulon-guild';
  const usesUnifiedWoodWall=['iseulon-', 'reedhaven-', 'grainstead-', 'saltford-'].some(currentCityPrefix => currentCityBuilding.id.startsWith(currentCityPrefix))||['iseulon-bookshop','iseulon-inn'].includes(currentCityBuilding.id);
  const currentStoneExterior=currentCityBuilding.id.startsWith("stonewarm-");
  if (usesUnifiedWoodWall||currentStoneExterior) {
    const woodRoofBaseHeight=Math.min(...currentSurfaceFaces.filter(currentFaceRecord=>currentFaceRecord.material==='roof').flatMap(currentFaceRecord=>currentFaceRecord.vertices.map(currentVertexPoint=>currentVertexPoint.height)));
    for (const currentWallFace of currentVisibleFaces.filter(currentFaceRecord=>!currentFaceRecord.surface.top)) {
      const wallMinimumScreenX=Math.floor(Math.min(...currentWallFace.points.map(currentPointValue=>currentPointValue.x)));
      const wallMinimumScreenY=Math.floor(Math.min(...currentWallFace.points.map(currentPointValue=>currentPointValue.y)));
      const wallCanvasPixelWidth=Math.ceil(Math.max(...currentWallFace.points.map(currentPointValue=>currentPointValue.x)))-wallMinimumScreenX;
      const wallCanvasPixelHeight=Math.ceil(Math.max(...currentWallFace.points.map(currentPointValue=>currentPointValue.y)))-wallMinimumScreenY;
      const wallTextureUniqueIdentifier=Phaser.Utils.String.UUID();
      const wallCanvasTexture=currentMapScene.textures.createCanvas(wallTextureUniqueIdentifier,wallCanvasPixelWidth,wallCanvasPixelHeight);
      if(!wallCanvasTexture)throw new Error('나무 벽 캔버스 생성 실패');
      const wallDrawingContext=wallCanvasTexture.getContext();
      const wallVertexRecords=currentWallFace.surface.vertices;
      const wallColumnVaries=wallVertexRecords.some(currentVertexPoint=>currentVertexPoint.column!==wallVertexRecords[0].column);
      const wallMinimumHorizontal=Math.min(...wallVertexRecords.map(currentVertexPoint=>wallColumnVaries?currentVertexPoint.column:currentVertexPoint.row));
      const wallMaximumHorizontal=Math.max(...wallVertexRecords.map(currentVertexPoint=>wallColumnVaries?currentVertexPoint.column:currentVertexPoint.row));
      const wallMinimumHeight=Math.min(...wallVertexRecords.map(currentVertexPoint=>currentVertexPoint.height));
      const wallMaximumHeight=Math.max(...wallVertexRecords.map(currentVertexPoint=>currentVertexPoint.height));
      const wallHorizontalIndex=Math.floor(wallMinimumHorizontal+CITY_HALF_TILE);
      const entranceColumnLocal=currentCityBuilding.entrance.column-currentCityBuilding.origin.column;
      const entranceRowLocal=currentCityBuilding.entrance.row-currentCityBuilding.origin.row;
      const entranceAlongWall=wallColumnVaries?entranceColumnLocal:entranceRowLocal;
      const wallEntranceDistance=Math.abs(wallHorizontalIndex-Math.round(entranceAlongWall));
      const wallUsesWindowTexture=wallMinimumHeight<woodRoofBaseHeight&&wallEntranceDistance%2!==0;
      const entranceAcrossWall=wallColumnVaries?entranceRowLocal:entranceColumnLocal;
      const wallFixedCoordinate=wallColumnVaries?wallVertexRecords[0].row:wallVertexRecords[0].column;
      const wallUsesDoorTexture=wallMinimumHeight<WALL_ENTRANCE_POSITION_TOLERANCE
        &&Math.abs(entranceAlongWall-(wallMinimumHorizontal+wallMaximumHorizontal)/2)<WALL_ENTRANCE_POSITION_TOLERANCE
        &&Math.abs(Math.abs(entranceAcrossWall-wallFixedCoordinate)-CITY_HALF_TILE)<WALL_ENTRANCE_POSITION_TOLERANCE;
      const wallSelectedTexture=currentStoneExterior?(wallUsesDoorTexture?"stone-building-door":wallUsesWindowTexture?"stone-building-window":"stone-building-wall"):usesRedBrickExterior?(wallUsesDoorTexture?RED_BRICK_DOOR_TEXTURE:wallUsesWindowTexture?RED_BRICK_WINDOW_TEXTURE:RED_BRICK_WALL_TEXTURE):wallMinimumHeight>=woodRoofBaseHeight?WOOD_CROSSBAR_WALL_TEXTURE:wallUsesDoorTexture?WOOD_DOOR_WALL_TEXTURE:wallUsesWindowTexture?WOOD_WINDOW_WALL_TEXTURE:UNIFIED_WOOD_WALL_TEXTURE;
      const wallSourceImage=currentMapScene.textures.get(wallSelectedTexture).getSourceImage() as HTMLImageElement;
      const wallOriginPosition={column:currentCityBuilding.origin.column+(wallColumnVaries?wallMinimumHorizontal:wallVertexRecords[0].column),row:currentCityBuilding.origin.row+(wallColumnVaries?wallVertexRecords[0].row:wallMinimumHorizontal)};
      const wallOriginScreenPoint=projectTerrainPosition(wallOriginPosition);
      const wallEndScreenPoint=projectTerrainPosition({column:wallOriginPosition.column+(wallColumnVaries?wallMaximumHorizontal-wallMinimumHorizontal:0),row:wallOriginPosition.row+(wallColumnVaries?0:wallMaximumHorizontal-wallMinimumHorizontal)});
      wallDrawingContext.beginPath();
      currentWallFace.points.forEach((currentPointValue,currentPointIndex)=>{if(currentPointIndex===0)wallDrawingContext.moveTo(currentPointValue.x-wallMinimumScreenX,currentPointValue.y-wallMinimumScreenY);else wallDrawingContext.lineTo(currentPointValue.x-wallMinimumScreenX,currentPointValue.y-wallMinimumScreenY);});
      wallDrawingContext.closePath();
      wallDrawingContext.clip();
      wallDrawingContext.transform((wallEndScreenPoint.x-wallOriginScreenPoint.x)/wallSourceImage.width,(wallEndScreenPoint.y-wallOriginScreenPoint.y)/wallSourceImage.width,0,(wallMaximumHeight-wallMinimumHeight)/wallSourceImage.height,wallOriginScreenPoint.x-wallMinimumScreenX,wallOriginScreenPoint.y-wallMaximumHeight-wallMinimumScreenY);
      wallDrawingContext.drawImage(wallSourceImage,0,0);
      wallCanvasTexture.refresh();
      currentMapScene.add.image(wallMinimumScreenX,wallMinimumScreenY,wallTextureUniqueIdentifier).setOrigin(0).setDepth(currentBuildingDepth+0.01).once('destroy',()=>currentMapScene.textures.remove(wallTextureUniqueIdentifier));
    }
  }
  if (usesUnifiedWoodWall||currentCityBuilding.id.startsWith('stonewarm-')) {
    const roofSurfaceFaces=currentVisibleFaces.filter(currentFaceRecord=>currentFaceRecord.surface.material==='roof'&&currentFaceRecord.surface.top);
    if (roofSurfaceFaces.length) {
      const roofCornerPoints=roofSurfaceFaces.flatMap(currentFaceRecord=>currentFaceRecord.points);
      const roofMinimumX=Math.floor(Math.min(...roofCornerPoints.map(currentPointValue=>currentPointValue.x)));
      const roofMinimumY=Math.floor(Math.min(...roofCornerPoints.map(currentPointValue=>currentPointValue.y)));
      const roofCanvasWidth=Math.ceil(Math.max(...roofCornerPoints.map(currentPointValue=>currentPointValue.x)))-roofMinimumX;
      const roofCanvasHeight=Math.ceil(Math.max(...roofCornerPoints.map(currentPointValue=>currentPointValue.y)))-roofMinimumY;
      const roofTextureIdentifier=Phaser.Utils.String.UUID();
      const roofCanvasTexture=currentMapScene.textures.createCanvas(roofTextureIdentifier,roofCanvasWidth,roofCanvasHeight);
      if (!roofCanvasTexture) throw new Error('지붕 캔버스 생성 실패');
      const roofDrawingContext=roofCanvasTexture.getContext();
      const selectedRoofTextureIdentifier=usesRedBrickExterior?STONEWARM_GUILD_ROOF_TEXTURE:usesUnifiedWoodWall?UNIFIED_WOOD_ROOF_TEXTURE:currentCityBuilding.facilityKind==='guild'?STONEWARM_GUILD_ROOF_TEXTURE:STONEWARM_ROOF_TEXTURE;
      const roofSourceImage=currentMapScene.textures.get(selectedRoofTextureIdentifier).getSourceImage() as HTMLImageElement;
      for (const roofFaceRecord of roofSurfaceFaces) {
        const roofFacePoints=roofFaceRecord.points;
        if (roofFacePoints.length!==4) throw new Error('지붕 면은 사각형이어야 합니다.');
        roofDrawingContext.save();
        roofDrawingContext.beginPath();
        roofFacePoints.forEach((roofPointValue,roofPointIndex)=>{
          if (roofPointIndex===0) roofDrawingContext.moveTo(roofPointValue.x-roofMinimumX,roofPointValue.y-roofMinimumY);
          else roofDrawingContext.lineTo(roofPointValue.x-roofMinimumX,roofPointValue.y-roofMinimumY);
        });
        roofDrawingContext.closePath();
        roofDrawingContext.clip();
        roofDrawingContext.transform((roofFacePoints[1].x-roofFacePoints[0].x)/roofSourceImage.width,
          (roofFacePoints[1].y-roofFacePoints[0].y)/roofSourceImage.width,
          (roofFacePoints[3].x-roofFacePoints[0].x)/roofSourceImage.height,
          (roofFacePoints[3].y-roofFacePoints[0].y)/roofSourceImage.height,
          roofFacePoints[0].x-roofMinimumX,roofFacePoints[0].y-roofMinimumY);
        roofDrawingContext.translate(roofSourceImage.width/2,roofSourceImage.height/2);
        roofDrawingContext.scale(roofSourceImage.width,roofSourceImage.height);
        roofDrawingContext.rotate(BUILDING_ROOF_TEXTURE_ROTATION_RADIANS);
        roofDrawingContext.drawImage(roofSourceImage,-0.5,-0.5,1,1);
        roofDrawingContext.restore();
      }
      roofCanvasTexture.refresh();
      currentMapScene.add.image(roofMinimumX,roofMinimumY,roofTextureIdentifier).setOrigin(0).setDepth(currentBuildingDepth+0.01)
        .once('destroy',()=>currentMapScene.textures.remove(roofTextureIdentifier));
    }
  }
  if(BUILDING_BOUNDARY_ENABLED){
    const currentBoundaryEdges=new Map<string,{points:CityScreenPoint[];normals:string[]}>();
    const currentAllVertices=currentVisibleFaces.flatMap(currentFaceRecord=>currentFaceRecord.surface.vertices);
    const currentEdgeTolerance=0.000001;
    for(const currentFaceRecord of currentVisibleFaces){
      const currentVertexRecords=currentFaceRecord.surface.vertices;
      // Newell 법선은 삼각 면의 중복 꼭짓점과 일직선 꼭짓점을 허용한다.
      const currentNormalVector=[0,0,0];
      for(let currentVertexIndex=0;currentVertexIndex<currentVertexRecords.length;currentVertexIndex++){
        const currentStartVertex=currentVertexRecords[currentVertexIndex],currentEndVertex=currentVertexRecords[(currentVertexIndex+1)%currentVertexRecords.length];
        currentNormalVector[0]+=(currentStartVertex.row-currentEndVertex.row)*(currentStartVertex.height+currentEndVertex.height);
        currentNormalVector[1]+=(currentStartVertex.height-currentEndVertex.height)*(currentStartVertex.column+currentEndVertex.column);
        currentNormalVector[2]+=(currentStartVertex.column-currentEndVertex.column)*(currentStartVertex.row+currentEndVertex.row);
      }
      const currentNormalLength=Math.hypot(...currentNormalVector);
      if(currentNormalLength<currentEdgeTolerance)continue;
      const currentNormalKey=currentNormalVector.map(currentAxisValue=>Math.round(currentAxisValue/currentNormalLength/currentEdgeTolerance)).join(',');
      for(let currentVertexIndex=0;currentVertexIndex<currentVertexRecords.length;currentVertexIndex++){
        const currentNextIndex=(currentVertexIndex+1)%currentVertexRecords.length;
        const currentStartVertex=currentVertexRecords[currentVertexIndex],currentEndVertex=currentVertexRecords[currentNextIndex];
        const currentStartCoordinates=[currentStartVertex.column,currentStartVertex.row,currentStartVertex.height];
        const currentEdgeVector=[currentEndVertex.column-currentStartVertex.column,currentEndVertex.row-currentStartVertex.row,currentEndVertex.height-currentStartVertex.height];
        const currentLengthSquared=currentEdgeVector.reduce((currentTotalValue,currentAxisValue)=>currentTotalValue+currentAxisValue*currentAxisValue,0);
        if(currentLengthSquared<currentEdgeTolerance*currentEdgeTolerance)continue;
        const currentSplitRatios=[0,1];
        for(const currentCandidateVertex of currentAllVertices){
          const currentOffsetVector=[currentCandidateVertex.column-currentStartVertex.column,currentCandidateVertex.row-currentStartVertex.row,currentCandidateVertex.height-currentStartVertex.height];
          const currentProjectionRatio=currentOffsetVector.reduce((currentTotalValue,currentAxisValue,currentAxisIndex)=>currentTotalValue+currentAxisValue*currentEdgeVector[currentAxisIndex],0)/currentLengthSquared;
          if(currentProjectionRatio<=currentEdgeTolerance||currentProjectionRatio>=1-currentEdgeTolerance)continue;
          if(currentOffsetVector.every((currentAxisValue,currentAxisIndex)=>Math.abs(currentAxisValue-currentProjectionRatio*currentEdgeVector[currentAxisIndex])<currentEdgeTolerance))currentSplitRatios.push(currentProjectionRatio);
        }
        currentSplitRatios.sort((firstSplitRatio,secondSplitRatio)=>firstSplitRatio-secondSplitRatio);
        for(let currentSplitIndex=1;currentSplitIndex<currentSplitRatios.length;currentSplitIndex++){
          const currentSegmentRatios=[currentSplitRatios[currentSplitIndex-1],currentSplitRatios[currentSplitIndex]];
          if(currentSegmentRatios[1]-currentSegmentRatios[0]<currentEdgeTolerance)continue;
          const currentEdgeKey=currentSegmentRatios.map(currentSplitRatio=>currentStartCoordinates.map((currentAxisValue,currentAxisIndex)=>Math.round((currentAxisValue+currentSplitRatio*currentEdgeVector[currentAxisIndex])/currentEdgeTolerance)).join(',')).sort().join('|');
          const currentEdgeRecord=currentBoundaryEdges.get(currentEdgeKey);
          if(currentEdgeRecord)currentEdgeRecord.normals.push(currentNormalKey);
          else {
            const currentStartPoint=currentFaceRecord.points[currentVertexIndex],currentEndPoint=currentFaceRecord.points[currentNextIndex];
            currentBoundaryEdges.set(currentEdgeKey,{points:currentSegmentRatios.map(currentSplitRatio=>({x:currentStartPoint.x+(currentEndPoint.x-currentStartPoint.x)*currentSplitRatio,y:currentStartPoint.y+(currentEndPoint.y-currentStartPoint.y)*currentSplitRatio})),normals:[currentNormalKey]});
          }
        }
      }
    }
    const currentOutlineSegments=[...currentBoundaryEdges.values()].filter(currentEdgeRecord=>currentEdgeRecord.normals.length===1||new Set(currentEdgeRecord.normals).size>1).map(currentEdgeRecord=>currentEdgeRecord.points);
    drawFieldElevationOutline(currentMapScene,currentOutlineSegments,currentBuildingDepth+.02);
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
