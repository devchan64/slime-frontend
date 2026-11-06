import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/actorViewport.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {ActorWindowCache}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('먼 개체는 생성하지 않고 화면 이동·축소·복귀 때 필요한 표시 자원만 유지한다',()=>{
 const alive=new Set(),counts=new Map();
 const cache=new ActorWindowCache(Array.from({length:10000},(_,id)=>({id:String(id),x:id*100,y:0,create(){
  const value={id};alive.add(value);counts.set(id,(counts.get(id)??0)+1);return value;
 }})),value=>{assert.ok(alive.delete(value));});
 const bounds={left:0,top:0,right:400,bottom:400};
 cache.sync(bounds);assert.ok(alive.size>0&&alive.size<15);assert.equal(counts.has(9999),false);
 const initial=[...alive];cache.sync(bounds);assert.deepEqual([...alive],initial);
 cache.sync({...bounds,left:50000,right:50400});assert.ok(initial.every(value=>!alive.has(value)));
 assert.ok(alive.size<15);
 cache.sync(bounds);assert.equal(counts.get(0),2);
 const normal=alive.size;cache.sync({...bounds,left:-400,right:1200});assert.ok(alive.size>normal);
 cache.clear();assert.equal(alive.size,0);cache.clear();
});

test('화면 가장자리에서 몸체·이름표·한 칸 이동의 여유 범위를 포함한다',()=>{
 const visible=[];
 const entries=[{id:'head',x:50,y:220},{id:'motion',x:-64,y:50},{id:'negative',x:-200,y:-200},{id:'far',x:2000,y:2000}];
 const cache=new ActorWindowCache(entries.map(entry=>({...entry,create:()=>{visible.push(entry.id);return entry.id;}})),()=>{});
 cache.sync({left:0,top:0,right:100,bottom:100});
 assert.deepEqual(new Set(visible),new Set(['head','motion','negative']));
});

test('상태가 반복되어도 동일 개체를 재사용하고 변경·삭제된 개체만 폐기한다',()=>{
 const currentCreatedObjects=[],currentDisposedObjects=[];
 const createActorEntry=(currentActorIdentifier,currentActorSignature,currentPositionX=0)=>({id:currentActorIdentifier,signature:currentActorSignature,x:currentPositionX,y:0,create(){const currentActorValue={id:currentActorIdentifier,signature:currentActorSignature};currentCreatedObjects.push(currentActorValue);return currentActorValue;}});
 const currentViewBounds={left:0,top:0,right:100,bottom:100};
 const currentActorCache=new ActorWindowCache([createActorEntry('hero','idle'),createActorEntry('monster','idle')],currentActorValue=>currentDisposedObjects.push(currentActorValue));
 currentActorCache.sync(currentViewBounds);
 for(let currentUpdateIndex=0;currentUpdateIndex<100;currentUpdateIndex++){
  currentActorCache.updateEntries([createActorEntry('hero','idle'),createActorEntry('monster','idle')]);currentActorCache.sync(currentViewBounds);
 }
 assert.equal(currentCreatedObjects.length,2);assert.equal(currentDisposedObjects.length,0);
 currentActorCache.updateEntries([createActorEntry('hero','walking'),createActorEntry('monster','idle')]);currentActorCache.sync(currentViewBounds);
 assert.equal(currentCreatedObjects.length,3);assert.deepEqual(currentDisposedObjects,[currentCreatedObjects[0]]);
 currentActorCache.updateEntries([createActorEntry('hero','walking')]);currentActorCache.sync(currentViewBounds);
 assert.deepEqual(currentDisposedObjects,[currentCreatedObjects[0],currentCreatedObjects[1]]);
 currentActorCache.clear();assert.equal(currentDisposedObjects.length,3);
});

test('상태 갱신 후 카메라 범위 이탈·재진입 및 서명 없는 개체의 교체를 보존한다',()=>{
 let currentCreationCount=0,currentDisposalCount=0;
 const createActorEntry=(currentPositionX,currentActorSignature)=>({id:'hero',x:currentPositionX,y:0,signature:currentActorSignature,create(){currentCreationCount++;return {};}});
 const currentViewBounds={left:0,top:0,right:100,bottom:100};
 const currentActorCache=new ActorWindowCache([createActorEntry(0,'same')],()=>currentDisposalCount++);
 currentActorCache.sync(currentViewBounds);
 currentActorCache.updateEntries([createActorEntry(10000,'same')]);currentActorCache.sync(currentViewBounds);
 assert.equal(currentDisposalCount,1);
 currentActorCache.updateEntries([createActorEntry(0,'same')]);currentActorCache.sync(currentViewBounds);assert.equal(currentCreationCount,2);
 currentActorCache.updateEntries([createActorEntry(0,undefined)]);currentActorCache.sync(currentViewBounds);assert.equal(currentDisposalCount,2);assert.equal(currentCreationCount,3);
});
