import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const actorPickingBundle=await build({entryPoints:['src/game/terrain/actorPicking.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {pickActorPosition}=await import('data:text/javascript;base64,'+Buffer.from(actorPickingBundle.outputFiles[0].text).toString('base64'));
const actorRegionEntries=[
 {position:{column:1,row:1},depth:2,left:0,right:20,top:0,bottom:40},
 {position:{column:2,row:2},depth:3,left:10,right:30,top:10,bottom:50},
];
test('겹친 이미지는 앞쪽부터 선택하며 반복 선택으로 가려진 대상과 앞쪽을 순환한다',()=>{
 const pointerWorldPoint={x:15,y:20};
 assert.deepEqual(pickActorPosition(pointerWorldPoint,actorRegionEntries,null),{column:2,row:2});
 assert.deepEqual(pickActorPosition(pointerWorldPoint,actorRegionEntries,{column:2,row:2}),{column:1,row:1});
 assert.deepEqual(pickActorPosition(pointerWorldPoint,actorRegionEntries,{column:1,row:1}),{column:2,row:2});
});
test('빈 공간은 타일 선택으로 넘기고 동일 타일의 복수 이미지는 중복 순환하지 않는다',()=>{
 assert.equal(pickActorPosition({x:100,y:100},actorRegionEntries,null),null);
 assert.deepEqual(pickActorPosition({x:15,y:20},[...actorRegionEntries,actorRegionEntries[1]],{column:2,row:2}),{column:1,row:1});
 assert.deepEqual(pickActorPosition({x:5,y:5},actorRegionEntries,{column:1,row:1}),{column:1,row:1});
});
