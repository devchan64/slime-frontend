import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const idleModulePath = pathToFileURL(resolve('src/game/animation/idleActors.ts')).href;
const idleBundleOutput = await build({entryPoints:['src/game/animation/idleActors.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.url':JSON.stringify(idleModulePath)}});
const {ACTOR_IDLE_ASSETS,ACTOR_IDLE_TEXTURES,DEFAULT_IDLE_DIRECTION_ASSETS,resolveActorIdleAsset,updateActorIdleFrame} = await import(`data:text/javascript;base64,${Buffer.from(idleBundleOutput.outputFiles[0].text).toString('base64')}`);

test('캐릭터 대기·휴식과 몬스터 10종의 등록 파일·관리 ID가 중복되지 않는다',()=>{
 const registeredIdleAssets=Object.values(ACTOR_IDLE_ASSETS);
 assert.equal(registeredIdleAssets.length,12);
 assert.equal(new Set(registeredIdleAssets.map(idleAssetRecord=>idleAssetRecord.key)).size,12);
 assert.equal(new Set(registeredIdleAssets.map(idleAssetRecord=>idleAssetRecord.animation.data.animationId)).size,12);
 for(const idleAssetRecord of registeredIdleAssets) assert.ok(existsSync(new URL(idleAssetRecord.url)));
});
test('등록된 모든 방향은 지정된 시간 경계에서 프레임을 전환하고 반복한다',()=>{
 for(const idleAssetRecord of Object.values(ACTOR_IDLE_ASSETS)) {
  for(const idleClipRecord of idleAssetRecord.animation.data.clips) {
   let accumulatedFrameTime=0;
   for(const idleFrameRecord of idleClipRecord.frames) {
    assert.equal(idleAssetRecord.animation.sample(idleClipRecord.clipId,accumulatedFrameTime).frame.frameId,idleFrameRecord.frameId);
    accumulatedFrameTime+=idleFrameRecord.durationMs;
   }
   assert.equal(idleClipRecord.loop,true);
   assert.equal(idleAssetRecord.animation.sample(idleClipRecord.clipId,accumulatedFrameTime).frame.frameId,idleClipRecord.frames[0].frameId);
  }
 }
});

test('첫 프레임이 이미 선택되어 있어도 발 기준점을 적용한다',()=>{
 const humanIdleAsset=ACTOR_IDLE_ASSETS.human;
 const initialIdleFrame=humanIdleAsset.animation.data.frames[0];
 const renderedCharacterImage={
  scene:{time:{now:0}}, frame:{name:`cell:${humanIdleAsset.animation.data.animationId}@${humanIdleAsset.animation.data.version}:${initialIdleFrame.frameId}`},
  originX:0.5,originY:0.5,
  getData(idleDataKey){return idleDataKey==='actorIdleKind'?'human':0;},
  setTexture(){throw new Error('동일 프레임은 다시 로드하지 않는다.');},
  setOrigin(selectedFrameOriginX,selectedFrameOriginY){this.originX=selectedFrameOriginX;this.originY=selectedFrameOriginY;return this;},
 };
 updateActorIdleFrame(renderedCharacterImage,'down_left');
 assert.equal(renderedCharacterImage.originX,initialIdleFrame.anchor.x/initialIdleFrame.rect.width);
 assert.equal(renderedCharacterImage.originY,initialIdleFrame.anchor.y/initialIdleFrame.rect.height);
});

test('정면왼쪽 대기 시트는 한 번 로드하고 8fps로 재생한다',()=>{
 assert.equal(ACTOR_IDLE_TEXTURES.length,12);
 assert.equal(new Set(ACTOR_IDLE_TEXTURES.map(currentAssetRecord=>currentAssetRecord.key)).size,12);
 const renderedCharacterImage={scene:{time:{now:0}},frame:{name:''},originX:0,originY:0,
  getData(currentDataName){return currentDataName==='actorIdleKind'?'human':0;},
  setTexture(currentTextureKey,currentFrameName){this.textureKey=currentTextureKey;this.frame.name=currentFrameName;return this;},
  setOrigin(currentOriginValueX,currentOriginValueY){this.originX=currentOriginValueX;this.originY=currentOriginValueY;return this;}};
 for(const [currentDirectionName,currentDirectionAsset] of Object.entries(DEFAULT_IDLE_DIRECTION_ASSETS)) {
  assert.ok(existsSync(new URL(currentDirectionAsset.url)));
  for(const currentFrameTime of [0,250,750,1750,2000]) {
   renderedCharacterImage.scene.time.now=currentFrameTime;
   updateActorIdleFrame(renderedCharacterImage,currentDirectionName);
   assert.equal(renderedCharacterImage.textureKey,currentDirectionAsset.key);
   assert.match(renderedCharacterImage.frame.name,new RegExp(`${currentDirectionName}\\.${(currentFrameTime/125)%4}$`));
  }
 }
 assert.throws(()=>resolveActorIdleAsset('human','invalid'));
});
test('정면왼쪽 대기 4프레임은 한 행과 기존 셀 크기를 유지한다',()=>{
 const currentAnimationData=ACTOR_IDLE_ASSETS.human.animation.data;
 assert.equal(currentAnimationData.frames.length,4);
 assert.deepEqual(currentAnimationData.sheet,{width:1536,height:384});
 assert.deepEqual(Object.keys(DEFAULT_IDLE_DIRECTION_ASSETS),['down_left']);
 currentAnimationData.frames.forEach((currentFrameRecord,frameColumnIndex)=>{
  assert.equal(currentFrameRecord.frameId,`down_left.${frameColumnIndex}`);
  assert.deepEqual(currentFrameRecord.rect,{x:frameColumnIndex*384,y:0,width:384,height:384});
 });
});
