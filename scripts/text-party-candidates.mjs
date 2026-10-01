import {parsePartyCandidatePage} from '../src/client/party-candidate-validation.mjs';
import {validatePartyFormationReceipt} from '../src/client/party-formation-receipt.mjs';
const PARTY_CANDIDATE_STATUS_LABELS={AVAILABLE:'참가 가능',ALREADY_BORROWED:'기존 대여',CP_OUT_OF_RANGE:'CP 조건 불충족',CAPACITY_FULL:'대여 정원 초과'};
const PARTY_CANDIDATE_IDENTIFIER_PATTERN=/^(?:[a-z0-9]{1,40}|guild:novice)$/;
function capturePartyCandidateContext(currentTextClient){
 const currentGameState=currentTextClient.state;
 return JSON.stringify([currentGameState?.me.id,currentGameState?.generation,currentGameState?.epoch,
  currentGameState?.location?.id,currentGameState?.map?.id,currentGameState?.me.position,currentGameState?.me.version]);
}
function sanitizePartyCandidateText(currentDisplayText){return currentDisplayText.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
export async function executePartyCandidateCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentFacilityIdentifier,...currentActionArguments]=currentCommandArguments;
 if(!['candidates','add'].includes(currentActionName)||!/^[a-z][a-z0-9-]{0,99}$/.test(currentFacilityIdentifier??'')
  ||(currentActionName==='candidates'?currentActionArguments.length>1:currentActionArguments.length!==1))
  throw new Error('loans candidates 길드ID [다음커서] / loans add 길드ID 캐릭터ID로 입력하세요.');
 const currentGameState=currentTextClient.state;
 const currentGuildBuilding=currentGameState?.map?.buildings?.find(currentBuildingEntry=>currentBuildingEntry.facilityId===currentFacilityIdentifier&&currentBuildingEntry.facilityKind==='guild');
 if(!currentGuildBuilding||currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation
  ||currentGameState.me.position?.column!==currentGuildBuilding.entrance?.column||currentGameState.me.position?.row!==currentGuildBuilding.entrance?.row)
  throw new Error('전투·조우를 종료하고 해당 길드회관 입구로 이동하세요.');
 const currentRequestContext=capturePartyCandidateContext(currentTextClient);
 const currentRequestTokens=currentTextClient.tokens;
 const currentRequestPrefix='/v1/game/guilds/'+currentFacilityIdentifier;
 if(currentActionName==='candidates'){
  currentTextClient.partyCandidatePage=null;
  const currentPageCursor=currentActionArguments[0];
  if(currentPageCursor!==undefined&&!/^[a-z0-9]{1,40}$/.test(currentPageCursor))throw new Error('후보 목록에 표시된 다음커서를 입력하세요.');
  const currentCandidatePage=parsePartyCandidatePage(await currentTextClient.request(currentRequestPrefix+'/party-candidates'+(currentPageCursor?'?after='+currentPageCursor:'')),currentGameState.map.id);
  if(currentTextClient.tokens!==currentRequestTokens||capturePartyCandidateContext(currentTextClient)!==currentRequestContext
   ||currentCandidatePage.characterVersion!==currentGameState.me.version)throw new Error('후보 조회 중 상태가 변경되었습니다. 다시 조회하세요.');
  if(currentCandidatePage.nextCursor!==null&&!/^[a-z0-9]{1,40}$/.test(currentCandidatePage.nextCursor))throw new Error('후보 목록 커서가 올바르지 않습니다.');
  if(currentCandidatePage.entries.some(currentCandidateEntry=>!PARTY_CANDIDATE_IDENTIFIER_PATTERN.test(currentCandidateEntry.characterId)))throw new Error('후보 캐릭터 ID가 올바르지 않습니다.');
  currentTextClient.partyCandidatePage={context:currentRequestContext,tokens:currentRequestTokens,facilityId:currentFacilityIdentifier,data:currentCandidatePage};
  return (currentCandidatePage.entries.map(currentCandidateEntry=>`${sanitizePartyCandidateText(currentCandidateEntry.name)} [${currentCandidateEntry.characterId}] · ${PARTY_CANDIDATE_STATUS_LABELS[currentCandidateEntry.status]}${currentCandidateEntry.source==='GUILD'?' · 무료 7일':''}`).join('\n')||'이 페이지에 모집 후보가 없습니다.')
   +(currentCandidatePage.nextCursor?'\n다음 조회: loans candidates '+currentFacilityIdentifier+' '+currentCandidatePage.nextCursor:'');
 }
 const currentCandidateIdentifier=currentActionArguments[0];
 if(!PARTY_CANDIDATE_IDENTIFIER_PATTERN.test(currentCandidateIdentifier))throw new Error('조회한 후보의 캐릭터 ID를 입력하세요.');
 const currentSavedPage=currentTextClient.partyCandidatePage;
 const currentSelectedCandidate=currentSavedPage?.data.entries.find(currentCandidateEntry=>currentCandidateEntry.characterId===currentCandidateIdentifier);
 if(!currentSavedPage||currentSavedPage.tokens!==currentRequestTokens||currentSavedPage.context!==currentRequestContext
  ||currentSavedPage.facilityId!==currentFacilityIdentifier||!currentSelectedCandidate)throw new Error('현재 길드에서 loans candidates로 해당 후보를 먼저 조회하세요.');
 if(!currentSelectedCandidate.cpEligible||!['AVAILABLE','ALREADY_BORROWED'].includes(currentSelectedCandidate.status))throw new Error('이 후보는 현재 참가 조건을 충족하지 않습니다.');
 currentTextClient.partyCandidatePage=null;
 return currentTextClient.command(currentRequestPrefix+'/party-members',{characterId:currentCandidateIdentifier},
  currentResponseRecord=>`대여 편성 추가: ${sanitizePartyCandidateText(currentSelectedCandidate.name)} [${currentResponseRecord.receipt.loanId}]`,{
   validateCommandResponse:(currentResponseRecord,currentRequestPayload)=>validatePartyFormationReceipt(currentResponseRecord.receipt,currentRequestPayload.requestId,'ADD'),
  });
}
