import {readPartyCreationIssue} from '../src/ui/partyCreationAccess.mjs';
const PARTY_CHARACTER_IDENTIFIER = /^[a-z0-9]{1,40}$/;
const PARTY_INVITATION_IDENTIFIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARTY_COMMAND_ARGUMENTS = {list:0,create:0,invite:1,accept:1,leave:0,kick:1,disband:0};
const PARTY_CREATION_MESSAGES = {
 'app.partyCreationFieldRequired':'전투·조우를 종료하고 탐색 상태에서 생성하세요.',
 'app.partyCreationGuildRequired':'도시의 길드 출입구에서 생성하세요.',
 'app.partyCreationCitizenshipRequired':'현지 시민권을 발급받은 뒤 생성하세요.',
 'app.partyCreationFormationRequired':'대여 편성을 해제한 뒤 생성하세요. 기존 계약은 유지됩니다.',
};
function sanitizePartyOutputText(currentTextValue){return String(currentTextValue).replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
function formatOnlinePartyState(currentGameState){
 const currentOutputLines=[];
 if(currentGameState.party){
  currentOutputLines.push('파티 '+sanitizePartyOutputText(currentGameState.party.id)+' · 파티장 '+sanitizePartyOutputText(currentGameState.party.leader));
  for(const currentMemberIdentifier of currentGameState.party.members){
   const currentMemberRecord=currentGameState.members.find(currentMemberEntry=>currentMemberEntry.id===currentMemberIdentifier);
   currentOutputLines.push('파티원 '+sanitizePartyOutputText(currentMemberRecord?.name??currentMemberIdentifier)+' ['+sanitizePartyOutputText(currentMemberIdentifier)+']');
  }
 }else currentOutputLines.push('가입한 온라인 파티가 없습니다.');
 for(const currentInvitationEntry of currentGameState.invitations??[])
  currentOutputLines.push('초대 '+sanitizePartyOutputText(currentInvitationEntry.id)+' · 보낸 사람 '+sanitizePartyOutputText(currentInvitationEntry.from)
   +(currentInvitationEntry.partyCpEligible===false?' · CP 범위 초과':' · 수락: party accept '+sanitizePartyOutputText(currentInvitationEntry.id)));
 for(const currentMemberEntry of currentGameState.members??[]){
  if(currentMemberEntry.id!==currentGameState.me.id&&!currentGameState.party?.members.includes(currentMemberEntry.id))
   currentOutputLines.push('주변 '+sanitizePartyOutputText(currentMemberEntry.name)+' ['+sanitizePartyOutputText(currentMemberEntry.id)+']'
    +(currentMemberEntry.partyCpEligible===false?' · CP 범위 초과':''));
 }
 return currentOutputLines.join('\n');
}
export async function executeOnlinePartyCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,...currentActionArguments]=currentCommandArguments;
 if(!Object.hasOwn(PARTY_COMMAND_ARGUMENTS,currentActionName)||currentActionArguments.length!==PARTY_COMMAND_ARGUMENTS[currentActionName])
  throw new Error('party list/create/invite 캐릭터ID/accept 초대ID/leave/kick 캐릭터ID/disband로 입력하세요.');
 if(currentActionName==='list'){
  await currentTextClient.snapshot();
  return formatOnlinePartyState(currentTextClient.state);
 }
 const currentGameState=currentTextClient.state;
 if(!currentGameState?.me)throw new Error('state로 캐릭터 상태를 먼저 조회하세요.');
 if(currentActionName==='create'){
  if(currentGameState.party)throw new Error('이미 온라인 파티에 가입했습니다.');
  const currentCreationIssue=readPartyCreationIssue(currentGameState);
  if(currentCreationIssue)throw new Error(PARTY_CREATION_MESSAGES[currentCreationIssue]);
 }
 if(['invite','accept'].includes(currentActionName)){
  if(currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation)throw new Error('전투·조우를 종료한 뒤 파티를 구성하세요.');
  if(currentGameState.me.borrowedPartyLoanIds?.length)throw new Error('대여 편성을 먼저 해제하세요. 기존 계약은 유지됩니다.');
 }
 const currentCommandBody={action:currentActionName.toUpperCase()};
 if(['invite','kick','disband'].includes(currentActionName)&&currentGameState.party?.leader!==currentGameState.me.id)throw new Error('파티장만 실행할 수 있습니다.');
 if(['invite','kick'].includes(currentActionName)){
  const currentTargetIdentifier=currentActionArguments[0];
  if(!PARTY_CHARACTER_IDENTIFIER.test(currentTargetIdentifier)||currentTargetIdentifier===currentGameState.me.id)throw new Error('대상 캐릭터 ID를 확인하세요.');
  if(currentActionName==='kick'){
   if(!currentGameState.party.members.includes(currentTargetIdentifier))throw new Error('현재 파티원을 선택하세요.');
  }else{
   const currentCandidateRecord=currentGameState.members?.find(currentMemberEntry=>currentMemberEntry.id===currentTargetIdentifier);
   if(!currentCandidateRecord||currentCandidateRecord.mode!=='FIELD'||currentCandidateRecord.partyCpEligible===false||currentGameState.party.members.includes(currentTargetIdentifier))
    throw new Error('party list로 현재 초대 가능한 캐릭터를 확인하세요.');
  }
  currentCommandBody.targetId=currentTargetIdentifier;
 }
 if(currentActionName==='accept'){
  const currentInvitationIdentifier=currentActionArguments[0].toLowerCase();
  if(!PARTY_INVITATION_IDENTIFIER.test(currentInvitationIdentifier))throw new Error('초대 ID 형식을 확인하세요.');
  const currentInvitationRecord=currentGameState.invitations?.find(currentInvitationEntry=>currentInvitationEntry.id===currentInvitationIdentifier);
  if(currentGameState.party||!currentInvitationRecord||currentInvitationRecord.partyCpEligible===false)throw new Error('party list로 현재 수락 가능한 초대를 확인하세요.');
  currentCommandBody.invitationId=currentInvitationIdentifier;
 }
 return currentTextClient.command('/v1/game/party/commands',currentCommandBody);
}
