import {FIELD_RENDER_METRICS,projectSurfaceCell,projectSurfaceVertex,rotateSurfacePosition,containsSurfacePoint,readSurfaceHeight,findSurfaceStair,buildSurfaceCliffs,buildSurfaceStairs,resolveCliffTextureScale} from '../field-surface/field-surface.mjs';

/** 게임과 검수가 동일하게 실행하는 Phaser 렌더러. URL·로그인·서비스 상태를 소유하지 않는다. */
export const FIELD_RENDERER_VERSION = '1.0.10';
export const FIELD_ELEVATION_EDGE_STYLE = Object.freeze({color:0x303030,width:4,alpha:0.85});
export const FIELD_MESH_BOUNDARY_STYLE = Object.freeze({color:0xdce5ef,width:1,alpha:0.9});
/** 필드 종류와 액터 종류가 달라도 공유하는 접지 그림자 검수 계약이다. */
export const FIELD_ACTOR_CONTACT_SHADOW_PROFILES = Object.freeze({
 baseline:Object.freeze({width:0.4,height:0.32,alpha:0.3,coreAlpha:0.24,coreScale:0.65,scale:1.3,opacityScale:1.5}),
 contrast:Object.freeze({width:0.4,height:0.32,alpha:0.36,coreAlpha:0.3,coreScale:0.65,scale:1.3,opacityScale:1.5}),
 broad:Object.freeze({width:0.44,height:0.34,alpha:0.32,coreAlpha:0.26,coreScale:0.65,scale:1.3,opacityScale:1.5}),
});
export const FIELD_ACTOR_CONTACT_SHADOW_COLOR = 0x18392e;
export const FIELD_SAFE_TOWER_PROFILE = Object.freeze({anchorX:627,anchorY:1095,bodyTop:82,displayHeight:112});
export const FIELD_SAFE_AURA_PROFILE = Object.freeze({columns:4,rows:2,frames:8,height:15,alpha:0.7,frameDuration:120,horizontalCrop:0.02,topCrop:0.25,bottomCrop:0.1});
const FIELD_EDGE_COORDINATE_EPSILON=.000001;
const FIELD_QUAD_TRIANGLES = [0,1,2,0,2,3];
const FIELD_CELL_CORNERS = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
const FIELD_BOUNDARY_NEIGHBORS = [{column:1,row:0,edge:[1,2]},{column:0,row:1,edge:[2,3]},{column:-1,row:0,edge:[3,0]},{column:0,row:-1,edge:[0,1]}];
const FIELD_CONNECTION_SHAPE = Object.freeze({inset:.08,radius:.2,half:.5});

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

/** 도로·수면 연결 마스크도 양쪽 클라이언트가 동일하게 합성한다. */
export function prepareFieldConnectedTexture(currentGameScene,currentSourceKey,currentGrassKey,currentConnectionMask){
 const currentTextureKey=`field-connected:${currentSourceKey}:${currentGrassKey}:${currentConnectionMask}`;
 if(currentGameScene.textures.exists(currentTextureKey))return currentTextureKey;
 const currentSourceImage=currentGameScene.textures.get(currentSourceKey).getSourceImage();
 const currentGrassImage=currentGameScene.textures.get(currentGrassKey).getSourceImage();
 const currentTextureSize=currentSourceImage.width;
 const currentCanvasTexture=currentGameScene.textures.createCanvas(currentTextureKey,currentTextureSize,currentTextureSize);
 if(!currentCanvasTexture)throw Error('필드 연결 텍스처 생성 실패');
 const currentDrawingContext=currentCanvasTexture.getContext();
 const currentInsetPixels=currentTextureSize*FIELD_CONNECTION_SHAPE.inset,currentHalfPixels=currentTextureSize*FIELD_CONNECTION_SHAPE.half,currentInnerWidth=currentTextureSize-currentInsetPixels*2;
 currentDrawingContext.drawImage(currentGrassImage,0,0,currentTextureSize,currentTextureSize);
 currentDrawingContext.save();currentDrawingContext.beginPath();
 currentDrawingContext.roundRect(currentInsetPixels,currentInsetPixels,currentInnerWidth,currentInnerWidth,currentTextureSize*FIELD_CONNECTION_SHAPE.radius);
 if(currentConnectionMask&1)currentDrawingContext.rect(currentInsetPixels,0,currentInnerWidth,currentHalfPixels);
 if(currentConnectionMask&2)currentDrawingContext.rect(currentHalfPixels,currentInsetPixels,currentHalfPixels,currentInnerWidth);
 if(currentConnectionMask&4)currentDrawingContext.rect(currentInsetPixels,currentHalfPixels,currentInnerWidth,currentHalfPixels);
 if(currentConnectionMask&8)currentDrawingContext.rect(0,currentInsetPixels,currentHalfPixels,currentInnerWidth);
 if((currentConnectionMask&3)===3)currentDrawingContext.rect(currentHalfPixels,0,currentHalfPixels,currentHalfPixels);
 if((currentConnectionMask&6)===6)currentDrawingContext.rect(currentHalfPixels,currentHalfPixels,currentHalfPixels,currentHalfPixels);
 if((currentConnectionMask&12)===12)currentDrawingContext.rect(0,currentHalfPixels,currentHalfPixels,currentHalfPixels);
 if((currentConnectionMask&9)===9)currentDrawingContext.rect(0,0,currentHalfPixels,currentHalfPixels);
 currentDrawingContext.clip();currentDrawingContext.drawImage(currentSourceImage,0,0,currentTextureSize,currentTextureSize);currentDrawingContext.restore();currentCanvasTexture.refresh();
 return currentTextureKey;
}

