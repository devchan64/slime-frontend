/** 맵의 장식 애니메이션. 점유·통행이나 원본 이미지에는 영향을 주지 않는다. */
import {clipBillboardShadowPolygon,resolveFieldSurfaceDepth} from './field-renderer.mjs';
import {BILLBOARD_RENDER_SCALE,MAP_TILE_WIDTH,MAP_TILE_HEIGHT,TERRAIN_DEPTH} from './render-constants.mjs';
const TERRAIN_EFFECT_RENDER_SCALE = BILLBOARD_RENDER_SCALE;
const TERRAIN_EFFECT_TILE_WIDTH = MAP_TILE_WIDTH;
const TERRAIN_EFFECT_TILE_HEIGHT = MAP_TILE_HEIGHT;
const TERRAIN_GLOW_CAP_PROFILE = Object.freeze({key:'safe-terrain-glow-core',width:1.5,height:1,alpha:.8});
const TERRAIN_GLOW_AREA_PROFILE = Object.freeze({key:'safe-terrain-glow-halo',width:1,height:1,alpha:.45});
const TERRAIN_GLOW_DEPTH_OFFSET = .01;
const TERRAIN_GLOW_FRAME_COUNT = 8;
const TERRAIN_GLOW_COLUMN_COUNT = 4;
const TERRAIN_GLOW_ROW_COUNT = 2;


const TERRAIN_DIFFUSE_RING_COUNT = 24;
const TERRAIN_DIFFUSE_POINT_COUNT = 48;
const TERRAIN_DIFFUSE_PEAK_ALPHA = .55;

/** 지면광 도형은 최초에만 구성하고 매 프레임에는 밝기만 변경한다. */
function mountTerrainGroundGlow(currentSceneInstance,currentMapRecord,currentEffectRecord,currentProjectPosition){
 const currentAnchorScreen=currentProjectPosition(currentEffectRecord.position);
 const currentHorizontalRadius=currentEffectRecord.radius*TERRAIN_EFFECT_TILE_WIDTH/2;
 const currentVerticalRadius=currentEffectRecord.radius*TERRAIN_EFFECT_TILE_HEIGHT/2;
 const currentLayerPolygons=Array.from({length:TERRAIN_DIFFUSE_RING_COUNT},(_,currentLayerIndex)=>{
  const currentLayerRatio=(TERRAIN_DIFFUSE_RING_COUNT-currentLayerIndex)/TERRAIN_DIFFUSE_RING_COUNT;
  return Array.from({length:TERRAIN_DIFFUSE_POINT_COUNT},(_,currentPointIndex)=>{
   const currentPointAngle=currentPointIndex/TERRAIN_DIFFUSE_POINT_COUNT*Math.PI*2;
   return {x:currentAnchorScreen.x+Math.cos(currentPointAngle)*currentHorizontalRadius*currentLayerRatio,y:currentAnchorScreen.y+Math.sin(currentPointAngle)*currentVerticalRadius*currentLayerRatio};
  });
 });
 const currentTileGraphics=[];
 for(let currentRowIndex=0;currentRowIndex<currentMapRecord.rows;currentRowIndex++)for(let currentColumnIndex=0;currentColumnIndex<currentMapRecord.columns;currentColumnIndex++){
  const currentCellPosition={column:currentColumnIndex,row:currentRowIndex};
  const currentCellCenter=currentProjectPosition(currentCellPosition);
  if(!currentCellCenter)continue;
  if(Math.abs(currentCellCenter.x-currentAnchorScreen.x)>currentHorizontalRadius+TERRAIN_EFFECT_TILE_WIDTH/2||Math.abs(currentCellCenter.y-currentAnchorScreen.y)>currentVerticalRadius+TERRAIN_EFFECT_TILE_HEIGHT/2)continue;
  const currentGroundPoints=[{x:currentCellCenter.x,y:currentCellCenter.y-TERRAIN_EFFECT_TILE_HEIGHT/2},{x:currentCellCenter.x+TERRAIN_EFFECT_TILE_WIDTH/2,y:currentCellCenter.y},{x:currentCellCenter.x,y:currentCellCenter.y+TERRAIN_EFFECT_TILE_HEIGHT/2},{x:currentCellCenter.x-TERRAIN_EFFECT_TILE_WIDTH/2,y:currentCellCenter.y}];
  let currentTileGraphic=null;
  for(const currentLayerPolygon of currentLayerPolygons){
   const currentClippedPoints=clipBillboardShadowPolygon(currentLayerPolygon,currentGroundPoints);
   if(currentClippedPoints.length<3)continue;
   currentTileGraphic??=currentSceneInstance.add.graphics().setDepth(resolveFieldSurfaceDepth(currentCellPosition,currentMapRecord)+TERRAIN_DEPTH.surface+TERRAIN_GLOW_DEPTH_OFFSET).setBlendMode('ADD').setData('terrainEffectId',currentEffectRecord.id);
   currentTileGraphic.fillStyle(Number.parseInt(currentEffectRecord.color.slice(1),16),TERRAIN_DIFFUSE_PEAK_ALPHA/TERRAIN_DIFFUSE_RING_COUNT);
   currentTileGraphic.fillPoints(currentClippedPoints,true);
  }
  if(currentTileGraphic)currentTileGraphics.push(currentTileGraphic);
 }
 const renderTerrainGroundPulse=()=>{
  const currentPulseAlpha=currentEffectRecord.intensity*(.9+.1*Math.sin(currentSceneInstance.time.now/currentEffectRecord.periodMs*Math.PI*2+currentEffectRecord.seed));
  for(const currentTileGraphic of currentTileGraphics)currentTileGraphic.setAlpha(currentPulseAlpha);
 };
 renderTerrainGroundPulse();currentSceneInstance.events.on('update',renderTerrainGroundPulse);
 return {destroy(){currentSceneInstance.events.off('update',renderTerrainGroundPulse);for(const currentTileGraphic of currentTileGraphics)currentTileGraphic.destroy();}};
}

