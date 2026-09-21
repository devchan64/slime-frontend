import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles} = await build({entryPoints:['src/client/accountRewards.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseAccountRewardPage,rewardRemainingSeconds,parseAccountRewardClaim} = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
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


test('수령 합계는 실제 건수·수량을 보존하고 빈 결과와 잘못된 결과를 구분한다',()=>{
  assert.deepEqual(parseAccountRewardClaim({claimedCount:2,materials:[{materialId:'jelly',quantity:3},{materialId:'herb',quantity:4}]}),{claimedCount:2,materialQuantity:7});
  assert.deepEqual(parseAccountRewardClaim({claimedCount:0,materials:[]}),{claimedCount:0,materialQuantity:0});
  for(const malformedClaimResult of [null,{claimedCount:1,materials:[]},{claimedCount:0,materials:[{materialId:'jelly',quantity:1}]},
    {claimedCount:1,materials:[{materialId:'jelly',quantity:-1}]},
    {claimedCount:1,materials:[{materialId:'jelly',quantity:1},{materialId:'jelly',quantity:2}]},
    {claimedCount:1,materials:[{materialId:'jelly',quantity:Number.MAX_SAFE_INTEGER},{materialId:'herb',quantity:1}]}])
    assert.throws(()=>parseAccountRewardClaim(malformedClaimResult));
});
