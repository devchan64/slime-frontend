import {DirectMessageClient,DirectMessageClientError} from '../src/client/direct-messages.mjs';
const DIRECT_MESSAGE_KOREAN_TEXT={
  retention:'대화별 최근 30일, 양방향 합계 최대 100개 보관 · 서버 저장은 상대 읽음 확인이 아닙니다.',
  invalidResponse:'개인 메시지 응답이 올바르지 않습니다.',sessionChanged:'로그인 세션이 변경되었습니다. 다시 실행하세요.',
  pendingSend:'진행 중이거나 결과가 불명확한 발송을 먼저 확인하세요.',invalidRecipient:'본인이 아닌 모험가 캐릭터 ID가 필요합니다.',
  invalidText:'공백만 입력할 수 없습니다. 메시지는 1~1000자입니다.',requestExpired:'최초 발송 시간이 지났습니다. 다시 보내세요.',
  noPendingSend:'재확인할 발송이 없거나 재시도 기한이 지났습니다.',
};
function formatDirectMessageTerminal(currentDisplayText){return String(currentDisplayText).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g,' ');}
export async function executeDirectMessageCommand(currentTextClient,currentCommandLine){
  if(!currentTextClient.tokens||!currentTextClient.state?.me?.name)throw new Error('캐릭터를 만든 뒤 이용하세요.');
  if(!currentTextClient.directMessageClient)currentTextClient.directMessageClient=new DirectMessageClient(
    (currentRequestPath,currentRequestBody,currentRequestMethod)=>currentTextClient.request(currentRequestPath,currentRequestBody,currentRequestMethod),
    ()=>currentTextClient.tokens&&currentTextClient.state?{characterId:currentTextClient.state.me.id,generation:currentTextClient.state.generation}:null
  );
  const currentMessageClient=currentTextClient.directMessageClient;
  const currentCommandParts=currentCommandLine.trim().split(/\s+/);
  const currentCommandAction=currentCommandParts[1];
  const currentCommandArguments=currentCommandParts.slice(2);
  const currentPeerIdentifier=currentCommandArguments[0];
  function requireDirectMessageArguments(currentMinimumCount,currentMaximumCount=currentMinimumCount){
    if(currentCommandArguments.length<currentMinimumCount||currentCommandArguments.length>currentMaximumCount)throw new Error('dm 명령 인수를 확인하세요. help로 사용법을 볼 수 있습니다.');
  }
  try{
    if(currentCommandAction==='send'){
      const currentSendMatch=/^dm\s+send\s+(\S+)\s+([\s\S]+)$/.exec(currentCommandLine.trim());
      if(!currentSendMatch)throw new Error('dm send 캐릭터ID 메시지 형식으로 입력하세요.');
      const currentSendReceipt=await currentMessageClient.sendDirectMessageText(currentSendMatch[1],currentSendMatch[2]);
      return '서버 저장 완료 · 메시지 '+currentSendReceipt.messageId+' (상대 읽음 확인 아님)';
    }
    if(currentCommandAction==='retry'){
      requireDirectMessageArguments(0);
      const currentSendReceipt=await currentMessageClient.retryPendingDirectMessage();
      return '서버 저장 확인 · 메시지 '+currentSendReceipt.messageId+' (상대 읽음 확인 아님)';
    }
    if(currentCommandAction==='list'||currentCommandAction==='blocks'){
      requireDirectMessageArguments(0,1);
      const currentListPage=currentCommandAction==='list'?await currentMessageClient.listDirectMessageConversations(currentPeerIdentifier):await currentMessageClient.listDirectMessageBlocks(currentPeerIdentifier);
      return currentListPage.entries.map(currentPeerEntry=>formatDirectMessageTerminal(currentPeerEntry.name)+' ['+formatDirectMessageTerminal(currentPeerEntry.characterId)+']').join('\n')+'\n'+(currentListPage.nextCursor?'다음: dm '+currentCommandAction+' '+currentListPage.nextCursor:'목록 끝');
    }
    if(currentCommandAction==='notice'){
      requireDirectMessageArguments(0);
      const currentNoticeValue=await currentMessageClient.readDirectMessageNotice();
      return '미확인 개인 메시지 '+currentNoticeValue.count+'개';
    }
    if(currentCommandAction==='block'||currentCommandAction==='unblock'){
      requireDirectMessageArguments(1);
      await currentMessageClient.setDirectMessageBlock(currentPeerIdentifier,currentCommandAction==='block');
      return formatDirectMessageTerminal(currentPeerIdentifier)+(currentCommandAction==='block'?' 수신 차단 완료':' 수신 차단 해제 완료');
    }
    if(currentCommandAction==='read'){
      requireDirectMessageArguments(1,2);
      const currentHistoryPage=await currentMessageClient.readDirectMessageHistory(currentPeerIdentifier,currentCommandArguments[1]);
      const currentReceivedIdentifiers=currentHistoryPage.entries.filter(currentMessageEntry=>currentMessageEntry.recipientId===currentTextClient.state.me.id).map(currentMessageEntry=>currentMessageEntry.messageId);
      if(currentReceivedIdentifiers.length)await currentMessageClient.acknowledgeDirectMessages(currentReceivedIdentifiers);
      const currentServerTimestamp=currentMessageClient.readDirectMessageTime();
      const currentValidEntries=currentHistoryPage.entries.filter(currentMessageEntry=>currentMessageEntry.expiresAt>currentServerTimestamp);
      currentTextClient.directMessageDisplayExpiresAt=currentValidEntries.length?performance.now()+1000*(Math.min(...currentValidEntries.map(currentMessageEntry=>currentMessageEntry.expiresAt))-currentServerTimestamp):null;
      return formatDirectMessageTerminal(currentHistoryPage.peer.name)+' ['+formatDirectMessageTerminal(currentPeerIdentifier)+']'+(currentHistoryPage.blocked?' · 수신 차단 중':'')+'\n'+DIRECT_MESSAGE_KOREAN_TEXT.retention+'\n'
        +currentValidEntries.map(currentMessageEntry=>'['+currentMessageEntry.messageId+'] '+formatDirectMessageTerminal(currentMessageEntry.senderId)+': '+formatDirectMessageTerminal(currentMessageEntry.text)).join('\n')
        +'\n'+(currentHistoryPage.nextCursor?'이전: dm read '+currentPeerIdentifier+' '+currentHistoryPage.nextCursor:'이전 페이지 없음');
    }
    throw new Error('dm list/read/send/retry/notice/block/unblock/blocks 중 하나를 입력하세요.');
  }catch(currentRequestError){
    if(currentRequestError instanceof DirectMessageClientError)throw new Error(DIRECT_MESSAGE_KOREAN_TEXT[currentRequestError.messageKey],{cause:currentRequestError});
    const currentPendingSend=currentMessageClient.readPendingDirectMessage();
    if(currentPendingSend)throw new Error(formatDirectMessageTerminal(currentPendingSend.payload.recipientId)+'에게 보낸 결과를 확인하지 못했습니다. 같은 요청으로 재확인: dm retry',{cause:currentRequestError});
    throw currentRequestError;
  }
}
