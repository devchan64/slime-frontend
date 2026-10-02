import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateExplorationResult} from '../src/client/exploration-result.mjs';
const currentTargetPosition={column:6,row:3};
const currentValidResult={mapId:'meadow',resourceKind:'mineral',position:currentTargetPosition,succeeded:true,fpCost:2,nextAttemptAt:86401,reward:{kind:'material',itemId:'iron-ore',quantity:1}};
test('탐색 성공 보상과 실패 무보상 계약을 확인한다',()=>{
 assert.equal(validateExplorationResult(currentValidResult,'meadow','mineral',currentTargetPosition),currentValidResult);
 assert.equal(validateExplorationResult({...currentValidResult,succeeded:false,reward:null},'meadow','mineral',currentTargetPosition).succeeded,false);
});
test('다른 대상·잘못된 보상·시각을 성공으로 표시하지 않는다',()=>{
 for(const currentInvalidPatch of [{mapId:'other'},{position:{column:7,row:3}},{succeeded:1},{fpCost:-1},{nextAttemptAt:NaN},{reward:{kind:'material',itemId:'iron-ore',quantity:0}},{succeeded:false}])
  assert.throws(()=>validateExplorationResult({...currentValidResult,...currentInvalidPatch},'meadow','mineral',currentTargetPosition));
});
