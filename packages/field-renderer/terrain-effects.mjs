/** 맵의 장식 애니메이션. 점유·통행이나 원본 이미지에는 영향을 주지 않는다. */
import {BILLBOARD_RENDER_SCALE,MAP_TILE_WIDTH,MAP_TILE_HEIGHT,TERRAIN_DEPTH} from './render-constants.mjs';
const TERRAIN_EFFECT_RENDER_SCALE = BILLBOARD_RENDER_SCALE;
const TERRAIN_EFFECT_TILE_WIDTH = MAP_TILE_WIDTH;
const TERRAIN_EFFECT_TILE_HEIGHT = MAP_TILE_HEIGHT;
const TERRAIN_GLOW_CAP_PROFILE = Object.freeze({key:'safe-terrain-glow-core',width:1,height:.45,alpha:.65});
const TERRAIN_GLOW_AREA_PROFILE = Object.freeze({key:'safe-terrain-glow-halo',width:1,height:1,alpha:.45});
const TERRAIN_GLOW_DEPTH_OFFSET = .01;
const TERRAIN_GLOW_FRAME_COUNT = 8;
const TERRAIN_GLOW_COLUMN_COUNT = 4;
const TERRAIN_GLOW_ROW_COUNT = 2;

function mountTerrainGlowSprite(currentSceneInstance,currentMapRecord,currentEffectRecord,currentAnchorScreen){
 const currentSheetProfile=currentEffectRecord.objectId?TERRAIN_GLOW_CAP_PROFILE:TERRAIN_GLOW_AREA_PROFILE;
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
 currentGlowSprite.setBlendMode('ADD').setAlpha(currentEffectRecord.intensity*currentSheetProfile.alpha);
 currentGlowSprite.setDepth(currentAnchorScreen.depth+TERRAIN_GLOW_DEPTH_OFFSET);
 currentGlowSprite.setData('terrainEffectId',currentEffectRecord.id);
 const renderTerrainGlowFrame=()=>{
  const currentFrameIndex=Math.floor((currentSceneInstance.time.now/currentEffectRecord.periodMs+currentEffectRecord.seed*.61803398875)*TERRAIN_GLOW_FRAME_COUNT)%TERRAIN_GLOW_FRAME_COUNT;
  currentGlowSprite.setFrame(currentFrameIndex);
  currentGlowSprite.setDisplaySize(currentEffectRecord.radius*TERRAIN_EFFECT_TILE_WIDTH*currentSheetProfile.width,currentEffectRecord.radius*TERRAIN_EFFECT_TILE_WIDTH*currentSheetProfile.height);
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
  if(currentEffectRecord.kind==='glow'){
   // 본체의 실제 앵커·정렬 깊이를 재사용하여 앞쪽 나무를 뚫고 빛이 보이지 않게 한다.
   let currentGlowAnchor={...currentAnchorScreen,depth:TERRAIN_DEPTH.base+(currentAnchorPosition.column+currentAnchorPosition.row)*TERRAIN_DEPTH.stride+TERRAIN_DEPTH.overlay};
   if(currentEffectRecord.objectId){
    const currentAttachedSprite=currentSceneInstance.children.list.find(currentSceneChild=>currentSceneChild.getData?.('terrainEffectObjectId')===currentEffectRecord.objectId);
    if(!currentAttachedSprite)throw Error('발광 연결 빌보드가 아직 렌더링되지 않았습니다: '+currentEffectRecord.objectId);
    currentGlowAnchor={x:currentAttachedSprite.x,y:currentAttachedSprite.y,depth:currentAttachedSprite.depth};
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