function mountTerrainGlowSprite(currentSceneInstance,currentMapRecord,currentEffectRecord,currentAnchorScreen){
 const currentHostSprite=currentAnchorScreen.hostSprite;
 const currentHostRecord=currentMapRecord.objects?.find(currentObjectRecord=>currentObjectRecord.id===currentEffectRecord.objectId);
 const currentMushroomProfile=currentMapRecord.effectProfiles?.[currentHostRecord?.textureKey];
 const currentSwarmProfile=currentEffectRecord.version===2?currentMapRecord.effectProfiles?.[currentEffectRecord.kind]:null;
 const currentSheetProfile=currentSwarmProfile??currentMushroomProfile??(currentEffectRecord.version===2?{key:currentEffectRecord.kind==='moths'?'safe-terrain-moth-swarm':'safe-terrain-firefly-swarm',width:1,height:1,alpha:1}:currentEffectRecord.objectId?TERRAIN_GLOW_CAP_PROFILE:TERRAIN_GLOW_AREA_PROFILE);
 if(!currentSceneInstance.textures.exists(currentSheetProfile.key))throw Error('발광 시트가 로드되지 않았습니다: '+currentSheetProfile.key);
 const currentSheetTexture=currentSceneInstance.textures.get(currentSheetProfile.key);
 const currentSourceImage=currentSheetTexture.getSourceImage();
 for(let currentFrameIndex=0;currentFrameIndex<TERRAIN_GLOW_FRAME_COUNT;currentFrameIndex++){
  const currentFrameColumn=currentFrameIndex%TERRAIN_GLOW_COLUMN_COUNT;
  const currentFrameRow=Math.floor(currentFrameIndex/TERRAIN_GLOW_COLUMN_COUNT);
  const currentFrameLeft=Math.round(currentSourceImage.width*currentFrameColumn/TERRAIN_GLOW_COLUMN_COUNT);
  const currentFrameTop=Math.round(currentSourceImage.height*currentFrameRow/TERRAIN_GLOW_ROW_COUNT);
  if(!currentSheetTexture.has(currentFrameIndex))currentSheetTexture.add(currentFrameIndex,0,currentFrameLeft,currentFrameTop,Math.round(currentSourceImage.width*(currentFrameColumn+1)/TERRAIN_GLOW_COLUMN_COUNT)-currentFrameLeft,Math.round(currentSourceImage.height*(currentFrameRow+1)/TERRAIN_GLOW_ROW_COUNT)-currentFrameTop);
 }
 const currentGlowSprite=currentSceneInstance.add.image(currentAnchorScreen.x,currentAnchorScreen.y-currentEffectRecord.height*TERRAIN_EFFECT_RENDER_SCALE,currentSheetProfile.key,0);
 currentGlowSprite.setTint(Number.parseInt(currentEffectRecord.color.slice(1),16));
 currentGlowSprite.setBlendMode(currentEffectRecord.version===2&&currentEffectRecord.kind!=='moths'?'NORMAL':'ADD').setAlpha(currentEffectRecord.intensity*currentSheetProfile.alpha);
 currentGlowSprite.setDepth(currentAnchorScreen.depth+TERRAIN_GLOW_DEPTH_OFFSET);
 currentGlowSprite.setData('terrainEffectId',currentEffectRecord.id);
 const renderTerrainGlowFrame=()=>{
  const currentFrameIndex=Math.floor((currentSceneInstance.time.now/currentEffectRecord.periodMs+currentEffectRecord.seed*.61803398875)*TERRAIN_GLOW_FRAME_COUNT)%TERRAIN_GLOW_FRAME_COUNT;
  // 연결된 발광도 시트 전체를 반복 재생한다. 밝기 변화만으로 애니메이션을 대체하지 않는다.
  const currentAttachedGlow=currentEffectRecord.kind==='glow'&&Boolean(currentEffectRecord.objectId);
  currentGlowSprite.setFrame(currentFrameIndex);
  if(currentAttachedGlow)currentGlowSprite.setAlpha(currentEffectRecord.intensity*currentSheetProfile.alpha*(.9+.1*Math.sin(currentSceneInstance.time.now/currentEffectRecord.periodMs*Math.PI*2+currentEffectRecord.seed)));
  if(currentMushroomProfile){
   const currentFrameBounds=currentMushroomProfile.frames[currentFrameIndex];
   const currentTargetBounds=currentMushroomProfile.target;
   const {left:currentFrameLeft,top:currentFrameTop,width:currentFrameWidth,height:currentFrameHeight}=calculateEffectFramePlacement(currentTargetBounds,currentFrameBounds);
   currentGlowSprite.setOrigin(0,0).setPosition(currentHostSprite.x+(currentFrameLeft-currentHostSprite.originX)*currentHostSprite.displayWidth,currentHostSprite.y+(currentFrameTop-currentHostSprite.originY)*currentHostSprite.displayHeight);
   currentGlowSprite.setDisplaySize(currentHostSprite.displayWidth*currentFrameWidth,currentHostSprite.displayHeight*currentFrameHeight);
  }else if(currentSwarmProfile){
   const currentFramePlacement=calculateEffectFramePlacement(currentSwarmProfile.target,currentSwarmProfile.frames[currentFrameIndex]);
   const currentSwarmSize=currentEffectRecord.radius*TERRAIN_EFFECT_TILE_WIDTH;
   currentGlowSprite.setOrigin(0,0).setPosition(currentAnchorScreen.x+(currentFramePlacement.left-.5)*currentSwarmSize,currentAnchorScreen.y-currentEffectRecord.height*TERRAIN_EFFECT_RENDER_SCALE+(currentFramePlacement.top-.5)*currentSwarmSize);
   currentGlowSprite.setDisplaySize(currentSwarmSize*currentFramePlacement.width,currentSwarmSize*currentFramePlacement.height);
  }else currentGlowSprite.setDisplaySize(currentEffectRecord.radius*TERRAIN_EFFECT_TILE_WIDTH*currentSheetProfile.width,currentEffectRecord.radius*TERRAIN_EFFECT_TILE_WIDTH*currentSheetProfile.height);
 };
 renderTerrainGlowFrame();
 currentSceneInstance.events.on('update',renderTerrainGlowFrame);
 currentGlowSprite.once('destroy',()=>currentSceneInstance.events.off('update',renderTerrainGlowFrame));
 return currentGlowSprite;
}
const TERRAIN_EFFECT_FULL_CIRCLE = Math.PI * 2;
const TERRAIN_MOTH_DRAW_PROFILE = Object.freeze({wingWidth:4,wingHeight:2.5,wingOffset:2,bodyWidth:1,bodyHeight:3});

