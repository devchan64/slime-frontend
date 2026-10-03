import {render} from 'preact';
import {SkillCardPanel} from '../../src/ui/SkillCardPanel';
import {SkillbookPanel} from '../../src/ui/SkillbookPanel';
import {setLocale,t} from '../../src/i18n';
const currentAssertionsList:string[]=[];
const waitBookPanelRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,120));
function assertBookCommandResult(currentConditionValue:unknown,currentMessageText:string){
 if(!currentConditionValue)throw new Error(currentMessageText);
 currentAssertionsList.push(currentMessageText);
}
const currentBookDefinition={definitionId:'monster-lore-book',definitionVersion:3,priceP:100,literacyRequired:3,grantsSkill:'monster_lore',nameTranslations:{ko:'몬스터학',en:'Monster Lore'}};
let currentOwnedBook:any=null;
let currentResponseMode='price';
let currentAcceptedStates=0;
let currentOriginalPurchase:any=null;
const currentPurchaseRequests:any[]=[];
const currentReadRequests:any[]=[];
const currentClientStub:any={
 tokens:{user_id:'owner'},
 state:{protocolVersion:1,generation:1,epoch:1,cursor:1,map:{id:'iseulon'},location:{id:'city-channel'},me:{id:'hero',position:{column:1,row:1},mode:'FIELD',version:2,coins:500,skills:{literacy:3},battleId:null}},
 request:async(currentRequestPath:string,currentRequestBody:any)=>{
  if(currentRequestPath.endsWith('/catalog'))return {characterVersion:currentClientStub.state.me.version,books:currentOwnedBook?[currentOwnedBook]:[],catalog:[{...currentBookDefinition,owned:!!currentOwnedBook}]};
  const currentReturnedState=structuredClone(currentClientStub.state);
  currentReturnedState.me.version++;currentReturnedState.cursor++;
  if(currentRequestPath.endsWith('/purchases')){
   currentPurchaseRequests.push(structuredClone(currentRequestBody));
   currentOriginalPurchase??=structuredClone(currentRequestBody);
   assertBookCommandResult(JSON.stringify(currentOriginalPurchase)===JSON.stringify(currentRequestBody),'구매 원본 요청 유지');
   const currentReturnedBook={...currentBookDefinition,requestId:currentRequestBody.requestId,facilityId:'iseulon-bookshop',purchasedAt:100,firstReadAt:null,weightG:450};
   if(currentResponseMode==='price')currentReturnedBook.priceP=999;
   if(currentResponseMode==='request')currentReturnedBook.requestId='wrong-request';
   if(currentResponseMode==='owner')currentReturnedState.me.id='other';
   if(currentResponseMode==='valid')currentOwnedBook=currentReturnedBook;
   return {book:currentReturnedBook,state:currentReturnedState};
  }
  currentReadRequests.push(structuredClone(currentRequestBody));
  const currentReturnedBook={...currentOwnedBook};
  if(currentResponseMode==='wrong-book')currentReturnedBook.definitionId='other-book';
  if(currentResponseMode==='valid'){currentReturnedBook.firstReadAt=101;currentOwnedBook=currentReturnedBook;}
  return {book:currentReturnedBook,state:currentReturnedState};
 },
 accept:(currentReturnedState:any)=>{currentAcceptedStates++;currentClientStub.state=currentReturnedState;},
};
async function clickBookPanelButton(currentButtonText:string){
 const currentTargetButton=[...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===currentButtonText);
 assertBookCommandResult(currentTargetButton&&!currentTargetButton.disabled,'사용 가능한 버튼 '+currentButtonText);
 currentTargetButton!.click();await waitBookPanelRender();
}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 render(<SkillbookPanel gameSessionClient={currentClientStub} currentFacilityIdentifier="iseulon-bookshop" actionsAreDisabled={false}/>,document.getElementById('root')!);
 await waitBookPanelRender();
 for(const currentInvalidMode of ['price','request','owner']){
  currentResponseMode=currentInvalidMode;
  await clickBookPanelButton(t('books.buy',{price:100}));
  assertBookCommandResult(currentAcceptedStates===0&&currentClientStub.state.me.version===2,'손상된 구매 응답 상태 적용 금지 '+currentInvalidMode);
 }
 currentResponseMode='valid';
 await clickBookPanelButton(t('books.buy',{price:100}));
 assertBookCommandResult(currentAcceptedStates===1&&currentClientStub.state.me.version===3,'검증된 구매 상태 한 번 적용');
 assertBookCommandResult(currentPurchaseRequests.length===4,'구매 재확인 요청 수');
 for(const currentInvalidMode of ['unread','wrong-book']){
  currentResponseMode=currentInvalidMode;
  await clickBookPanelButton(t('books.read'));
  assertBookCommandResult(currentAcceptedStates===1&&currentClientStub.state.me.version===3,'손상된 열람 응답 상태 적용 금지 '+currentInvalidMode);
 }
 currentResponseMode='valid';
 await clickBookPanelButton(t('books.read'));
 assertBookCommandResult(currentAcceptedStates===2&&currentClientStub.state.me.version===4,'검증된 열람 상태 한 번 적용');
 assertBookCommandResult(currentReadRequests.every(currentRequestBody=>JSON.stringify(currentRequestBody)==='{"expectedVersion":3}'),'열람 요청 계약과 재확인 버전 유지');
 assertBookCommandResult(document.body.textContent!.includes(t('books.readComplete')),'검증 후 열람 완료 안내');
 await verifySkillCardFlow();
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();


