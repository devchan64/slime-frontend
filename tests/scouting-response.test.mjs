import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBundleResult=await build({entryPoints:['src/client/scouting.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseScoutingObservation}=await import(`data:text/javascript;base64,${Buffer.from(currentBundleResult.outputFiles[0].text).toString('base64')}`);
const currentValidObservation=()=>({monsterId:'slime',mapId:'meadow',succeeded:true,observedAt:100,expiresAt:160,fpCost:1,countBand:{minimumCount:2,maximumCount:3}});
test('정찰은 개인 인원 구간과 최초 만료 시각을 보존하고 원본을 공유하지 않는다',()=>{
 const currentOriginalResult=currentValidObservation();const currentParsedResult=parseScoutingObservation(currentOriginalResult);
 assert.deepEqual(currentParsedResult,currentOriginalResult);currentOriginalResult.countBand.minimumCount=99;assert.equal(currentParsedResult.countBand.minimumCount,2);
 const currentFailedResult={...currentValidObservation(),succeeded:false};delete currentFailedResult.countBand;
 assert.deepEqual(parseScoutingObservation(currentFailedResult),currentFailedResult);
});
test('정찰 실패의 인원 누출·내부 UUID·손상된 시각과 수량은 거절한다',()=>{
 for(const currentInvalidPatch of [{succeeded:false},{monsterInstanceId:'private'},{expiresAt:100},{observedAt:NaN},{fpCost:0},{countBand:{minimumCount:4,maximumCount:3}},{countBand:{minimumCount:2,maximumCount:3,exactCount:2}}])
  assert.throws(()=>parseScoutingObservation({...currentValidObservation(),...currentInvalidPatch}));
});
test('위험도는 승인 등급과 버전만 허용하고 이전 영수증도 읽는다',()=>{
 for(const currentRiskGrade of ['LOW','EVEN','HIGH','VERY_HIGH','UNKNOWN'])
  assert.equal(parseScoutingObservation({...currentValidObservation(),riskGrade:currentRiskGrade,riskVersion:1}).riskGrade,currentRiskGrade);
 for(const currentInvalidPatch of [{riskGrade:'INVALID',riskVersion:1},{riskGrade:'LOW'},{riskVersion:1},{riskGrade:'LOW',riskVersion:2},{riskGrade:'LOW',riskVersion:1,csp:100}])
  assert.throws(()=>parseScoutingObservation({...currentValidObservation(),...currentInvalidPatch}));
});
