import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBuildResult=await build({entryPoints:['src/client/guildMembership.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {validateGuildMembership}=await import(`data:text/javascript;base64,${Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64')}`);
test('본인에게 발급된 기본 자격증만 표시한다',()=>{
 const currentMembershipRecord={guildId:'adventurers-guild',characterId:'hero',certificateStatus:'ISSUED'};
 assert.deepEqual(validateGuildMembership(currentMembershipRecord,'hero'),currentMembershipRecord);
 for(const currentRecordPatch of [{characterId:'other'},{guildId:'merchant'},{certificateStatus:'PENDING'},{coins:99}]){
  assert.throws(()=>validateGuildMembership({...currentMembershipRecord,...currentRecordPatch},'hero'));
 }
 assert.equal(validateGuildMembership(null,'hero'),null);
 assert.equal(validateGuildMembership(undefined,'hero'),undefined);
});