export function sampleTerrainEffectFrame(currentEffectRecord, currentElapsedMilliseconds) {
 const currentTimePhase = currentElapsedMilliseconds / currentEffectRecord.periodMs * TERRAIN_EFFECT_FULL_CIRCLE;
 const currentSeedPhase = currentEffectRecord.seed * 2.399963229728653;
 const currentEffectRadius = currentEffectRecord.radius;
 if(currentEffectRecord.kind === 'glow') return [{column:0,row:0,height:currentEffectRecord.height*TERRAIN_EFFECT_RENDER_SCALE,alpha:currentEffectRecord.intensity*(.78+.22*Math.sin(currentTimePhase+currentSeedPhase)),wing:0}];
 if(currentEffectRecord.kind !== 'moths')throw Error('지원하지 않는 지형 이펙트: '+currentEffectRecord.kind);
 return Array.from({length:currentEffectRecord.count},(_,currentMothIndex)=>{
  const currentMothPhase=currentTimePhase+currentSeedPhase+currentMothIndex*2.399963229728653;
  const currentOrbitRadius=currentEffectRadius*(.35+.65*(currentMothIndex+1)/currentEffectRecord.count);
  return {column:Math.cos(currentMothPhase)*currentOrbitRadius,row:Math.sin(currentMothPhase*.83)*currentOrbitRadius,
   height:currentEffectRecord.height*TERRAIN_EFFECT_RENDER_SCALE*(.75+.25*Math.sin(currentMothPhase*1.7)),alpha:currentEffectRecord.intensity,
   wing:.25+.75*Math.abs(Math.sin(currentElapsedMilliseconds/70+currentMothPhase))};
 });
}

