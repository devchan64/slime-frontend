import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:`export * from './src/game/terrain/rotation'; export * from './src/game/terrain/elevation';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {rotatedSurface,elevationTileFaces,pickSurface}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('계단 타일은 회전 후에도 한 칸의 높이 전환 지형으로 유지된다',()=>{
 const tile={id:'step',kind:'stairs',asset:'stone-step-tile',cell:{column:1,row:0},lower:{column:0,row:0}};
 const map={columns:2,rows:1,elevations:[[0,1]],elevationTiles:[tile],ramps:[{id:'step',kind:'stairs',asset:'stone-stairs',start:tile.lower,end:tile.cell}]};
 for(let r=0;r<4;r++){
  const view=rotatedSurface(map,r);
  assert.equal(view.elevationTiles.length,1);
  assert.deepEqual(view.elevationTiles[0].cell,view.ramps[0].end);
  assert.deepEqual(view.elevationTiles[0].lower,view.ramps[0].start);
  assert.equal(view.elevationTiles[0].asset,'stone-step-tile');
  const visible=elevationTileFaces(view.elevationTiles[0],view).filter(f=>f.top).filter(f=>{
   const x=f.points.reduce((n,p)=>n+p.x,0)/4,y=f.points.reduce((n,p)=>n+p.y,0)/4;
   const picked=pickSurface(x,y,view);
   return picked?.column===view.elevationTiles[0].cell.column&&picked?.row===view.elevationTiles[0].cell.row;
  });
  assert.ok(visible.length>0,'네 방향 모두 디딤면에서 계단 타일을 선택할 수 있어야 한다');
 }
});

test('이전 사다리 스냅샷도 별도 에셋 없이 높이 전환 타일로 표시한다',()=>{
 const map={columns:2,rows:1,elevations:[[0,1]],ramps:[{id:'old',kind:'ladder',asset:'timber-ladder',start:{column:0,row:0},end:{column:1,row:0}}]};
 const view=rotatedSurface(map,0);
 assert.deepEqual(view.elevationTiles,[{id:'old',kind:'stairs',asset:'stone-step-tile',cell:{column:1,row:0},lower:{column:0,row:0}}]);
});
