export {sampleTerrainEffectFrame,mountTerrainEffectLayer} from './terrain-effects.mjs';
import {enumerateBridgeCells} from '../field-surface/terrain-bridges.mjs';
import {buildBridgeCellGeometry} from './bridge-geometry.mjs';
import {readGroundSurfaceHeight} from '../field-surface/field-surface.mjs';
export {findBridgeSurface,canTraverseBridgeEdge,validateBridgeSurfaces,prepareBridgeTraversalSurface} from '../field-surface/terrain-bridges.mjs';
export {resolveGuardDisplayPlacement,projectGuardDisplayCenter,GUARD_CENTER_FOOTPRINT_SIZE} from './guard-placement.mjs';
import {TERRAIN_DEPTH,TERRAIN_MATERIAL_BOUNDARY_ENABLED,resolveMapRenderOptions,BILLBOARD_RENDER_SCALE} from './render-constants.mjs';
import {FIELD_TILE_BOUNDARY_ALPHA,FIELD_ELEVATION_EDGE_STYLE,FIELD_GROUND_EDGE_STYLE,FIELD_MESH_BOUNDARY_STYLE,FIELD_ACTOR_CONTACT_SHADOW_PROFILES,FIELD_ACTOR_CONTACT_SHADOW_COLOR,FIELD_SAFE_TOWER_PROFILE,FIELD_SAFE_AURA_PROFILE,FIELD_CONNECTION_SHAPE} from './render-constants.mjs';
export {FIELD_TILE_BOUNDARY_ALPHA,FIELD_ELEVATION_EDGE_STYLE,FIELD_GROUND_EDGE_STYLE,FIELD_MESH_BOUNDARY_STYLE,FIELD_ACTOR_CONTACT_SHADOW_PROFILES,FIELD_ACTOR_CONTACT_SHADOW_COLOR,FIELD_SAFE_TOWER_PROFILE,FIELD_SAFE_AURA_PROFILE,FIELD_CONNECTION_SHAPE} from './render-constants.mjs';
import {FIELD_RENDER_METRICS,projectSurfaceCell,projectSurfaceVertex,rotateSurfacePosition,containsSurfacePoint,readSurfaceHeight,findSurfaceStair,buildSurfaceCliffs,buildSurfaceStairs,resolveCliffTextureScale} from '../field-surface/field-surface.mjs';

/** 게임과 검수가 동일하게 실행하는 Phaser 렌더러. URL·로그인·서비스 상태를 소유하지 않는다. */
export const FIELD_RENDERER_VERSION = '1.0.180';
export {resolveMapRenderOptions} from './render-constants.mjs';
/** 필드 종류와 액터 종류가 달라도 공유하는 접지 그림자 검수 계약이다. */
const FIELD_EDGE_COORDINATE_EPSILON=.000001;
const FIELD_QUAD_TRIANGLES = [0,1,2,0,2,3];
const FIELD_CELL_CORNERS = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
const FIELD_BOUNDARY_NEIGHBORS = [{column:1,row:0,edge:[1,2]},{column:0,row:1,edge:[2,3]},{column:-1,row:0,edge:[3,0]},{column:0,row:-1,edge:[0,1]}];

/** 캐릭터·몬스터 공통 그림자를 그리며 검수 화면도 게임과 동일한 계약을 사용한다. */
export function resolveFieldActorContactShadow(currentShadowProfileName='contrast'){
 const currentShadowProfile=FIELD_ACTOR_CONTACT_SHADOW_PROFILES[currentShadowProfileName];
 if(!currentShadowProfile)throw Error('지원하지 않는 접지 그림자 프로필: '+currentShadowProfileName);
 const currentShadowWidth=FIELD_RENDER_METRICS.tileWidth*currentShadowProfile.width*currentShadowProfile.scale;
 const currentShadowHeight=FIELD_RENDER_METRICS.tileHeight*currentShadowProfile.height*currentShadowProfile.scale;
 return {color:FIELD_ACTOR_CONTACT_SHADOW_COLOR,outer:{width:currentShadowWidth,height:currentShadowHeight,alpha:currentShadowProfile.alpha*currentShadowProfile.opacityScale},core:{width:currentShadowWidth*currentShadowProfile.coreScale,height:currentShadowHeight*currentShadowProfile.coreScale,alpha:currentShadowProfile.coreAlpha*currentShadowProfile.opacityScale}};
}

export function drawFieldActorContactShadow(currentShadowGraphics,currentScreenPosition,currentShadowProfileName='contrast'){
 const currentShadowMetrics=resolveFieldActorContactShadow(currentShadowProfileName);
 currentShadowGraphics.fillStyle(currentShadowMetrics.color,currentShadowMetrics.outer.alpha);
 currentShadowGraphics.fillEllipse(currentScreenPosition.x,currentScreenPosition.y,currentShadowMetrics.outer.width,currentShadowMetrics.outer.height);
 currentShadowGraphics.fillStyle(currentShadowMetrics.color,currentShadowMetrics.core.alpha);
 currentShadowGraphics.fillEllipse(currentScreenPosition.x,currentScreenPosition.y,currentShadowMetrics.core.width,currentShadowMetrics.core.height);
 return currentShadowMetrics;
}

/** 높이는 투영에만 적용한다. 겹침 순서는 지면 좌표를 사용해 높은 벽이 뒤로 밀리지 않게 한다. */
export function resolveFieldSurfaceDepth(currentCellPosition,currentMapSurface,currentRenderOptions=FIELD_RENDER_METRICS){
 if(!Number.isFinite(currentCellPosition.column)||!Number.isFinite(currentCellPosition.row))throw Error('필드 깊이 계산의 접지 좌표가 유효하지 않습니다.');
 // 교량 내부의 지형·상판·캐릭터는 같은 기준 깊이를 공유한다.
 const currentBridgeRecord=currentMapSurface.bridges?.find(currentBridgeCandidate=>enumerateBridgeCells(currentBridgeCandidate).slice(1,-1).some(currentBridgeCell=>currentBridgeCell.column===currentCellPosition.column&&currentBridgeCell.row===currentCellPosition.row));
 const currentDepthPositions=currentBridgeRecord?enumerateBridgeCells(currentBridgeRecord).slice(1,-1):[currentCellPosition];
 const currentRotatedPosition=currentDepthPositions.map(currentDepthPosition=>rotateSurfacePosition(currentDepthPosition,currentRenderOptions.rotation??0)).reduce((currentFrontPosition,currentNextPosition)=>currentNextPosition.column+currentNextPosition.row>currentFrontPosition.column+currentFrontPosition.row?currentNextPosition:currentFrontPosition);
 return TERRAIN_DEPTH.base+(currentRotatedPosition.column+currentRotatedPosition.row)*TERRAIN_DEPTH.stride;
}

/** 도로·수면 연결 마스크도 양쪽 클라이언트가 동일하게 합성한다. */
export function buildFieldCellGeometry(currentCellPosition,currentMapSurface,currentRenderOptions=FIELD_RENDER_METRICS){
 const currentStairRecord=findSurfaceStair(currentCellPosition,currentMapSurface);
 if(currentStairRecord)return buildSurfaceStairs(currentStairRecord,currentMapSurface,currentRenderOptions).map(currentFaceRecord=>({...currentFaceRecord,kind:currentFaceRecord.top?'tread':'cliff'}));
 const currentScreenCenter=projectSurfaceVertex({...currentCellPosition,height:readGroundSurfaceHeight(currentCellPosition,currentMapSurface)*currentRenderOptions.elevationHeight},currentRenderOptions);
 const currentGroundPoints=FIELD_CELL_CORNERS.map(([currentColumnOffset,currentRowOffset])=>({x:currentScreenCenter.x+(currentColumnOffset-currentRowOffset)*currentRenderOptions.tileWidth/2,y:currentScreenCenter.y+(currentColumnOffset+currentRowOffset)*currentRenderOptions.tileHeight/2}));
 return [...buildSurfaceCliffs(currentCellPosition,currentMapSurface,currentRenderOptions).map(currentFacePoints=>({points:currentFacePoints,top:false,kind:'cliff'})),{points:currentGroundPoints,top:true,kind:'ground'},...buildBridgeCellGeometry(currentCellPosition,currentMapSurface,currentRenderOptions)];
}

/** Phaser 메시의 Y축은 위쪽이다. 화면 좌표를 이 경계에서 한 번만 반전한다. */
export function buildFieldPanelVertices(currentPanelPoints){
 if(currentPanelPoints.length!==4||currentPanelPoints.some(currentPointValue=>!Number.isFinite(currentPointValue.x)||!Number.isFinite(currentPointValue.y)))throw Error('필드 패널은 유효한 꼭짓점 4개여야 합니다.');
 const currentPanelCenter={x:currentPanelPoints.reduce((currentPointSum,currentPointValue)=>currentPointSum+currentPointValue.x,0)/4,y:currentPanelPoints.reduce((currentPointSum,currentPointValue)=>currentPointSum+currentPointValue.y,0)/4};
 return {center:currentPanelCenter,vertices:FIELD_QUAD_TRIANGLES.flatMap(currentPointIndex=>[currentPanelPoints[currentPointIndex].x-currentPanelCenter.x,currentPanelCenter.y-currentPanelPoints[currentPointIndex].y])};
}

export function drawFieldMeshBoundary(currentGameScene,currentPanelPoints,currentRenderDepth){
 const currentMeshGraphic=currentGameScene.add.graphics().setDepth(currentRenderDepth);
 currentMeshGraphic.lineStyle(FIELD_MESH_BOUNDARY_STYLE.width,FIELD_MESH_BOUNDARY_STYLE.color,FIELD_MESH_BOUNDARY_STYLE.alpha);
 currentMeshGraphic.strokePoints(currentPanelPoints,true);
 currentMeshGraphic.lineBetween(currentPanelPoints[0].x,currentPanelPoints[0].y,currentPanelPoints[2].x,currentPanelPoints[2].y);
 return currentMeshGraphic;
}

export function drawFieldTexturePanel(currentGameScene,currentPanelPoints,currentTextureKey,currentRenderDepth,currentUvCorners=[0,0,1,0,1,1,0,1]){
 if(!currentGameScene.textures.exists(currentTextureKey))throw Error('필드 텍스처 누락: '+currentTextureKey);
 const currentPanelGeometry=buildFieldPanelVertices(currentPanelPoints);
 const currentPanelUvs=FIELD_QUAD_TRIANGLES.flatMap(currentPointIndex=>currentUvCorners.slice(currentPointIndex*2,currentPointIndex*2+2));
 const currentPanelMesh=currentGameScene.add.mesh(currentPanelGeometry.center.x,currentPanelGeometry.center.y,currentTextureKey,undefined,currentPanelGeometry.vertices,currentPanelUvs);
 currentPanelMesh.hideCCW=false;
 currentPanelMesh.ignoreDirtyCache=true;
 currentPanelMesh.setOrtho(currentPanelMesh.width,currentPanelMesh.height);
 currentPanelMesh.setDepth(currentRenderDepth);
 return currentPanelMesh;
}

