import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {sampleTerrainEffectFrame,mountTerrainEffectLayer,sampleEffectAnimationFrame} from '../packages/field-renderer/terrain-effects.mjs';
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
 currentSceneRecord.time.now=500;currentSceneEvents.emit('update');assert.equal(currentFrameIndex,3);
 currentSceneRecord.time.now=4000;currentSceneEvents.emit('update');assert.equal(currentFrameIndex,0);
 for(const [currentFrameNumber,currentFrameBounds] of currentSheetFrames){
  assert.ok(currentFrameBounds[1]+currentFrameBounds[3]<=1774);
  assert.ok(currentFrameBounds[2]+currentFrameBounds[4]<=887);
 }
 currentSpriteRecord.emit('destroy');assert.equal(currentSceneEvents.listenerCount('update'),0);
 currentSceneRecord.textures.exists=()=>false;
 assert.throws(()=>mountTerrainEffectLayer(currentSceneRecord,{terrainEffects:[currentGlowRecord]},()=>({x:0,y:0})),/시트가 로드되지/);
});

test('버섯 발광은 본체 복제 없이 시트를 반복 재생한다',()=>{
 const currentSceneEvents=new EventEmitter();
 const currentHostSprite={x:137,y:229,depth:450,displayWidth:80,displayHeight:70,originX:.5,originY:1,getData:currentDataKey=>currentDataKey==='terrainEffectObjectId'?'cap':undefined};
 const currentHaloSprite=new EventEmitter();
 for(const currentMethodName of ['setOrigin','setPosition','setTint','setBlendMode','setAlpha','setDepth','setData','setFrame','setDisplaySize'])currentHaloSprite[currentMethodName]=(...currentCallValues)=>{currentHaloSprite[currentMethodName+'Values']=currentCallValues;return currentHaloSprite;};
 let currentCreatedImages=0;
 const currentSceneRecord={children:{list:[currentHostSprite]},time:{now:0},events:currentSceneEvents,textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:1774,height:887}),has:()=>true})},add:{image:(...currentImageValues)=>{currentCreatedImages++;assert.equal(currentImageValues[2],'safe-terrain-glow-mushroom-single');return currentHaloSprite;}}};
 mountTerrainEffectLayer(currentSceneRecord,{effectProfiles:{'mushroom-variant-2-v1':{key:'safe-terrain-glow-mushroom-single',alpha:.65,target:[.1,.2,.9,.6],frames:Array.from({length:8},()=>[.2,.3,.8,.7])}},objects:[{id:'cap',textureKey:'mushroom-variant-2-v1',position:{column:2,row:3}}],terrainEffects:[{...currentEffectRecord,kind:'glow',objectId:'cap',position:undefined}]},()=>({x:100,y:100}));
 const currentInitialFrame=currentHaloSprite.setFrameValues[0];currentSceneRecord.time.now=500;currentSceneEvents.emit('update');
 assert.deepEqual(currentHaloSprite.setDisplaySizeValues.map(currentValue=>Math.round(currentValue)),[107,70]);
 assert.notEqual(currentHaloSprite.setFrameValues[0],currentInitialFrame);assert.equal(currentCreatedImages,1);assert.ok(currentHaloSprite.setDisplaySizeValues.every(Number.isFinite));assert.ok(currentHaloSprite.setPositionValues.every(Number.isFinite));
 currentHaloSprite.emit('destroy');assert.equal(currentSceneEvents.listenerCount('update'),0);
});

test('나방 시트는 발광 합성으로 8프레임을 반복하고 리스너를 해제한다',()=>{
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
 const currentGlowRecord={...currentEffectRecord,kind:'moths',version:2,count:3,seed:0};
 mountTerrainEffectLayer(currentSceneRecord,{columns:10,rows:10,terrainEffects:[currentGlowRecord]},()=>({x:100,y:100}));
 assert.equal(currentBlendMode,'ADD');assert.equal(currentSheetFrames.size,8);assert.equal(currentFrameIndex,0);
 currentSceneRecord.time.now=167;currentSceneEvents.emit('update');assert.equal(currentFrameIndex,1);
 currentSceneRecord.time.now=1334;currentSceneEvents.emit('update');assert.equal(currentFrameIndex,0);
 for(const [currentFrameNumber,currentFrameBounds] of currentSheetFrames){
  assert.ok(currentFrameBounds[1]+currentFrameBounds[3]<=1774);
  assert.ok(currentFrameBounds[2]+currentFrameBounds[4]<=887);
 }
 currentSpriteRecord.emit('destroy');assert.equal(currentSceneEvents.listenerCount('update'),0);
 currentSceneRecord.textures.exists=()=>false;
 assert.throws(()=>mountTerrainEffectLayer(currentSceneRecord,{terrainEffects:[currentGlowRecord]},()=>({x:0,y:0})),/시트가 로드되지/);
});

