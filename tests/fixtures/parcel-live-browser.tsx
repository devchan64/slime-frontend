import {render} from 'preact';
import {DirectMessages} from '../../src/ui/DirectMessages';
import {AccountRewardsPanel} from '../../src/ui/AccountRewardsPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
const currentOriginalFetch=window.fetch.bind(window);
const currentRecordedPurchases:string[]=[];
let currentResponseDiscarded=false;
let currentMessageDiscarded=false;
const currentMessagePayloads:string[]=[];
function assertBrowserCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);}
function renderParcelPanel(){render(<AccountRewardsPanel gameSessionClient={currentGameClient} actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function waitParcelCondition(currentPredicate:()=>boolean,currentDescription:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(currentPredicate())return;await currentWaitRender();}
 throw new Error(currentDescription+' '+document.body.textContent);
}
async function clickParcelButton(currentTranslationKey:string){
 await waitParcelCondition(()=>[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t(currentTranslationKey)&&!currentButton.disabled),'버튼 대기 '+currentTranslationKey);
 [...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t(currentTranslationKey))!.click();
 await currentWaitRender();
}
const currentClaimVersions:number[]=[];
window.fetch=async(currentInput,currentOptions)=>{
 const currentResponse=await currentOriginalFetch(currentInput,currentOptions);
 if(String(currentInput).endsWith('/claim')){
  currentRecordedPurchases.push(String(currentOptions?.body));
  if(currentResponse.ok)currentClaimVersions.push((await currentResponse.clone().json()).state.me.version);
  if(currentResponse.ok&&!currentResponseDiscarded){currentResponseDiscarded=true;await currentResponse.arrayBuffer();throw new TypeError('실제 수령 응답 유실 검사');}
 }
 if(String(currentInput).endsWith('/v1/direct-messages/messages')&&currentOptions?.method==='POST'){
  currentMessagePayloads.push(String(currentOptions.body));
  if(currentResponse.ok&&!currentMessageDiscarded){currentMessageDiscarded=true;await currentResponse.arrayBuffer();throw new TypeError('실제 개인 메시지 응답 유실 검사');}
 }
 return currentResponse;
};
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();
 setLocale(currentTestContext.locale);currentGameClient.tokens=currentTestContext.tokens;
 currentGameClient.onState=()=>renderParcelPanel();
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 const currentOriginalVersion=currentGameClient.state!.me.version;
 await currentWaitRender();await currentWaitRender();
 await clickParcelButton('parcels.refresh');
 await waitParcelCondition(()=>document.body.textContent!.includes('7P'),'첨부 금액 표시');
 assertBrowserCondition(document.body.textContent!.includes(currentTestContext.expectedMaterialName+' × 2'),'실제 카탈로그의 언어별 재료 이름 표시');
 assertBrowserCondition(!document.body.textContent!.includes('protein-jelly'),'내부 아이템 ID 대신 이름 표시');
 await clickParcelButton('parcels.claim');
 await waitParcelCondition(()=>document.body.textContent!.includes(t('parcels.uncertain')),'응답 유실 후 미확정 안내');
 await clickParcelButton('parcels.retry');
 await waitParcelCondition(()=>document.body.textContent!.includes(t('parcels.received')),'실제 수령 완료 표시');
 assertBrowserCondition(currentRecordedPurchases.length===2&&currentRecordedPurchases[0]===currentRecordedPurchases[1],'동일 요청으로 재시도');
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 assertBrowserCondition(currentGameClient.state!.me.coins===17,'돈 7P 단일 지급');
 assertBrowserCondition(currentGameClient.state!.me.bag!.items.some(currentItem=>currentItem.id==='protein-jelly'&&currentItem.quantity===2),'재료 2개 단일 지급');
 assertBrowserCondition(currentClaimVersions.length===2&&currentClaimVersions[0]===currentClaimVersions[1],'재수령 요청에서 버전 유지');
 assertBrowserCondition(currentGameClient.state!.me.version===currentClaimVersions[0]&&currentClaimVersions[0]>currentOriginalVersion,'최초 수령 상태 유지');
 await clickParcelButton('parcels.refresh');
 await waitParcelCondition(()=>document.body.textContent!.includes(t('parcels.empty')),'수령 후 빈 목록');
 const currentRecipientClient=new Client();currentRecipientClient.tokens=currentTestContext.recipientTokens;
 currentRecipientClient.accept(await currentRecipientClient.request('/v1/game/state'));
 async function openLiveMessagePanel(currentActiveClient:Client,currentPeerIdentifier:string){
  render(null,document.getElementById('root')!);await currentWaitRender();
  render(<DirectMessages currentGameClient={currentActiveClient} currentGameState={currentActiveClient.state!}/>,document.getElementById('root')!);
  await currentWaitRender();
  (document.querySelector('button[aria-label]') as HTMLButtonElement).click();
  await waitParcelCondition(()=>!!document.querySelector('fieldset:not(:disabled) input'),'대화 상대 입력 가능');
  const currentPeerInput=document.querySelector('fieldset input') as HTMLInputElement;
  currentPeerInput.value=currentPeerIdentifier;currentPeerInput.dispatchEvent(new Event('input',{bubbles:true}));await currentWaitRender();
  await clickParcelButton('directmessages.select');
  await waitParcelCondition(()=>!!document.querySelector('textarea:not(:disabled)'),'대화 내역 조회 완료');
 }
 async function sendLiveMessageText(currentMessageText:string){
  const currentMessageInput=document.querySelector('textarea') as HTMLTextAreaElement;
  currentMessageInput.value=currentMessageText;currentMessageInput.dispatchEvent(new Event('input',{bubbles:true}));await currentWaitRender();
  await clickParcelButton('directmessages.send');
 }
 const currentPrivateText='<img src=x onerror=alert(1)> 실제 비공개 본문';
 await openLiveMessagePanel(currentGameClient,currentRecipientClient.state!.me.id);
 await sendLiveMessageText(currentPrivateText);
 await waitParcelCondition(()=>[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t('directmessages.retry')),'실제 발송 유실 후 재확인');
 await clickParcelButton('directmessages.retry');
 await waitParcelCondition(()=>!!document.querySelector('.direct-message-history')?.textContent?.includes(currentPrivateText),'발신자 저장 메시지 조회');
 assertBrowserCondition(currentMessagePayloads.length===2&&currentMessagePayloads[0]===currentMessagePayloads[1],'개인 메시지 동일 ID·상대·본문 재시도');
 await openLiveMessagePanel(currentRecipientClient,currentGameClient.state!.me.id);
 await waitParcelCondition(()=>!!document.querySelector('.direct-message-history')?.textContent?.includes(currentPrivateText),'수신자 GUI 실제 메시지 조회');
 assertBrowserCondition(document.querySelectorAll('.direct-message-history li').length===1,'수신 내역 단일 메시지');
 assertBrowserCondition(!document.querySelector('.direct-message-history img'),'실제 본문 HTML 실행 없음');
 await clickParcelButton('directmessages.block');
 await waitParcelCondition(()=>[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t('directmessages.unblock')),'실제 수신 차단 저장');
 await openLiveMessagePanel(currentGameClient,currentRecipientClient.state!.me.id);
 await sendLiveMessageText('차단 뒤 저장되면 안 되는 본문');
 await waitParcelCondition(()=>!!document.querySelector('[role="alert"]'),'차단 후 실제 발송 거절');
 assertBrowserCondition(!document.querySelector('.direct-message-history')?.textContent?.includes('차단 뒤 저장되면 안 되는 본문'),'거절 메시지를 성공 내역에 추가하지 않음');
 assertBrowserCondition(currentMessagePayloads.length===3,'차단 발송 자동 재시도 없음');
 const currentPublicState=await currentGameClient.request('/v1/game/state');
 assertBrowserCondition(!JSON.stringify(currentPublicState).includes(currentPrivateText),'공개 게임 상태에 개인 본문 없음');
 render(null,document.getElementById('root')!);
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 GUI 소포 수령과 개인 메시지 발송·유실 재시도·수신·차단'});
}catch(currentError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentError)});}})();