export function mountTerrainEffectLayer(currentSceneInstance,currentMapRecord,currentProjectPosition) {
 const currentEffectRecords=currentMapRecord.terrainEffects??[];
 if(!currentEffectRecords.length)return [];
 const currentObjectLookup=new Map((currentMapRecord.objects??[]).map(currentObjectRecord=>[currentObjectRecord.id,currentObjectRecord]));
 const currentMountedGraphics=[];
 const currentStartedTime=0;
 for(const currentEffectRecord of currentEffectRecords){
  const currentAnchorPosition=currentEffectRecord.position??currentObjectLookup.get(currentEffectRecord.objectId)?.position;
  if(!currentAnchorPosition)throw Error('지형 이펙트 연결 대상이 없습니다: '+currentEffectRecord.id);
  const currentEffectColor=Number.parseInt(currentEffectRecord.color.slice(1),16);
  const currentAnchorScreen=currentProjectPosition(currentAnchorPosition);
  if(!currentAnchorScreen)throw Error('지형 이펙트 좌표가 맵 밖입니다: '+currentEffectRecord.id);
  if(currentEffectRecord.kind==='glow'&&!currentEffectRecord.objectId&&currentEffectRecord.height===0){
   currentMountedGraphics.push(mountTerrainGroundGlow(currentSceneInstance,currentMapRecord,currentEffectRecord,currentProjectPosition));continue;
  }
  if(currentEffectRecord.kind==='glow'||currentEffectRecord.version===2){
   // 본체의 실제 앵커·정렬 깊이를 재사용하여 앞쪽 나무를 뚫고 빛이 보이지 않게 한다.
   let currentGlowAnchor={...currentAnchorScreen,depth:TERRAIN_DEPTH.base+(currentAnchorPosition.column+currentAnchorPosition.row)*TERRAIN_DEPTH.stride+TERRAIN_DEPTH.overlay};
   if(currentEffectRecord.objectId){
    const currentAttachedSprite=currentSceneInstance.children.list.find(currentSceneChild=>currentSceneChild.getData?.('terrainEffectObjectId')===currentEffectRecord.objectId);
    if(!currentAttachedSprite)throw Error('발광 연결 빌보드가 아직 렌더링되지 않았습니다: '+currentEffectRecord.objectId);
    currentGlowAnchor={x:currentAttachedSprite.x,y:currentAttachedSprite.y,depth:currentAttachedSprite.depth,hostSprite:currentAttachedSprite};
   }
   currentMountedGraphics.push(mountTerrainGlowSprite(currentSceneInstance,currentMapRecord,currentEffectRecord,currentGlowAnchor));continue;
  }
  const currentEffectGraphics=currentSceneInstance.add.graphics();
  // 광량 오버레이는 인접 지면에 잘리지 않게 지형 위에 합성한다.
  currentEffectGraphics.setDepth(TERRAIN_DEPTH.base+(currentMapRecord.columns+currentMapRecord.rows)*TERRAIN_DEPTH.stride+TERRAIN_DEPTH.overlay);
  currentEffectGraphics.setData('terrainEffectId',currentEffectRecord.id);
  const renderTerrainEffectFrame=()=>{
   currentEffectGraphics.clear();
   for(const currentParticleState of sampleTerrainEffectFrame(currentEffectRecord,currentSceneInstance.time.now-currentStartedTime)){
    // 비행 궤적은 지형 기준점 주위의 화면 공간 장식이며 통행 좌표가 아니다.
    const currentParticleX=currentAnchorScreen.x+(currentParticleState.column-currentParticleState.row)*TERRAIN_EFFECT_TILE_WIDTH/2;
    const currentParticleY=currentAnchorScreen.y+(currentParticleState.column+currentParticleState.row)*TERRAIN_EFFECT_TILE_HEIGHT/2-currentParticleState.height;
     currentEffectGraphics.fillStyle(currentEffectColor,currentParticleState.alpha);
     currentEffectGraphics.fillEllipse(currentParticleX-TERRAIN_MOTH_DRAW_PROFILE.wingOffset*currentParticleState.wing,currentParticleY,TERRAIN_MOTH_DRAW_PROFILE.wingWidth*currentParticleState.wing,TERRAIN_MOTH_DRAW_PROFILE.wingHeight);
     currentEffectGraphics.fillEllipse(currentParticleX+TERRAIN_MOTH_DRAW_PROFILE.wingOffset*currentParticleState.wing,currentParticleY,TERRAIN_MOTH_DRAW_PROFILE.wingWidth*currentParticleState.wing,TERRAIN_MOTH_DRAW_PROFILE.wingHeight);
     currentEffectGraphics.fillStyle(0xfff8df,currentParticleState.alpha);
     currentEffectGraphics.fillEllipse(currentParticleX,currentParticleY,TERRAIN_MOTH_DRAW_PROFILE.bodyWidth,TERRAIN_MOTH_DRAW_PROFILE.bodyHeight);
   }
  };
  renderTerrainEffectFrame();
  currentSceneInstance.events.on('update',renderTerrainEffectFrame);
  currentEffectGraphics.once('destroy',()=>currentSceneInstance.events.off('update',renderTerrainEffectFrame));
  currentMountedGraphics.push(currentEffectGraphics);
 }
 return currentMountedGraphics;
}

export function calculateEffectFramePlacement(currentTargetBounds,currentFrameBounds){
 const currentFrameWidth=(currentTargetBounds[2]-currentTargetBounds[0])/(currentFrameBounds[2]-currentFrameBounds[0]);
 const currentFrameHeight=(currentTargetBounds[3]-currentTargetBounds[1])/(currentFrameBounds[3]-currentFrameBounds[1]);
 return {left:currentTargetBounds[0]-currentFrameBounds[0]*currentFrameWidth,top:currentTargetBounds[1]-currentFrameBounds[1]*currentFrameHeight,width:currentFrameWidth,height:currentFrameHeight};
}