test('지면광은 앞쪽 타일에도 이어지고 도형 재생성 없이 맥동하며 제거된다',()=>{
 const currentSceneEvents=new EventEmitter();
 const currentCreatedGraphics=[];
 const currentSceneRecord={time:{now:0},events:currentSceneEvents,add:{graphics:()=>{
  const currentGraphicRecord={polygons:[],destroyed:false};
  for(const currentMethodName of ['setBlendMode','setData','fillStyle'])currentGraphicRecord[currentMethodName]=()=>currentGraphicRecord;
  currentGraphicRecord.setDepth=currentDepthValue=>{currentGraphicRecord.depth=currentDepthValue;return currentGraphicRecord;};
  currentGraphicRecord.setAlpha=currentAlphaValue=>{currentGraphicRecord.alpha=currentAlphaValue;return currentGraphicRecord;};
  currentGraphicRecord.fillPoints=currentPolygonPoints=>currentGraphicRecord.polygons.push(currentPolygonPoints);
  currentGraphicRecord.destroy=()=>{currentGraphicRecord.destroyed=true;};
  currentCreatedGraphics.push(currentGraphicRecord);return currentGraphicRecord;
 }}};
 const currentGroundEffect={...currentEffectRecord,kind:'glow',height:0,radius:2.8,position:{column:2,row:2}};
 const [currentGroundLayer]=mountTerrainEffectLayer(currentSceneRecord,{columns:5,rows:5,terrainEffects:[currentGroundEffect]},currentCellPosition=>({x:(currentCellPosition.column-currentCellPosition.row)*40,y:(currentCellPosition.column+currentCellPosition.row)*20}));
 assert.ok(currentCreatedGraphics.some(currentGraphicRecord=>currentGraphicRecord.depth>600));
 assert.ok(currentCreatedGraphics.every(currentGraphicRecord=>currentGraphicRecord.depth%100>1&&currentGraphicRecord.depth%100<2));
 const currentPolygonCount=currentCreatedGraphics.reduce((currentTotalCount,currentGraphicRecord)=>currentTotalCount+currentGraphicRecord.polygons.length,0);
 const currentInitialAlpha=currentCreatedGraphics[0].alpha;
 currentSceneRecord.time.now=500;currentSceneEvents.emit('update');
 assert.notEqual(currentCreatedGraphics[0].alpha,currentInitialAlpha);
 assert.equal(currentCreatedGraphics.reduce((currentTotalCount,currentGraphicRecord)=>currentTotalCount+currentGraphicRecord.polygons.length,0),currentPolygonCount);
 currentGroundLayer.destroy();assert.ok(currentCreatedGraphics.every(currentGraphicRecord=>currentGraphicRecord.destroyed));assert.equal(currentSceneEvents.listenerCount('update'),0);
});

test('나방·반딧불 DB 정렬값이 위치·크기·밝기에 반영된다',()=>{
 for(const currentEffectKind of ['moths','fireflies']){
  const currentSceneEvents=new EventEmitter();
  const currentSpriteRecord=new EventEmitter();
  for(const currentMethodName of ['setOrigin','setPosition','setTint','setBlendMode','setAlpha','setDepth','setData','setFrame','setDisplaySize'])currentSpriteRecord[currentMethodName]=(...currentValues)=>{currentSpriteRecord[currentMethodName+'Values']=currentValues;return currentSpriteRecord;};
  const currentSceneRecord={children:{list:[]},time:{now:0},events:currentSceneEvents,textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:800,height:400}),has:()=>true})},add:{image:()=>currentSpriteRecord}};
  mountTerrainEffectLayer(currentSceneRecord,{objects:[],effectProfiles:{[currentEffectKind]:{key:'safe-test-swarm',alpha:.4,target:[.25,.25,.75,.75],frames:Array.from({length:8},()=>[0,0,1,1])}},terrainEffects:[{version:2,id:'swarm',kind:currentEffectKind,position:{column:1,row:1},color:'#ffffff',radius:1,intensity:.5,periodMs:2000,height:40,seed:0,count:currentEffectKind==='moths'?3:7}]},()=>({x:100,y:100,depth:1}));
  assert.deepEqual(currentSpriteRecord.setPositionValues,[80,60]);
  assert.deepEqual(currentSpriteRecord.setDisplaySizeValues,[40,40]);
  assert.deepEqual(currentSpriteRecord.setAlphaValues,[.2]);
  assert.deepEqual(currentSpriteRecord.setBlendModeValues,[currentEffectKind==='moths'?'ADD':'NORMAL']);
 }
});

test('발광 시트는 6fps 경계와 8프레임 순환을 지킨다',()=>{
 assert.equal(sampleEffectAnimationFrame(0),0);
 assert.equal(sampleEffectAnimationFrame(166),0);
 assert.equal(sampleEffectAnimationFrame(167),1);
 assert.equal(sampleEffectAnimationFrame(1000),6);
 assert.equal(sampleEffectAnimationFrame(1333),7);
 assert.equal(sampleEffectAnimationFrame(1334),0);
});