async function verifySkillCardFlow(){
 const currentCardDefinition={cardId:'monster-dissection-card',definitionVersion:1,priceP:100,literacyRequired:1,grantsSkill:'monster_dissection',nameTranslations:{ko:'몬스터 해부 스킬카드',en:'Monster Dissection Skill Card'},learned:false};
 let currentStoredCard:any=null;
 let currentPurchaseReceipt:any=null;
 let currentUseReceipt:any=null;
 let currentPurchaseAttempts=0;
 let currentUseAttempts=0;
 const currentCardRequests:any[]=[];
 const currentCardClient:any={tokens:{user_id:'owner'},state:{...structuredClone(currentClientStub.state),me:{...structuredClone(currentClientStub.state.me),skills:{literacy:0},coins:500}},
  accept:(currentReturnedState:any)=>{currentCardClient.state=currentReturnedState;},
  request:async(currentRequestPath:string,currentRequestBody:any)=>{
   if(!currentRequestBody)return {characterVersion:currentCardClient.state.me.version,cards:currentStoredCard?[{...currentStoredCard,currentLiteracy:currentCardClient.state.me.skills.literacy}]:[],
    ...(currentRequestPath.includes('/bookshops/')?{catalog:[{...currentCardDefinition,owned:!!currentStoredCard,learned:'monster_dissection' in currentCardClient.state.me.skills}]}:{})};
   currentCardRequests.push({path:currentRequestPath,body:structuredClone(currentRequestBody)});
   const currentReturnedState=structuredClone(currentCardClient.state);currentReturnedState.me.version++;currentReturnedState.cursor++;
   if(currentRequestPath.endsWith('/skill-card-purchases')){
    currentPurchaseAttempts++;
    currentStoredCard={...currentCardDefinition,currentLiteracy:0,source:'purchase',storage:'ACCOUNT',expiresAt:null,acquiredAt:100};
    currentPurchaseReceipt??={requestId:currentRequestBody.requestId,completedAt:100,command:{kind:'purchase',cardId:currentCardDefinition.cardId,facilityId:'iseulon-bookshop',definitionVersion:1,priceP:100},
     result:{cardId:currentCardDefinition.cardId,priceP:100,storage:'ACCOUNT',expiresAt:null}};
    if(currentPurchaseAttempts===1)throw new TypeError('응답 유실');
    currentReturnedState.me.coins=400;
    return {receipt:currentPurchaseReceipt,state:currentReturnedState};
   }
   currentUseAttempts++;
   currentUseReceipt??={requestId:currentRequestBody.requestId,completedAt:101,command:{kind:'use',cardId:currentCardDefinition.cardId},result:{cardId:currentCardDefinition.cardId,skillId:'monster_dissection',level:0}};
   currentStoredCard=null;
   if(currentUseAttempts===1)throw new TypeError('응답 유실');
   currentReturnedState.me.skills.monster_dissection=0;
   return {receipt:currentUseReceipt,state:currentReturnedState};
  }};
 render(null,document.getElementById('root')!);
 render(<SkillCardPanel gameSessionClient={currentCardClient} currentFacilityIdentifier="iseulon-bookshop" actionsAreDisabled={false}/>,document.getElementById('root')!);
 await waitBookPanelRender();
 await clickBookPanelButton(t('cards.buy',{price:100}));
 assertBookCommandResult(!('monster_dissection' in currentCardClient.state.me.skills),'문해 부족 상태에서도 구매 가능하며 자동 습득하지 않음');
 assertBookCommandResult([...document.querySelectorAll('button')].some(currentButtonEntry=>currentButtonEntry.textContent===t('cards.refresh')&&currentButtonEntry.disabled),'구매 결과 불명일 때 새 목록으로 요청을 덮어쓰지 않음');
 await clickBookPanelButton(t('cards.retry'));
 assertBookCommandResult(JSON.stringify(currentCardRequests[0])===JSON.stringify(currentCardRequests[1]),'구매 응답 유실 후 동일 요청 복구');
 assertBookCommandResult(document.body.textContent!.includes(t('cards.owned')),'구매 카드를 보관함으로 안내');
 render(null,document.getElementById('root')!);
 render(<SkillCardPanel gameSessionClient={currentCardClient} actionsAreDisabled={false}/>,document.getElementById('root')!);
 await waitBookPanelRender();
 assertBookCommandResult([...document.querySelectorAll('button')].some(currentButtonEntry=>currentButtonEntry.textContent===t('cards.use')&&currentButtonEntry.disabled),'문해 부족 카드 사용 비활성');
 currentCardClient.state.me.skills.literacy=1;
 await clickBookPanelButton(t('cards.refresh'));
 await clickBookPanelButton(t('cards.use'));
 assertBookCommandResult(currentCardRequests.length===2&&document.body.textContent!.includes(t('cards.confirm',{name:currentCardDefinition.nameTranslations[location.hash==='#en'?'en':'ko']})),'소모·습득 확인 전 사용 명령을 전송하지 않음');
 await clickBookPanelButton(t('cards.confirmUse'));
 await clickBookPanelButton(t('cards.retry'));
 assertBookCommandResult(JSON.stringify(currentCardRequests[2])===JSON.stringify(currentCardRequests[3]),'사용 응답 유실 후 동일 요청 복구');
 assertBookCommandResult(currentCardClient.state.me.skills.monster_dissection===0&&document.body.textContent!.includes(t('cards.empty')),'카드 소비 후 스킬 레벨 0 및 빈 보관함 표시');
}
