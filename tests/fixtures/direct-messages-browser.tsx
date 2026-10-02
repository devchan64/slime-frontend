import {render} from 'preact';
import {DirectMessages} from '../../src/ui/DirectMessages';
import {setLocale,t} from '../../src/i18n';
const currentRootElement=document.getElementById('root')!;
const currentAssertionMessages:string[]=[];
const waitDirectMessageRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,120));
function assertDirectMessageBrowser(currentCondition:unknown,currentMessageText:string){if(!currentCondition)throw new Error(currentMessageText);currentAssertionMessages.push(currentMessageText);}
function clickDirectMessageButton(currentButtonText:string){
 const currentButtonElement=Array.from(document.querySelectorAll('button')).find(currentButtonElement=>currentButtonElement.textContent===currentButtonText) as HTMLButtonElement;
 if(!currentButtonElement||currentButtonElement.disabled)throw new Error('버튼을 사용할 수 없음: '+currentButtonText);currentButtonElement.click();
}
async function selectDirectMessagePeer(currentPeerIdentifier:string){
 const currentInputElement=document.querySelector('fieldset input') as HTMLInputElement;currentInputElement.value=currentPeerIdentifier;currentInputElement.dispatchEvent(new Event('input',{bubbles:true}));await waitDirectMessageRender();
 clickDirectMessageButton(t('directmessages.select'));await waitDirectMessageRender();
}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 const currentInitialMilliseconds=Date.now();
 const currentInitialTimestamp=currentInitialMilliseconds/1000;
 const currentRequestIdentifier=currentInitialMilliseconds.toString(16).padStart(12,'0').replace(/^(.{8})(.{4})$/,'$1-$2')+'-7000-8000-000000000001';
 const currentSendPayloads:any[]=[];
 let currentBlockedValue=false;
 let currentExpireHistory=false;
 let currentHistoryPaging=false;
 let currentLatestBody='자동 갱신 전 본문';
 let currentLatestSequence='2';
 const currentAcknowledgedMessages:string[]=[];
 let currentHistoryRequests=0;
 let currentDelayHistory=false;
 let currentDeferredHistory:((currentResult:unknown)=>void)|null=null;
 let currentDelayedResponse:any;
 const currentClientStub:any={tokens:{access_token:'test'},state:{me:{id:'hero',name:'주인공'},generation:1,members:[{id:'friend',name:'친구'},{id:'other',name:'다른 상대'}]},request:async(currentRequestPath:string,currentRequestBody:any,currentRequestMethod:string)=>{
   if(currentRequestPath.endsWith('/notifications'))return {serverTime:currentInitialTimestamp,count:1,latestMessageId:'1'};
   if(currentRequestPath.endsWith('/conversations'))return {serverTime:currentInitialTimestamp,entries:[{characterId:'friend',name:'친구',latestMessageId:'1',sentAt:currentInitialTimestamp}],nextCursor:null};
   if(currentRequestPath.endsWith('/request-id'))return {requestId:currentRequestIdentifier,characterId:'hero',firstSendBefore:currentInitialTimestamp+60,expiresAt:currentInitialTimestamp+30*86400};
   if(currentRequestPath==='/v1/direct-messages/messages'){
     currentSendPayloads.push(currentRequestBody);if(currentSendPayloads.length===1)throw new TypeError('응답 유실');return {messageId:'2',sentAt:currentInitialTimestamp};
   }
   if(currentRequestPath.endsWith('/acknowledgements')){currentAcknowledgedMessages.push(...currentRequestBody.messageIds);return {messageIds:currentRequestBody.messageIds};}
   if(currentRequestPath.includes('/blocks/')){assertDirectMessageBrowser(currentRequestMethod==='PUT','차단은 PUT 전송');currentBlockedValue=currentRequestBody.blocked;return {characterId:'friend',blocked:currentBlockedValue};}
   if(currentRequestPath.includes('/conversations/')&&currentRequestPath.includes('/messages')){
     currentHistoryRequests++;
     const currentPeerIdentifier=currentRequestPath.split('/')[4];
     const currentOlderPage=currentRequestPath.includes('?before=');
     const currentHistoryResponse={serverTime:currentInitialTimestamp,peer:{characterId:currentPeerIdentifier,name:currentPeerIdentifier==='friend'?'친구':'다른 상대'},blocked:currentBlockedValue,
       entries:[{messageId:currentOlderPage?'1':currentLatestSequence,senderId:currentPeerIdentifier,recipientId:'hero',text:currentHistoryPaging?(currentOlderPage?'이전 대화 본문':currentLatestBody):'<img src=x onerror=alert(1)> 개인 본문',sentAt:currentInitialTimestamp-10,expiresAt:currentExpireHistory?Date.now()/1000+0.6:currentInitialTimestamp+600}],nextCursor:currentHistoryPaging&&!currentOlderPage?'2':null};
     if(currentDelayHistory){currentDelayHistory=false;currentDelayedResponse=currentHistoryResponse;return new Promise(currentResolveCallback=>{currentDeferredHistory=currentResolveCallback;});}
     return currentHistoryResponse;
   }
   throw new Error('예상하지 않은 API: '+currentRequestPath);
 }};
 render(<div class="app-shell world-shell"><header><label class="language-select"><select><option>한국어</option></select></label><DirectMessages currentGameClient={currentClientStub} currentGameState={currentClientStub.state}/><a class="brand">SLIME</a><div class="connection">{t('common.connected')}</div><button>{t('common.logout')}</button></header></div>,currentRootElement);
 await waitDirectMessageRender();
 assertDirectMessageBrowser(document.documentElement.scrollWidth<=window.innerWidth,'모바일 헤더 가로 넘침 없음');
 (document.querySelector('button[aria-label]') as HTMLButtonElement).click();await waitDirectMessageRender();await selectDirectMessagePeer('friend');
 assertDirectMessageBrowser(document.querySelector('.direct-message-history')!.textContent!.includes('<img'),'본문은 일반 문자로 표시');
 assertDirectMessageBrowser(!document.querySelector('.direct-message-history img'),'HTML 실행 없음');
 const currentDraftElement=document.querySelector('textarea') as HTMLTextAreaElement;currentDraftElement.value='친구에게만 보낼 초안';currentDraftElement.dispatchEvent(new Event('input',{bubbles:true}));await waitDirectMessageRender();
 await selectDirectMessagePeer('other');
 assertDirectMessageBrowser((document.querySelector('textarea') as HTMLTextAreaElement).value==='','상대 변경 시 이전 초안을 새 상대에게 옮기지 않음');
 await selectDirectMessagePeer('friend');
 assertDirectMessageBrowser((document.querySelector('textarea') as HTMLTextAreaElement).value==='친구에게만 보낼 초안','원래 상대의 초안 유지');
 clickDirectMessageButton(t('directmessages.send'));await waitDirectMessageRender();
 assertDirectMessageBrowser(!!document.querySelector('[role="alert"]'),'응답 유실 안내');
 await selectDirectMessagePeer('other');clickDirectMessageButton(t('directmessages.retry'));await waitDirectMessageRender();
 assertDirectMessageBrowser(currentSendPayloads.length===2&&JSON.stringify(currentSendPayloads[0])===JSON.stringify(currentSendPayloads[1]),'상대 변경 후 재확인도 원래 상대·ID·본문 유지');
 await selectDirectMessagePeer('friend');clickDirectMessageButton(t('directmessages.block'));await waitDirectMessageRender();
 assertDirectMessageBrowser(currentBlockedValue&&document.body.textContent!.includes(t('directmessages.unblock')),'수신 차단 후 해제 버튼');
 currentExpireHistory=true;clickDirectMessageButton(t('directmessages.refresh'));await waitDirectMessageRender();
 assertDirectMessageBrowser(document.querySelector('.direct-message-history')!.textContent!.includes('개인 본문'),'만료 직전 본문 표시');
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,1400));
 assertDirectMessageBrowser(!document.querySelector('.direct-message-history')!.textContent!.includes('개인 본문'),'만료 본문 화면 폐기');
 assertDirectMessageBrowser(!Object.values(localStorage).join('').includes('개인 본문'),'브라우저 영구 저장소에 본문 없음');
 assertDirectMessageBrowser(document.documentElement.scrollWidth<=window.innerWidth,'모바일 대화창 가로 넘침 없음');
 currentExpireHistory=false;currentHistoryPaging=true;clickDirectMessageButton(t('directmessages.refresh'));await waitDirectMessageRender();
 const currentLiveDraft=document.querySelector('textarea') as HTMLTextAreaElement;currentLiveDraft.value='갱신 중에도 유지할 초안';currentLiveDraft.dispatchEvent(new Event('input',{bubbles:true}));
 currentLatestBody='새로 도착한 자동 본문';currentLatestSequence='3';
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,31000));
 assertDirectMessageBrowser(document.querySelector('.direct-message-history')!.textContent!.includes(currentLatestBody),'버튼 조작 없이 새 본문 자동 표시');
 assertDirectMessageBrowser((document.querySelector('textarea') as HTMLTextAreaElement).value==='갱신 중에도 유지할 초안','자동 갱신 중 작성 초안 유지');
 assertDirectMessageBrowser(currentAcknowledgedMessages.filter(currentMessageIdentifier=>currentMessageIdentifier==='3').length===1,'새 자동 수신 메시지 확인 처리');
 clickDirectMessageButton(t('directmessages.older'));await waitDirectMessageRender();
 const currentPreviousRequests=currentHistoryRequests;
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,31000));
 assertDirectMessageBrowser(currentHistoryRequests===currentPreviousRequests&&document.querySelector('.direct-message-history')!.textContent!.includes('이전 대화 본문'),'이전 내역 페이지는 자동 조회와 덮어쓰기 중단');
 clickDirectMessageButton(t('directmessages.refresh'));await waitDirectMessageRender();currentDelayHistory=true;
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,31000));
 assertDirectMessageBrowser(currentDeferredHistory!==null,'열린 최신 대화의 자동 조회 재개');
 await selectDirectMessagePeer('other');
 currentDelayedResponse.entries[0].text='폐기해야 할 늦은 응답';
 (currentDeferredHistory as unknown as (currentResult:unknown)=>void)(currentDelayedResponse);await waitDirectMessageRender();
 assertDirectMessageBrowser(!document.body.textContent!.includes('폐기해야 할 늦은 응답')&&document.querySelector('h3')!.textContent!.includes('other'),'상대 변경 이후 늦은 자동 조회 폐기');
 currentDelayHistory=true;currentLatestSequence='4';
 clickDirectMessageButton(t('directmessages.refresh'));await waitDirectMessageRender();
 clickDirectMessageButton(t('common.close'));await waitDirectMessageRender();
 currentDelayedResponse.entries[0].text='닫은 창의 늦은 수동 응답';
 (currentDeferredHistory as unknown as (currentResult:unknown)=>void)(currentDelayedResponse);await waitDirectMessageRender();
 assertDirectMessageBrowser(!currentAcknowledgedMessages.includes('4'),'닫은 뒤 도착한 내역은 수신 확인하지 않음');
 (document.querySelector('button[aria-label]') as HTMLButtonElement).click();await waitDirectMessageRender();
 assertDirectMessageBrowser(!document.querySelector('.direct-message-history'),'다시 열어도 닫은 창의 늦은 내역을 복원하지 않음');
 await selectDirectMessagePeer('other');
 assertDirectMessageBrowser(currentAcknowledgedMessages.includes('4')&&!!document.querySelector('.direct-message-history'),'다시 선택한 대화는 정상 표시하고 수신 확인');
 render(null,currentRootElement);await waitDirectMessageRender();
 assertDirectMessageBrowser(!document.querySelector('dialog'),'로그아웃 시 개인 화면 제거');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionMessages});
}catch(currentFailure){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailure),assertions:currentAssertionMessages});}})();
