import {validatePartyFormationReceipt} from '../src/client/party-formation-receipt.mjs';
import {parseBorrowedParticipation} from '../src/client/borrowed-participation-validation.mjs';

const BORROWED_PARTICIPATION_REASONS=Object.freeze({
 EXPIRED:'대여 만료',OUT_OF_RANGE:'CP 조건 불충족',MIGRATION_REQUIRED:'성장 기록 갱신 필요',
 RECOVERY_PENDING:'회복 대기',IN_BATTLE:'다른 전투 참가 중',
});

export async function readBorrowedParticipation(currentTextClient){
 if(!currentTextClient.state)throw new Error('먼저 로그인하세요.');
 const currentRequestTokens=currentTextClient.tokens;
 const currentRequestState=currentTextClient.state;
 const currentRequestIdentity=[currentRequestState.me.id,currentRequestState.generation,currentRequestState.epoch,currentRequestState.me.version];
 const currentResponseRecord=await currentTextClient.request('/v1/game/borrowed-party/participation');
 const currentLatestState=currentTextClient.state;
 if(currentTextClient.tokens!==currentRequestTokens||!currentLatestState
  ||JSON.stringify(currentRequestIdentity)!==JSON.stringify([currentLatestState.me.id,currentLatestState.generation,currentLatestState.epoch,currentLatestState.me.version]))
  throw new Error('대여 참가 조회 중 캐릭터·세션·상태가 변경되었습니다. 다시 조회하세요.');
 const currentParticipationRecord=parseBorrowedParticipation(currentResponseRecord);
 const currentObservedDate=new Date(currentParticipationRecord.serverTime*1000);
 if(currentParticipationRecord.serverTime<0||!Number.isFinite(currentObservedDate.getTime()))throw new Error('대여 참가 관측 시각이 올바르지 않습니다.');
 const currentOutputLines=[`대여 전투 참가 예상 · 관측 ${currentObservedDate.toISOString()}`];
 for(const currentParticipantEntry of currentParticipationRecord.participants)
  currentOutputLines.push(`참가 가능: ${currentParticipantEntry.name} [${currentParticipantEntry.loanId}]`);
 for(const currentExcludedEntry of currentParticipationRecord.excluded)
  currentOutputLines.push(`제외: ${currentExcludedEntry.name} [${currentExcludedEntry.loanId}] · ${BORROWED_PARTICIPATION_REASONS[currentExcludedEntry.reason]}`);
 if(!currentParticipationRecord.participants.length&&!currentParticipationRecord.excluded.length)currentOutputLines.push('편성된 대여 파티원이 없습니다.');
 currentOutputLines.push('실제 전투 시작 시 서버가 참가 조건을 다시 확인합니다.');
 return currentOutputLines.join('\n');
}


export async function removeBorrowedParticipant(currentTextClient,currentLoanIdentifier){
 if(typeof currentLoanIdentifier!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(currentLoanIdentifier))
  throw new Error('loans remove 대여ID(UUID)로 입력하세요.');
 const currentGameState=currentTextClient.state;
 if(currentGameState?.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation)
  throw new Error('전투·조우를 종료한 뒤 대여 편성을 변경하세요.');
 const currentSelectedLoan=currentLoanIdentifier.toLowerCase();
 return currentTextClient.command('/v1/game/borrowed-party/'+currentSelectedLoan+'/remove',{},
  ()=>`편성 해제: ${currentSelectedLoan} · 기존 대여 계약은 유지됩니다.`,{
   validateCommandResponse:(currentResponseRecord,currentRequestPayload)=>{
    validatePartyFormationReceipt(currentResponseRecord.receipt,currentRequestPayload.requestId,'REMOVE',currentSelectedLoan);
   },
  });
}
