import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:`export * from './src/game/terrain/rotation'; export * from './src/game/terrain/elevation'; export {elevationRange} from './src/game/terrain/viewport';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {elevationRange,toView,fromView,rotatedSurface,nextRotation,rotateConnections,project,pickSurface,canStep,heightAt,cliffFaces}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('직사각형 맵의 네 방향 투영과 클릭이 원래 논리 좌표를 보존한다',()=>{
 const map={columns:5,rows:3,elevations:Array.from({length:3},()=>Array(5).fill(0))};
 for(let turn=0;turn<4;turn++){
  const view=rotatedSurface(map,turn);
  for(let row=0;row<map.rows;row++)for(let column=0;column<map.columns;column++){
   const cell={column,row},v=toView(cell,map,turn),screen=project(v,view);
   assert.deepEqual(fromView(v,map,turn),cell);
   assert.deepEqual(fromView(pickSurface(screen.x,screen.y,view,elevationRange(view)),map,turn),cell);
  }
 }
 assert.equal(nextRotation(3,1),0);assert.equal(nextRotation(0,-1),3);
});
test('회전은 높이와 계단 통행을 보존하고 도로·물 연결 방향을 함께 바꾼다',()=>{
 const map={columns:3,rows:2,elevations:[[0,1,2],[0,1,2]],ramps:[{start:{column:0,row:0},end:{column:1,row:0}}]};
 for(let turn=0;turn<4;turn++){
  const view=rotatedSurface(map,turn);
  const {start,end}=view.ramps[0];
  assert.equal(canStep(start,end,view),true);
  assert.equal(heightAt(end,view),1);
 }
 assert.equal(rotateConnections(1,1),2);
 assert.equal(rotateConnections(8,1),1);
 for(let mask=0;mask<16;mask++)assert.equal(rotateConnections(rotateConnections(mask,1),3),mask);
});
test('높은 앞 지형에 가려진 타일을 반대 방향에서 선택할 수 있다',()=>{
 const map={columns:2,rows:1,elevations:[[0,2]]};
 const hidden={column:0,row:0};
 let point=project(hidden,map);
 assert.equal(pickSurface(point.x,point.y,map,elevationRange(map)),null);
 const view=rotatedSurface(map,2),cell=toView(hidden,map,2);
 point=project(cell,view);
 assert.deepEqual(fromView(pickSurface(point.x,point.y,view,elevationRange(view)),map,2),hidden);
});

test('고도 지연 조회의 네 회전은 전체 행렬을 만든 기준과 투영·절벽·선택 결과가 같다',()=>{
 const map={columns:9,rows:6,elevations:Array.from({length:6},(_,r)=>Array.from({length:9},(_,c)=>(c*7+r*3)%4))};
 for(let rotation=0;rotation<4;rotation++){
  const view=rotatedSurface(map,rotation);
  const reference={columns:view.columns,rows:view.rows,elevations:Array.from({length:view.rows},(_,row)=>Array.from({length:view.columns},(_,column)=>{
   const source=fromView({column,row},map,rotation);return map.elevations[source.row][source.column];
  }))};
  for(let row=0;row<view.rows;row++)for(let column=0;column<view.columns;column++){
   const cell={column,row};assert.equal(heightAt(cell,view),reference.elevations[row][column]);
   assert.deepEqual(project(cell,view),project(cell,reference));assert.deepEqual(cliffFaces(cell,view),cliffFaces(cell,reference));
   const point=project(cell,view);
   assert.deepEqual(pickSurface(point.x,point.y,view,elevationRange(view)),pickSurface(point.x,point.y,reference,elevationRange(reference)));
  }
 }
});

test('100만 셀 맵의 회전은 고도 셀을 미리 읽거나 회전 행렬을 할당하지 않는다',()=>{
 let reads=0;const row=new Proxy(Array(1000).fill(2),{get(target,key){if(/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key);}});
 const map={columns:1000,rows:1000,elevations:Array(1000).fill(row)};
 for(let rotation=0;rotation<4;rotation++){
  reads=0;const view=rotatedSurface(map,rotation);
  assert.equal(reads,0);assert.equal(view.elevations,undefined);assert.equal(view.heightSource.surface,map);
  assert.equal(heightAt({column:999,row:500},view),2);assert.equal(reads,1);
 }
});

test('많은 승강 타일의 투영·선택은 회전별 색인으로 조회하고 목록 방식과 일치한다',()=>{
 const map={columns:200,rows:100,elevations:Array.from({length:100},()=>Array.from({length:200},(_,c)=>c%2)),
  elevationTiles:Array.from({length:10000},(_,i)=>({id:`stairs-${i}`,kind:'stairs',asset:'stone-step-tile',
   cell:{column:(i%100)*2+1,row:Math.floor(i/100)},lower:{column:(i%100)*2,row:Math.floor(i/100)}}))};
 for(let rotation=0;rotation<4;rotation++){
  const view=rotatedSurface(map,rotation),reference={...view,elevationTileIndex:undefined};
  const heights=elevationRange(view);
  let reads=0;
  view.elevationTiles=new Proxy(view.elevationTiles,{get(target,key){
   if(/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key);
  }});
  for(const source of [{column:0,row:0},{column:1,row:0},{column:100,row:50},{column:101,row:50},{column:199,row:99}]){
   const cell=toView(source,map,rotation),point=project(cell,view);
   assert.deepEqual(point,project(cell,reference));
   assert.deepEqual(cliffFaces(cell,view),cliffFaces(cell,reference));
   for(let y=-24;y<=24;y+=8)for(let x=-32;x<=32;x+=8)
    assert.deepEqual(pickSurface(point.x+x,point.y+y,view,heights),pickSurface(point.x+x,point.y+y,reference,heights));
  }
  assert.equal(reads,0,'준비 후 투영·선택에서 전체 계단 목록을 순회하지 않는다');
 }
});
