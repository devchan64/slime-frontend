import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/client/huntLedger.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseHuntLedgerPage,localizedHuntName}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
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

test('사냥 이름은 같은 응답에서 언어를 바꾸며 이전 응답의 ID를 보존한다',()=>{
 const currentLedgerPage=createHuntLedgerPage();
 currentLedgerPage.monsterNames={slime:{ko:'슬라임',en:'Slime'}};
 currentLedgerPage.mapNames={meadow:{ko:'이슬초원',en:'Dew Meadow'}};
 parseHuntLedgerPage(currentLedgerPage);
 assert.equal(localizedHuntName(currentLedgerPage.monsterNames,'slime','ko'),'슬라임');
 assert.equal(localizedHuntName(currentLedgerPage.monsterNames,'slime','en'),'Slime');
 assert.equal(localizedHuntName(undefined,'slime','ko'),'slime');
 for(const invalidNameMap of [null,[],{}, {slime:{ko:'슬라임'}},{slime:{ko:'',en:'Slime'}},{slime:{ko:'슬라임',en:'Slime',ja:'スライム'}}])
  assert.throws(()=>parseHuntLedgerPage({...currentLedgerPage,monsterNames:invalidNameMap}),/이름 번역/);
 assert.throws(()=>parseHuntLedgerPage({...currentLedgerPage,mapNames:{}}),/이름 번역/);
});
