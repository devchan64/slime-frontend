import {render} from 'preact';
import {RefiningMissionPanel} from '../../src/ui/RefiningMissionPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentOriginalFetch=globalThis.fetch.bind(globalThis);
const currentCancellationRequests:{path:string;body:string;receipt:unknown}[]=[];
const waitMissionRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,100));
function canonicalMissionValue(currentInputValue:any):any{
 if(Array.isArray(currentInputValue))return currentInputValue.map(canonicalMissionValue);
 if(currentInputValue&&typeof currentInputValue==='object')return Object.fromEntries(Object.keys(currentInputValue).sort().map(currentFieldName=>[currentFieldName,canonicalMissionValue(currentInputValue[currentFieldName])]));
 return currentInputValue;
}
function assertMissionCondition(currentConditionValue:unknown,currentFailureMessage:string){if(!currentConditionValue)throw new Error(currentFailureMessage);}
function renderMissionPanel(){render(<RefiningMissionPanel gameSessionClient={currentGameClient} actionsAreDisabled={false} characterStateVersion={currentGameClient.state!.me.version}/>,document.getElementById('root')!);}
async function waitMissionText(currentExpectedText:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(document.body.textContent!.includes(currentExpectedText))return;await waitMissionRender();}
 throw new Error('화면 대기 시간 초과: '+currentExpectedText+' '+document.body.textContent);
}
async function clickMissionButton(currentButtonKey:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){
  const currentButtonElement=[...document.querySelectorAll('button')].find(currentElement=>currentElement.textContent===t(currentButtonKey));
  if(currentButtonElement&&!currentButtonElement.disabled){currentButtonElement.click();await waitMissionRender();return;}
  await waitMissionRender();
 }
 throw new Error('버튼 대기 시간 초과: '+currentButtonKey+' '+document.body.textContent);
}
(async()=>{try{
 const currentTestContext=await (await currentOriginalFetch('/test-context')).json();setLocale('ko');
 currentGameClient.tokens=currentTestContext.tokens;
 currentGameClient.onState=()=>renderMissionPanel();
 globalThis.fetch=async(currentFetchInput,currentFetchOptions)=>{
  const currentServerResponse=await currentOriginalFetch(currentFetchInput,currentFetchOptions);
  const currentRequestPath=String(currentFetchInput);
  if(currentRequestPath.includes('/refining-missions/')&&currentRequestPath.endsWith('/cancel')){
   assertMissionCondition(currentServerResponse.ok,'실제 취소 API 성공');
   const currentResponseBody=await currentServerResponse.clone().json();
   currentCancellationRequests.push({path:currentRequestPath,body:String(currentFetchOptions?.body),receipt:currentResponseBody.receipt});
   if(currentCancellationRequests.length===1)throw new TypeError('실제 성공 응답 유실 검사');
  }
  return currentServerResponse;
 };
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 const currentInitialVersion=currentGameClient.state!.me.version;
 const currentInitialCoins=currentGameClient.state!.me.coins;
 const currentInitialMaterials=JSON.stringify(currentGameClient.state!.me.materials);
 await waitMissionText(currentTestContext.receiverName);
 await waitMissionText(currentTestContext.refiningCityNameTranslations.ko);
 await clickMissionButton('missions.cancel');
 assertMissionCondition(currentCancellationRequests.length===0,'확인 전 서버 변경 금지');
 assertMissionCondition(document.querySelector('[role="group"]')!.textContent!.includes(currentTestContext.receiverName),'선택 임무 확인');
 await clickMissionButton('missions.confirm');
 await waitMissionText(t('missions.uncertain'));
 assertMissionCondition(currentGameClient.state!.me.version===currentInitialVersion,'유실 응답으로 로컬 상태 추정 금지');
 await clickMissionButton('missions.retry');
 await waitMissionText(t('missions.cancelled'));
 assertMissionCondition(currentCancellationRequests.length===2,'취소와 재시도 두 요청');
 assertMissionCondition(JSON.stringify(canonicalMissionValue(currentCancellationRequests[0]))===JSON.stringify(canonicalMissionValue(currentCancellationRequests[1])),'동일 본문과 최초 영수증 복구');
 assertMissionCondition(currentGameClient.state!.me.version===currentInitialVersion+1,'단일 버전 증가');
 assertMissionCondition(currentGameClient.state!.me.coins===currentInitialCoins&&JSON.stringify(currentGameClient.state!.me.materials)===currentInitialMaterials,'담보 무환불과 위탁 물품 보존');
 await clickMissionButton('missions.refresh');await waitMissionText(t('missions.statusCancelled'));
 setLocale('en');await waitMissionRender();
 await waitMissionText(t('missions.statusCancelled'));await waitMissionText(currentTestContext.refiningCityNameTranslations.en);
 assertMissionCondition(![...document.querySelectorAll('button')].some(currentElement=>currentElement.textContent===t('missions.cancel')),'취소 완료 기록의 재취소 버튼 제거');
 await currentOriginalFetch('/test-result',{method:'POST',body:'PASS: 실제 정제 임무 GUI 조회·목적지·무환불·유실 재시도·언어 전환'});
}catch(currentBrowserError){await currentOriginalFetch('/test-result',{method:'POST',body:'FAIL: '+String(currentBrowserError)});}})();
