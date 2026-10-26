/** 맵의 장식 애니메이션. 점유·통행이나 원본 이미지에는 영향을 주지 않는다. */
import {BILLBOARD_RENDER_SCALE,MAP_TILE_WIDTH,MAP_TILE_HEIGHT,TERRAIN_DEPTH} from './render-constants.mjs';
const TERRAIN_EFFECT_RENDER_SCALE = BILLBOARD_RENDER_SCALE;
const TERRAIN_EFFECT_TILE_WIDTH = MAP_TILE_WIDTH;
const TERRAIN_EFFECT_TILE_HEIGHT = MAP_TILE_HEIGHT;
const TERRAIN_EFFECT_GLOW_LAYERS = 12;
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
  const currentEffectGraphics=currentSceneInstance.add.graphics();
  const currentAnchorScreen=currentProjectPosition(currentAnchorPosition);
  if(!currentAnchorScreen)throw Error('지형 이펙트 좌표가 맵 밖입니다: '+currentEffectRecord.id);
  // 광량 오버레이는 인접 지면에 잘리지 않게 지형 위에 합성한다.
  currentEffectGraphics.setDepth(TERRAIN_DEPTH.base+(currentMapRecord.columns+currentMapRecord.rows)*TERRAIN_DEPTH.stride+TERRAIN_DEPTH.overlay);
  currentEffectGraphics.setData('terrainEffectId',currentEffectRecord.id);
  const renderTerrainEffectFrame=()=>{
   currentEffectGraphics.clear();
   for(const currentParticleState of sampleTerrainEffectFrame(currentEffectRecord,currentSceneInstance.time.now-currentStartedTime)){
    // 비행 궤적은 지형 기준점 주위의 화면 공간 장식이며 통행 좌표가 아니다.
    const currentParticleX=currentAnchorScreen.x+(currentParticleState.column-currentParticleState.row)*TERRAIN_EFFECT_TILE_WIDTH/2;
    const currentParticleY=currentAnchorScreen.y+(currentParticleState.column+currentParticleState.row)*TERRAIN_EFFECT_TILE_HEIGHT/2-currentParticleState.height;
    if(currentEffectRecord.kind==='glow'){
     for(let currentLayerIndex=TERRAIN_EFFECT_GLOW_LAYERS;currentLayerIndex>0;currentLayerIndex--){
      const currentLayerScale=currentLayerIndex/TERRAIN_EFFECT_GLOW_LAYERS;
      currentEffectGraphics.fillStyle(currentEffectColor,currentParticleState.alpha*.12*(1-currentLayerScale*.7));
      currentEffectGraphics.fillEllipse(currentParticleX,currentParticleY,currentEffectRecord.radius*TERRAIN_EFFECT_TILE_WIDTH*currentLayerScale,currentEffectRecord.radius*TERRAIN_EFFECT_TILE_HEIGHT*currentLayerScale);
     }
    }else{
     currentEffectGraphics.fillStyle(currentEffectColor,currentParticleState.alpha);
     currentEffectGraphics.fillEllipse(currentParticleX-TERRAIN_MOTH_DRAW_PROFILE.wingOffset*currentParticleState.wing,currentParticleY,TERRAIN_MOTH_DRAW_PROFILE.wingWidth*currentParticleState.wing,TERRAIN_MOTH_DRAW_PROFILE.wingHeight);
     currentEffectGraphics.fillEllipse(currentParticleX+TERRAIN_MOTH_DRAW_PROFILE.wingOffset*currentParticleState.wing,currentParticleY,TERRAIN_MOTH_DRAW_PROFILE.wingWidth*currentParticleState.wing,TERRAIN_MOTH_DRAW_PROFILE.wingHeight);
     currentEffectGraphics.fillStyle(0xfff8df,currentParticleState.alpha);
     currentEffectGraphics.fillEllipse(currentParticleX,currentParticleY,TERRAIN_MOTH_DRAW_PROFILE.bodyWidth,TERRAIN_MOTH_DRAW_PROFILE.bodyHeight);
    }
   }
  };
  renderTerrainEffectFrame();
  currentSceneInstance.events.on('update',renderTerrainEffectFrame);
  currentEffectGraphics.once('destroy',()=>currentSceneInstance.events.off('update',renderTerrainEffectFrame));
  currentMountedGraphics.push(currentEffectGraphics);
 }
 return currentMountedGraphics;
}
