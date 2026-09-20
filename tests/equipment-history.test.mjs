import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const historyModuleBuild=await build({entryPoints:['src/client/equipmentHistory.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseEquipmentHistory}=await import(`data:text/javascript;base64,${Buffer.from(historyModuleBuild.outputFiles[0].text).toString('base64')}`);
function createHistoryResponse() {
 return {instanceId:'one',nextBefore:null,items:[{recordId:'record-one',kind:'WORN',sourceId:'battle-one',createdAt:100,
 before:{ownerCharacterId:'owner',stateVersion:1,currentDurability:1,maxDurability:80,equippedSlot:'main_hand',reserved:false},
 after:{ownerCharacterId:'owner',stateVersion:2,currentDurability:0,maxDurability:80,equippedSlot:'main_hand',reserved:false}}]};
}
test('전후 내구도와 버전을 보존한다',()=>{
 const currentHistoryResponse=createHistoryResponse();assert.deepEqual(parseEquipmentHistory(currentHistoryResponse,'one'),currentHistoryResponse);
});
test('다른 장비·중복·미지원 이력은 거절한다',()=>{
 assert.throws(()=>parseEquipmentHistory(createHistoryResponse(),'other'),/이력/);
 for(const invalidRecordPatch of [{kind:'UNKNOWN'},{createdAt:NaN},{after:null},{before:{stateVersion:0}}]) {
  const currentHistoryResponse=createHistoryResponse();Object.assign(currentHistoryResponse.items[0],invalidRecordPatch);
  assert.throws(()=>parseEquipmentHistory(currentHistoryResponse,'one'),/이력/);
 }
 const currentHistoryResponse=createHistoryResponse();currentHistoryResponse.items.push(currentHistoryResponse.items[0]);
 assert.throws(()=>parseEquipmentHistory(currentHistoryResponse,'one'),/이력/);
});
