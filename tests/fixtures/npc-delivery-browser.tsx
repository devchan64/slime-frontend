import {render} from 'preact';
import {NpcDialogue} from '../../src/ui/NpcDialogue';
import type {Client} from '../../src/client/api';
import {t,setLocale,getLocale} from '../../src/i18n';
const currentAssertionLabels:string[]=[];
const currentMutationRequests:Array<{path:string;body:any}>=[];
let currentQuestCompleted=false;
const currentFixtureClient={tokens:{user_id:'owner'},state:{generation:1,epoch:1,location:{id:'city'},me:{id:'hero',name:'여행자',mode:'FIELD',position:{column:1,row:1},version:2}},
 async request(currentRequestPath:string,currentRequestBody?:any):Promise<any>{
  if(currentRequestBody){currentMutationRequests.push({path:currentRequestPath,body:structuredClone(currentRequestBody)});currentQuestCompleted=true;return {state:{...this.state,me:{...this.state.me,version:3}}};}
  return {serverTime:30,characterVersion:this.state.me.version,npc:{id:'npc',name:'모라',cityId:'iseulon',facilityId:'iseulon-market'},acceptedCount:currentQuestCompleted?0:1,maximumAcceptedCount:5,entries:[{eventId:'first',title:'첫 납품',status:currentQuestCompleted?'COMPLETED':'ACCEPTED',dialogue:currentQuestCompleted?'고맙습니다.':'전달해 주세요.',items:[{itemId:'protein-jelly',required:2,owned:currentQuestCompleted?1:3,nameTranslations:{ko:'단백질젤리',en:'Protein jelly'}}],moneyP:4,action:currentQuestCompleted?null:'complete',canExecute:!currentQuestCompleted,blockedReasons:[],giverNpcId:'npc',receiverNpcId:'npc'}]};
 },accept(currentReceivedState:any){this.state=currentReceivedState;renderDeliveryPanel();},
};
function renderDeliveryPanel(){render(<NpcDialogue gameSessionClient={currentFixtureClient as unknown as Client} currentNpcIdentifier="npc" currentNpcName="모라" actionsAreDisabled={false} currentCharacterVersion={currentFixtureClient.state.me.version}/>,document.getElementById('root')!);}
function verifyDeliveryCondition(currentConditionValue:unknown,currentAssertionLabel:string){if(!currentConditionValue)throw new Error(currentAssertionLabel);currentAssertionLabels.push(currentAssertionLabel);}
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,120));
const findNamedButton=(currentButtonText:string)=>[...document.querySelectorAll('button')].find(currentButtonElement=>currentButtonElement.textContent===currentButtonText);
async function clickDeliveryButton(currentTranslationKey:string){const currentButtonElement=findNamedButton(t(currentTranslationKey));verifyDeliveryCondition(currentButtonElement&&!currentButtonElement.disabled,'조작 가능: '+currentTranslationKey);currentButtonElement!.click();await waitRenderCycle();}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');renderDeliveryPanel();await waitRenderCycle();await waitRenderCycle();
 findNamedButton(t('npc.talk',{name:'모라'}))!.click();await waitRenderCycle();await waitRenderCycle();
 await clickDeliveryButton('npc.complete');
 const currentReviewSection=document.querySelector('[aria-label="'+t('npc.deliveryReview')+'"]')!;
 verifyDeliveryCondition(currentReviewSection?.textContent?.includes(t('npc.deliveryCharacter',{name:'여행자'})),'선택한 캐릭터 표시');
 verifyDeliveryCondition(currentReviewSection.textContent?.includes(t('npc.deliveryMaterial',{name:getLocale()==='ko'?'단백질젤리':'Protein jelly',quantity:2})),'차감 재료와 수량 표시');
 verifyDeliveryCondition(currentReviewSection.textContent?.includes(t('journal.reward',{amount:4})),'보상 표시');
 verifyDeliveryCondition(currentMutationRequests.length===0,'확인 화면 열기만으로 전달하지 않음');
 await clickDeliveryButton('npc.deliveryCancel');
 verifyDeliveryCondition(!findNamedButton(t('npc.deliveryConfirm'))&&currentMutationRequests.length===0,'취소 시 전달 요청 없음');
 await clickDeliveryButton('npc.complete');await clickDeliveryButton('journal.refresh');
 verifyDeliveryCondition(!findNamedButton(t('npc.deliveryConfirm')),'새로고침 시 이전 확인 폐기');
 await clickDeliveryButton('npc.complete');
 const currentConfirmButton=findNamedButton(t('npc.deliveryConfirm'))!;currentConfirmButton.click();currentConfirmButton.click();await waitRenderCycle();await waitRenderCycle();
 verifyDeliveryCondition(currentMutationRequests.length===1,'연속 클릭에도 전달 한 번');
 verifyDeliveryCondition(JSON.stringify(currentMutationRequests[0])===JSON.stringify({path:'/v1/game/main-events/first/complete',body:{npcId:'npc',expectedVersion:2}}),'확인한 버전과 NPC로 전달');
 verifyDeliveryCondition(!findNamedButton(t('npc.deliveryConfirm'))&&!findNamedButton(t('npc.complete')),'완료 후 전달 버튼 제거');
 verifyDeliveryCondition(document.querySelector('li')?.textContent?.includes(t('npc.completed')),'완료 상태 갱신');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionLabels});
}catch(currentFailureError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailureError),stack:(currentFailureError as Error).stack,assertions:currentAssertionLabels});}})();
