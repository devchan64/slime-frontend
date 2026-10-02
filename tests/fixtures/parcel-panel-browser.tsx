import {render} from 'preact';
import {ParcelPanel} from '../../src/ui/ParcelPanel';
import {t,setLocale} from '../../src/i18n';
const currentAssertionsList:string[]=[];
const CURRENT_PARCEL_IDENTIFIER='11111111-1111-4111-8111-111111111111';
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,150));
function assertParcelBrowser(currentConditionValue:unknown,currentMessageText:string){if(!currentConditionValue)throw new Error(currentMessageText);currentAssertionsList.push(currentMessageText);}
let currentClaimAttempts=0;
let currentOriginalPayload:unknown;
let currentParcelClaimed=false;
let currentParcelExpiry=100.5;
const currentClientStub:any={tokens:{user_id:'account'},state:{generation:1,epoch:1,location:{id:'city-channel'},map:{id:'meadow'},me:{id:'hero',version:4,mode:'MENU',position:{column:1,row:1}}},
 request:async(currentRequestPath:string,currentRequestBody:any)=>{
  assertParcelBrowser(currentRequestPath.startsWith('/v1/accounts/me/parcels'),'계정 보관함 API 사용');
  if(!currentRequestPath.endsWith('/claim'))return {serverTime:100,characterVersion:4,nextCursor:null,entries:currentParcelClaimed?[]:[{parcelId:CURRENT_PARCEL_IDENTIFIER,sentAt:90,expiresAt:currentParcelExpiry,attachmentNames:[null,{ko:'기본 의상',en:'Default outfit'},{ko:'단백질 젤리',en:'Protein jelly'}],attachments:[{kind:'money',amountP:7},{kind:'costume',costumeId:'default'},{kind:'item',category:'material',itemId:'protein-jelly',quantity:2}]}]};
  currentClaimAttempts++;
  if(currentClaimAttempts===1){currentOriginalPayload=structuredClone(currentRequestBody);throw new TypeError('response lost');}
  assertParcelBrowser(JSON.stringify(currentRequestBody)===JSON.stringify(currentOriginalPayload),'재시도 원본 요청 유지');
  assertParcelBrowser(Object.keys(currentRequestBody).join(',')==='expectedVersion'&&currentRequestBody.expectedVersion===4,'소포 ID 기반 수령 계약');
  currentParcelClaimed=currentClaimAttempts>=3;
  return {receipt:{parcelId:CURRENT_PARCEL_IDENTIFIER,characterId:'hero',storage:'ACCOUNT',facilityId:'account-storage',claimedAt:110,attachments:currentClaimAttempts===2?[{kind:'money',amountP:7}]:[{kind:'money',amountP:7},{kind:'costume',costumeId:'default'},{kind:'item',category:'material',itemId:'protein-jelly',quantity:2}]},state:{...currentClientStub.state,me:{...currentClientStub.state.me,version:5}}};
 },accept:(currentGameState:any)=>{currentClientStub.state=currentGameState;}};