/** 높은 평면의 단차 모서리만 반환한다. 같은 높이의 평면 이음새는 제외하고 계단 접합부는 포함한다. 계단 자체는 각 디딤면에서 그린다. */
export function buildFieldElevationEdges(currentCellPosition,currentMapSurface,currentRenderOptions=FIELD_RENDER_METRICS){
 if(findSurfaceStair(currentCellPosition,currentMapSurface))return [];
 const currentCellHeight=readSurfaceHeight(currentCellPosition,currentMapSurface);
 const currentCornerPoints=FIELD_CELL_CORNERS.map(([currentColumnOffset,currentRowOffset])=>projectSurfaceVertex({column:currentCellPosition.column+currentColumnOffset,row:currentCellPosition.row+currentRowOffset,height:currentCellHeight*currentRenderOptions.elevationHeight},currentRenderOptions));
 return FIELD_BOUNDARY_NEIGHBORS.flatMap(currentNeighborOffset=>{
  const currentNeighborCell={column:currentCellPosition.column+currentNeighborOffset.column,row:currentCellPosition.row+currentNeighborOffset.row};
  if(currentNeighborCell.column<0||currentNeighborCell.row<0||currentNeighborCell.column>=currentMapSurface.columns||currentNeighborCell.row>=currentMapSurface.rows
    ||(readSurfaceHeight(currentNeighborCell,currentMapSurface)>currentCellHeight||(readSurfaceHeight(currentNeighborCell,currentMapSurface)===currentCellHeight&&!findSurfaceStair(currentNeighborCell,currentMapSurface))))return [];
  return [currentNeighborOffset.edge.map(currentCornerIndex=>currentCornerPoints[currentCornerIndex])];
 });
}

/** 같은 높이에서 바닥 재질이 바뀌는 이음새를 뒤쪽 셀당 한 번만 반환한다. 도로·단차는 전용 경계를 유지한다. */
export function resolveFieldGroundMaterial(currentCellPosition,currentGroundOverrides,resolveDefaultMaterial){
 const currentOverrideRecord=currentGroundOverrides.find(currentGroundRecord=>currentGroundRecord.position.column===currentCellPosition.column&&currentGroundRecord.position.row===currentCellPosition.row);
 return currentOverrideRecord?.textureKey??resolveDefaultMaterial(currentCellPosition);
}

export function buildFieldMaterialEdges(currentCellPosition,currentMapSurface,resolveGroundMaterial,currentRenderOptions=FIELD_RENDER_METRICS){
 if(findSurfaceStair(currentCellPosition,currentMapSurface))return [];
 const currentMaterialName=resolveGroundMaterial(currentCellPosition);
 const currentCellHeight=readSurfaceHeight(currentCellPosition,currentMapSurface);
 const currentCornerPoints=FIELD_CELL_CORNERS.map(([currentColumnOffset,currentRowOffset])=>projectSurfaceVertex({column:currentCellPosition.column+currentColumnOffset,row:currentCellPosition.row+currentRowOffset,height:currentCellHeight*currentRenderOptions.elevationHeight},currentRenderOptions));
 return FIELD_BOUNDARY_NEIGHBORS.filter(currentNeighborOffset=>currentNeighborOffset.column<0||currentNeighborOffset.row<0).flatMap(currentNeighborOffset=>{
  const currentNeighborCell={column:currentCellPosition.column+currentNeighborOffset.column,row:currentCellPosition.row+currentNeighborOffset.row};
  if(currentNeighborCell.column<0||currentNeighborCell.row<0||findSurfaceStair(currentNeighborCell,currentMapSurface)||readSurfaceHeight(currentNeighborCell,currentMapSurface)!==currentCellHeight)return [];
  const currentNeighborMaterial=resolveGroundMaterial(currentNeighborCell);
  if(currentNeighborMaterial===currentMaterialName)return [];
  return [currentNeighborOffset.edge.map(currentCornerIndex=>currentCornerPoints[currentCornerIndex])];
 });
}

/** 연결 마스크의 둥근 도로 외곽만 투영한다. 연결된 타일 끝에는 선을 만들지 않는다. */
export function buildFieldRoadEdges(currentCellPosition,currentMapSurface,currentConnectionMask,currentRenderOptions=FIELD_RENDER_METRICS,currentFullTileRoad=false){
 const currentCellCenter=projectSurfaceCell(currentCellPosition,currentMapSurface,currentRenderOptions);
 const currentInsetValue=currentFullTileRoad?0:FIELD_CONNECTION_SHAPE.inset,currentCornerRadius=currentFullTileRoad?0:FIELD_CONNECTION_SHAPE.radius;
 const currentCurveSteps=8;
 const currentRoadSegments=[];
 for(let currentCornerIndex=0;currentCornerIndex<4;currentCornerIndex++){
  const currentFirstConnected=Boolean(currentConnectionMask&(1<<currentCornerIndex));
  const currentSecondConnected=Boolean(currentConnectionMask&(1<<((currentCornerIndex+1)%4)));
  if(currentFirstConnected&&currentSecondConnected)continue;
  let currentCornerPoints;
  if(currentFirstConnected)currentCornerPoints=[[1-currentInsetValue,0],[1-currentInsetValue,.5]];
  else if(currentSecondConnected)currentCornerPoints=[[.5,currentInsetValue],[1,currentInsetValue]];
  else{
   currentCornerPoints=[[.5,currentInsetValue]];
   for(let currentCurveIndex=0;currentCurveIndex<=currentCurveSteps;currentCurveIndex++){
    const currentCurveAngle=-Math.PI/2+Math.PI/2*currentCurveIndex/currentCurveSteps;
    currentCornerPoints.push([1-currentInsetValue-currentCornerRadius+Math.cos(currentCurveAngle)*currentCornerRadius,currentInsetValue+currentCornerRadius+Math.sin(currentCurveAngle)*currentCornerRadius]);
   }
   currentCornerPoints.push([1-currentInsetValue,.5]);
  }
  const currentProjectedPoints=currentCornerPoints.map(currentCornerPoint=>{
   let [currentTextureColumn,currentTextureRow]=currentCornerPoint;
   for(let currentRotationIndex=0;currentRotationIndex<currentCornerIndex;currentRotationIndex++)[currentTextureColumn,currentTextureRow]=[1-currentTextureRow,currentTextureColumn];
   return {x:currentCellCenter.x+(currentTextureColumn-currentTextureRow)*currentRenderOptions.tileWidth/2,y:currentCellCenter.y+(currentTextureColumn+currentTextureRow-1)*currentRenderOptions.tileHeight/2};
  });
  for(let currentPointIndex=1;currentPointIndex<currentProjectedPoints.length;currentPointIndex++)currentRoadSegments.push([currentProjectedPoints[currentPointIndex-1],currentProjectedPoints[currentPointIndex]]);
 }
 return currentRoadSegments;
}

/** 화면 CSS 픽셀 기준 두께를 유지하며 배율 변경 때만 선을 다시 그린다. */
export function drawFieldElevationOutline(currentGameScene,currentEdgeSegments,currentRenderDepth,currentOutlineStyle=FIELD_ELEVATION_EDGE_STYLE){
 const currentEdgeGraphic=currentGameScene.add.graphics().setDepth(currentRenderDepth);
 let previousStrokeWidth=null;
 const synchronizeElevationWidth=()=>{
  const currentStrokeWidth=currentOutlineStyle.width*currentGameScene.scale.displayScale.x/currentGameScene.cameras.main.zoom;
  if(currentStrokeWidth===previousStrokeWidth)return;
  previousStrokeWidth=currentStrokeWidth;
  currentEdgeGraphic.clear();
  currentEdgeGraphic.lineStyle(currentStrokeWidth,currentOutlineStyle.color,currentOutlineStyle.alpha);
  for(const [currentStartPoint,currentEndPoint] of currentEdgeSegments)currentEdgeGraphic.lineBetween(currentStartPoint.x,currentStartPoint.y,currentEndPoint.x,currentEndPoint.y);
 };
 synchronizeElevationWidth();
 currentGameScene.events.on('postupdate',synchronizeElevationWidth);
 currentEdgeGraphic.once('destroy',()=>currentGameScene.events.off('postupdate',synchronizeElevationWidth));
 return currentEdgeGraphic;
}

/** 이어지는 측벽의 세로 이음선은 제외하고 계단 접합부와 끝 모서리는 유지한다. */
export function buildFieldCliffEdges(currentCellPosition,currentMapSurface,currentFacePoints,currentRenderOptions=FIELD_RENDER_METRICS){
 const currentEdgeSegments=currentFacePoints.map((currentStartPoint,currentPointIndex)=>[currentStartPoint,currentFacePoints[(currentPointIndex+1)%4]]);
 if(findSurfaceStair(currentCellPosition,currentMapSurface))return currentEdgeSegments;
 const currentTopVector={x:currentFacePoints[1].x-currentFacePoints[0].x,y:currentFacePoints[1].y-currentFacePoints[0].y};
 const currentNeighborFaces=FIELD_BOUNDARY_NEIGHBORS.flatMap(currentNeighborOffset=>{
  const currentNeighborCell={column:currentCellPosition.column+currentNeighborOffset.column,row:currentCellPosition.row+currentNeighborOffset.row};
  if(currentNeighborCell.column<0||currentNeighborCell.row<0||currentNeighborCell.column>=currentMapSurface.columns||currentNeighborCell.row>=currentMapSurface.rows||findSurfaceStair(currentNeighborCell,currentMapSurface))return [];
  return buildSurfaceCliffs(currentNeighborCell,currentMapSurface,currentRenderOptions);
 });
 return currentEdgeSegments.flatMap(([currentStartPoint,currentEndPoint],currentEdgeIndex)=>{
  if(currentEdgeIndex%2===0)return [[currentStartPoint,currentEndPoint]];
  let currentVisibleRanges=[[Math.min(currentStartPoint.y,currentEndPoint.y),Math.max(currentStartPoint.y,currentEndPoint.y)]];
  for(const currentNeighborPoints of currentNeighborFaces){
   const currentNeighborVector={x:currentNeighborPoints[1].x-currentNeighborPoints[0].x,y:currentNeighborPoints[1].y-currentNeighborPoints[0].y};
   if(Math.abs(currentTopVector.x*currentNeighborVector.y-currentTopVector.y*currentNeighborVector.x)>FIELD_EDGE_COORDINATE_EPSILON)continue;
   for(const currentNeighborIndex of [1,3]){
    const currentNeighborStart=currentNeighborPoints[currentNeighborIndex],currentNeighborEnd=currentNeighborPoints[(currentNeighborIndex+1)%4];
    if(Math.abs(currentNeighborStart.x-currentStartPoint.x)>FIELD_EDGE_COORDINATE_EPSILON)continue;
    const currentRangeLower=Math.min(currentNeighborStart.y,currentNeighborEnd.y),currentRangeUpper=Math.max(currentNeighborStart.y,currentNeighborEnd.y);
    currentVisibleRanges=currentVisibleRanges.flatMap(([currentLowerValue,currentUpperValue])=>{
     if(currentRangeUpper<=currentLowerValue||currentRangeLower>=currentUpperValue)return [[currentLowerValue,currentUpperValue]];
     return [[currentLowerValue,Math.min(currentUpperValue,currentRangeLower)],[Math.max(currentLowerValue,currentRangeUpper),currentUpperValue]].filter(([currentFromValue,currentToValue])=>currentToValue-currentFromValue>FIELD_EDGE_COORDINATE_EPSILON);
    });
   }
  }
  return currentVisibleRanges.map(([currentLowerValue,currentUpperValue])=>[{x:currentStartPoint.x,y:currentLowerValue},{x:currentStartPoint.x,y:currentUpperValue}]);
 });
}

