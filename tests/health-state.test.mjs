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
