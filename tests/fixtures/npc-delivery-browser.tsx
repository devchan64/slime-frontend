import {render} from 'preact';
import {NpcDialogue} from '../../src/ui/NpcDialogue';
import type {Client} from '../../src/client/api';
import {t,setLocale,getLocale} from '../../src/i18n';
const currentAssertionLabels:string[]=[];
const currentMutationRequests:Array<{path:string;body:any}>=[];
let currentQuestCompleted=false;
let currentTimedMode=false;
let currentTimedAccepted=false;
let currentTimedExpired=false;
let currentDeliveryFailure='';
let currentMaterialsMissing=false;
const currentFixtureClient={tokens:{user_id:'owner'},state:{generation:1,epoch:1,location:{id:'city'},me:{id:'hero',name:'여행자',mode:'FIELD',position:{column:1,row:1},version:2}},
 async request(currentRequestPath:string,currentRequestBody?:any):Promise<any>{
  if(currentTimedMode){
   if(currentRequestBody){
    currentMutationRequests.push({path:currentRequestPath,body:structuredClone(currentRequestBody)});
    currentTimedAccepted=true;currentQuestCompleted=currentRequestPath.endsWith('/complete');
    const currentUpdatedState={...this.state,serverTime:31,me:{...this.state.me,version:this.state.me.version+1}};
    return {state:currentUpdatedState,entry:createTimedFixtureEntry()};
   }
   if(currentRequestPath==='/v1/game/state')return structuredClone(this.state);
   return {serverTime:currentTimedExpired?90000:31,characterVersion:this.state.me.version,npc:{id:'npc',name:'모라',cityId:'iseulon',facilityId:'iseulon-market'},acceptedCount:currentTimedAccepted&&!currentQuestCompleted&&!currentTimedExpired?1:0,maximumAcceptedCount:5,nextOffset:null,entries:[createTimedFixtureEntry()]};
  }
  if(currentRequestBody){currentMutationRequests.push({path:currentRequestPath,body:structuredClone(currentRequestBody)});
   if(currentDeliveryFailure==='materials'){currentMaterialsMissing=true;this.state.me.version++;throw new Error('테스트 재료 부족');}
   currentQuestCompleted=true;
   if(currentDeliveryFailure==='response'){this.state.me.version++;throw new TypeError('테스트 응답 유실');}
   return {state:{...this.state,me:{...this.state.me,version:3}}};}
  if(currentRequestPath==='/v1/game/state')return structuredClone(this.state);
  return {serverTime:30,characterVersion:this.state.me.version,npc:{id:'npc',name:'모라',cityId:'iseulon',facilityId:'iseulon-market'},acceptedCount:currentQuestCompleted?0:1,maximumAcceptedCount:5,entries:[{destination:{npcId:'npc',name:'모라',cityId:'iseulon',facilityId:'iseulon-market',cityNameTranslations:{ko:'이슬온',en:'Iseulon'}},eventId:'first',title:'첫 납품',status:currentQuestCompleted?'COMPLETED':'ACCEPTED',dialogue:currentQuestCompleted?'고맙습니다.':'전달해 주세요.',items:[{itemId:'protein-jelly',required:2,owned:currentQuestCompleted||currentMaterialsMissing?1:3,nameTranslations:{ko:'단백질젤리',en:'Protein jelly'}}],moneyP:4,action:currentQuestCompleted?null:'complete',canExecute:!currentQuestCompleted&&!currentMaterialsMissing,blockedReasons:currentMaterialsMissing?['MATERIALS_REQUIRED']:[],giverNpcId:'npc',receiverNpcId:'npc'}]};
 },accept(currentReceivedState:any){this.state=currentReceivedState;renderDeliveryPanel();},
};
function createTimedFixtureEntry(){return {offerId:'random:2026-10-03:first',eventId:'first',type:'random',periodId:'2026-10-03',title:'기간 납품',dialogue:'기간 안에 전달해 주세요.',
 destination:{npcId:'npc',name:'모라',cityId:'iseulon',facilityId:'iseulon-market',cityNameTranslations:{ko:'이슬온',en:'Iseulon'}},giverNpcId:'npc',receiverNpcId:'npc',
 status:currentTimedExpired?'EXPIRED':currentQuestCompleted?'COMPLETED':currentTimedAccepted?'ACCEPTED':'AVAILABLE',
 action:currentTimedExpired||currentQuestCompleted?null:currentTimedAccepted?'complete':'accept',canExecute:!currentTimedExpired&&!currentQuestCompleted,blockedReasons:[],
 items:[{itemId:'hide',required:1,owned:2,nameTranslations:{ko:'질긴 가죽',en:'Tough Hide'}}],moneyP:5,
 acceptedAt:currentTimedAccepted?30:null,completedAt:currentQuestCompleted?31:null,acceptanceEndsAt:100,deliveryDeadline:86430};}
