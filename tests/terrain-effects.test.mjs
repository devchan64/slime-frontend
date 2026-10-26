import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {sampleTerrainEffectFrame,mountTerrainEffectLayer} from '../packages/field-renderer/terrain-effects.mjs';
const currentEffectRecord={version:1,id:'moths',kind:'moths',position:{column:2,row:3},color:'#ffe8a3',radius:1,intensity:.7,periodMs:4000,height:40,count:6,seed:1};
test('나방은 결정적 궤적과 반배율 높이를 사용하고 프레임마다 움직인다',()=>{
 const currentFirstFrame=sampleTerrainEffectFrame(currentEffectRecord,0);
 assert.equal(currentFirstFrame.length,6);
 assert.deepEqual(currentFirstFrame,sampleTerrainEffectFrame(currentEffectRecord,0));
 assert.notDeepEqual(currentFirstFrame,sampleTerrainEffectFrame(currentEffectRecord,100));
 assert.ok(currentFirstFrame.every(currentParticleState=>currentParticleState.height<=20&&Math.abs(currentParticleState.column)<=1));
});
test('레이어 제거 시 애니메이션 리스너를 해제하고 다시 그려도 시간은 이어진다',()=>{
 const currentSceneEvents=new EventEmitter();
 const currentDrawRecords=[];
 const currentSceneRecord={time:{now:1000},events:currentSceneEvents,add:{graphics:()=>{
  const currentGraphicsRecord=new EventEmitter();
  for(const currentMethodName of ['clear','setDepth','setData','fillStyle'])currentGraphicsRecord[currentMethodName]=()=>currentGraphicsRecord;
  currentGraphicsRecord.fillEllipse=(...currentDrawArguments)=>currentDrawRecords.push(currentDrawArguments);
  return currentGraphicsRecord;
 }}};
 const currentMapRecord={columns:10,rows:10,terrainEffects:[currentEffectRecord]};
 const [currentGraphicsRecord]=mountTerrainEffectLayer(currentSceneRecord,currentMapRecord,()=>({x:100,y:100}),()=>10);
 const currentOriginalFrame=structuredClone(currentDrawRecords);
 assert.equal(currentSceneEvents.listenerCount('update'),1);
 currentGraphicsRecord.emit('destroy');assert.equal(currentSceneEvents.listenerCount('update'),0);
 currentDrawRecords.length=0;
 const [currentNextGraphics]=mountTerrainEffectLayer(currentSceneRecord,currentMapRecord,()=>({x:100,y:100}),()=>10);
 assert.deepEqual(currentDrawRecords,currentOriginalFrame);
 currentNextGraphics.emit('destroy');
});
test('연결 빌보드가 없는 이펙트를 조용히 건너뛰지 않는다',()=>{
 assert.throws(()=>mountTerrainEffectLayer({time:{now:0}},{terrainEffects:[{...currentEffectRecord,position:undefined,objectId:'missing'}]},()=>({x:0,y:0}),()=>0),/연결 대상/);
});
test('발광 시트는 8프레임으로 순환하고 제거 시 갱신을 해제한다',()=>{
 const currentSceneEvents=new EventEmitter();
 const currentSpriteRecord=new EventEmitter();
 const currentSheetFrames=new Map();
 let currentFrameIndex;
 let currentBlendMode;
 for(const currentMethodName of ['setAlpha','setDepth','setData','setDisplaySize','setTint'])currentSpriteRecord[currentMethodName]=()=>currentSpriteRecord;
 currentSpriteRecord.setBlendMode=currentSelectedMode=>{currentBlendMode=currentSelectedMode;return currentSpriteRecord;};
 currentSpriteRecord.setFrame=currentSelectedFrame=>{currentFrameIndex=currentSelectedFrame;return currentSpriteRecord;};
 const currentTextureRecord={getSourceImage:()=>({width:1774,height:887}),has:currentSelectedFrame=>currentSheetFrames.has(currentSelectedFrame),add:(currentSelectedFrame,...currentFrameBounds)=>currentSheetFrames.set(currentSelectedFrame,currentFrameBounds)};
 const currentSceneRecord={time:{now:0},events:currentSceneEvents,textures:{exists:()=>true,get:()=>currentTextureRecord},add:{image:()=>currentSpriteRecord}};
 const currentGlowRecord={...currentEffectRecord,kind:'glow',seed:0};
 mountTerrainEffectLayer(currentSceneRecord,{columns:10,rows:10,terrainEffects:[currentGlowRecord]},()=>({x:100,y:100}));
 assert.equal(currentBlendMode,'ADD');assert.equal(currentSheetFrames.size,8);assert.equal(currentFrameIndex,0);
 currentSceneRecord.time.now=500;currentSceneEvents.emit('update');assert.equal(currentFrameIndex,1);
 currentSceneRecord.time.now=4000;currentSceneEvents.emit('update');assert.equal(currentFrameIndex,0);
 for(const [currentFrameNumber,currentFrameBounds] of currentSheetFrames){
  assert.ok(currentFrameBounds[1]+currentFrameBounds[3]<=1774);
  assert.ok(currentFrameBounds[2]+currentFrameBounds[4]<=887);
 }
 currentSpriteRecord.emit('destroy');assert.equal(currentSceneEvents.listenerCount('update'),0);
 currentSceneRecord.textures.exists=()=>false;
 assert.throws(()=>mountTerrainEffectLayer(currentSceneRecord,{terrainEffects:[currentGlowRecord]},()=>({x:0,y:0})),/시트가 로드되지/);
});

