import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/client/huntLedger.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseHuntLedgerPage}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function createHuntLedgerPage(){return {entries:[{id:7,monsterInstanceId:'b:e',monsterTypeId:'slime',battleId:'battle',spawnId:'spawn',mapId:'meadow',quantity:1,result:'WIN',createdAt:100}],totals:[{monsterTypeId:'slime',quantity:10}],nextCursor:7};}
test('사냥 페이지는 서버 기록·총계·커서를 보존한다',()=>{
 const currentLedgerPage=createHuntLedgerPage();assert.equal(parseHuntLedgerPage(currentLedgerPage),currentLedgerPage);
 assert.deepEqual(parseHuntLedgerPage({entries:[],totals:[],nextCursor:null}),{entries:[],totals:[],nextCursor:null});
});
test('사냥 원장의 순서·중복·날짜·수량·커서 위반은 거절한다',()=>{
 for(const invalidEntryPatch of [{id:0},{quantity:0},{createdAt:Infinity},{createdAt:1e20},{monsterTypeId:'missing'},{mapId:null}]){
  const currentLedgerPage=createHuntLedgerPage();Object.assign(currentLedgerPage.entries[0],invalidEntryPatch);
  assert.throws(()=>parseHuntLedgerPage(currentLedgerPage),/사냥 원장/);
 }
 assert.throws(()=>parseHuntLedgerPage(createHuntLedgerPage(),7),/사냥 원장/);
 for(const invalidLedgerPatch of [{nextCursor:6},{nextCursor:undefined},{totals:[]},{entries:[...createHuntLedgerPage().entries,...createHuntLedgerPage().entries]}])
  assert.throws(()=>parseHuntLedgerPage({...createHuntLedgerPage(),...invalidLedgerPatch}),/사냥 원장/);
});
