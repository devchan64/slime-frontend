import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {access} from 'node:fs/promises';
const {outputFiles}=await build({stdin:{contents:`export * from './src/game/terrain/connectorPlacement'; export * from './src/game/terrain/rotation'; export * from './src/game/terrain/elevation';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {connectorPlacement,rotatedSurface,elevationTileFaces,pickSurface}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('계단·사다리는 네 회전 방향에서 맞는 에셋을 사용하며 메타데이터를 보존한다',async()=>{
 for(const [kind,asset] of [['stairs','stone-stairs'],['ladder','timber-ladder']]){
  const map={columns:2,rows:1,elevations:[[0,1]],ramps:[{id:'link',kind,asset,start:{column:0,row:0},end:{column:1,row:0}}]};
  const keys=new Set();
  for(let r=0;r<4;r++){
   const view=rotatedSurface(map,r),link=view.ramps[0];
   assert.equal(link.kind,kind);
   const result=connectorPlacement(link,view);keys.add(result.key);
   await access(`src/assets/terrain/connectors/${result.key}.svg`);
   assert.deepEqual(connectorPlacement({...link,start:link.end,end:link.start},view),result);
  }
  assert.equal(keys.size,4);
 }
});
test('부분 메타데이터와 잘못된 에셋 조합을 거절하고 이전 계단만 호환한다',()=>{
 const map={columns:2,rows:1,elevations:[[0,1]]};
 const legacy={start:{column:0,row:0},end:{column:1,row:0}};
 assert.equal(connectorPlacement(legacy,map).key,'stone-stairs-east');
 assert.throws(()=>connectorPlacement({...legacy,kind:'ladder'},map));
 assert.throws(()=>connectorPlacement({...legacy,id:'bad',kind:'stairs',asset:'timber-ladder'},map));
});

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
