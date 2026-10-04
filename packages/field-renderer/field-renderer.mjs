import {FIELD_RENDER_METRICS,projectSurfaceCell,projectSurfaceVertex,rotateSurfacePosition,containsSurfacePoint,readSurfaceHeight,findSurfaceStair,buildSurfaceCliffs,buildSurfaceStairs,resolveCliffTextureScale} from '../field-surface/field-surface.mjs';

/** 게임과 검수가 동일하게 실행하는 Phaser 렌더러. URL·로그인·서비스 상태를 소유하지 않는다. */
export const FIELD_RENDERER_VERSION = '1.0.2';
export const FIELD_MESH_BOUNDARY_STYLE = Object.freeze({color:0xdce5ef,width:1,alpha:0.9});
export const FIELD_SAFE_TOWER_PROFILE = Object.freeze({anchorX:627,anchorY:1095,bodyTop:82,displayHeight:112});
export const FIELD_SAFE_AURA_PROFILE = Object.freeze({columns:4,rows:2,frames:8,height:15,alpha:0.7,frameDuration:120,horizontalCrop:0.02,topCrop:0.25,bottomCrop:0.1});
const FIELD_QUAD_TRIANGLES = [0,1,2,0,2,3];
const FIELD_CELL_CORNERS = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
const FIELD_BOUNDARY_NEIGHBORS = [{column:1,row:0,edge:[1,2]},{column:0,row:1,edge:[2,3]},{column:-1,row:0,edge:[3,0]},{column:0,row:-1,edge:[0,1]}];
const FIELD_CONNECTION_SHAPE = Object.freeze({inset:.08,radius:.2,half:.5});

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
  if(currentShowMesh)currentRenderObjects.push(drawFieldMeshBoundary(currentGameScene,currentFaceRecord.points,currentFaceDepth+.002));
 }
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
