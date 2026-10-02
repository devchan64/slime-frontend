import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isHealthDepleted} from '../src/client/health-state.mjs';

test('표시 HP 0에서도 서버가 생존으로 판정하면 살아 있는 대상으로 유지한다',()=>{
 assert.equal(isHealthDepleted({hp:0,healthDepleted:false}),false);
 assert.equal(isHealthDepleted({hp:0,healthDepleted:true}),true);
 assert.equal(isHealthDepleted({hp:1,healthDepleted:false}),false);
 assert.equal(isHealthDepleted({hp:0}),true);
 assert.equal(isHealthDepleted({hp:1}),false);
 assert.equal(isHealthDepleted({}),false);
 for(const currentInvalidFlag of [0,1,null,'false'])assert.throws(()=>isHealthDepleted({hp:0,healthDepleted:currentInvalidFlag}));
});


test('올림 표시가 최대 HP와 같아도 실제 완충 전에는 회복 가능 상태를 유지한다',async()=>{
 const {isHealthFull}=await import('../src/client/health-state.mjs');
 assert.equal(isHealthFull({hp:10,maxHp:10,healthFull:false}),false);
 assert.equal(isHealthFull({hp:10,maxHp:10,healthFull:true}),true);
 assert.equal(isHealthFull({hp:10,maxHp:10}),true);
 assert.equal(isHealthFull({hp:9,maxHp:10}),false);
 assert.throws(()=>isHealthFull({hp:10,maxHp:10,healthFull:'false'}));
});
