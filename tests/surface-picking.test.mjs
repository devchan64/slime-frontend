import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/game/terrain/elevation'; export * from './src/game/terrain/rotation'; export {elevationRange} from './src/game/terrain/viewport';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {elevationRange,pickSurface,project,cliffFaces,elevationTileFaces,rotatedSurface,CELL_WIDTH,CELL_HEIGHT,MAP_ORIGIN}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
// 변경 전 전체 탐색을 독립 참조로 보존해 지면·절벽·계단 겹침의 선택 우선순위를 비교한다.
function contains(x,y,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
function reference(x,y,map){
 for(let diagonal=map.columns+map.rows-2;diagonal>=0;diagonal--)
  for(let row=Math.min(map.rows-1,diagonal);row>=0;row--){
   const column=diagonal-row;if(column>=map.columns)continue;
   const cell={column,row},p=project(cell,map);
   const tile=map.elevationTiles?.find(t=>t.cell.column===column&&t.cell.row===row);
   if(tile){for(const face of elevationTileFaces(tile,map).reverse())if(contains(x,y,face.points))return face.top?cell:null;continue;}
   if(Math.abs(x-p.x)/(CELL_WIDTH/2)+Math.abs(y-p.y)/(CELL_HEIGHT/2)<=1)return cell;
   if(cliffFaces(cell,map).some(face=>contains(x,y,face)))return null;
  }
 return null;
}
test('직사각형·고도·계단·네 방향 회전의 선택 결과가 전체 탐색과 같다',()=>{
 const original={columns:7,rows:5,elevations:Array.from({length:5},(_,r)=>Array.from({length:7},(_,c)=>(c+r)%3)),
 elevationTiles:[{id:'stairs',kind:'stairs',asset:'stone-step-tile',cell:{column:1,row:0},lower:{column:0,row:0}}]};
 for(let rotation=0;rotation<4;rotation++){
  const map=rotatedSurface(original,rotation);
  for(let x=MAP_ORIGIN.x-220;x<=MAP_ORIGIN.x+220;x+=11)
   for(let y=MAP_ORIGIN.y-70;y<=MAP_ORIGIN.y+220;y+=7){
    assert.deepEqual(pickSurface(x,y,map,elevationRange(map)),reference(x,y,map),`고도 범위 회전 ${rotation}: ${x},${y}`);
   }
  for(let row=0;row<map.rows;row++)for(let column=0;column<map.columns;column++){
   const p=project({column,row},map);
   for(const [dx,dy] of [[0,0],[32,0],[-32,0],[0,16],[0,-16]])
    assert.deepEqual(pickSurface(p.x+dx,p.y+dy,map,elevationRange(map)),reference(p.x+dx,p.y+dy,map));
  }
 }
});
test('백만 셀 맵 선택은 맵 면적 대신 대각선 후보만 읽는다',()=>{
 let reads=0;const map={columns:1000,rows:1000,get elevations(){reads++;return undefined;}};
 assert.deepEqual(pickSurface(MAP_ORIGIN.x,MAP_ORIGIN.y,map,{min:0,max:0}),{column:0,row:0});
 assert.ok(reads<20000,`고도 조회 ${reads}`);
});
test('맵 밖과 유효하지 않은 포인터 좌표는 선택하지 않는다',()=>{
 const map={columns:4,rows:3};
 for(const [x,y] of [[1e300,0],[-1e300,0],[Infinity,0],[NaN,1],[1,-Infinity],[0,0],[MAP_ORIGIN.x,MAP_ORIGIN.y-100]])
  assert.equal(pickSurface(x,y,map,{min:0,max:0}),null);
});


test('고도 범위를 전달하면 평지의 검사 횟수는 맵 크기와 무관하다',()=>{
 const counts=[];
 for(const length of [100,1000,10000]){
  let reads=0;
  const map={columns:length,rows:length,get elevations(){reads++;return undefined;}};
  assert.deepEqual(pickSurface(MAP_ORIGIN.x,MAP_ORIGIN.y,map,{min:0,max:0}),{column:0,row:0});
  counts.push(reads);
 }
 assert.equal(counts[0],counts[1]);assert.equal(counts[1],counts[2]);assert.ok(counts[0]<100);
});

test('높은 절벽·낮은 지형의 수직 범위에서도 전체 탐색 결과를 유지한다',()=>{
 const map={columns:9,rows:6,elevations:Array.from({length:6},(_,r)=>Array.from({length:9},(_,c)=>(r*7+c*3)%18-4))};
 const heights=elevationRange(map);
 for(let x=MAP_ORIGIN.x-210;x<=MAP_ORIGIN.x+280;x+=13)
  for(let y=MAP_ORIGIN.y-350;y<=MAP_ORIGIN.y+360;y+=17)
   assert.deepEqual(pickSurface(x,y,map,heights),reference(x,y,map));
});
