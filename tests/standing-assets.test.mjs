import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const standingModulePath = pathToFileURL(resolve('src/game/animation/standingActors.ts')).href;
const standingBundleOutput = await build({entryPoints:['src/game/animation/standingActors.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.url':JSON.stringify(standingModulePath)}});
const {ACTOR_STANDING_ASSETS,ACTOR_STANDING_TEXTURES,DEFAULT_STANDING_DIRECTION_ASSETS,resolveActorStandingAsset,updateActorStandingFrame} = await import(`data:text/javascript;base64,${Buffer.from(standingBundleOutput.outputFiles[0].text).toString('base64')}`);

test('캐릭터 스탠딩·휴식과 몬스터 10종의 등록 파일·관리 ID가 중복되지 않는다',()=>{
 const registeredStandingAssets=Object.values(ACTOR_STANDING_ASSETS);
 assert.equal(registeredStandingAssets.length,12);
 assert.equal(new Set(registeredStandingAssets.map(standingAssetRecord=>standingAssetRecord.key)).size,12);
 assert.equal(new Set(registeredStandingAssets.map(standingAssetRecord=>standingAssetRecord.animation.data.animationId)).size,12);
 for(const standingAssetRecord of registeredStandingAssets) assert.ok(existsSync(new URL(standingAssetRecord.url)));
});
test('등록된 모든 방향은 지정된 시간 경계에서 프레임을 전환하고 반복한다',()=>{
 for(const standingAssetRecord of Object.values(ACTOR_STANDING_ASSETS)) {
  for(const standingClipRecord of standingAssetRecord.animation.data.clips) {
   let accumulatedFrameTime=0;
   for(const standingFrameRecord of standingClipRecord.frames) {
    assert.equal(standingAssetRecord.animation.sample(standingClipRecord.clipId,accumulatedFrameTime).frame.frameId,standingFrameRecord.frameId);
    accumulatedFrameTime+=standingFrameRecord.durationMs;
   }
   assert.equal(standingClipRecord.loop,true);
   assert.equal(standingAssetRecord.animation.sample(standingClipRecord.clipId,accumulatedFrameTime).frame.frameId,standingClipRecord.frames[0].frameId);
  }
 }
});

test('첫 프레임이 이미 선택되어 있어도 발 기준점을 적용한다',()=>{
 const humanStandingAsset=ACTOR_STANDING_ASSETS.human;
 const initialStandingFrame=humanStandingAsset.animation.data.frames[0];
 const renderedCharacterImage={
  scene:{time:{now:0}}, frame:{name:`cell:${humanStandingAsset.animation.data.animationId}@${humanStandingAsset.animation.data.version}:${initialStandingFrame.frameId}`},
  originX:0.5,originY:0.5,
  getData(standingDataKey){return standingDataKey==='actorStandingKind'?'human':0;},
  setTexture(){throw new Error('동일 프레임은 다시 로드하지 않는다.');},
  setOrigin(selectedFrameOriginX,selectedFrameOriginY){this.originX=selectedFrameOriginX;this.originY=selectedFrameOriginY;return this;},
 };
 updateActorStandingFrame(renderedCharacterImage,'down_left');
 assert.equal(renderedCharacterImage.originX,initialStandingFrame.anchor.x/initialStandingFrame.rect.width);
 assert.equal(renderedCharacterImage.originY,initialStandingFrame.anchor.y/initialStandingFrame.rect.height);
});

test('네 방향 텍스처가 모두 로드 대상이고 방향 전환 시 올바른 시트를 사용한다',()=>{
 assert.equal(ACTOR_STANDING_TEXTURES.length,15);
 assert.equal(new Set(ACTOR_STANDING_TEXTURES.map(currentAssetRecord=>currentAssetRecord.key)).size,15);
 const renderedCharacterImage={scene:{time:{now:0}},frame:{name:''},originX:0,originY:0,
  getData(currentDataName){return currentDataName==='actorStandingKind'?'human':0;},
  setTexture(currentTextureKey,currentFrameName){this.textureKey=currentTextureKey;this.frame.name=currentFrameName;return this;},
  setOrigin(currentOriginValueX,currentOriginValueY){this.originX=currentOriginValueX;this.originY=currentOriginValueY;return this;}};
 for(const [currentDirectionName,currentDirectionAsset] of Object.entries(DEFAULT_STANDING_DIRECTION_ASSETS)) {
  assert.ok(existsSync(new URL(currentDirectionAsset.url)));
  for(const currentFrameTime of [0,400,800,1200,1600]) {
   renderedCharacterImage.scene.time.now=currentFrameTime;
   updateActorStandingFrame(renderedCharacterImage,currentDirectionName);
   assert.equal(renderedCharacterImage.textureKey,currentDirectionAsset.key);
   assert.match(renderedCharacterImage.frame.name,new RegExp(`${currentDirectionName}\\.${(currentFrameTime/400)%4}$`));
  }
 }
 assert.throws(()=>resolveActorStandingAsset('human','invalid'));
});
test('16개 앵커는 양발 접지점 평균이며 원점 변환 후 월드 접지 중간이 고정된다',()=>{
 const sourceContactMetadata=JSON.parse(readFileSync('src/assets/characters/default/standing-v4/source.json','utf8'));
 for(const currentFrameRecord of ACTOR_STANDING_ASSETS.human.animation.data.frames) {
  const currentFootContacts=sourceContactMetadata.contacts[currentFrameRecord.frameId];
  const currentFootEndpoints=sourceContactMetadata.footprintEndpoints[currentFrameRecord.frameId];
  if(sourceContactMetadata.coordinateMode==='toe-heel')for(const footSequenceIndex of [0,1]) for(const coordinateAxisName of ['x','y']) assert.equal(currentFootContacts[footSequenceIndex][coordinateAxisName],Math.round((currentFootEndpoints[footSequenceIndex*2][coordinateAxisName]+currentFootEndpoints[footSequenceIndex*2+1][coordinateAxisName])/2));
  for(const coordinateAxisName of ['x','y']) {
   const midpointCoordinateValue=(currentFootContacts[0][coordinateAxisName]+currentFootContacts[1][coordinateAxisName])/2;
   assert.equal(currentFrameRecord.anchor[coordinateAxisName],Math.round(midpointCoordinateValue));
   assert.ok(Number.isInteger(currentFrameRecord.anchor[coordinateAxisName]));
   const transformedMidpointValue=currentFootContacts.reduce((accumulatedCoordinateValue,currentFootContact)=>accumulatedCoordinateValue+(currentFootContact[coordinateAxisName]-currentFrameRecord.anchor[coordinateAxisName])*60/sourceContactMetadata.referenceBodyHeight,0)/2;
   assert.ok(Math.abs(transformedMidpointValue)<=0.5*60/sourceContactMetadata.referenceBodyHeight+1e-9);
  }
 }
 assert.equal(ACTOR_STANDING_ASSETS.human.animation.data.frames.length,16);
 assert.equal(existsSync('src/assets/characters/default/standing-v3'),false);
});
