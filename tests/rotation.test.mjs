import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:`export * from './src/game/terrain/rotation'; export * from './src/game/terrain/elevation';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {toView,fromView,rotatedSurface,nextRotation,rotateConnections,project,pickSurface,canStep}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('직사각형 맵의 네 방향 투영과 클릭이 원래 논리 좌표를 보존한다',()=>{
 const map={columns:5,rows:3,elevations:Array.from({length:3},()=>Array(5).fill(0))};
 for(let turn=0;turn<4;turn++){
  const view=rotatedSurface(map,turn);
  for(let row=0;row<map.rows;row++)for(let column=0;column<map.columns;column++){
   const cell={column,row},v=toView(cell,map,turn),screen=project(v,view);
   assert.deepEqual(fromView(v,map,turn),cell);
   assert.deepEqual(fromView(pickSurface(screen.x,screen.y,view),map,turn),cell);
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
  assert.equal(view.elevations[end.row][end.column],1);
 }
 assert.equal(rotateConnections(1,1),2);
 assert.equal(rotateConnections(8,1),1);
 for(let mask=0;mask<16;mask++)assert.equal(rotateConnections(rotateConnections(mask,1),3),mask);
});
test('높은 앞 지형에 가려진 타일을 반대 방향에서 선택할 수 있다',()=>{
 const map={columns:2,rows:1,elevations:[[0,2]]};
 const hidden={column:0,row:0};
 let point=project(hidden,map);
 assert.equal(pickSurface(point.x,point.y,map),null);
 const view=rotatedSurface(map,2),cell=toView(hidden,map,2);
 point=project(cell,view);
 assert.deepEqual(fromView(pickSurface(point.x,point.y,view),map,2),hidden);
});
