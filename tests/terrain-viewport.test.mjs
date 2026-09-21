import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:`export * from './src/game/terrain/viewport'; export * from './src/game/terrain/elevation'; export * from './src/game/terrain/rotation';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {terrainWindow,elevationRange,TerrainWindowCache,project,cliffFaces,elevationTileFaces,rotatedSurface}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const includes=(w,c,r)=>c>=w.firstColumn&&c<=w.lastColumn&&r>=w.firstRow&&r<=w.lastRow;
const intersects=(points,b)=>Math.min(...points.map(p=>p.x))<=b.right&&Math.max(...points.map(p=>p.x))>=b.left&&Math.min(...points.map(p=>p.y))<=b.bottom&&Math.max(...points.map(p=>p.y))>=b.top;

test('네 방향 회전의 지면·높은 절벽·계단이 화면과 겹치면 반드시 생성 범위에 포함된다',()=>{
 const source={columns:31,rows:19,elevations:Array.from({length:19},(_,r)=>Array.from({length:31},(_,c)=>(c*3+r)%12)),
  elevationTiles:[{id:'step',cell:{column:2,row:2},lower:{column:2,row:1},kind:'stairs',asset:'stone-step-tile'}]};
 for(let rotation=0;rotation<4;rotation++){
  const surface=rotatedSurface(source,rotation),heights=elevationRange(surface);
  for(let top=-450;top<1000;top+=127)for(let left=-200;left<2300;left+=257){
   const bounds={left,top,right:left+180,bottom:top+120},window=terrainWindow(surface,heights,bounds);
   for(let row=0;row<surface.rows;row++)for(let column=0;column<surface.columns;column++){
    const cell={column,row},p=project(cell,surface);
    const polygons=[[{x:p.x-32,y:p.y-32},{x:p.x+32,y:p.y+16}],...cliffFaces(cell,surface)];
    const tile=surface.elevationTiles.find(t=>t.cell.column===column&&t.cell.row===row);
    if(tile)polygons.push(...elevationTileFaces(tile,surface).map(face=>face.points));
    if(polygons.some(points=>intersects(points,bounds)))assert.ok(includes(window,column,row),JSON.stringify({rotation,cell,bounds,window}));
   }
  }
 }
});
test('같은 카메라 크기에서는 백만 타일 맵도 생성 수가 전체 면적에 비례하지 않는다',()=>{
 const bounds={left:900,top:15000,right:1700,bottom:15600};
 const count=w=>Math.max(0,w.lastColumn-w.firstColumn+1)*Math.max(0,w.lastRow-w.firstRow+1);
 const a=terrainWindow({columns:1000,rows:1000},{min:0,max:3},bounds);
 const b=terrainWindow({columns:10000,rows:10000},{min:0,max:3},bounds);
 assert.equal(count(a),count(b));assert.ok(count(a)<3000);
 const outside=terrainWindow({columns:10,rows:10},{min:0,max:0},{left:-5000,right:-4000,top:-5000,bottom:-4000});
 assert.equal(count(outside),0);
});
test('이동·확대·회전 교체 시 겹치는 객체 유지, 화면 밖 객체 폐기, 반복 조회 무변경',()=>{
 const created=[],destroyed=[];
 const cache=new TerrainWindowCache((column,row)=>{const tile={column,row};created.push(tile);return tile;},tile=>destroyed.push(tile));
 const a={firstColumn:0,lastColumn:3,firstRow:0,lastRow:3};
 cache.sync(a);assert.equal(created.length,16);cache.sync({...a});assert.equal(created.length,16);
 cache.sync({...a,firstColumn:2,lastColumn:5});assert.equal(created.length,24);assert.equal(destroyed.length,8);
 assert.ok(destroyed.every(p=>p.column<2));
 cache.sync({firstColumn:3,lastColumn:3,firstRow:1,lastRow:1});assert.equal(destroyed.length,23);
 cache.clear();assert.equal(destroyed.length,24);assert.equal(new Set(destroyed).size,24);
 cache.sync(a);assert.equal(created.length,40);cache.clear();assert.equal(destroyed.length,40);
});

test('먼 거리 이동과 확대 시 새 타일 생성 전에 화면 밖 자원을 정리한다',()=>{
 let currentLiveCount=0,currentPeakCount=0;
 const currentTileCache=new TerrainWindowCache((currentColumnIndex,currentRowIndex)=>{
  currentLiveCount++;currentPeakCount=Math.max(currentPeakCount,currentLiveCount);
  return {column:currentColumnIndex,row:currentRowIndex};
 },()=>{currentLiveCount--;});
 currentTileCache.sync({firstColumn:0,lastColumn:9,firstRow:0,lastRow:9});
 assert.equal(currentLiveCount,100);
 currentPeakCount=currentLiveCount;
 currentTileCache.sync({firstColumn:100,lastColumn:109,firstRow:100,lastRow:109});
 assert.equal(currentPeakCount,100);
 assert.equal(currentLiveCount,100);
 currentTileCache.sync({firstColumn:105,lastColumn:119,firstRow:105,lastRow:119});
 assert.equal(currentLiveCount,225);
 assert.equal(currentPeakCount,225);
 currentTileCache.clear();assert.equal(currentLiveCount,0);
});
