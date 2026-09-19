import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:`export * from './src/game/animation/facing';export {toView} from './src/game/terrain/rotation';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {screenFacing,toView}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const vectors={column_positive:[1,0],column_negative:[-1,0],row_positive:[0,1],row_negative:[0,-1]};
test('네 방향과 네 회전은 실제 직사각형 맵의 투영 방향과 일치한다',()=>{
 const map={columns:32,rows:17},origin={column:4,row:5};
 for(const [facing,[c,r]] of Object.entries(vectors))for(let rotation=0;rotation<4;rotation++){
  const a=toView(origin,map,rotation),b=toView({column:origin.column+c,row:origin.row+r},map,rotation);
  const dx=(b.column-b.row)-(a.column-a.row),dy=(b.column+b.row)-(a.column+a.row);
  const expected=`${dy>0?'down':'up'}_${dx>0?'right':'left'}`;
  assert.equal(screenFacing(facing,rotation),expected);
 }
 assert.equal(screenFacing('row_positive',0),'down_left');
});
test('회전 후 복귀는 같은 방향이며 누락·잘못된 값은 추정하지 않는다',()=>{
 for(const facing of Object.keys(vectors)){
  const first=screenFacing(facing,0);
  assert.equal(new Set([0,1,2,3].map(r=>screenFacing(facing,r))).size,4);
  assert.equal(screenFacing(facing,0),first);
 }
 for(const bad of ['unknown','toString',null,undefined])assert.throws(()=>screenFacing(bad,0));
 for(const bad of [-1,4,NaN,true,.5])assert.throws(()=>screenFacing('row_positive',bad));
});