function renderDeliveryPanel(){render(<NpcDialogue gameSessionClient={currentFixtureClient as unknown as Client} currentNpcIdentifier="npc" currentNpcName="모라" actionsAreDisabled={false} currentCharacterVersion={currentFixtureClient.state.me.version} currentQuestCategory={currentTimedMode?'timed':'main'}/>,document.getElementById('root')!);}
function verifyDeliveryCondition(currentConditionValue:unknown,currentAssertionLabel:string){if(!currentConditionValue)throw new Error(currentAssertionLabel);currentAssertionLabels.push(currentAssertionLabel);}
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,120));
const findNamedButton=(currentButtonText:string)=>[...document.querySelectorAll('button')].find(currentButtonElement=>currentButtonElement.textContent===currentButtonText);
async function clickDeliveryButton(currentTranslationKey:string){const currentButtonElement=findNamedButton(t(currentTranslationKey));verifyDeliveryCondition(currentButtonElement&&!currentButtonElement.disabled,'조작 가능: '+currentTranslationKey);currentButtonElement!.click();await waitRenderCycle();}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');renderDeliveryPanel();await waitRenderCycle();await waitRenderCycle();
 findNamedButton(t('npc.talk',{name:'모라'}))!.click();await waitRenderCycle();await waitRenderCycle();
 verifyDeliveryCondition(document.body.textContent?.includes(t('npc.destination',{city:getLocale()==='ko'?'이슬온':'Iseulon',name:'모라'})),'전달 도시와 NPC 표시');
 verifyDeliveryCondition(document.body.textContent?.includes(t('npc.destinationCitizenship',{city:getLocale()==='ko'?'이슬온':'Iseulon'})),'완료 도시 시민권과 길드 발급·재료 판매 안내');
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
 currentDeliveryFailure='materials';await clickDeliveryButton('npc.deliveryConfirm');await waitRenderCycle();
 verifyDeliveryCondition(currentMutationRequests.length===1&&!currentQuestCompleted,'재료 부족 오류 뒤 전달 자동 재실행 없음');
 verifyDeliveryCondition(findNamedButton(t('npc.complete'))?.disabled&&document.body.textContent?.includes(t('npc.materialsrequired')),'갱신된 재료 부족 조건 표시');
 verifyDeliveryCondition(document.body.textContent?.includes('테스트 재료 부족'),'실패 이유 보존');
 currentMaterialsMissing=false;currentFixtureClient.state.me.version++;await clickDeliveryButton('journal.refresh');
 await clickDeliveryButton('npc.complete');currentDeliveryFailure='response';
 const currentConfirmButton=findNamedButton(t('npc.deliveryConfirm'))!;currentConfirmButton.click();currentConfirmButton.click();await waitRenderCycle();await waitRenderCycle();
 verifyDeliveryCondition(currentMutationRequests.length===2,'응답 유실·연속 클릭에도 추가 전달 없음');
 verifyDeliveryCondition(JSON.stringify(currentMutationRequests[1])===JSON.stringify({path:'/v1/game/main-events/first/complete',body:{npcId:'npc',expectedVersion:4}}),'확인한 버전과 NPC로 전달');
 verifyDeliveryCondition(!findNamedButton(t('npc.deliveryConfirm'))&&!findNamedButton(t('npc.complete')),'완료 후 전달 버튼 제거');
 verifyDeliveryCondition(document.querySelector('li')?.textContent?.includes(t('npc.completed')),'완료 상태 갱신');
 verifyDeliveryCondition(!document.body.textContent?.includes(t('npc.destinationCitizenship',{city:getLocale()==='ko'?'이슬온':'Iseulon'})),'완료된 의뢰에는 발급 안내 숨김');
 render(null,document.getElementById('root')!);await waitRenderCycle();
 currentTimedMode=true;currentQuestCompleted=false;currentDeliveryFailure='';currentMaterialsMissing=false;
 renderDeliveryPanel();await waitRenderCycle();
 findNamedButton(t('timedquests.talk',{name:'모라'}))!.click();await waitRenderCycle();await waitRenderCycle();
 for(let currentRenderAttempt=0;currentRenderAttempt<10&&!document.body.textContent?.includes(t('timedquests.randomDeadline'));currentRenderAttempt++)await waitRenderCycle();
 verifyDeliveryCondition(document.body.textContent?.includes(t('timedquests.randomDeadline')),'랜덤 수령 전 24시간 기한 안내');
 const currentBeforeTimedRequests=currentMutationRequests.length;
 await clickDeliveryButton('npc.accept');await waitRenderCycle();
 verifyDeliveryCondition(currentMutationRequests.length===currentBeforeTimedRequests+1&&currentMutationRequests.at(-1)?.path==='/v1/game/timed-events/random%3A2026-10-03%3Afirst/accept','기간별 ID로 수령');
 verifyDeliveryCondition(document.body.textContent?.includes(t('timedquests.deliverBefore',{time:new Date(86430*1000).toLocaleString(getLocale())})),'확정된 전달 마감 표시');
 await clickDeliveryButton('npc.complete');await clickDeliveryButton('npc.deliveryConfirm');await waitRenderCycle();
 verifyDeliveryCondition(currentMutationRequests.length===currentBeforeTimedRequests+2&&document.body.textContent?.includes(t('npc.completed')),'확인 후 기간 의뢰 한 번 전달');
 currentQuestCompleted=false;currentTimedExpired=true;await clickDeliveryButton('journal.refresh');await waitRenderCycle();
 verifyDeliveryCondition(document.body.textContent?.includes(t('timedquests.expired'))&&!findNamedButton(t('npc.complete'))&&!findNamedButton(t('npc.accept')),'만료 의뢰는 무보상과 실행 불가 표시');
 verifyDeliveryCondition(!document.body.textContent?.includes(t('npc.destinationCitizenship',{city:createTimedFixtureEntry().destination.cityNameTranslations[getLocale()]})),'만료 후 시민권 구입 안내 제거');
 verifyDeliveryCondition(!document.body.textContent?.includes(t('journal.reward',{amount:5})),'만료 후 예정 보상 안내 제거');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionLabels});
}catch(currentFailureError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailureError),stack:(currentFailureError as Error).stack,assertions:currentAssertionLabels});}})();
