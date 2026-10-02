import {render} from 'preact';
import {TravelerPermitPanel} from '../../src/ui/TravelerPermitPanel';
import {t,setLocale} from '../../src/i18n';
const currentAssertionsList:string[]=[];
window.addEventListener('error',currentErrorEvent=>{document.body.dataset.runtimeError=currentErrorEvent.message;});
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,150));
function assertBarterBrowser(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage+' '+JSON.stringify(document.body.dataset)+' '+document.body.textContent);currentAssertionsList.push(currentMessage);}
const currentGuardRecord={id:'guard-one',cityId:'iseulon',mapId:'field',connectionId:'gate',name:'경비센터',position:{column:1,row:1}};
let currentSavedRequest:any;
let currentPaymentRecord:any;
let currentPurchaseAttempts=0;
let currentQuoteDuration=60;
const currentClientStub:any={tokens:{user_id:'account'},state:{generation:1,epoch:1,location:{id:'field-channel'},map:{id:'field'},me:{id:'hero',version:1,mode:'FIELD',battleId:null,position:{column:1,row:1},bag:{items:[{id:'protein-jelly',kind:'material',quantity:4,nameTranslations:{ko:'단백질젤리',en:'Protein Jelly'}}]}}},
 request:async(currentRequestPath:string,currentRequestBody:any)=>{
  if(currentRequestPath.endsWith('barter-quote')){
   assertBarterBrowser(currentRequestBody.cashP===2&&currentRequestBody.materials['protein-jelly']===4,'선택한 현금과 재료 전송');
   currentPaymentRecord={...currentRequestBody};
   return {guardCenterId:'guard-one',cityId:'iseulon',policyVersion:1,priceP:5,validitySeconds:604800,serverTime:100,expiresAt:100+currentQuoteDuration,payment:currentPaymentRecord};
  }
  currentPurchaseAttempts++;
  if(currentPurchaseAttempts===1){currentSavedRequest=structuredClone(currentRequestBody);throw new TypeError('response lost');}
  assertBarterBrowser(JSON.stringify(currentSavedRequest)===JSON.stringify(currentRequestBody),'응답 유실 후 같은 요청 재전송');
  const {expectedVersion:_,...currentReceiptFields}=currentRequestBody;
  return {receipt:{...currentReceiptFields,guardCenterId:'guard-one',permit:{instanceId:'00000000-0000-4000-8000-000000000001',itemId:'city-traveler-permit',characterId:'hero',cityId:'iseulon',issuerId:'guard-one',issuedAt:100,expiresAt:604900}},state:structuredClone(currentClientStub.state)};
 },accept:()=>{}};
function renderBarterPanel(){render(<TravelerPermitPanel gameSessionClient={currentClientStub} currentGuardDefinition={currentGuardRecord} actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function clickBarterButton(currentTranslationKey:string){const currentButton=[...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t(currentTranslationKey));assertBarterBrowser(currentButton&&!currentButton.disabled,currentTranslationKey+' 사용 가능');currentButton!.click();for(let currentWaitAttempt=0;currentWaitAttempt<20;currentWaitAttempt++){await currentWaitRender();if(!document.body.textContent!.includes(t('guild.pending')))return;}throw new Error('응답 렌더 대기 시간 초과 '+JSON.stringify(document.body.dataset));}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');renderBarterPanel();await currentWaitRender();
 (document.querySelector('input[type=checkbox]') as HTMLInputElement).click();await currentWaitRender();
 const currentNumberInputs=[...document.querySelectorAll<HTMLInputElement>('input[type=number]')];
 for(const [currentInputIndex,currentInputValue] of ['2','4'].entries()){currentNumberInputs[currentInputIndex].value=currentInputValue;currentNumberInputs[currentInputIndex].dispatchEvent(new Event('input',{bubbles:true}));await currentWaitRender();}
 await clickBarterButton('citizenship.permitPrice');
 assertBarterBrowser(document.body.textContent!.includes(t('citizenship.barterNoChange')),'선택한 납부 내용과 거스름돈 없음 표시');
 currentClientStub.state.me.version++;renderBarterPanel();await currentWaitRender();
 assertBarterBrowser([...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t('citizenship.permitPurchase'))?.disabled,'상태 변경 후 기존 견적 결제 차단');
 currentQuoteDuration=1;
 await clickBarterButton('citizenship.permitPrice');
 await clickBarterButton('citizenship.permitPurchase');
 assertBarterBrowser(document.querySelector('fieldset')!.disabled,'불확정 구매 중 선택 고정');
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,1400));
 assertBarterBrowser(document.body.textContent!.includes(t('citizenship.permitExpired')),'결과 불명 중 견적 만료 안내');
 await clickBarterButton('citizenship.permitRetry');
 assertBarterBrowser(document.body.textContent!.includes(t('citizenship.permitPurchased')),'혼합 납부 영수증 검증 후 완료 표시');
 await clickBarterButton('citizenship.permitPrice');
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,1400));
 assertBarterBrowser(document.body.textContent!.includes(t('citizenship.permitExpired')),'신규 견적 만료 안내');
 assertBarterBrowser(![...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t('citizenship.permitPurchase')),'만료된 새 견적의 결제 버튼 제거');
 assertBarterBrowser(currentPurchaseAttempts===2,'만료가 자동 결제나 재시도를 만들지 않음');
 assertBarterBrowser(!document.querySelector('fieldset')!.disabled,'확정 후 만료된 견적의 재료 선택 수정 가능');
 assertBarterBrowser(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentError),assertions:currentAssertionsList});}})();