export function buildFieldCellGeometry(currentCellPosition,currentMapSurface,currentRenderOptions=FIELD_RENDER_METRICS){
 const currentStairRecord=findSurfaceStair(currentCellPosition,currentMapSurface);
 if(currentStairRecord)return buildSurfaceStairs(currentStairRecord,currentMapSurface,currentRenderOptions).map(currentFaceRecord=>({...currentFaceRecord,kind:currentFaceRecord.top?'tread':'cliff'}));
 const currentScreenCenter=projectSurfaceCell(currentCellPosition,currentMapSurface,currentRenderOptions);
 const currentGroundPoints=FIELD_CELL_CORNERS.map(([currentColumnOffset,currentRowOffset])=>({x:currentScreenCenter.x+(currentColumnOffset-currentRowOffset)*currentRenderOptions.tileWidth/2,y:currentScreenCenter.y+(currentColumnOffset+currentRowOffset)*currentRenderOptions.tileHeight/2}));
 return [...buildSurfaceCliffs(currentCellPosition,currentMapSurface,currentRenderOptions).map(currentFacePoints=>({points:currentFacePoints,top:false,kind:'cliff'})),{points:currentGroundPoints,top:true,kind:'ground'}];
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
export function buildFieldMaterialEdges(currentCellPosition,currentMapSurface,resolveGroundMaterial,currentRenderOptions=FIELD_RENDER_METRICS){
 if(findSurfaceStair(currentCellPosition,currentMapSurface))return [];
 const currentMaterialName=resolveGroundMaterial(currentCellPosition);
 if(currentMaterialName==='road')return [];
 const currentCellHeight=readSurfaceHeight(currentCellPosition,currentMapSurface);
 const currentCornerPoints=FIELD_CELL_CORNERS.map(([currentColumnOffset,currentRowOffset])=>projectSurfaceVertex({column:currentCellPosition.column+currentColumnOffset,row:currentCellPosition.row+currentRowOffset,height:currentCellHeight*currentRenderOptions.elevationHeight},currentRenderOptions));
 return FIELD_BOUNDARY_NEIGHBORS.filter(currentNeighborOffset=>currentNeighborOffset.column<0||currentNeighborOffset.row<0).flatMap(currentNeighborOffset=>{
  const currentNeighborCell={column:currentCellPosition.column+currentNeighborOffset.column,row:currentCellPosition.row+currentNeighborOffset.row};
  if(currentNeighborCell.column<0||currentNeighborCell.row<0||findSurfaceStair(currentNeighborCell,currentMapSurface)||readSurfaceHeight(currentNeighborCell,currentMapSurface)!==currentCellHeight)return [];
  const currentNeighborMaterial=resolveGroundMaterial(currentNeighborCell);
  if(currentNeighborMaterial===currentMaterialName||currentNeighborMaterial==='road')return [];
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
export function drawFieldElevationOutline(currentGameScene,currentEdgeSegments,currentRenderDepth){
 const currentEdgeGraphic=currentGameScene.add.graphics().setDepth(currentRenderDepth);
 let previousStrokeWidth=null;
 const synchronizeElevationWidth=()=>{
  const currentStrokeWidth=FIELD_ELEVATION_EDGE_STYLE.width*currentGameScene.scale.displayScale.x/currentGameScene.cameras.main.zoom;
  if(currentStrokeWidth===previousStrokeWidth)return;
  previousStrokeWidth=currentStrokeWidth;
  currentEdgeGraphic.clear();
  currentEdgeGraphic.lineStyle(currentStrokeWidth,FIELD_ELEVATION_EDGE_STYLE.color,FIELD_ELEVATION_EDGE_STYLE.alpha);
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

export function drawFieldCellObjects(currentGameScene,currentCellPosition,currentMapSurface,currentRenderOptions,currentTextureKeys,currentRenderDepth,currentShowMesh=false){
 const currentCellFaces=buildFieldCellGeometry(currentCellPosition,currentMapSurface,currentRenderOptions);
 const currentTreadCount=currentCellFaces.filter(currentFaceRecord=>currentFaceRecord.kind==='tread').length;
 const currentRenderObjects=[];
 for(const [currentFaceIndex,currentFaceRecord] of currentCellFaces.entries()){
  const currentFaceDepth=currentRenderDepth+currentFaceIndex/(currentCellFaces.length+1);
  const currentTextureKey=currentTextureKeys[currentFaceRecord.kind];
  if(!currentGameScene.textures.exists(currentTextureKey))throw Error('필드 텍스처 누락: '+currentTextureKey);
  if(currentFaceRecord.kind==='cliff'){
   const currentSourceImage=currentGameScene.textures.get(currentTextureKey).getSourceImage();
   const currentTextureScale=resolveCliffTextureScale(currentRenderOptions,currentSourceImage.width,currentSourceImage.height);
   const currentMinimumX=Math.min(...currentFaceRecord.points.map(currentPointValue=>currentPointValue.x)),currentMaximumX=Math.max(...currentFaceRecord.points.map(currentPointValue=>currentPointValue.x));
   const currentMinimumY=Math.min(...currentFaceRecord.points.map(currentPointValue=>currentPointValue.y)),currentMaximumY=Math.max(...currentFaceRecord.points.map(currentPointValue=>currentPointValue.y));
   const currentWallSprite=currentGameScene.add.tileSprite(currentMinimumX,currentMinimumY,Math.max(1,currentMaximumX-currentMinimumX),Math.max(1,currentMaximumY-currentMinimumY),currentTextureKey).setOrigin(0).setDepth(currentFaceDepth);
   currentWallSprite.setTileScale(currentTextureScale.scaleX,currentTextureScale.scaleY);
   const currentWallMask=currentGameScene.add.graphics().setVisible(false);
   currentWallMask.fillPoints(currentFaceRecord.points,true);
   currentWallSprite.setMask(currentWallMask.createGeometryMask());
   currentRenderObjects.push(currentWallSprite,currentWallMask);
  }else{
   const currentUvCorners=currentFaceRecord.kind==='tread'?[0,0,1/currentTreadCount,0,1/currentTreadCount,1,0,1]:undefined;
   if(currentFaceRecord.kind==='ground'&&currentTextureKeys.underlay)currentRenderObjects.push(drawFieldTexturePanel(currentGameScene,currentFaceRecord.points,currentTextureKeys.underlay,currentFaceDepth));
   currentRenderObjects.push(drawFieldTexturePanel(currentGameScene,currentFaceRecord.points,currentTextureKey,currentFaceDepth+.001,currentUvCorners));
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
  if(currentRoadEdges.length)currentRenderObjects.push(drawFieldElevationOutline(currentGameScene,currentRoadEdges,currentRenderDepth+.98));
 }
 if(currentTextureKeys.resolveGroundMaterial){
  const currentMaterialEdges=buildFieldMaterialEdges(currentCellPosition,currentMapSurface,currentTextureKeys.resolveGroundMaterial,currentRenderOptions);
  if(currentMaterialEdges.length)currentRenderObjects.push(drawFieldElevationOutline(currentGameScene,currentMaterialEdges,currentRenderDepth+.99));
 }
 const currentElevationEdges=buildFieldElevationEdges(currentCellPosition,currentMapSurface,currentRenderOptions);
 if(currentElevationEdges.length)currentRenderObjects.push(drawFieldElevationOutline(currentGameScene,currentElevationEdges,currentRenderDepth+0.99));
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
 return currentTowerImage.setOrigin(FIELD_SAFE_TOWER_PROFILE.anchorX/currentTowerImage.width,FIELD_SAFE_TOWER_PROFILE.anchorY/currentTowerImage.height).setScale(FIELD_SAFE_TOWER_PROFILE.displayHeight/(FIELD_SAFE_TOWER_PROFILE.anchorY-FIELD_SAFE_TOWER_PROFILE.bodyTop)).setDepth(currentRenderDepth);
}

export {FIELD_RENDER_METRICS,projectSurfaceCell,projectSurfaceVertex,rotateSurfacePosition,containsSurfacePoint};
