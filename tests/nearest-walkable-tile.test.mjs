import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBundle = await build({entryPoints:['src/game/terrain/nearestWalkableTile.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {findNearestWalkableTile} = await import(`data:text/javascript;base64,${Buffer.from(currentBundle.outputFiles[0].text).toString('base64')}`);
test('클릭 좌표에서 가장 가까운 이동 가능 타일을 선택한다',()=>{
 const currentSurface={columns:4,rows:3,blocked:[{column:1,row:1},{column:2,row:1}]};
 const projectTilePosition=currentTilePosition=>({x:currentTilePosition.column*10,y:currentTilePosition.row*10});
 assert.deepEqual(findNearestWalkableTile({x:11,y:10},currentSurface,projectTilePosition),{column:1,row:0});
 assert.deepEqual(findNearestWalkableTile({x:29,y:10},currentSurface,projectTilePosition),{column:3,row:1});
 assert.equal(findNearestWalkableTile({x:0,y:0},{columns:1,rows:1,blocked:[{column:0,row:0}]},projectTilePosition),null);
});
