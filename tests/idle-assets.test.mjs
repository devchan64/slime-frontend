import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const idleModulePath = pathToFileURL(resolve('src/game/animation/idleActors.ts')).href;
const idleBundleOutput = await build({entryPoints:['src/game/animation/idleActors.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.url':JSON.stringify(idleModulePath)}});
const {ACTOR_IDLE_ASSETS,ACTOR_IDLE_TEXTURES,DEFAULT_IDLE_DIRECTION_ASSETS,resolveActorIdleAsset,updateActorIdleFrame,updateActorRestPlayback,calculateRestExitDuration} = await import(`data:text/javascript;base64,${Buffer.from(idleBundleOutput.outputFiles[0].text).toString('base64')}`);

test('캐릭터 대기·휴식과 몬스터 15종의 등록 파일·관리 ID가 중복되지 않는다',()=>{
 const registeredIdleAssets=Object.values(ACTOR_IDLE_ASSETS);
 assert.equal(registeredIdleAssets.length,17);
 assert.equal(new Set(registeredIdleAssets.map(idleAssetRecord=>idleAssetRecord.key)).size,17);
 assert.equal(new Set(registeredIdleAssets.map(idleAssetRecord=>idleAssetRecord.animation.data.animationId)).size,17);
 for(const idleAssetRecord of registeredIdleAssets) assert.ok(existsSync(new URL(idleAssetRecord.url)));
});
test('등록된 모든 방향은 지정된 시간 경계와 반복·정지 정책을 따른다',()=>{
 for(const idleAssetRecord of Object.values(ACTOR_IDLE_ASSETS)) {
  for(const idleClipRecord of idleAssetRecord.animation.data.clips) {
   let accumulatedFrameTime=0;
   for(const idleFrameRecord of idleClipRecord.frames) {
    assert.equal(idleAssetRecord.animation.sample(idleClipRecord.clipId,accumulatedFrameTime).frame.frameId,idleFrameRecord.frameId);
    accumulatedFrameTime+=idleFrameRecord.durationMs;
   }
   assert.equal(idleAssetRecord.animation.sample(idleClipRecord.clipId,accumulatedFrameTime).frame.frameId, idleClipRecord.loop ? idleClipRecord.frames[0].frameId : idleClipRecord.frames.at(-1).frameId);
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
 assert.equal(ACTOR_IDLE_TEXTURES.length,17);
 assert.equal(new Set(ACTOR_IDLE_TEXTURES.map(currentAssetRecord=>currentAssetRecord.key)).size,17);
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
   assert.match(renderedCharacterImage.frame.name,new RegExp(`${currentDirectionName}\\.${(currentFrameTime/125)%8}$`));
  }
 }
 assert.throws(()=>resolveActorIdleAsset('human','invalid'));
});
test('정면왼쪽 대기 8프레임은 4열2행과 384px 셀 크기를 유지한다',()=>{
 const currentAnimationData=ACTOR_IDLE_ASSETS.human.animation.data;
 assert.equal(currentAnimationData.frames.length,8);
 assert.deepEqual(currentAnimationData.sheet,{width:1536,height:768});
 assert.deepEqual(Object.keys(DEFAULT_IDLE_DIRECTION_ASSETS),['down_left']);
 currentAnimationData.frames.forEach((currentFrameRecord,frameColumnIndex)=>{
  assert.equal(currentFrameRecord.frameId,`down_left.${frameColumnIndex}`);
  assert.deepEqual(currentFrameRecord.rect,{x:(frameColumnIndex%4)*384,y:Math.floor(frameColumnIndex/4)*384,width:384,height:384});
 });
});

test('휴식은 진입 13프레임 뒤 고정되고 해제 8프레임은 반복하지 않는다',()=>{
 const restAssetAnimation = ACTOR_IDLE_ASSETS['human-rest'].animation;
 const entryClipIdentifier = restAssetAnimation.clip('rest-entry','down_left');
 const exitClipIdentifier = restAssetAnimation.clip('rest-exit','down_left');
 assert.equal(restAssetAnimation.data.clips.find(currentClipRecord=>currentClipRecord.clipId===entryClipIdentifier).frames.length,13);
 assert.equal(restAssetAnimation.data.clips.find(currentClipRecord=>currentClipRecord.clipId===exitClipIdentifier).frames.length,8);
 for(const currentClipRecord of restAssetAnimation.data.clips) assert.equal(currentClipRecord.loop,false);
 for(const currentTimeValue of [1625,10000,3600000]) assert.equal(restAssetAnimation.sample(entryClipIdentifier,currentTimeValue).frame.frameId,'down_left.12');
 assert.equal(restAssetAnimation.sample(exitClipIdentifier,999).frame.frameId,'down_left.20');
 assert.equal(restAssetAnimation.sample(exitClipIdentifier,1000).frame.frameId,'down_left.20');
});

test('휴식 해제 완료 시 이미지의 대기 텍스처와 입식 배율을 복구한다',()=>{
 const restAssetAnimation = ACTOR_IDLE_ASSETS['human-rest'].animation;
 const spriteTextureRecord = {getSourceImage:()=>restAssetAnimation.data.sheet,has:()=>false,add:()=>true};
 const renderedCharacterData = new Map([['actorDisplayHeight',80],['actorIdleKind','human-rest'],['idlePhaseOffset',0]]);
 const renderedCharacterImage = {scene:{textures:{exists:()=>true,get:()=>spriteTextureRecord},time:{now:0}},frame:{name:''},
  getData(currentDataName){return renderedCharacterData.get(currentDataName);},
  setData(currentDataName,currentDataValue){renderedCharacterData.set(currentDataName,currentDataValue);return this;},
  setTexture(currentTextureKey,currentFrameName){this.textureKey=currentTextureKey;this.frame.name=currentFrameName;return this;},
  setOrigin(currentOriginValueX,currentOriginValueY){this.originX=currentOriginValueX;this.originY=currentOriginValueY;return this;},
  setScale(currentScaleValue){this.scaleValue=currentScaleValue;return this;}};
 assert.equal(calculateRestExitDuration(),1000);
 assert.equal(updateActorRestPlayback(renderedCharacterImage,'down_left',{actionNameValue:'rest-entry',elapsedTimeValue:10000}),true);
 assert.match(renderedCharacterImage.frame.name,/down_left\.12$/);
 assert.equal(updateActorRestPlayback(renderedCharacterImage,'down_left',{actionNameValue:'rest-exit',elapsedTimeValue:999}),true);
 assert.match(renderedCharacterImage.frame.name,/down_left\.20$/);
 assert.equal(updateActorRestPlayback(renderedCharacterImage,'down_left',null),false);
 updateActorIdleFrame(renderedCharacterImage,'down_left');
 assert.equal(renderedCharacterImage.textureKey,ACTOR_IDLE_ASSETS.human.key);
 assert.equal(renderedCharacterImage.getData('actorIdleKind'),'human');
 assert.equal(renderedCharacterImage.scaleValue,80/365.5);
});
