import {render} from 'preact';
import {RefiningContractsPanel} from '../../src/ui/RefiningContractsPanel';
import type {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';

const currentAssertionLabels:string[]=[];
const currentMutationRequests:Array<{path:string;body:any}>=[];
const currentRecipeEntry={collectionId:'iron-ore',processingMethod:'smelting',grade:'low',outputQuantity:1,inputQuantity:2,costP:1,durationSeconds:30,
 outputMaterial:{materialId:'iron-ingot-low',name:'하급 철괴',englishName:'Low iron ingot',materialKind:'material',essenceAttribute:null}};
let currentContractEntries:any[]=[];
let currentCreateFailure=true;
let currentClaimFailure=true;
let currentClaimCompleted=false;
let currentCatalogMismatch=false;
const currentFixtureClient={tokens:{user_id:'owner'},state:{generation:1,location:{id:'city'},me:{id:'hero',mode:'FIELD',battleId:null,position:{column:1,row:1},version:1}},
 async request(currentRequestPath:string,currentRequestBody?:any):Promise<any>{
  if(currentRequestBody){
   currentMutationRequests.push({path:currentRequestPath,body:structuredClone(currentRequestBody)});
   if(currentRequestPath.endsWith('/claim')){
    if(currentClaimFailure){currentClaimFailure=false;throw new TypeError('테스트 수령 연결 실패');}
    currentClaimCompleted=true;currentContractEntries[0].status='CLAIMED';currentContractEntries[0].claimedAt=150;
   }else{
    if(currentCreateFailure){currentCreateFailure=false;throw new TypeError('테스트 계약 연결 실패');}
    currentContractEntries=[{contractId:'one',facilityId:'workshop',startedAt:100,readyAt:130,claimedAt:null,status:'READY',quote:{...currentRecipeEntry,inputQuantity:4,outputQuantity:2,costP:2}}];
   }
   return {state:{...this.state,me:{...this.state.me,version:this.state.me.version+1}}};
  }
  if(currentRequestPath.endsWith('catalog'))return {facilityId:currentCatalogMismatch?'other':'workshop',available:true,unavailableReason:null,grades:['low'],entries:[currentRecipeEntry]};
  if(currentRequestPath.includes('quote?')){
   const currentRequestedQuantity=Number(new URL(currentRequestPath,'https://example.invalid').searchParams.get('quantity'));
   return {characterVersion:this.state.me.version,ownedCoins:100,quoteToken:'a'.repeat(64),quote:{...currentRecipeEntry,ownedQuantity:10,outputQuantity:currentRequestedQuantity,inputQuantity:2*currentRequestedQuantity,costP:currentRequestedQuantity}};
  }
  return {serverTime:150,characterVersion:this.state.me.version,entries:structuredClone(currentContractEntries),nextCursor:null};
 },
 accept(currentReceivedState:any){this.state=currentReceivedState;renderCurrentPanel();},
};
function renderCurrentPanel(){render(<RefiningContractsPanel gameSessionClient={currentFixtureClient as unknown as Client} currentFacilityIdentifier="workshop" actionsAreDisabled={false}/>,document.getElementById('root')!);}
function verifyCurrentCondition(currentConditionValue:unknown,currentAssertionLabel:string){if(!currentConditionValue)throw new Error(currentAssertionLabel);currentAssertionLabels.push(currentAssertionLabel);}
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,80));
const findNamedButton=(currentButtonText:string)=>[...document.querySelectorAll('button')].find(currentButtonElement=>currentButtonElement.textContent===currentButtonText);
async function clickRefiningButton(currentTranslationKey:string){const currentButtonElement=findNamedButton(t(currentTranslationKey));verifyCurrentCondition(currentButtonElement&&!currentButtonElement.disabled,'조작 가능: '+currentTranslationKey);currentButtonElement!.click();await waitRenderCycle();}

(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');renderCurrentPanel();await waitRenderCycle();await waitRenderCycle();
 await clickRefiningButton('workshop.refiningBrowse');
 verifyCurrentCondition(document.body.textContent!.includes(t('workshop.processingMethodSmelting')),'실제 언어팩의 정련 분류 표시');
 const currentQuantityInput=document.querySelector<HTMLInputElement>('input[type="number"]')!;
 currentQuantityInput.value='2';currentQuantityInput.dispatchEvent(new Event('input',{bubbles:true}));await waitRenderCycle();
 await clickRefiningButton('workshop.refiningQuote');
 await clickRefiningButton('workshop.refiningSubmit');
 verifyCurrentCondition(!document.querySelector('li'),'실패한 계약을 목록에 추가하지 않음');
 await clickRefiningButton('workshop.refiningSubmit');await waitRenderCycle();
 verifyCurrentCondition(JSON.stringify(currentMutationRequests[0])===JSON.stringify(currentMutationRequests[1]),'계약 재시도는 같은 요청 ID·견적·버전');
 verifyCurrentCondition(currentMutationRequests[1].body.quantity===2,'선택 수량을 계약에 사용');
 verifyCurrentCondition(document.querySelectorAll('li').length===1,'계약 완료 후 목록 자동 갱신');
 verifyCurrentCondition(!findNamedButton(t('workshop.refiningSubmit')),'완료한 견적의 결제 버튼 제거');
 await clickRefiningButton('workshop.claim');
 verifyCurrentCondition(!currentClaimCompleted&&!!findNamedButton(t('workshop.claim')),'수령 실패 뒤 재시도 가능');
 await clickRefiningButton('workshop.claim');
 verifyCurrentCondition(currentClaimCompleted&&!findNamedButton(t('workshop.claim')),'수령 완료 목록 갱신·버튼 제거');
 verifyCurrentCondition(JSON.stringify(currentMutationRequests[2])===JSON.stringify(currentMutationRequests[3]),'수령 재시도는 같은 계약·버전');
 verifyCurrentCondition(document.querySelector('li')?.textContent?.includes(t('workshop.claimed')),'수령 완료 상태 표시');
 currentCatalogMismatch=true;await clickRefiningButton('workshop.refiningBrowse');
 verifyCurrentCondition(!findNamedButton(t('workshop.refiningQuote')),'다른 시설의 목록으로 견적을 만들지 않음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionLabels});
}catch(currentFailureError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailureError),stack:(currentFailureError as Error).stack,assertions:currentAssertionLabels});}})();
