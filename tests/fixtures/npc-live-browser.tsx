import {render} from 'preact';
import {NpcDialogue} from '../../src/ui/NpcDialogue';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
let currentScenarioContext:any;
let currentDroppedResponse=false;
let currentCompletionPayload:any;
let currentCompletionPath='';
let currentCompletionRequests=0;
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,100));
function assertBrowserCondition(currentCheckedCondition:unknown,currentFailureMessage:string){if(!currentCheckedCondition)throw new Error(currentFailureMessage);}
function renderDeliveryPanel(){render(<NpcDialogue gameSessionClient={currentGameClient} currentNpcIdentifier={currentScenarioContext.npcId} currentNpcName={currentScenarioContext.npcName} currentQuestCategory={currentScenarioContext.category} actionsAreDisabled={false} currentCharacterVersion={currentGameClient.state!.me.version}/>,document.getElementById('root')!);}
async function clickDeliveryButton(currentButtonText:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){
  const currentButtonElement=[...document.querySelectorAll('button')].find(currentButtonElement=>currentButtonElement.textContent===currentButtonText);
  if(currentButtonElement&&!currentButtonElement.disabled){currentButtonElement.click();await waitRenderCycle();return;}
  await waitRenderCycle();
 }
 throw new Error('버튼 대기 시간 초과: '+currentButtonText+' '+document.body.textContent);
}
async function verifySavedInventory(currentMaterialQuantity:number,currentCoinQuantity:number){
 const currentSavedState=await currentGameClient.request('/v1/game/state');
 assertBrowserCondition(currentSavedState.me.materials[currentScenarioContext.materialId]===currentMaterialQuantity,'서버 재료 수량');
 assertBrowserCondition(currentSavedState.me.coins===currentCoinQuantity,'서버 보상 잔액');
}
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();currentScenarioContext=currentTestContext;setLocale(currentTestContext.locale);
 const currentOriginalFetch=globalThis.fetch;
 globalThis.fetch=async(currentRequestInput,currentRequestOptions)=>{
  const currentActualResponse=await currentOriginalFetch(currentRequestInput,currentRequestOptions);
  if(currentScenarioContext.category==='timed'&&String(currentRequestInput).includes('/timed-events/')&&String(currentRequestInput).endsWith('/complete')&&currentRequestOptions?.method==='POST'){
   currentCompletionRequests++;currentCompletionPayload=JSON.parse(currentRequestOptions.body as string);currentCompletionPath=String(currentRequestInput);
   if(currentActualResponse.ok&&!currentDroppedResponse){currentDroppedResponse=true;await currentActualResponse.arrayBuffer();throw new TypeError('완료 저장 후 응답 유실');}
  }
  return currentActualResponse;
 };
 currentGameClient.tokens=currentTestContext.tokens;currentGameClient.onState=()=>renderDeliveryPanel();
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));await waitRenderCycle();await waitRenderCycle();
 await clickDeliveryButton(t(currentScenarioContext.category==='timed'?'timedquests.talk':'npc.talk',{name:currentScenarioContext.npcName}));
 await clickDeliveryButton(t('npc.complete'));
 assertBrowserCondition(document.body.textContent?.includes(t('npc.destination',{city:currentScenarioContext.cityName,name:currentScenarioContext.npcName})),'실제 서버 전달처 표시');
 const currentReviewSection=document.querySelector('[aria-label="'+t('npc.deliveryReview')+'"]');
 assertBrowserCondition(currentReviewSection?.textContent?.includes(t('npc.deliveryCharacter',{name:currentGameClient.state!.me.name})),'실제 캐릭터 이름');
 assertBrowserCondition(currentReviewSection?.textContent?.includes(t('npc.deliveryMaterial',{name:currentScenarioContext.materialName,quantity:currentScenarioContext.requiredQuantity})),'실제 차감 재료');
 assertBrowserCondition(currentReviewSection?.textContent?.includes(t('journal.reward',{amount:currentScenarioContext.rewardAmount})),'실제 보상');
 await verifySavedInventory(currentScenarioContext.requiredQuantity+1,10);
 await clickDeliveryButton(t('npc.deliveryCancel'));await verifySavedInventory(currentScenarioContext.requiredQuantity+1,10);
 await clickDeliveryButton(t('npc.complete'));await clickDeliveryButton(t('npc.deliveryConfirm'));
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime&&!document.querySelector('li')?.textContent?.includes(t('npc.completed')))await waitRenderCycle();
 assertBrowserCondition(document.querySelector('li')?.textContent?.includes(t('npc.completed')),'실제 완료 화면');
 await verifySavedInventory(1,10+currentScenarioContext.rewardAmount);
 if(currentScenarioContext.category==='timed'){
  assertBrowserCondition(currentDroppedResponse&&currentCompletionRequests===1,'완료 응답 유실 후 자동 재정산 없음');
  const currentRecoveryResponse=await currentGameClient.request(new URL(currentCompletionPath,location.origin).pathname,currentCompletionPayload);
  assertBrowserCondition(currentRecoveryResponse.entry.status==='COMPLETED','원래 요청으로 완료 복구');
  await verifySavedInventory(1,10+currentScenarioContext.rewardAmount);
 }
 const currentJournalPage=await currentGameClient.request(currentScenarioContext.category==='timed'?'/v1/game/timed-events':'/v1/game/main-events');
 assertBrowserCondition(currentJournalPage.entries.length===1&&currentJournalPage.entries[0].status==='COMPLETED','다음 의뢰 자동 수령 없음');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 NPC 전달 확인·취소·재료 차감·보상·완료 저장'});
}catch(currentBrowserError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentBrowserError)});}})();
