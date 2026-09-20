import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles} = await build({entryPoints:['src/client/accountRewards.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseAccountRewardPage,rewardRemainingSeconds} = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const validRewardPage = () => ({serverTime:100,nextCursor:null,entries:[{id:'reward-a',storedAt:50,expiresAt:604850,materials:[{materialId:'protein-jelly',quantity:3,nameTranslations:{ko:'단백질 젤리',en:'Protein Jelly'}}]}]});
test('보관함 페이지의 물품·수량·두 언어와 기한을 보존한다',()=>{
  const storedRewardPage=validRewardPage();
  assert.deepEqual(parseAccountRewardPage(storedRewardPage),storedRewardPage);
  assert.deepEqual(parseAccountRewardPage({serverTime:100,nextCursor:null,entries:[]}).entries,[]);
});
test('잘못된 기한·중복 보상·물품 정보는 수령 화면에서 거절한다',()=>{
  for (const mutateRewardPage of [
    rewardPageData=>{rewardPageData.serverTime=NaN;},
    rewardPageData=>{rewardPageData.entries[0].expiresAt=50;},
    rewardPageData=>{rewardPageData.entries.push(rewardPageData.entries[0]);},
    rewardPageData=>{rewardPageData.entries[0].materials[0].quantity=0;},
    rewardPageData=>{rewardPageData.entries[0].materials[0].quantity=1.5;},
    rewardPageData=>{delete rewardPageData.entries[0].materials[0].nameTranslations.en;},
    rewardPageData=>{rewardPageData.nextCursor=23;}
  ]) {
    const storedRewardPage=validRewardPage();mutateRewardPage(storedRewardPage);
    assert.throws(()=>parseAccountRewardPage(storedRewardPage));
  }
});
test('서버 시각에 단조 경과 시간을 더하며 만료 정각부터 남은 시간이 0이다',()=>{
  assert.equal(rewardRemainingSeconds(604850,50,0),604800);
  assert.equal(rewardRemainingSeconds(101,100,999),0.0010000000000000009);
  assert.equal(rewardRemainingSeconds(101,100,1000),0);
  assert.equal(rewardRemainingSeconds(101,100,1001),0);
  assert.equal(rewardRemainingSeconds(101,100,-1000),1);
});