/** 같은 높이의 겹치는 바닥만 빌보드 뒤로 보낸다. 절벽과 높은 지형은 기존 정렬을 유지한다. */
export function resolveBillboardGroundDepth(currentCellPosition,currentMapSurface,currentRenderOptions,currentRenderDepth,currentBillboardRecords=currentMapSurface.objects??[]){
 const currentCellCenter=projectSurfaceCell(currentCellPosition,currentMapSurface,currentRenderOptions);
 const currentCellHeight=readSurfaceHeight(currentCellPosition,currentMapSurface);
 // 고도 지형은 바닥과 벽면의 정렬을 분리하면 이웃 벽이 윗면을 덮는다.
 if(currentCellHeight>0)return currentRenderDepth;
 let currentGroundDepth=currentRenderDepth;
 for(const currentObjectRecord of currentBillboardRecords){
  if(!['billboard','decoration'].includes(currentObjectRecord.kind)||readSurfaceHeight(currentObjectRecord.position,currentMapSurface)!==currentCellHeight)continue;
  const currentObjectCenter=projectSurfaceCell(currentObjectRecord.position,currentMapSurface,currentRenderOptions);
  const currentObjectPlacement=resolveFieldSceneryPlacement(currentObjectRecord,currentObjectCenter,currentRenderOptions);
  const currentSpriteSize=currentObjectRecord.displayHeight*(currentRenderOptions.billboardScale??BILLBOARD_RENDER_SCALE);
  const currentSpriteLeft=currentObjectPlacement.screen.x-currentSpriteSize*(['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)?.5:currentObjectRecord.anchorX);
  const currentSpriteTop=currentObjectPlacement.screen.y-currentSpriteSize*(['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)?1:currentObjectRecord.anchorY);
  if(currentSpriteLeft>currentCellCenter.x+currentRenderOptions.tileWidth/2||currentSpriteLeft+currentSpriteSize<currentCellCenter.x-currentRenderOptions.tileWidth/2||currentSpriteTop>currentCellCenter.y+currentRenderOptions.tileHeight/2||currentSpriteTop+currentSpriteSize<currentCellCenter.y-currentRenderOptions.tileHeight/2)continue;
  const currentObjectDepth=resolveFieldSceneryDepth(currentObjectRecord,currentMapSurface,currentRenderOptions);
  currentGroundDepth=Math.min(currentGroundDepth,currentObjectDepth-1);
 }
 return currentGroundDepth;
}

/** 측벽 폭과 원본 종횡비로 무늬 크기를 고정하고, 남는 높이는 압축 대신 잘라 표시한다. */
export function buildFieldCliffTextureLayers(currentFacePoints,currentSourceWidth,currentSourceHeight){
 const [currentFirstPoint,currentSecondPoint,currentBottomPoint]=currentFacePoints;
 const currentWallWidth=Math.abs(currentSecondPoint.x-currentFirstPoint.x);
 const currentWallHeight=currentBottomPoint.y-currentSecondPoint.y;
 const currentRepeatHeight=currentWallWidth*currentSourceHeight/currentSourceWidth;
 if(!Number.isFinite(currentRepeatHeight)||currentRepeatHeight<=0||!Number.isFinite(currentWallHeight)||currentWallHeight<=0)throw Error('측벽 텍스처 크기 또는 면 높이가 올바르지 않습니다.');
 const currentWallLayers=[];
 for(let currentLayerOffset=0;currentLayerOffset<currentWallHeight;currentLayerOffset+=currentRepeatHeight){
  const currentLayerHeight=Math.min(currentRepeatHeight,currentWallHeight-currentLayerOffset);
  const currentLayerRatio=currentLayerHeight/currentRepeatHeight;
  currentWallLayers.push({points:[
   {x:currentFirstPoint.x,y:currentFirstPoint.y+currentLayerOffset},
   {x:currentSecondPoint.x,y:currentSecondPoint.y+currentLayerOffset},
   {x:currentSecondPoint.x,y:currentSecondPoint.y+currentLayerOffset+currentLayerHeight},
   {x:currentFirstPoint.x,y:currentFirstPoint.y+currentLayerOffset+currentLayerHeight}
  ],uvCorners:[0,0,1,0,1,currentLayerRatio,0,currentLayerRatio]});
 }
 return currentWallLayers;
}

/** 지형·정적 식생에 생성 시 적용한다. 광원·추가 패스·프레임 이벤트는 생성하지 않는다. */
export function resolveTerrainAmbientTint(currentMapSurface){
 const currentAmbientColor=currentMapSurface?.ambientTint;
 if(currentAmbientColor===undefined)return 0xffffff;
 if(typeof currentAmbientColor!=='string'||!/^#[0-9a-fA-F]{6}$/.test(currentAmbientColor))throw Error('ambientTint는 #RRGGBB 색상이어야 합니다.');
 return Number.parseInt(currentAmbientColor.slice(1),16);
}
export function applyTerrainAmbientTint(currentRenderObject,currentMapSurface){
 const currentAmbientTint=resolveTerrainAmbientTint(currentMapSurface);
 currentRenderObject.setData?.('terrainAmbientTint',currentAmbientTint);
 if(currentAmbientTint===0xffffff)return currentRenderObject;
 if(currentRenderObject.type==='Mesh'){
  for(const currentMeshVertex of currentRenderObject.vertices)currentMeshVertex.color=currentAmbientTint;
 }else if(currentRenderObject.setTint){currentRenderObject.setTint(currentAmbientTint);}
 return currentRenderObject;
}

export function drawFieldCellObjects(currentGameScene,currentCellPosition,currentMapSurface,currentRenderOptions,currentTextureKeys,currentRenderDepth,currentShowMesh=false,currentBillboardRecords=currentMapSurface.objects??[]){
 const currentGroundDepth=resolveBillboardGroundDepth(currentCellPosition,currentMapSurface,currentRenderOptions,currentRenderDepth,currentBillboardRecords);
 const currentCellFaces=buildFieldCellGeometry(currentCellPosition,currentMapSurface,currentRenderOptions);
 const currentHasElevation=readSurfaceHeight(currentCellPosition,currentMapSurface)>0;
 const currentTreadCount=currentCellFaces.filter(currentFaceRecord=>currentFaceRecord.kind==='tread').length;
 const currentRenderObjects=[];
 for(const [currentFaceIndex,currentFaceRecord] of currentCellFaces.entries()){
  const currentFaceDepth=(currentFaceRecord.kind==='ground'?currentGroundDepth:currentRenderDepth)+currentFaceIndex/(currentCellFaces.length+1);
  if(currentFaceRecord.kind==='bridge'){
   if(!currentGameScene.textures.exists(currentFaceRecord.textureKey))throw Error('교량 스프라이트 누락: '+currentFaceRecord.textureKey);
   const currentBridgeDepth=currentFaceRecord.depthAnchor
    ?Math.max(currentRenderDepth,resolveFieldSurfaceDepth(currentFaceRecord.depthAnchor,currentMapSurface,currentRenderOptions))+currentFaceRecord.structureLayer
    :currentFaceDepth+currentFaceRecord.depthOffset;
   const currentBridgePanel=drawFieldTexturePanel(currentGameScene,currentFaceRecord.points,currentFaceRecord.textureKey,currentBridgeDepth,currentFaceRecord.uvCorners);
   markFieldOcclusionObject(currentBridgePanel,currentFaceRecord.points);
   currentRenderObjects.push(currentBridgePanel);
   if(currentShowMesh)currentRenderObjects.push(drawFieldMeshBoundary(currentGameScene,currentFaceRecord.points,currentBridgeDepth+.002));
   continue;
  }
  const currentTextureKey=currentTextureKeys[currentFaceRecord.kind];
  if(!currentGameScene.textures.exists(currentTextureKey))throw Error('필드 텍스처 누락: '+currentTextureKey);
  if(currentFaceRecord.kind==='cliff'){
   const currentSourceImage=currentGameScene.textures.get(currentTextureKey).getSourceImage();
   const currentWallLayers=buildFieldCliffTextureLayers(currentFaceRecord.points,currentSourceImage.width,currentSourceImage.height);
   for(const currentWallLayer of currentWallLayers){
    const currentWallPanel=drawFieldTexturePanel(currentGameScene,currentWallLayer.points,currentTextureKey,currentFaceDepth,currentWallLayer.uvCorners);
    markFieldOcclusionObject(currentWallPanel,currentWallLayer.points);
    currentRenderObjects.push(currentWallPanel);
   }
  }else{
   const currentUvCorners=currentFaceRecord.kind==='tread'?[0,0,1/currentTreadCount,0,1/currentTreadCount,1,0,1]:undefined;
   if(currentFaceRecord.kind==='ground'&&currentTextureKeys.underlay){
    const currentUnderlayPanel=drawFieldTexturePanel(currentGameScene,currentFaceRecord.points,currentTextureKeys.underlay,currentFaceDepth);
    if(currentHasElevation)markFieldOcclusionObject(currentUnderlayPanel,currentFaceRecord.points);
    currentRenderObjects.push(currentUnderlayPanel);
   }
   const currentTerrainPanel=drawFieldTexturePanel(currentGameScene,currentFaceRecord.points,currentTextureKey,currentFaceDepth+.001,currentUvCorners);
   if(currentHasElevation)markFieldOcclusionObject(currentTerrainPanel,currentFaceRecord.points);
   currentRenderObjects.push(currentTerrainPanel);
  }
  if(currentFaceRecord.kind==='tread'||currentFaceRecord.kind==='cliff'){
   // 측벽과 디딤면의 경계는 각 면의 깊이를 따라 앞쪽 지형에 가려진다.
   const currentFaceSegments=currentFaceRecord.kind==='cliff'?buildFieldCliffEdges(currentCellPosition,currentMapSurface,currentFaceRecord.points,currentRenderOptions):currentFaceRecord.points.map((currentStartPoint,currentPointIndex)=>[currentStartPoint,currentFaceRecord.points[(currentPointIndex+1)%currentFaceRecord.points.length]]);
   currentRenderObjects.push(drawFieldElevationOutline(currentGameScene,currentFaceSegments,currentFaceDepth+.002));
  }
  if(currentShowMesh)currentRenderObjects.push(drawFieldMeshBoundary(currentGameScene,currentFaceRecord.points,currentFaceDepth+.002));
 }
 if(currentTextureKeys.roadConnectionMask!==undefined&&!findSurfaceStair(currentCellPosition,currentMapSurface)){
  const currentRoadEdges=buildFieldRoadEdges(currentCellPosition,currentMapSurface,currentTextureKeys.roadConnectionMask,currentRenderOptions,currentTextureKeys.fullTileRoad);
  if(currentRoadEdges.length)currentRenderObjects.push(drawFieldElevationOutline(currentGameScene,currentRoadEdges,currentGroundDepth+.98,FIELD_GROUND_EDGE_STYLE));
 }
 if(TERRAIN_MATERIAL_BOUNDARY_ENABLED&&currentTextureKeys.resolveGroundMaterial){
  const currentMaterialEdges=buildFieldMaterialEdges(currentCellPosition,currentMapSurface,currentTextureKeys.resolveGroundMaterial,currentRenderOptions);
  if(currentMaterialEdges.length)currentRenderObjects.push(drawFieldElevationOutline(currentGameScene,currentMaterialEdges,currentGroundDepth+.99,FIELD_GROUND_EDGE_STYLE));
 }
 const currentElevationEdges=buildFieldElevationEdges(currentCellPosition,currentMapSurface,currentRenderOptions);
 if(currentElevationEdges.length)currentRenderObjects.push(drawFieldElevationOutline(currentGameScene,currentElevationEdges,currentGroundDepth+0.99));
 if(currentHasElevation){
  const currentOcclusionSources=currentRenderObjects.filter(currentRenderObject=>currentRenderObject.getData?.('fieldOcclusionBaseAlpha')!==undefined);
  for(const currentSourceObject of currentOcclusionSources)currentSourceObject.setData('fieldOcclusionCellSources',currentOcclusionSources);
  for(const currentRenderObject of currentRenderObjects){
   if(currentRenderObject.getData?.('fieldOcclusionBaseAlpha')!==undefined)continue;
   currentRenderObject.setData?.('fieldOcclusionEdgeSources',currentOcclusionSources);
   currentRenderObject.setData?.('fieldOcclusionEdgeBaseAlpha',currentRenderObject.alpha??1);
  }
 }
 for(const currentRenderObject of currentRenderObjects)applyTerrainAmbientTint(currentRenderObject,currentMapSurface);
 return currentRenderObjects;
}

export function buildFieldBoundaryPanels(currentCellPosition,currentSafeCenter,currentSafeRadius,currentScreenCenter,currentRenderOptions=FIELD_RENDER_METRICS){
 if(!Number.isInteger(currentSafeRadius)||currentSafeRadius<0)throw Error('결계 반경은 0 이상의 정수여야 합니다.');
 const currentCenterDistance=Math.abs(currentCellPosition.column-currentSafeCenter.column)+Math.abs(currentCellPosition.row-currentSafeCenter.row);
 if(currentCenterDistance>currentSafeRadius)return [];
 const currentCellPoints=[{x:currentScreenCenter.x,y:currentScreenCenter.y-currentRenderOptions.tileHeight/2},{x:currentScreenCenter.x+currentRenderOptions.tileWidth/2,y:currentScreenCenter.y},{x:currentScreenCenter.x,y:currentScreenCenter.y+currentRenderOptions.tileHeight/2},{x:currentScreenCenter.x-currentRenderOptions.tileWidth/2,y:currentScreenCenter.y}];
 return FIELD_BOUNDARY_NEIGHBORS.filter(currentNeighborRecord=>Math.abs(currentCellPosition.column+currentNeighborRecord.column-currentSafeCenter.column)+Math.abs(currentCellPosition.row+currentNeighborRecord.row-currentSafeCenter.row)>currentSafeRadius).map(currentNeighborRecord=>{
  const [currentFirstPoint,currentSecondPoint]=currentNeighborRecord.edge.map(currentPointIndex=>currentCellPoints[currentPointIndex]);
  return [{x:currentFirstPoint.x,y:currentFirstPoint.y-FIELD_SAFE_AURA_PROFILE.height},{x:currentSecondPoint.x,y:currentSecondPoint.y-FIELD_SAFE_AURA_PROFILE.height},currentSecondPoint,currentFirstPoint];
 });
}

export function resolveFieldAuraUvs(currentFrameIndex,currentImageWidth,currentImageHeight){
 if(!Number.isInteger(currentFrameIndex)||currentFrameIndex<0||currentFrameIndex>=FIELD_SAFE_AURA_PROFILE.frames)throw Error('결계 프레임 범위 오류');
 const currentColumnIndex=currentFrameIndex%FIELD_SAFE_AURA_PROFILE.columns,currentRowIndex=Math.floor(currentFrameIndex/FIELD_SAFE_AURA_PROFILE.columns);
 const currentLeftPixel=Math.round(currentColumnIndex*currentImageWidth/FIELD_SAFE_AURA_PROFILE.columns),currentRightPixel=Math.round((currentColumnIndex+1)*currentImageWidth/FIELD_SAFE_AURA_PROFILE.columns);
 const currentTopPixel=Math.round(currentRowIndex*currentImageHeight/FIELD_SAFE_AURA_PROFILE.rows),currentBottomPixel=Math.round((currentRowIndex+1)*currentImageHeight/FIELD_SAFE_AURA_PROFILE.rows);
 const currentCropPixels=(currentRightPixel-currentLeftPixel)*FIELD_SAFE_AURA_PROFILE.horizontalCrop;
 const currentLeftUv=(currentLeftPixel+currentCropPixels)/currentImageWidth,currentRightUv=(currentRightPixel-currentCropPixels)/currentImageWidth,currentTopUv=(currentTopPixel+(currentBottomPixel-currentTopPixel)*FIELD_SAFE_AURA_PROFILE.topCrop)/currentImageHeight,currentBottomUv=(currentBottomPixel-(currentBottomPixel-currentTopPixel)*FIELD_SAFE_AURA_PROFILE.bottomCrop)/currentImageHeight;
 return [currentLeftUv,currentTopUv,currentRightUv,currentTopUv,currentRightUv,currentBottomUv,currentLeftUv,currentBottomUv];
}

export function drawFieldAuraPanel(currentGameScene,currentPanelPoints,currentTextureKey,currentRenderDepth){
 const currentSourceImage=currentGameScene.textures.get(currentTextureKey).getSourceImage();
 const currentAuraMesh=drawFieldTexturePanel(currentGameScene,currentPanelPoints,currentTextureKey,currentRenderDepth,resolveFieldAuraUvs(0,currentSourceImage.width,currentSourceImage.height));
 currentAuraMesh.setAlpha(FIELD_SAFE_AURA_PROFILE.alpha);
 const synchronizeFieldAura=(currentTimeMilliseconds)=>{
  const currentFrameIndex=Math.floor(currentTimeMilliseconds/FIELD_SAFE_AURA_PROFILE.frameDuration)%FIELD_SAFE_AURA_PROFILE.frames;
  const currentUvCorners=resolveFieldAuraUvs(currentFrameIndex,currentSourceImage.width,currentSourceImage.height);
  for(const [currentVertexIndex,currentCornerIndex] of FIELD_QUAD_TRIANGLES.entries()){
   const currentMeshVertex=currentAuraMesh.vertices[currentVertexIndex];
   currentMeshVertex.u=currentMeshVertex.tu=currentUvCorners[currentCornerIndex*2];
   currentMeshVertex.v=currentMeshVertex.tv=currentUvCorners[currentCornerIndex*2+1];
  }
 };
 currentGameScene.events.on('update',synchronizeFieldAura);
 currentAuraMesh.once('destroy',()=>currentGameScene.events.off('update',synchronizeFieldAura));
 return currentAuraMesh;
}

export function drawFieldTowerObject(currentGameScene,currentScreenPosition,currentTextureKey,currentRenderDepth=0){
 if(!currentGameScene.textures.exists(currentTextureKey))throw Error('결계탑 텍스처 누락');
 const currentTowerImage=currentGameScene.add.image(currentScreenPosition.x,currentScreenPosition.y,currentTextureKey);
 return markFieldOcclusionObject(currentTowerImage).setOrigin(FIELD_SAFE_TOWER_PROFILE.anchorX/currentTowerImage.width,FIELD_SAFE_TOWER_PROFILE.anchorY/currentTowerImage.height).setScale(FIELD_SAFE_TOWER_PROFILE.displayHeight/(FIELD_SAFE_TOWER_PROFILE.anchorY-FIELD_SAFE_TOWER_PROFILE.bodyTop)).setDepth(currentRenderDepth);
}

export {FIELD_RENDER_METRICS,projectSurfaceCell,projectSurfaceVertex,rotateSurfacePosition,containsSurfacePoint};

/** 마을의 재질 경계를 한 번만 그리고 양쪽 타일보다 앞에 배치한다. */
export function drawTownMaterialEdges(currentGameScene,currentCellPosition,resolveGroundMaterial,projectGroundPosition,resolveGroundDepth,currentSurfaceDepth){
 if(!TERRAIN_MATERIAL_BOUNDARY_ENABLED)return [];
 const currentMaterialName=resolveGroundMaterial(currentCellPosition);
 return FIELD_BOUNDARY_NEIGHBORS.filter(currentNeighborOffset=>currentNeighborOffset.column<0||currentNeighborOffset.row<0).flatMap(currentNeighborOffset=>{
  const currentNeighborCell={column:currentCellPosition.column+currentNeighborOffset.column,row:currentCellPosition.row+currentNeighborOffset.row};
  if(currentNeighborCell.column<0||currentNeighborCell.row<0||resolveGroundMaterial(currentNeighborCell)===currentMaterialName)return [];
  const currentEdgePoints=currentNeighborOffset.edge.map(currentCornerIndex=>{const [currentColumnOffset,currentRowOffset]=FIELD_CELL_CORNERS[currentCornerIndex];return projectGroundPosition({column:currentCellPosition.column+currentColumnOffset,row:currentCellPosition.row+currentRowOffset});});
  return [drawFieldElevationOutline(currentGameScene,[currentEdgePoints],Math.max(resolveGroundDepth(currentCellPosition),resolveGroundDepth(currentNeighborCell))+currentSurfaceDepth+.01,FIELD_GROUND_EDGE_STYLE)];
 });
}

/** 빌보드 이미지 아랫변 중앙의 위치를 타일 좌표로 변환한다. */
export function resolveBillboardIntersectionOffset(currentObjectRecord){
 const currentColumnCount=currentObjectRecord.groundFootprintColumns??1,currentRowCount=currentObjectRecord.groundFootprintRows??1;
 return {column:currentColumnCount===1?.5:currentColumnCount-1,row:currentRowCount===1?.5:currentRowCount-1};
}
function resolveBillboardAnchorOffset(currentObjectRecord){
 if(currentObjectRecord.billboardAnchorMode==='tile-intersection'){
  const currentIntersectionOffset=resolveBillboardIntersectionOffset(currentObjectRecord);
  return {column:currentIntersectionOffset.column+currentObjectRecord.anchorX+currentObjectRecord.anchorY,row:currentIntersectionOffset.row+currentObjectRecord.anchorY-currentObjectRecord.anchorX};
 }

 if(['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)){
  const currentHorizontalOffset=currentObjectRecord.anchorX-.5,currentVerticalOffset=currentObjectRecord.anchorY-.5;
  return {column:currentHorizontalOffset+currentVerticalOffset,row:currentVerticalOffset-currentHorizontalOffset};
 }
 const currentAnchorName=currentObjectRecord.billboardPlacementAnchor??currentObjectRecord.tileAnchor??'center';
 if(!Object.hasOwn(FIELD_SCENERY_TILE_ANCHORS,currentAnchorName))throw Error('지원하지 않는 타일 앵커: '+currentAnchorName);
 return FIELD_SCENERY_TILE_ANCHORS[currentAnchorName];
}

/** 이미지 여백 보정은 제외하고 실제 점유 기준점으로 정렬한다. */
function resolveBillboardDepthOffset(currentObjectRecord,currentRenderOptions){
 const currentDepthPosition=currentObjectRecord.billboardAnchorMode==='tile-intersection'?resolveBillboardIntersectionOffset(currentObjectRecord):currentObjectRecord.billboardAnchorMode==='tile-bottom-center'?{column:0,row:0}:resolveBillboardAnchorOffset(currentObjectRecord);
 return rotateSurfacePosition(currentDepthPosition,currentRenderOptions.rotation??0);
}

const BILLBOARD_SHADOW_PROFILE=Object.freeze({color:0x18201b,insetRatio:.5,depthOffset:.5,cornerRatio:.35,cornerSteps:6,layers:[{scale:1,alpha:.14},{scale:.78,alpha:.20},{scale:.5,alpha:.26}]});
/** 크기 1은 타일 한 칸의 열·행 길이이며 이미지 높이와 점유 수를 다시 곱하지 않는다. */
export function buildBillboardShadowPolygon(currentColumnCount,currentRowCount,currentCenterPoint,currentRenderOptions,currentLayerScale=1){
 if(!Number.isInteger(currentColumnCount)||currentColumnCount<1||!Number.isInteger(currentRowCount)||currentRowCount<1)throw Error('그림자 점유 타일 수는 양의 정수여야 합니다');
 const currentHalfColumn=currentLayerScale*(currentRenderOptions.shadowScaleX??currentColumnCount)/2;
 const currentHalfRow=currentLayerScale*(currentRenderOptions.shadowScaleY??currentRowCount)/2;
 const currentCornerRadius=Math.min(currentHalfColumn,currentHalfRow)*BILLBOARD_SHADOW_PROFILE.cornerRatio;
 const currentCornerCenters=[[currentHalfColumn-currentCornerRadius,currentHalfRow-currentCornerRadius],[-currentHalfColumn+currentCornerRadius,currentHalfRow-currentCornerRadius],[-currentHalfColumn+currentCornerRadius,-currentHalfRow+currentCornerRadius],[currentHalfColumn-currentCornerRadius,-currentHalfRow+currentCornerRadius]];
 return currentCornerCenters.flatMap(([currentColumnOffset,currentRowOffset],currentCornerIndex)=>Array.from({length:BILLBOARD_SHADOW_PROFILE.cornerSteps+1},(_,currentStepIndex)=>{
  const currentArcAngle=(currentCornerIndex+currentStepIndex/BILLBOARD_SHADOW_PROFILE.cornerSteps)*Math.PI/2;
  const currentWorldPoint=rotateSurfacePosition({column:currentColumnOffset+Math.cos(currentArcAngle)*currentCornerRadius,row:currentRowOffset+Math.sin(currentArcAngle)*currentCornerRadius},currentRenderOptions.rotation??0);
  return {x:currentCenterPoint.x+(currentWorldPoint.column-currentWorldPoint.row)*currentRenderOptions.tileWidth/2,y:currentCenterPoint.y+(currentWorldPoint.column+currentWorldPoint.row)*currentRenderOptions.tileHeight/2};
 }));
}

/** 볼록한 지면 경계로 그림자를 자른다. 타일마다 깊이를 부여해 앞 타일의 덮임을 방지한다. */
export function clipBillboardShadowPolygon(currentShadowPoints,currentGroundPoints){
 let currentClippedPoints=currentShadowPoints;
 for(let currentEdgeIndex=0;currentEdgeIndex<currentGroundPoints.length;currentEdgeIndex++){
  const currentEdgeStart=currentGroundPoints[currentEdgeIndex],currentEdgeEnd=currentGroundPoints[(currentEdgeIndex+1)%currentGroundPoints.length];
  const readSignedDistance=currentPointValue=>(currentEdgeEnd.x-currentEdgeStart.x)*(currentPointValue.y-currentEdgeStart.y)-(currentEdgeEnd.y-currentEdgeStart.y)*(currentPointValue.x-currentEdgeStart.x);
  const currentInputPoints=currentClippedPoints;currentClippedPoints=[];
  for(let currentPointIndex=0;currentPointIndex<currentInputPoints.length;currentPointIndex++){
   const currentStartPoint=currentInputPoints[currentPointIndex],currentEndPoint=currentInputPoints[(currentPointIndex+1)%currentInputPoints.length];
   const currentStartDistance=readSignedDistance(currentStartPoint),currentEndDistance=readSignedDistance(currentEndPoint);
   if(currentStartDistance>=0)currentClippedPoints.push(currentStartPoint);
   if((currentStartDistance>=0)!==(currentEndDistance>=0)){
    const currentEdgeRatio=currentStartDistance/(currentStartDistance-currentEndDistance);
    currentClippedPoints.push({x:currentStartPoint.x+(currentEndPoint.x-currentStartPoint.x)*currentEdgeRatio,y:currentStartPoint.y+(currentEndPoint.y-currentStartPoint.y)*currentEdgeRatio});
   }
  }
 }
 return currentClippedPoints;
}

export function drawBillboardContactShadow(currentGameScene,currentObjectRecord,currentScreenPosition,currentRenderDepth,currentRenderOptions={}){
 if(currentRenderOptions.billboardShadows===false)return null;
 const currentBillboardScale=currentRenderOptions.billboardScale??BILLBOARD_RENDER_SCALE;
 const currentTileWidth=currentRenderOptions.tileWidth??FIELD_RENDER_METRICS.tileWidth;
 const currentTileHeight=currentRenderOptions.tileHeight??FIELD_RENDER_METRICS.tileHeight;
 const currentAnchorOffset=rotateSurfacePosition(resolveBillboardAnchorOffset(currentObjectRecord),currentRenderOptions.rotation??0);
 const currentColumnCount=currentObjectRecord.groundFootprintColumns??1,currentRowCount=currentObjectRecord.groundFootprintRows??1;
 const currentShadowSizeVersion=currentObjectRecord.shadowSizeVersion??1;
 if(![1,2].includes(currentShadowSizeVersion))throw new Error('지원하지 않는 그림자 크기 버전');
 const currentShadowColumnLength=currentShadowSizeVersion===2?(currentObjectRecord.shadowScaleX??1)*currentColumnCount:(currentObjectRecord.shadowScaleX??currentColumnCount);
 const currentShadowRowLength=currentShadowSizeVersion===2?(currentObjectRecord.shadowScaleY??1)*currentRowCount:(currentObjectRecord.shadowScaleY??currentRowCount);
 const currentShadowVersion=currentObjectRecord.shadowCoordinateVersion??1;
 if(![1,2].includes(currentShadowVersion))throw new Error('지원하지 않는 그림자 좌표 버전');
 const currentShadowOrigin=currentShadowVersion===1&&currentObjectRecord.billboardAnchorMode==='tile-intersection'?resolveBillboardIntersectionOffset(currentObjectRecord):{column:(currentColumnCount-1)/2,row:(currentRowCount-1)/2};
 const currentShadowOffset=rotateSurfacePosition({column:currentShadowOrigin.column+(currentObjectRecord.shadowOffsetColumn??0),row:currentShadowOrigin.row+(currentObjectRecord.shadowOffsetRow??0)},currentRenderOptions.rotation??0);
 const currentShadowX=currentScreenPosition.x+(currentShadowOffset.column-currentShadowOffset.row)*currentTileWidth/2-(currentAnchorOffset.column-currentAnchorOffset.row)*currentTileWidth*BILLBOARD_SHADOW_PROFILE.insetRatio;
 const currentShadowY=currentScreenPosition.y+(currentShadowOffset.column+currentShadowOffset.row)*currentTileHeight/2-(currentAnchorOffset.column+currentAnchorOffset.row)*currentTileHeight*BILLBOARD_SHADOW_PROFILE.insetRatio;
 const currentDepthAnchorOffset=resolveBillboardDepthOffset(currentObjectRecord,currentRenderOptions);
 const currentAnchorDepthOffset=['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)?(currentDepthAnchorOffset.column+currentDepthAnchorOffset.row)*TERRAIN_DEPTH.stride:0;
 const currentShadowDepth=currentRenderDepth-currentAnchorDepthOffset-(currentDepthAnchorOffset.column+currentDepthAnchorOffset.row>0?TERRAIN_DEPTH.actor:0)-TERRAIN_DEPTH.overlay+TERRAIN_DEPTH.surface+BILLBOARD_SHADOW_PROFILE.depthOffset;
 const currentMapSurface=currentRenderOptions.shadowSurface;
 if(currentMapSurface){
  const currentShadowGraphics=[];
  const currentOriginHeight=readGroundSurfaceHeight(currentObjectRecord.position,currentMapSurface);
  const currentLayerPolygons=BILLBOARD_SHADOW_PROFILE.layers.map(currentLayerProfile=>({alpha:currentLayerProfile.alpha,points:buildBillboardShadowPolygon(currentColumnCount,currentRowCount,{x:currentShadowX,y:currentShadowY},{tileWidth:currentTileWidth,tileHeight:currentTileHeight,rotation:currentRenderOptions.rotation??0,shadowScaleX:currentShadowColumnLength,shadowScaleY:currentShadowRowLength},currentLayerProfile.scale)}));
  const currentOuterPoints=currentLayerPolygons[0].points;
  const currentShadowBounds={left:Math.min(...currentOuterPoints.map(currentPointValue=>currentPointValue.x)),right:Math.max(...currentOuterPoints.map(currentPointValue=>currentPointValue.x)),top:Math.min(...currentOuterPoints.map(currentPointValue=>currentPointValue.y)),bottom:Math.max(...currentOuterPoints.map(currentPointValue=>currentPointValue.y))};
  for(let currentRowIndex=0;currentRowIndex<currentMapSurface.rows;currentRowIndex++)for(let currentColumnIndex=0;currentColumnIndex<currentMapSurface.columns;currentColumnIndex++){
   const currentCellPosition={column:currentColumnIndex,row:currentRowIndex};
   if(readGroundSurfaceHeight(currentCellPosition,currentMapSurface)!==currentOriginHeight||findSurfaceStair(currentCellPosition,currentMapSurface))continue;
   const currentCellOffset=rotateSurfacePosition({column:currentColumnIndex-currentObjectRecord.position.column,row:currentRowIndex-currentObjectRecord.position.row},currentRenderOptions.rotation??0);
   const currentCenterPoint={x:currentShadowX+(currentCellOffset.column-currentCellOffset.row-currentShadowOffset.column+currentShadowOffset.row)*currentTileWidth/2,y:currentShadowY+(currentCellOffset.column+currentCellOffset.row-currentShadowOffset.column-currentShadowOffset.row)*currentTileHeight/2};
   if(currentCenterPoint.x+currentTileWidth/2<currentShadowBounds.left||currentCenterPoint.x-currentTileWidth/2>currentShadowBounds.right||currentCenterPoint.y+currentTileHeight/2<currentShadowBounds.top||currentCenterPoint.y-currentTileHeight/2>currentShadowBounds.bottom)continue;
   const currentGroundPoints=[{x:currentCenterPoint.x,y:currentCenterPoint.y-currentTileHeight/2},{x:currentCenterPoint.x+currentTileWidth/2,y:currentCenterPoint.y},{x:currentCenterPoint.x,y:currentCenterPoint.y+currentTileHeight/2},{x:currentCenterPoint.x-currentTileWidth/2,y:currentCenterPoint.y}];
   let currentTileGraphic=null;
   for(const currentLayerPolygon of currentLayerPolygons){
    const currentClippedPoints=clipBillboardShadowPolygon(currentLayerPolygon.points,currentGroundPoints);
    if(currentClippedPoints.length<3)continue;
    currentTileGraphic??=currentGameScene.add.graphics().setDepth(resolveFieldSurfaceDepth(currentCellPosition,currentMapSurface,currentRenderOptions)+TERRAIN_DEPTH.surface+BILLBOARD_SHADOW_PROFILE.depthOffset);
    currentTileGraphic.fillStyle(BILLBOARD_SHADOW_PROFILE.color,currentLayerPolygon.alpha);currentTileGraphic.fillPoints(currentClippedPoints,true);
   }
   if(currentTileGraphic)currentShadowGraphics.push(currentTileGraphic);
  }
  return {destroy(){for(const currentTileGraphic of currentShadowGraphics)currentTileGraphic.destroy();}};
 }
 const currentShadowGraphic=currentGameScene.add.graphics().setDepth(currentShadowDepth);
 for(const currentLayerProfile of BILLBOARD_SHADOW_PROFILE.layers){
  currentShadowGraphic.fillStyle(BILLBOARD_SHADOW_PROFILE.color,currentLayerProfile.alpha);
  {
   const currentShadowPoints=buildBillboardShadowPolygon(currentColumnCount,currentRowCount,{x:currentShadowX,y:currentShadowY},{tileWidth:currentTileWidth,tileHeight:currentTileHeight,rotation:currentRenderOptions.rotation??0,shadowScaleX:currentShadowColumnLength,shadowScaleY:currentShadowRowLength},currentLayerProfile.scale);
   currentShadowGraphic.fillPoints(currentShadowPoints,true);
  }
 }
 return currentShadowGraphic;
}

/** 지형지물은 타일 중심의 투영 좌표에 접지하며 통행 데이터를 변경하지 않는다. */
export function drawFieldSceneryObject(currentGameScene,currentObjectRecord,currentScreenPosition,currentRenderDepth,currentTowerTextureKey='structure-ward-tower-v1',currentRenderOptions=resolveMapRenderOptions()){
 const currentBillboardScale=currentRenderOptions.billboardScale??BILLBOARD_RENDER_SCALE;
 if(!Number.isFinite(currentBillboardScale)||currentBillboardScale<=0)throw Error('빌보드 렌더 배율은 양수여야 합니다.');
 if(currentObjectRecord.kind==='ward-tower')return applyTerrainAmbientTint(drawFieldTowerObject(currentGameScene,currentScreenPosition,currentTowerTextureKey,currentRenderDepth),currentRenderOptions.shadowSurface);
 if(currentObjectRecord.kind==='billboard'){
  const currentLayerImages=drawLayeredFieldBillboard(currentGameScene,currentObjectRecord,currentScreenPosition,currentRenderDepth,currentBillboardScale);
  const currentContactShadow=drawBillboardContactShadow(currentGameScene,currentObjectRecord,currentScreenPosition,currentRenderDepth,currentRenderOptions);
  if(currentContactShadow)currentLayerImages[0].once('destroy',()=>currentContactShadow.destroy());
  for(const currentLayerImage of currentLayerImages){currentLayerImage.setData('terrainEffectObjectId',currentObjectRecord.id);applyTerrainAmbientTint(currentLayerImage,currentRenderOptions.shadowSurface);}
  return currentLayerImages;
 }
 if(currentObjectRecord.kind!=='decoration')throw Error('지원하지 않는 지형지물 종류');
 if(!currentGameScene.textures.exists(currentObjectRecord.textureKey))throw Error('지형지물 텍스처 누락: '+currentObjectRecord.textureKey);
 const currentSceneryImage=currentGameScene.add.image(currentScreenPosition.x,currentScreenPosition.y,currentObjectRecord.textureKey);
 currentSceneryImage.setData('terrainEffectObjectId',currentObjectRecord.id);
 applyTerrainAmbientTint(currentSceneryImage,currentRenderOptions.shadowSurface);
 markFieldOcclusionObject(currentSceneryImage);
 currentSceneryImage.setData('sceneryGroundPosition',resolveFieldSceneryPlacement(currentObjectRecord,currentScreenPosition).position);
 const currentContactShadow=drawBillboardContactShadow(currentGameScene,currentObjectRecord,currentScreenPosition,currentRenderDepth,currentRenderOptions);
 if(currentContactShadow)currentSceneryImage.once('destroy',()=>currentContactShadow.destroy());
 return currentSceneryImage.setOrigin(['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)?.5:currentObjectRecord.anchorX,['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)?1:currentObjectRecord.anchorY).setScale(currentObjectRecord.displayHeight*currentBillboardScale/currentSceneryImage.height).setDepth(currentRenderDepth);
}


/** 접지 앵커는 맵 기준 앞·중앙·뒤이며 카메라 회전에도 월드 위치를 유지한다. */
export const FIELD_SCENERY_TILE_ANCHORS = Object.freeze({
 top:Object.freeze({column:-.5,row:-.5}),
 bottom:Object.freeze({column:.5,row:.5}),
 back:Object.freeze({column:-.25,row:-.25}),
 center:Object.freeze({column:0,row:0}),
 front:Object.freeze({column:.25,row:.25}),
});

/** 두 프레임은 같은 캔버스 좌표를 공유하며 중앙 캐릭터 앞뒤로 정렬한다. */
const BILLBOARD_FRONT_DEPTH_OFFSET = 20;
const BILLBOARD_ANCHORED_LAYER_OFFSET = 1;
export function drawLayeredFieldBillboard(currentGameScene,currentObjectRecord,currentScreenPosition,currentRenderDepth,currentBillboardScale=1){
 if(!currentGameScene.textures.exists(currentObjectRecord.textureKey))throw Error('빌보드 텍스처 누락: '+currentObjectRecord.textureKey);
 const currentSpriteTexture=currentGameScene.textures.get(currentObjectRecord.textureKey);
 const currentSourceImage=currentSpriteTexture.getSourceImage();
 const currentFrameSize=currentObjectRecord.frameSize;
 if(!Number.isInteger(currentFrameSize)||currentFrameSize<=0||currentSourceImage.width!==currentFrameSize*2||currentSourceImage.height!==currentFrameSize)throw Error('빌보드는 같은 크기의 정사각형 뒤·앞 2프레임 시트여야 합니다.');
 return ['back','front'].map((currentLayerName,currentLayerIndex)=>{
  const currentFrameName='billboard-'+currentLayerName;
  if(!currentSpriteTexture.has(currentFrameName))currentSpriteTexture.add(currentFrameName,0,currentLayerIndex*currentFrameSize,0,currentFrameSize,currentFrameSize);
  return markFieldOcclusionObject(currentGameScene.add.image(currentScreenPosition.x,currentScreenPosition.y,currentObjectRecord.textureKey,currentFrameName))
   .setOrigin(['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)?.5:currentObjectRecord.anchorX,['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)?1:currentObjectRecord.anchorY).setScale(currentObjectRecord.displayHeight*currentBillboardScale/currentFrameSize)
   .setDepth(currentRenderDepth+currentLayerIndex*(currentObjectRecord.billboardPlacementAnchor?BILLBOARD_ANCHORED_LAYER_OFFSET:BILLBOARD_FRONT_DEPTH_OFFSET))
   .setData('sceneryGroundPosition',resolveFieldSceneryPlacement(currentObjectRecord,currentScreenPosition).position);
 });
}

/** 앵커는 그림의 표시 위치다. 높은 지형의 가림은 실제 점유 범위와 카메라 방향으로 판정한다. */
function constrainBillboardTerrainDepth(currentObjectRecord,currentMapSurface,currentRenderOptions,currentBaseDepth){
 if(!['decoration','billboard'].includes(currentObjectRecord.kind)||!Number.isFinite(currentObjectRecord.displayHeight))return currentBaseDepth;
 const currentOwnerPosition=currentObjectRecord.position;
 const currentOwnerHeight=readSurfaceHeight(currentOwnerPosition,currentMapSurface);
 const currentFootprintColumns=currentObjectRecord.groundFootprintColumns??1;
 const currentFootprintRows=currentObjectRecord.groundFootprintRows??1;
 const currentFootprintCorners=[[0,0],[currentFootprintColumns-1,0],[0,currentFootprintRows-1],[currentFootprintColumns-1,currentFootprintRows-1]].map(([currentColumnOffset,currentRowOffset])=>rotateSurfacePosition({column:currentOwnerPosition.column+currentColumnOffset,row:currentOwnerPosition.row+currentRowOffset},currentRenderOptions.rotation??0));
 const currentMinimumColumn=Math.min(...currentFootprintCorners.map(currentCornerPosition=>currentCornerPosition.column));
 const currentMaximumColumn=Math.max(...currentFootprintCorners.map(currentCornerPosition=>currentCornerPosition.column));
 const currentMinimumRow=Math.min(...currentFootprintCorners.map(currentCornerPosition=>currentCornerPosition.row));
 const currentMaximumRow=Math.max(...currentFootprintCorners.map(currentCornerPosition=>currentCornerPosition.row));
 const currentSpriteSize=currentObjectRecord.displayHeight*(currentRenderOptions.billboardScale??BILLBOARD_RENDER_SCALE);
 const currentSpritePosition=resolveFieldSceneryPlacement(currentObjectRecord,projectSurfaceCell(currentOwnerPosition,currentMapSurface,currentRenderOptions),currentRenderOptions).screen;
 const currentCenteredAnchor=['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode);
 const currentSpriteLeft=currentSpritePosition.x-currentSpriteSize*(currentCenteredAnchor?.5:currentObjectRecord.anchorX);
 const currentSpriteTop=currentSpritePosition.y-currentSpriteSize*(currentCenteredAnchor?1:currentObjectRecord.anchorY);
 let currentConstrainedDepth=currentBaseDepth;
 for(let currentCellRow=0;currentCellRow<currentMapSurface.rows;currentCellRow++)for(let currentCellColumn=0;currentCellColumn<currentMapSurface.columns;currentCellColumn++){
  const currentCellPosition={column:currentCellColumn,row:currentCellRow};
  if(readSurfaceHeight(currentCellPosition,currentMapSurface)<=currentOwnerHeight)continue;
  const currentViewPosition=rotateSurfacePosition(currentCellPosition,currentRenderOptions.rotation??0);
  // 두 축 중 하나라도 뒤에 있는 대각선 이웃은 앞쪽 장애물로 간주하지 않는다.
  if(currentViewPosition.column<currentMinimumColumn||currentViewPosition.row<currentMinimumRow)continue;
  if(currentViewPosition.column<=currentMaximumColumn&&currentViewPosition.row<=currentMaximumRow)continue;
  const currentCellCenter=projectSurfaceCell(currentCellPosition,currentMapSurface,currentRenderOptions);
  if(currentCellCenter.x+currentRenderOptions.tileWidth/2<=currentSpriteLeft||currentCellCenter.x-currentRenderOptions.tileWidth/2>=currentSpriteLeft+currentSpriteSize||currentCellCenter.y+currentRenderOptions.tileHeight/2<=currentSpriteTop||currentCellCenter.y-currentRenderOptions.tileHeight/2>=currentSpriteTop+currentSpriteSize)continue;
  const currentTerrainDepth=resolveFieldSurfaceDepth(currentCellPosition,currentMapSurface,currentRenderOptions);
  const currentLayerPadding=currentObjectRecord.kind==='billboard'?(currentObjectRecord.billboardPlacementAnchor?BILLBOARD_ANCHORED_LAYER_OFFSET:BILLBOARD_FRONT_DEPTH_OFFSET):0;
  currentConstrainedDepth=Math.min(currentConstrainedDepth,currentTerrainDepth-currentLayerPadding-1);
 }
 return currentConstrainedDepth;
}

/** 화면 앵커 이동은 이웃 타일의 정렬 순서를 바꾸지 않는다. */
function resolveSceneryBaseDepth(currentObjectRecord,currentMapSurface,currentRenderOptions=FIELD_RENDER_METRICS){
 const currentAnchorOffset=resolveBillboardDepthOffset(currentObjectRecord,currentRenderOptions);
 const currentActorSideOffset=currentAnchorOffset.column+currentAnchorOffset.row>0?TERRAIN_DEPTH.actor:0;
 const currentAnchorDepthOffset=['tile-bottom-center','tile-intersection'].includes(currentObjectRecord.billboardAnchorMode)?(currentAnchorOffset.column+currentAnchorOffset.row)*TERRAIN_DEPTH.stride:0;
 const currentBaseDepth=resolveFieldSurfaceDepth(currentObjectRecord.position,currentMapSurface,currentRenderOptions)+currentAnchorDepthOffset+TERRAIN_DEPTH.overlay+currentActorSideOffset;
 return constrainBillboardTerrainDepth(currentObjectRecord,currentMapSurface,currentRenderOptions,currentBaseDepth);
}

const BILLBOARD_ORDER_DEPTH_GAP = 0.01;

/** 점유 사각형과 화면 범위를 함께 사용해 서로 가릴 수 있는 빌보드만 비교한다. */
function measureSceneryOrderBounds(currentObjectRecord,currentMapSurface,currentRenderOptions){
 const currentColumnCount=currentObjectRecord.groundFootprintColumns??1,currentRowCount=currentObjectRecord.groundFootprintRows??1;
 const currentCornerPositions=[[0,0],[currentColumnCount-1,0],[0,currentRowCount-1],[currentColumnCount-1,currentRowCount-1]].map(([currentColumnOffset,currentRowOffset])=>rotateSurfacePosition({column:currentObjectRecord.position.column+currentColumnOffset,row:currentObjectRecord.position.row+currentRowOffset},currentRenderOptions.rotation??0));
 const currentSpritePoint=resolveFieldSceneryPlacement(currentObjectRecord,projectSurfaceCell(currentObjectRecord.position,currentMapSurface,currentRenderOptions),currentRenderOptions).screen;
 const currentSpriteSize=currentObjectRecord.displayHeight*(currentRenderOptions.billboardScale??BILLBOARD_RENDER_SCALE);
 const currentCenteredAnchor=['tile-intersection','tile-bottom-center'].includes(currentObjectRecord.billboardAnchorMode);
 const currentSpriteLeft=currentSpritePoint.x-currentSpriteSize*(currentCenteredAnchor?.5:currentObjectRecord.anchorX);
 const currentSpriteTop=currentSpritePoint.y-currentSpriteSize*(currentCenteredAnchor?1:currentObjectRecord.anchorY);
 return {minColumn:Math.min(...currentCornerPositions.map(currentCornerPosition=>currentCornerPosition.column)),maxColumn:Math.max(...currentCornerPositions.map(currentCornerPosition=>currentCornerPosition.column)),minRow:Math.min(...currentCornerPositions.map(currentCornerPosition=>currentCornerPosition.row)),maxRow:Math.max(...currentCornerPositions.map(currentCornerPosition=>currentCornerPosition.row)),left:currentSpriteLeft,right:currentSpriteLeft+currentSpriteSize,top:currentSpriteTop,bottom:currentSpriteTop+currentSpriteSize,height:readSurfaceHeight(currentObjectRecord.position,currentMapSurface)};
}

/** 긴 점유의 먼 끝이 앞 행·열의 작은 개체를 덮지 않도록 선후 관계를 적용한다. */
export function resolveFieldSceneryDepth(currentObjectRecord,currentMapSurface,currentRenderOptions=FIELD_RENDER_METRICS){
 const currentBaseDepth=resolveSceneryBaseDepth(currentObjectRecord,currentMapSurface,currentRenderOptions);
 if(!Number.isFinite(currentObjectRecord.displayHeight)||!['decoration','billboard'].includes(currentObjectRecord.kind))return currentBaseDepth;
 const currentCandidateObjects=(currentMapSurface.objects??[]).filter(currentCandidateRecord=>['decoration','billboard'].includes(currentCandidateRecord.kind)&&Number.isFinite(currentCandidateRecord.displayHeight)&&currentCandidateRecord!==currentObjectRecord&&(!currentObjectRecord.id||currentCandidateRecord.id!==currentObjectRecord.id));
 currentCandidateObjects.push(currentObjectRecord);
 const currentBoundsRecords=currentCandidateObjects.map(currentCandidateRecord=>measureSceneryOrderBounds(currentCandidateRecord,currentMapSurface,currentRenderOptions));
 const currentResolvedDepths=new Map(),currentVisitingIndices=new Set();
 const resolveOrderedObjectDepth=currentTargetIndex=>{
  if(currentResolvedDepths.has(currentTargetIndex))return currentResolvedDepths.get(currentTargetIndex);
  if(currentVisitingIndices.has(currentTargetIndex))throw Error('빌보드 점유 정렬에 순환 관계가 있습니다.');
  currentVisitingIndices.add(currentTargetIndex);
  const currentTargetRecord=currentCandidateObjects[currentTargetIndex],currentTargetBounds=currentBoundsRecords[currentTargetIndex];
  let currentTargetDepth=resolveSceneryBaseDepth(currentTargetRecord,currentMapSurface,currentRenderOptions);
  for(let currentOtherIndex=0;currentOtherIndex<currentCandidateObjects.length;currentOtherIndex++){
   if(currentOtherIndex===currentTargetIndex)continue;
   const currentOtherBounds=currentBoundsRecords[currentOtherIndex];
   if(currentTargetBounds.height!==currentOtherBounds.height||currentTargetBounds.left>=currentOtherBounds.right||currentOtherBounds.left>=currentTargetBounds.right||currentTargetBounds.top>=currentOtherBounds.bottom||currentOtherBounds.top>=currentTargetBounds.bottom)continue;
   const currentColumnOverlap=currentTargetBounds.minColumn<=currentOtherBounds.maxColumn&&currentOtherBounds.minColumn<=currentTargetBounds.maxColumn;
   const currentRowOverlap=currentTargetBounds.minRow<=currentOtherBounds.maxRow&&currentOtherBounds.minRow<=currentTargetBounds.maxRow;
   if((currentColumnOverlap&&currentTargetBounds.minRow>currentOtherBounds.maxRow)||(currentRowOverlap&&currentTargetBounds.minColumn>currentOtherBounds.maxColumn)){
    const currentOtherRecord=currentCandidateObjects[currentOtherIndex];
    const currentLayerPadding=currentOtherRecord.kind==='billboard'?(currentOtherRecord.billboardPlacementAnchor?BILLBOARD_ANCHORED_LAYER_OFFSET:BILLBOARD_FRONT_DEPTH_OFFSET):0;
    currentTargetDepth=Math.max(currentTargetDepth,resolveOrderedObjectDepth(currentOtherIndex)+currentLayerPadding+BILLBOARD_ORDER_DEPTH_GAP);
   }
  }
  currentVisitingIndices.delete(currentTargetIndex);
  currentTargetDepth=constrainBillboardTerrainDepth(currentTargetRecord,currentMapSurface,currentRenderOptions,currentTargetDepth);
  currentResolvedDepths.set(currentTargetIndex,currentTargetDepth);
  return currentTargetDepth;
 };
 return resolveOrderedObjectDepth(currentCandidateObjects.length-1);
}

/** 소속 타일의 고도를 유지하고 선택한 접지 위치만 회전·투영한다. */
export function resolveFieldSceneryPlacement(currentObjectRecord,currentTileCenter,currentRenderOptions=FIELD_RENDER_METRICS){
 const currentAnchorOffset=resolveBillboardAnchorOffset(currentObjectRecord);
 const currentViewOffset=rotateSurfacePosition(currentAnchorOffset,currentRenderOptions.rotation??0);
 return {position:{column:currentObjectRecord.position.column+currentAnchorOffset.column,row:currentObjectRecord.position.row+currentAnchorOffset.row},
  screen:{x:currentTileCenter.x+(currentViewOffset.column-currentViewOffset.row)*currentRenderOptions.tileWidth/2,
   y:currentTileCenter.y+(currentViewOffset.column+currentViewOffset.row)*currentRenderOptions.tileHeight/2}};
}


/** 겹친 앞쪽 지형만 흐리게 하며 대상이 이동하거나 사라지면 원래 불투명도로 복원한다. */
export const FIELD_OCCLUSION_ALPHA = 0.4;
export function markFieldOcclusionObject(currentRenderObject,currentPanelPoints){
 currentRenderObject.setData?.('fieldOcclusionBaseAlpha',currentRenderObject.alpha??1);
 if(currentPanelPoints)currentRenderObject.setData?.('fieldOcclusionPolygon',currentPanelPoints);
 if(currentPanelPoints)currentRenderObject.setData?.('fieldOcclusionBounds',{x:Math.min(...currentPanelPoints.map(currentPanelPoint=>currentPanelPoint.x)),y:Math.min(...currentPanelPoints.map(currentPanelPoint=>currentPanelPoint.y)),width:Math.max(...currentPanelPoints.map(currentPanelPoint=>currentPanelPoint.x))-Math.min(...currentPanelPoints.map(currentPanelPoint=>currentPanelPoint.x)),height:Math.max(...currentPanelPoints.map(currentPanelPoint=>currentPanelPoint.y))-Math.min(...currentPanelPoints.map(currentPanelPoint=>currentPanelPoint.y))});
 return currentRenderObject;
}
export function shouldFadeFieldOccluder(currentOccluderBounds,currentOccluderDepth,currentActorBounds,currentActorDepth){
 return currentOccluderDepth>currentActorDepth&&currentOccluderBounds.x<currentActorBounds.x+currentActorBounds.width&&currentOccluderBounds.x+currentOccluderBounds.width>currentActorBounds.x&&currentOccluderBounds.y<currentActorBounds.y+currentActorBounds.height&&currentOccluderBounds.y+currentOccluderBounds.height>currentActorBounds.y;
}
const FIELD_OCCLUSION_SAMPLE_COUNT = 24;
const FIELD_OCCLUSION_ALPHA_THRESHOLD = 32;

/** 투명 여백과 지형 면 밖을 제외한 실제 겹침을 검사한다. */
export function containsFieldOcclusionPoint(currentPolygonPoints,currentPointValue){
 let currentInsideValue=false;
 for(let currentPointIndex=0,currentPreviousIndex=currentPolygonPoints.length-1;currentPointIndex<currentPolygonPoints.length;currentPreviousIndex=currentPointIndex++){
  const currentStartPoint=currentPolygonPoints[currentPointIndex],currentEndPoint=currentPolygonPoints[currentPreviousIndex];
  if((currentStartPoint.y>currentPointValue.y)!==(currentEndPoint.y>currentPointValue.y)&&currentPointValue.x<(currentEndPoint.x-currentStartPoint.x)*(currentPointValue.y-currentStartPoint.y)/(currentEndPoint.y-currentStartPoint.y)+currentStartPoint.x)currentInsideValue=!currentInsideValue;
 }
 return currentInsideValue;
}
function containsFieldOpaquePixel(currentSceneObject,currentWorldPoint){
 const currentOcclusionChildren=currentSceneObject.getData?.('fieldOcclusionChildren');
 if(currentOcclusionChildren)return currentOcclusionChildren.some(currentChildObject=>containsFieldOpaquePixel(currentChildObject,currentWorldPoint));
 const currentPolygonPoints=currentSceneObject.getData?.('fieldOcclusionPolygon');
 if(currentPolygonPoints)return containsFieldOcclusionPoint(currentPolygonPoints,currentWorldPoint);
 const currentLocalPoint=currentSceneObject.getWorldTransformMatrix().applyInverse(currentWorldPoint.x,currentWorldPoint.y);
 const currentPixelColumn=Math.floor(currentLocalPoint.x+currentSceneObject.displayOriginX);
 const currentPixelRow=Math.floor(currentLocalPoint.y+currentSceneObject.displayOriginY);
 const currentPixelAlpha=currentSceneObject.scene.textures.getPixelAlpha(currentSceneObject.flipX?currentSceneObject.width-1-currentPixelColumn:currentPixelColumn,currentSceneObject.flipY?currentSceneObject.height-1-currentPixelRow:currentPixelRow,currentSceneObject.texture.key,currentSceneObject.frame.name);
 return currentPixelAlpha!==null&&currentPixelAlpha>=FIELD_OCCLUSION_ALPHA_THRESHOLD;
}
export function updateFieldActorOcclusion(currentGameScene){
 const currentActorRecords=currentGameScene.children.list.filter(currentSceneObject=>currentSceneObject.visible&&currentSceneObject.getBounds&&(currentSceneObject.getData?.('actorSelectionPosition')||currentSceneObject.getData?.('fieldActorVisibility'))).map(currentActorObject=>({object:currentActorObject,bounds:currentActorObject.getBounds(),depth:currentActorObject.depth}));
 for(const currentSceneObject of currentGameScene.children.list){
  const currentBaseAlpha=currentSceneObject.getData?.('fieldOcclusionBaseAlpha');
  if(currentBaseAlpha===undefined||!currentSceneObject.visible)continue;
  const currentObjectBounds=currentSceneObject.getData('fieldOcclusionBounds')??currentSceneObject.getBounds();
  const currentIsOccluded=currentActorRecords.some(currentActorRecord=>{
   if(!shouldFadeFieldOccluder(currentObjectBounds,currentSceneObject.depth,currentActorRecord.bounds,currentActorRecord.depth))return false;
   const currentOverlapLeft=Math.max(currentObjectBounds.x,currentActorRecord.bounds.x),currentOverlapTop=Math.max(currentObjectBounds.y,currentActorRecord.bounds.y);
   const currentOverlapWidth=Math.min(currentObjectBounds.x+currentObjectBounds.width,currentActorRecord.bounds.x+currentActorRecord.bounds.width)-currentOverlapLeft;
   const currentOverlapHeight=Math.min(currentObjectBounds.y+currentObjectBounds.height,currentActorRecord.bounds.y+currentActorRecord.bounds.height)-currentOverlapTop;
   for(let currentSampleRow=0;currentSampleRow<FIELD_OCCLUSION_SAMPLE_COUNT;currentSampleRow++)for(let currentSampleColumn=0;currentSampleColumn<FIELD_OCCLUSION_SAMPLE_COUNT;currentSampleColumn++){
    const currentWorldPoint={x:currentOverlapLeft+(currentSampleColumn+.5)*currentOverlapWidth/FIELD_OCCLUSION_SAMPLE_COUNT,y:currentOverlapTop+(currentSampleRow+.5)*currentOverlapHeight/FIELD_OCCLUSION_SAMPLE_COUNT};
    if(containsFieldOpaquePixel(currentActorRecord.object,currentWorldPoint)&&containsFieldOpaquePixel(currentSceneObject,currentWorldPoint))return true;
   }
   return false;
  });
  currentSceneObject.setAlpha(currentBaseAlpha*(currentIsOccluded?FIELD_OCCLUSION_ALPHA:1));
 }
 // 윗면·측벽 중 실제로 가리는 면이 있으면 같은 타일 전체를 함께 감쇠한다.
 const currentFadedCellSources=new Set();
 for(const currentSceneObject of currentGameScene.children.list){
  const currentCellSources=currentSceneObject.getData?.('fieldOcclusionCellSources');
  if(currentCellSources&&currentSceneObject.alpha<currentSceneObject.getData('fieldOcclusionBaseAlpha'))currentFadedCellSources.add(currentCellSources);
 }
 for(const currentCellSources of currentFadedCellSources)for(const currentSourceObject of currentCellSources)currentSourceObject.setAlpha(currentSourceObject.getData('fieldOcclusionBaseAlpha')*FIELD_OCCLUSION_ALPHA);
 // 경계선은 별도 겹침 판정 없이 같은 타일 면의 감쇠율을 따른다.
 for(const currentSceneObject of currentGameScene.children.list){
  const currentEdgeSources=currentSceneObject.getData?.('fieldOcclusionEdgeSources');
  if(!currentEdgeSources||!currentSceneObject.visible)continue;
  const currentFadeRatio=Math.min(1,...currentEdgeSources.map(currentSourceObject=>{
   const currentSourceAlpha=currentSourceObject.getData('fieldOcclusionBaseAlpha');
   return currentSourceAlpha>0?currentSourceObject.alpha/currentSourceAlpha:1;
  }));
  currentSceneObject.setAlpha(currentSceneObject.getData('fieldOcclusionEdgeBaseAlpha')*currentFadeRatio);
 }
}

export {buildLayeredTraversal,layeredPositionKey} from '../field-surface/layered-traversal.mjs';
export {projectLayeredPosition,pickLayeredPosition} from '../field-surface/layered-projection.mjs';

export {calculateEffectFramePlacement} from './terrain-effects.mjs';
