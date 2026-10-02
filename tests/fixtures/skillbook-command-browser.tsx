import {render} from 'preact';
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
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();
