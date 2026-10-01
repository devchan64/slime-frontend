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
const currentClientStub:any={tokens:{user_id:'account'},state:{generation:1,me:{id:'hero'}},request:async()=>currentResponseData==='delay'?new Promise(currentResolveCallback=>{currentDelayedResolve=currentResolveCallback;}):structuredClone(currentResponseData)};
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
 assertCostumeInventory(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();
