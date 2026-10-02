const PARTY_CHARACTER_IDENTIFIER = /^[a-z0-9]{1,40}$/;
const PARTY_COMMAND_ARGUMENTS = {list:0,leave:0,kick:1,disband:0};
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
 return currentOutputLines.join('\n');
}
export async function executeOnlinePartyCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,...currentActionArguments]=currentCommandArguments;
 if(['create','invite','accept'].includes(currentActionName))throw new Error('온라인 파티는 제공하지 않습니다. 길드의 모험가 대여·편성을 이용하세요.');
 if(!Object.hasOwn(PARTY_COMMAND_ARGUMENTS,currentActionName)||currentActionArguments.length!==PARTY_COMMAND_ARGUMENTS[currentActionName])
  throw new Error('기존 기록 정리는 party list/leave/kick 캐릭터ID/disband로 입력하세요.');
 if(currentActionName==='list'){await currentTextClient.snapshot();return formatOnlinePartyState(currentTextClient.state);}
 const currentGameState=currentTextClient.state;
 if(!currentGameState?.me)throw new Error('state로 캐릭터 상태를 먼저 조회하세요.');
 const currentCommandBody={action:currentActionName.toUpperCase()};
 if(['kick','disband'].includes(currentActionName)&&currentGameState.party?.leader!==currentGameState.me.id)throw new Error('파티장만 실행할 수 있습니다.');
 if(currentActionName==='kick'){
  const currentTargetIdentifier=currentActionArguments[0];
  if(!PARTY_CHARACTER_IDENTIFIER.test(currentTargetIdentifier)||currentTargetIdentifier===currentGameState.me.id||!currentGameState.party.members.includes(currentTargetIdentifier))throw new Error('현재 파티원을 선택하세요.');
  currentCommandBody.targetId=currentTargetIdentifier;
 }
 return currentTextClient.command('/v1/game/party/commands',currentCommandBody);
}
