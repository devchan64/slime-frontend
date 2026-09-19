import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/ui/battleActionPoints.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {actionPoints,actionPointSubject}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const unit=(id,side,column,ap)=>({id,side,position:{column,row:0},ap,maxAp:6});
const battle={units:[unit('me','ally',0,4),unit('friend','ally',1,0),unit('monster','enemy',2,5)],order:['me','monster'],index:0};
test('선택한 아군의 AP를 우선하며 0도 유효한 잔고다',()=>{
 const subject=actionPointSubject(battle,{column:1,row:0});
 assert.equal(subject.unit.id,'friend');
 assert.equal(subject.labelKey,'battle.selectedCharacter');
 assert.deepEqual(actionPoints(subject.unit),{value:0,maximum:6});
});
test('이동 지점·적 선택은 현재 행동 아군을 명시하고 적의 AP는 노출하지 않는다',()=>{
 for(const selected of [null,{column:2,row:0},{column:3,row:0}]) {
  const subject=actionPointSubject(battle,selected);
  assert.equal(subject.unit.id,'me');
  assert.equal(subject.labelKey,'battle.activeCharacter');
 }
 assert.equal(actionPointSubject({...battle,index:1},null),null);
 assert.equal(actionPointSubject({...battle,index:1},{column:1,row:0}).unit.id,'friend');
});
test('서버 갱신값을 읽으며 미지원 응답에서 잔고를 만들지 않는다',()=>{
 assert.equal(actionPoints({...battle.units[0],ap:undefined}),null);
 assert.equal(actionPoints({...battle.units[0],ap:2}).value,2);
 assert.deepEqual(actionPoints({...battle.units[0],maxAp:undefined}),{value:4,maximum:undefined});
 for(const ap of [-1,1.5,7,NaN]) assert.throws(()=>actionPoints({...battle.units[0],ap}));
});
