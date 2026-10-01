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
const currentClientStub:any={tokens:{user_id:'account'},state:{generation:1,epoch:1,location:{id:'city-channel'},map:{id:'iseulon'},me:{id:'hero',version:4,mode:'FIELD',position:{column:1,row:1}}},
 request:async(currentRequestPath:string,currentRequestBody:any)=>{
  if(!currentRequestPath.endsWith('/claim'))return {serverTime:100,characterVersion:4,nextCursor:null,entries:currentParcelClaimed?[]:[{parcelId:CURRENT_PARCEL_IDENTIFIER,sentAt:90,expiresAt:currentParcelExpiry,attachmentNames:[null,{ko:'기본 의상',en:'Default outfit'},{ko:'단백질 젤리',en:'Protein jelly'}],attachments:[{kind:'money',amountP:7},{kind:'costume',costumeId:'default'},{kind:'item',category:'material',itemId:'protein-jelly',quantity:2}]}]};
  currentClaimAttempts++;
  if(currentClaimAttempts===1){currentOriginalPayload=structuredClone(currentRequestBody);throw new TypeError('response lost');}
  assertParcelBrowser(JSON.stringify(currentRequestBody)===JSON.stringify(currentOriginalPayload),'재시도 원본 요청 유지');
  assertParcelBrowser(Object.keys(currentRequestBody).join(',')==='expectedVersion'&&currentRequestBody.expectedVersion===4,'소포 ID 기반 수령 계약');
  currentParcelClaimed=currentClaimAttempts>=3;
  return {receipt:{parcelId:CURRENT_PARCEL_IDENTIFIER,characterId:'hero',facilityId:'iseulon-guild',claimedAt:110,attachments:currentClaimAttempts===2?[{kind:'money',amountP:7}]:[{kind:'money',amountP:7},{kind:'costume',costumeId:'default'},{kind:'item',category:'material',itemId:'protein-jelly',quantity:2}]},state:{...currentClientStub.state,me:{...currentClientStub.state.me,version:5}}};
 },accept:(currentGameState:any)=>{currentClientStub.state=currentGameState;}};
async function clickParcelButton(currentTranslationKey:string){
 const currentButton=[...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t(currentTranslationKey));
 assertParcelBrowser(currentButton&&!currentButton.disabled,currentTranslationKey+' 사용 가능');
 currentButton!.click();await currentWaitRender();
}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 render(<ParcelPanel gameSessionClient={currentClientStub} currentFacilityIdentifier="iseulon-guild" actionsAreDisabled={false}/>,document.getElementById('root')!);
 await currentWaitRender();await clickParcelButton('parcels.refresh');
 assertParcelBrowser(document.body.textContent!.includes('7p')&&document.body.textContent!.includes((location.hash==='#en'?'Protein jelly':'단백질 젤리')+' × 2'),'첨부물 표시');
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
 render(<ParcelPanel gameSessionClient={currentClientStub} currentFacilityIdentifier="iseulon-guild" actionsAreDisabled={false}/>,document.getElementById('root')!);
 await currentWaitRender();await clickParcelButton('parcels.refresh');
 await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,1200));
 assertParcelBrowser(document.body.textContent!.includes(t('parcels.expired')),'열린 목록의 만료 안내');
 assertParcelBrowser([...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t('parcels.claim'))?.disabled,'만료 소포 신규 수령 차단');
 assertParcelBrowser(currentClaimAttempts===3,'만료 표시가 수령 요청을 만들지 않음');
 assertParcelBrowser(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();
