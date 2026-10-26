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
