import {render} from 'preact';
import {CostumeInventoryPanel} from '../../src/ui/CostumeInventoryPanel';
import {parseCostumeInventory} from '../../src/client/costumeInventory';
import {t,setLocale} from '../../src/i18n';
const currentAssertionsList:string[]=[];
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,120));
function assertCostumeInventory(currentConditionValue:unknown,currentMessageText:string){if(!currentConditionValue)throw new Error(currentMessageText);currentAssertionsList.push(currentMessageText);}
const currentOwnedEntry={costumeId:'default',version:1,designId:'default',designVersion:1,valueP:25,source:'parcel',acquiredAt:100,nameTranslations:{ko:'기본 의상',en:'Default outfit'},descriptionTranslations:{ko:'획득 당시 설명',en:'Description at acquisition'}};
let currentResponseData:any={characterVersion:4,defaultCostumeId:'default',entries:[]};
let currentDelayedResolve:((currentValue:any)=>void)|null=null;
let currentEquipAttempts=0;
let currentOriginalEquipBody:any;
const currentClientStub:any={tokens:{user_id:'account'},state:{generation:1,epoch:1,me:{id:'hero',mode:'FIELD',version:4}},request:async(currentRequestPath:string,currentRequestBody:any)=>{
 if(currentRequestPath==='/v1/characters/me/costume'){
  currentEquipAttempts++;
  if(currentEquipAttempts===1){currentOriginalEquipBody=structuredClone(currentRequestBody);throw new TypeError('response lost');}
  assertCostumeInventory(JSON.stringify(currentOriginalEquipBody)===JSON.stringify(currentRequestBody),'착용 재시도 원본 유지');
  return {requestId:currentRequestBody.requestId,state:{...currentClientStub.state,me:{...currentClientStub.state.me,version:5,costumeAppearance:{costumeId:'default',costumeVersion:1,designId:'default',designVersion:1}}}};
 }
 return currentResponseData==='delay'?new Promise(currentResolveCallback=>{currentDelayedResolve=currentResolveCallback;}):structuredClone(currentResponseData);
 },accept:(currentGameState:any)=>{currentClientStub.state=currentGameState;}};
async function clickCostumeRefresh(){const currentRefreshButton=document.querySelector('button')!;assertCostumeInventory(!currentRefreshButton.disabled,'조회 버튼 사용 가능');currentRefreshButton.click();await currentWaitRender();}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 render(<CostumeInventoryPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,document.getElementById('root')!);
 await currentWaitRender();await clickCostumeRefresh();
 assertCostumeInventory(document.body.textContent!.includes(t('wardrobe.empty')),'빈 소유 목록 안내');
 currentResponseData.entries=[currentOwnedEntry];await clickCostumeRefresh();
 assertCostumeInventory(document.body.textContent!.includes(t('wardrobe.value',{value:25})),'표준 가치 표시');
 assertCostumeInventory(document.body.textContent!.includes(currentOwnedEntry.nameTranslations[location.hash==='#en'?'en':'ko']),'언어별 코스튬 이름');
 for(const currentInvalidPatch of [{source:'drop'},{acquiredAt:-1},{valueP:0},{extra:1}]){
  let currentRejectedFlag=false;try{parseCostumeInventory({...currentResponseData,entries:[{...currentOwnedEntry,...currentInvalidPatch}]});}catch{currentRejectedFlag=true;}
  assertCostumeInventory(currentRejectedFlag,'잘못된 소유 응답 거절 '+JSON.stringify(currentInvalidPatch));
 }
 const currentSavedResponse=structuredClone(currentResponseData);currentResponseData='delay';await clickCostumeRefresh();
 assertCostumeInventory(document.querySelector('button')!.disabled,'진행 중 중복 조회 차단');
 currentClientStub.state.generation=2;currentDelayedResolve!(currentSavedResponse);await currentWaitRender();
 assertCostumeInventory(!document.body.textContent!.includes(t('wardrobe.value',{value:25})),'이전 세션의 지연 응답 무시');
 render(null,document.getElementById('root')!);currentResponseData=currentSavedResponse;
 render(<CostumeInventoryPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,document.getElementById('root')!);await currentWaitRender();await clickCostumeRefresh();
 const currentEquipButton=[...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t('wardrobe.equip'))!;
 assertCostumeInventory(!currentEquipButton.disabled,'보유 코스튬 착용 가능');currentEquipButton.click();await currentWaitRender();
 assertCostumeInventory(document.body.textContent!.includes(t('wardrobe.uncertain')),'착용 응답 유실 안내');
 assertCostumeInventory(document.querySelector('button')!.disabled,'착용 미확정 중 조회 차단');
 const currentRetryButton=[...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t('wardrobe.retry'))!;currentRetryButton.click();await currentWaitRender();
 assertCostumeInventory(document.body.textContent!.includes(t('wardrobe.equipped'))&&currentClientStub.state.me.version===5,'착용 결과와 상태 반영');
 currentClientStub.state.me.mode='IN_BATTLE';render(<CostumeInventoryPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,document.getElementById('root')!);await currentWaitRender();
 assertCostumeInventory([...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t('wardrobe.default'))?.disabled,'전투 중 기본 디자인 변경 차단');
 assertCostumeInventory(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');

 const currentOriginalRequestHandler=currentClientStub.request;
 const currentOriginalAcceptHandler=currentClientStub.accept;
 for(const currentContextChange of ['epoch','mode','battle']){
  render(null,document.getElementById('root')!);
  currentClientStub.state.me.mode='FIELD';delete currentClientStub.state.battle;
  let currentDeferredEquipResolve:((currentResponseRecord:any)=>void)|null=null;
  let currentAcceptedStateCount=0;
  let currentPendingEquipBody:any;
  const currentPreEquipState=structuredClone(currentClientStub.state);
  currentClientStub.request=(currentRequestPath:string,currentRequestBody:any)=>{
   if(currentRequestPath!=='/v1/characters/me/costume')return currentOriginalRequestHandler(currentRequestPath,currentRequestBody);
   currentPendingEquipBody=currentRequestBody;
   return new Promise(currentResolveCallback=>{currentDeferredEquipResolve=currentResolveCallback;});
  };
  currentClientStub.accept=()=>{currentAcceptedStateCount++;};
  render(<CostumeInventoryPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,document.getElementById('root')!);
  await currentWaitRender();await clickCostumeRefresh();
  const currentDeferredEquipButton=[...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t('wardrobe.equip'))!;
  currentDeferredEquipButton.click();await currentWaitRender();
  if(currentContextChange==='epoch')currentClientStub.state.epoch++;
  else if(currentContextChange==='mode')currentClientStub.state.me.mode='IN_BATTLE';
  else currentClientStub.state.battle={id:'battle'};
  currentDeferredEquipResolve!({requestId:currentPendingEquipBody.requestId,state:{...currentPreEquipState,me:{...currentPreEquipState.me,
   version:currentPreEquipState.me.version+1,costumeAppearance:{costumeId:'default',costumeVersion:1,designId:'default',designVersion:1}}}});
  await currentWaitRender();
  assertCostumeInventory(currentAcceptedStateCount===0,currentContextChange+' 변경 후 늦은 교체 상태 폐기');
  assertCostumeInventory(!document.body.textContent!.includes(t('wardrobe.equipped')),currentContextChange+' 변경 후 이전 교체 완료 안내 폐기');
 }
 currentClientStub.request=currentOriginalRequestHandler;currentClientStub.accept=currentOriginalAcceptHandler;
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();
