import {render} from 'preact';
import {DeveloperToolsPanel} from '../../src/ui/DeveloperToolsPanel';
import {ApiError} from '../../src/client/response';
import {t,setLocale} from '../../src/i18n';
const currentAssertionsList:string[]=[];
const waitForDeveloperRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
function assertDeveloperBrowserState(currentConditionValue:unknown,currentAssertionText:string){if(!currentConditionValue)throw new Error(currentAssertionText);currentAssertionsList.push(currentAssertionText);}
function clickDeveloperButton(currentMessageKey:string){
 const currentButtonElement=[...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t(currentMessageKey));
 assertDeveloperBrowserState(currentButtonElement&&!currentButtonElement.disabled,'사용 가능한 버튼: '+currentMessageKey);currentButtonElement!.click();
}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 let currentAccessDenied=true;
 let currentResponseLost=true;
 let currentStateReadLost=false;
 let currentPostRequestCount=0;
 let currentConfirmedReceipt:any=null;
 let currentConfirmedPayload:any=null;
 let currentConfirmationCount=0;
 let currentItemReceipt:any=null;
 let currentEquipmentReceipt:any=null;
 let currentEquipmentOwned=false;
 let currentBatchQuantity=0;
 let currentBatchReceipt:any=null;
 const currentBatchIdentifier='00000000-0000-4000-8000-000000000030';
 let currentPermitOwned=false;
 let currentPermitReceipt:any=null;
 const currentPermitIdentifier='00000000-0000-4000-8000-000000000020';
 const currentEquipmentIdentifier='00000000-0000-4000-8000-000000000010';
 const currentRequestPayloads:any[]=[];
 const currentClientStub:any={tokens:{user_id:'test'},state:{generation:1,me:{id:'test',name:'test',mode:'FIELD',version:1,cp:10,sp:2,coins:20}},
  accept(currentIncomingState:any){this.state=currentIncomingState;},
  async request(currentRequestPath:string,currentRequestPayload:any){
   if(currentRequestPath==='/v1/developer/capabilities'){
    if(currentAccessDenied)throw new ApiError('DEVELOPER_FORBIDDEN','권한 없음',403);
    return {accountId:'test',targetScope:'SELF',assets:['CP','SP','P']};
   }
   if(currentRequestPath==='/v1/developer/catalog')return {accountId:'test',targetScope:'SELF',productionRecipes:[{itemId:'leather-cord',nameTranslations:{ko:'가죽끈',en:'Leather cord'},itemLevels:[1,2],recipeVersion:'v1',usage:'material'}],permitIssuers:[{cityId:'iseulon',issuerId:'meadow-guard-center'}],entries:[{category:'material',itemId:'protein-jelly',nameTranslations:{ko:'단백질 젤리',en:'Protein jelly'},supportedOperations:['ADD','REMOVE']},{category:'equipment',itemId:'iron-sword',nameTranslations:{ko:'철검',en:'Iron sword'},supportedOperations:['ADD','REMOVE']},{category:'traveler_permit',itemId:'city-traveler-permit',nameTranslations:{ko:'여행자증명서',en:'Traveler Certificate'},supportedOperations:['ADD','REMOVE']}]};
   if(currentRequestPath==='/v1/developer/inventory')return {characterId:'test',items:[...(currentBatchQuantity?[{category:'production_batch',itemId:'leather-cord',quantity:currentBatchQuantity,batchId:currentBatchIdentifier,itemLevel:2}]:[]),...(currentPermitOwned?[{category:'traveler_permit',itemId:'city-traveler-permit',quantity:1,instanceId:currentPermitIdentifier,cityId:'iseulon',issuerId:'meadow-guard-center',expiresAt:604900}]:[]),...(currentItemReceipt?[{category:'material',itemId:'protein-jelly',quantity:1}]:[]),...(currentEquipmentOwned?[{category:'equipment',itemId:'iron-sword',quantity:1,instanceId:currentEquipmentIdentifier,instanceVersion:1,removable:true}]:[])],version:currentBatchReceipt?.version??currentPermitReceipt?.version??currentEquipmentReceipt?.version??(currentItemReceipt?3:currentConfirmedReceipt?2:1),balances:{CP:currentConfirmedReceipt?11:10,SP:2,P:20}};
   if(currentRequestPath==='/v1/developer/adjustments'&&!currentRequestPayload)return {characterId:'test',entries:currentBatchReceipt?[currentBatchReceipt]:currentPermitReceipt?[currentPermitReceipt]:currentEquipmentReceipt?[currentEquipmentReceipt]:currentItemReceipt?[currentItemReceipt,currentConfirmedReceipt]:currentConfirmedReceipt?[currentConfirmedReceipt]:[],nextCursor:null};
   if(currentRequestPath==='/v1/developer/adjustments'){
    currentPostRequestCount++;currentRequestPayloads.push(currentRequestPayload);
    if(currentRequestPayload.category==='production_batch'){const currentPreviousQuantity=currentBatchQuantity;currentBatchQuantity+=currentRequestPayload.quantity*(currentRequestPayload.operation==='ADD'?1:-1);currentBatchReceipt={ok:true,...currentRequestPayload,actorId:'test',characterId:'test',before:currentPreviousQuantity,after:currentBatchQuantity,batchId:currentBatchIdentifier,batch:{batchId:currentBatchIdentifier,productionResult:{productId:'leather-cord',itemLevel:2}},version:currentRequestPayload.expectedVersion+1,createdAt:104};return currentBatchReceipt;}
    if(currentRequestPayload.category==='traveler_permit'){currentPermitOwned=currentRequestPayload.operation==='ADD';currentPermitReceipt={ok:true,...currentRequestPayload,actorId:'test',characterId:'test',before:currentPermitOwned?0:1,after:currentPermitOwned?1:0,instanceId:currentPermitIdentifier,permit:{characterId:'test',cityId:'iseulon',issuerId:'meadow-guard-center'},version:currentPermitOwned?6:7,createdAt:103};return currentPermitReceipt;}
    if(currentRequestPayload.category==='equipment'){currentEquipmentOwned=currentRequestPayload.operation==='ADD';currentEquipmentReceipt={ok:true,...currentRequestPayload,actorId:'test',characterId:'test',before:currentEquipmentOwned?0:1,after:currentEquipmentOwned?1:0,instanceId:currentEquipmentIdentifier,instanceVersion:currentEquipmentOwned?1:2,version:currentEquipmentOwned?4:5,createdAt:102};return currentEquipmentReceipt;}
    if(currentRequestPayload.asset==='ITEM'){currentItemReceipt={ok:true,...currentRequestPayload,actorId:'test',characterId:'test',before:0,after:1,version:3,createdAt:101};return currentItemReceipt;}
    if(!currentConfirmedReceipt){currentConfirmedPayload=currentRequestPayload;currentConfirmedReceipt={ok:true,...currentRequestPayload,actorId:'test',characterId:'test',before:10,after:11,version:2,createdAt:100};}
    else assertDeveloperBrowserState(JSON.stringify(currentRequestPayload)===JSON.stringify(currentConfirmedPayload),'재시도 요청 ID·내용 보존');
    if(currentResponseLost){currentResponseLost=false;throw new Error('응답 유실');}
    return currentConfirmedReceipt;
   }
   if(currentRequestPath==='/v1/game/state'){
    if(currentStateReadLost){currentStateReadLost=false;throw new Error('상태 조회 유실');}
    return {...this.state,me:{...this.state.me,version:currentBatchReceipt?.version??currentPermitReceipt?.version??currentEquipmentReceipt?.version??(currentItemReceipt?3:2),cp:11}};
   }
   throw new Error('예상하지 않은 요청 '+currentRequestPath);
  }};
 const currentRootElement=document.getElementById('root')!;
 render(<DeveloperToolsPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,currentRootElement);await waitForDeveloperRender();
 assertDeveloperBrowserState(!document.querySelector('button'),'일반 계정 개발자 버튼 숨김');
 render(null,currentRootElement);currentAccessDenied=false;
 render(<DeveloperToolsPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,currentRootElement);await waitForDeveloperRender();
 clickDeveloperButton('app.developerTitle');await waitForDeveloperRender();
 assertDeveloperBrowserState(document.body.textContent!.includes('10 → 11'),'적용 전 잔고 미리보기');
 window.confirm=()=>{currentConfirmationCount++;return true;};
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentConfirmationCount===1,'변경 확인 한 번');
 assertDeveloperBrowserState(document.body.textContent!.includes(t('app.developerUncertain')),'응답 유실 안내');
 assertDeveloperBrowserState(document.querySelector('fieldset')!.disabled,'불명확한 요청 중 새 변경 금지');
 currentStateReadLost=true;clickDeveloperButton('app.developerRetry');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentPostRequestCount===2,'원 요청 재확인');
 clickDeveloperButton('app.developerRetry');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentPostRequestCount===2,'확정 영수증 뒤 조회 실패는 변경 API 재호출 없음');
 assertDeveloperBrowserState(currentClientStub.state.me.cp===11,'최신 상태 반영');
 assertDeveloperBrowserState(document.querySelector('li')?.textContent?.includes('10 → 11'),'서버 변경 이력 표시');
 assertDeveloperBrowserState(!document.querySelector('fieldset')!.disabled,'성공 후 조작 복구');
 (document.querySelector('input[type=checkbox]') as HTMLInputElement).click();await waitForDeveloperRender();
 const currentItemSelect=document.querySelector('select')!;currentItemSelect.value='material:protein-jelly';currentItemSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 assertDeveloperBrowserState(document.body.textContent!.includes('0 → 1'),'아이템 보유량 미리보기');
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentItemReceipt?.category==='material'&&currentItemReceipt?.itemId==='protein-jelly'&&currentItemReceipt?.expectedVersion===2,'아이템 분류·ID·버전 전송');
 assertDeveloperBrowserState(document.querySelector('li')?.textContent?.includes('material protein-jelly: 0 → 1'),'아이템 이력 표시');
 currentItemSelect.value='equipment:iron-sword';currentItemSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentEquipmentOwned,'장비 개체 지급');
 const currentOperationSelect=document.querySelectorAll('select')[1];currentOperationSelect.value='REMOVE';currentOperationSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 const currentInstanceSelect=document.querySelectorAll('select')[2];currentInstanceSelect.value=currentEquipmentIdentifier;currentInstanceSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(!currentEquipmentOwned&&currentEquipmentReceipt.expectedInstanceVersion===1&&currentEquipmentReceipt.instanceId===currentEquipmentIdentifier,'선택한 장비 개체와 버전으로 회수');
 currentItemSelect.value='traveler_permit:city-traveler-permit';currentItemSelect.dispatchEvent(new Event('change',{bubbles:true}));
 currentOperationSelect.value='ADD';currentOperationSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 const currentCitySelect=document.querySelectorAll('select')[2];currentCitySelect.value='iseulon';currentCitySelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 const currentIssuerSelect=document.querySelectorAll('select')[3];currentIssuerSelect.value='meadow-guard-center';currentIssuerSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentPermitOwned&&currentPermitReceipt.cityId==='iseulon'&&currentPermitReceipt.issuerId==='meadow-guard-center','도시와 경비센터 선택 후 증서 지급');
 currentOperationSelect.value='REMOVE';currentOperationSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 const currentPermitSelect=document.querySelectorAll('select')[2];currentPermitSelect.value=currentPermitIdentifier;currentPermitSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 assertDeveloperBrowserState(currentPermitSelect.selectedOptions[0].textContent!.includes('iseulon'),'증서 도시와 개체 표시');
 assertDeveloperBrowserState(document.documentElement.scrollWidth<=window.innerWidth,'증서 선택 모바일 가로 넘침 없음');
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(!currentPermitOwned&&currentPermitReceipt.instanceId===currentPermitIdentifier&&!currentPermitReceipt.cityId,'선택한 증서 개체만 회수');
 currentItemSelect.value='production_batch:leather-cord';currentItemSelect.dispatchEvent(new Event('change',{bubbles:true}));
 currentOperationSelect.value='ADD';currentOperationSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 const currentLevelSelect=document.querySelectorAll('select')[2];currentLevelSelect.value='2';currentLevelSelect.dispatchEvent(new Event('change',{bubbles:true}));
 const currentQuantityElement=document.querySelector('input[type=number]') as HTMLInputElement;currentQuantityElement.value='3';currentQuantityElement.dispatchEvent(new Event('input',{bubbles:true}));await waitForDeveloperRender();
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentBatchQuantity===3&&currentBatchReceipt.itemLevel===2&&currentBatchReceipt.expectedVersion===7,'선택한 레벨과 수량으로 생산 배치 지급');
 currentOperationSelect.value='REMOVE';currentOperationSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitForDeveloperRender();
 const currentBatchSelect=document.querySelectorAll('select')[2];currentBatchSelect.value=currentBatchIdentifier;currentBatchSelect.dispatchEvent(new Event('change',{bubbles:true}));
 currentQuantityElement.value='1';currentQuantityElement.dispatchEvent(new Event('input',{bubbles:true}));await waitForDeveloperRender();
 assertDeveloperBrowserState(currentBatchSelect.selectedOptions[0].textContent!.includes('Lv.2 · 3'),'배치 레벨과 보유 수량 표시');
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentBatchQuantity===2&&currentBatchReceipt.batchId===currentBatchIdentifier&&currentBatchReceipt.itemLevel===undefined,'선택한 배치에서 일부 수량 회수');
 currentQuantityElement.value='2';currentQuantityElement.dispatchEvent(new Event('input',{bubbles:true}));await waitForDeveloperRender();
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentBatchQuantity===0&&document.querySelectorAll('select')[2].options.length===1,'전량 회수 후 배치 선택 목록에서 제거');
 assertDeveloperBrowserState(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();
