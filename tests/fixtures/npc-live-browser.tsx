import {render} from 'preact';
import {NpcDialogue} from '../../src/ui/NpcDialogue';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,100));
function assertBrowserCondition(currentCheckedCondition:unknown,currentFailureMessage:string){if(!currentCheckedCondition)throw new Error(currentFailureMessage);}
function renderDeliveryPanel(){render(<NpcDialogue gameSessionClient={currentGameClient} currentNpcIdentifier="iseulon-grocer" currentNpcName="모라" actionsAreDisabled={false} currentCharacterVersion={currentGameClient.state!.me.version}/>,document.getElementById('root')!);}
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
 assertBrowserCondition(currentSavedState.me.materials['protein-jelly']===currentMaterialQuantity,'서버 재료 수량');
 assertBrowserCondition(currentSavedState.me.coins===currentCoinQuantity,'서버 보상 잔액');
}
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();setLocale('ko');
 currentGameClient.tokens=currentTestContext.tokens;currentGameClient.onState=()=>renderDeliveryPanel();
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));await waitRenderCycle();await waitRenderCycle();
 await clickDeliveryButton(t('npc.talk',{name:'모라'}));
 await clickDeliveryButton(t('npc.complete'));
 const currentReviewSection=document.querySelector('[aria-label="'+t('npc.deliveryReview')+'"]');
 assertBrowserCondition(currentReviewSection?.textContent?.includes(t('npc.deliveryCharacter',{name:currentGameClient.state!.me.name})),'실제 캐릭터 이름');
 assertBrowserCondition(currentReviewSection?.textContent?.includes(t('npc.deliveryMaterial',{name:'단백질젤리',quantity:2})),'실제 차감 재료');
 assertBrowserCondition(currentReviewSection?.textContent?.includes(t('journal.reward',{amount:4})),'실제 보상');
 await verifySavedInventory(3,10);
 await clickDeliveryButton(t('npc.deliveryCancel'));await verifySavedInventory(3,10);
 await clickDeliveryButton(t('npc.complete'));await clickDeliveryButton(t('npc.deliveryConfirm'));
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime&&!document.querySelector('li')?.textContent?.includes(t('npc.completed')))await waitRenderCycle();
 assertBrowserCondition(document.querySelector('li')?.textContent?.includes(t('npc.completed')),'실제 완료 화면');
 await verifySavedInventory(1,14);
 const currentJournalPage=await currentGameClient.request('/v1/game/main-events');
 assertBrowserCondition(currentJournalPage.entries.length===1&&currentJournalPage.entries[0].status==='COMPLETED','다음 의뢰 자동 수령 없음');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 NPC 전달 확인·취소·재료 차감·보상·완료 저장'});
}catch(currentBrowserError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentBrowserError)});}})();