async function clickParcelButton(currentTranslationKey:string){
 const currentButton=[...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t(currentTranslationKey));
 assertParcelBrowser(currentButton&&!currentButton.disabled,currentTranslationKey+' 사용 가능');
 currentButton!.click();await currentWaitRender();
}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 render(<ParcelPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,document.getElementById('root')!);
 await currentWaitRender();await clickParcelButton('parcels.refresh');
 assertParcelBrowser(document.body.textContent!.includes('7P')&&document.body.textContent!.includes((location.hash==='#en'?'Protein jelly':'단백질 젤리')+' × 2'),'첨부물 표시');
 await clickParcelButton('parcels.claim');
 assertParcelBrowser(document.body.textContent!.includes(t('parcels.uncertain')),'응답 유실 안내');
 assertParcelBrowser([...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t('parcels.refresh'))?.disabled,'결과 불명 중 목록 변경 차단');
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,1200));
 assertParcelBrowser(document.body.textContent!.includes(t('parcels.expired')),'응답 유실 후 만료 도달');
 await clickParcelButton('parcels.retry');
 assertParcelBrowser(document.body.textContent!.includes(t('parcels.uncertain')),'누락된 첨부물 영수증은 결과 불명 유지');
 assertParcelBrowser(currentClientStub.state.me.version===4,'잘못된 영수증은 상태 적용하지 않음');
 await clickParcelButton('parcels.retry');
 assertParcelBrowser(document.body.textContent!.includes(t('parcels.received')),'수령 완료 표시');
 assertParcelBrowser(currentClientStub.state.me.version===5,'수령 상태 반영');
 await clickParcelButton('parcels.refresh');
 assertParcelBrowser(document.body.textContent!.includes(t('parcels.empty')),'수령 후 빈 목록');
 render(null,document.getElementById('root')!);currentParcelClaimed=false;currentParcelExpiry=100.5;
 render(<ParcelPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,document.getElementById('root')!);
 await currentWaitRender();await clickParcelButton('parcels.refresh');
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,1200));
 assertParcelBrowser(document.body.textContent!.includes(t('parcels.expired')),'열린 목록의 만료 안내');
 assertParcelBrowser([...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t('parcels.claim'))?.disabled,'만료 소포 신규 수령 차단');
 assertParcelBrowser(currentClaimAttempts===3,'만료 표시가 수령 요청을 만들지 않음');
 assertParcelBrowser(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');

 const currentOriginalRequestHandler=currentClientStub.request;
 const currentOriginalAcceptHandler=currentClientStub.accept;
 for(const currentContextChange of ['reservation','battle','epoch']){
  render(null,document.getElementById('root')!);
  delete currentClientStub.state.reservation;delete currentClientStub.state.battle;
  currentParcelClaimed=false;currentParcelExpiry=1000;
  let currentDeferredClaimResolve:((currentResponseRecord:unknown)=>void)|null=null;
  let currentDeferredClaimCount=0;let currentAcceptedStateCount=0;
  const currentPreClaimState=structuredClone(currentClientStub.state);
  currentClientStub.request=(currentRequestPath:string,currentRequestBody:unknown)=>{
   assertParcelBrowser(currentRequestPath.startsWith('/v1/accounts/me/parcels'),'계정 보관함 API 사용');
  if(!currentRequestPath.endsWith('/claim'))return currentOriginalRequestHandler(currentRequestPath,currentRequestBody);
   currentDeferredClaimCount++;
   return new Promise(currentResolveCallback=>{currentDeferredClaimResolve=currentResolveCallback;});
  };
  currentClientStub.accept=()=>{currentAcceptedStateCount++;};
  render(<ParcelPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,document.getElementById('root')!);
  await currentWaitRender();await clickParcelButton('parcels.refresh');await clickParcelButton('parcels.claim');
  if(currentContextChange==='epoch')currentClientStub.state.epoch++;
  else currentClientStub.state[currentContextChange]={id:'new-context'};
  currentDeferredClaimResolve!({receipt:{parcelId:CURRENT_PARCEL_IDENTIFIER,characterId:'hero',storage:'ACCOUNT',facilityId:'account-storage',claimedAt:110,
   attachments:[{kind:'money',amountP:7},{kind:'costume',costumeId:'default'},{kind:'item',category:'material',itemId:'protein-jelly',quantity:2}]},
   state:{...currentPreClaimState,me:{...currentPreClaimState.me,version:currentPreClaimState.me.version+1}}});
  await currentWaitRender();
  assertParcelBrowser(currentAcceptedStateCount===1,currentContextChange+' 변경 후에도 같은 계정 수령 상태 전달');
  assertParcelBrowser(document.body.textContent!.includes(t('parcels.received')),currentContextChange+' 변경 후에도 수령 완료 안내 유지');
  assertParcelBrowser(currentDeferredClaimCount===1,currentContextChange+' 변경 중 수령 요청 중복 없음');
 }
 currentClientStub.request=currentOriginalRequestHandler;currentClientStub.accept=currentOriginalAcceptHandler;
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();