test('연결 발광은 씨드와 관계없이 갓 시트를 쓰고 본체 앵커와 깊이를 따른다',()=>{
 const currentSceneEvents=new EventEmitter();
 const currentCreatedSprites=[];
 const currentSheetFrames=new Set();
 const currentHostSprite={x:137,y:229,depth:450,getData:currentDataKey=>currentDataKey==='terrainEffectObjectId'?'cap':undefined};
 const currentSceneRecord={children:{list:[currentHostSprite]},time:{now:0},events:currentSceneEvents,textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:1774,height:887}),has:currentFrameNumber=>currentSheetFrames.has(currentFrameNumber),add:currentFrameNumber=>currentSheetFrames.add(currentFrameNumber)})},add:{image:(currentScreenX,currentScreenY,currentTextureKey)=>{
  const currentSpriteRecord=new EventEmitter();Object.assign(currentSpriteRecord,{x:currentScreenX,y:currentScreenY,key:currentTextureKey});
  for(const currentMethodName of ['setAlpha','setData','setTint','setBlendMode','setFrame'])currentSpriteRecord[currentMethodName]=()=>currentSpriteRecord;
  currentSpriteRecord.setDepth=currentDepthValue=>{currentSpriteRecord.depth=currentDepthValue;return currentSpriteRecord;};
  currentSpriteRecord.setDisplaySize=(currentWidthValue,currentHeightValue)=>{Object.assign(currentSpriteRecord,{width:currentWidthValue,height:currentHeightValue});return currentSpriteRecord;};
  currentCreatedSprites.push(currentSpriteRecord);return currentSpriteRecord;
 }}};
 for(const currentSeedValue of [0,1,2]){
  mountTerrainEffectLayer(currentSceneRecord,{columns:10,rows:10,objects:[{id:'cap',position:{column:2,row:3}}],terrainEffects:[{...currentEffectRecord,kind:'glow',objectId:'cap',position:undefined,seed:currentSeedValue}]},()=>({x:100,y:100}));
 }
 for(const currentSpriteRecord of currentCreatedSprites){
  assert.equal(currentSpriteRecord.key,'safe-terrain-glow-core');assert.equal(currentSpriteRecord.x,137);assert.equal(currentSpriteRecord.y,209);
  assert.ok(currentSpriteRecord.depth>450&&currentSpriteRecord.depth<451);assert.ok(currentSpriteRecord.height<currentSpriteRecord.width);
  currentSpriteRecord.emit('destroy');
 }
 assert.equal(currentSceneEvents.listenerCount('update'),0);
 currentSceneRecord.children.list=[];
 assert.throws(()=>mountTerrainEffectLayer(currentSceneRecord,{objects:[{id:'cap',position:{column:2,row:3}}],terrainEffects:[{...currentEffectRecord,kind:'glow',position:undefined,objectId:'cap'}]},()=>({x:100,y:100})),/아직 렌더링/);
});
