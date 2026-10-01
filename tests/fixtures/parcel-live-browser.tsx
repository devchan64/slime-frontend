import {render} from 'preact';
import {ParcelPanel} from '../../src/ui/ParcelPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
const currentOriginalFetch=window.fetch.bind(window);
const currentRecordedPurchases:string[]=[];
let currentFacilityIdentifier:any;
let currentResponseDiscarded=false;
function assertBrowserCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);}
function renderParcelPanel(){render(<ParcelPanel gameSessionClient={currentGameClient} currentFacilityIdentifier={currentFacilityIdentifier} actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function waitParcelCondition(currentPredicate:()=>boolean,currentDescription:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(currentPredicate())return;await currentWaitRender();}
 throw new Error(currentDescription+' '+document.body.textContent);
}
async function clickParcelButton(currentTranslationKey:string){
 await waitParcelCondition(()=>[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t(currentTranslationKey)&&!currentButton.disabled),'버튼 대기 '+currentTranslationKey);
 [...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t(currentTranslationKey))!.click();
 await currentWaitRender();
}
window.fetch=async(currentInput,currentOptions)=>{
 const currentResponse=await currentOriginalFetch(currentInput,currentOptions);
 if(String(currentInput).endsWith('/claim')){
  currentRecordedPurchases.push(String(currentOptions?.body));
  if(currentResponse.ok&&!currentResponseDiscarded){currentResponseDiscarded=true;await currentResponse.arrayBuffer();throw new TypeError('실제 수령 응답 유실 검사');}
 }
 return currentResponse;
};
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();
 setLocale('ko');currentGameClient.tokens=currentTestContext.tokens;currentFacilityIdentifier=currentTestContext.facilityId;
 currentGameClient.onState=()=>renderParcelPanel();
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 const currentOriginalVersion=currentGameClient.state!.me.version;
 await currentWaitRender();await currentWaitRender();
 await clickParcelButton('parcels.refresh');
 await waitParcelCondition(()=>document.body.textContent!.includes('7p'),'첨부 금액 표시');
 await clickParcelButton('parcels.claim');
 await waitParcelCondition(()=>document.body.textContent!.includes(t('parcels.uncertain')),'응답 유실 후 미확정 안내');
 await clickParcelButton('parcels.retry');
 await waitParcelCondition(()=>document.body.textContent!.includes(t('parcels.received')),'실제 수령 완료 표시');
 assertBrowserCondition(currentRecordedPurchases.length===2&&currentRecordedPurchases[0]===currentRecordedPurchases[1],'동일 요청으로 재시도');
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 assertBrowserCondition(currentGameClient.state!.me.coins===17,'돈 7p 단일 지급');
 assertBrowserCondition(currentGameClient.state!.me.bag!.items.some(currentItem=>currentItem.id==='protein-jelly'&&currentItem.quantity===2),'재료 2개 단일 지급');
 assertBrowserCondition(currentGameClient.state!.me.version===currentOriginalVersion+1,'캐릭터 버전 단일 증가');
 await clickParcelButton('parcels.refresh');
 await waitParcelCondition(()=>document.body.textContent!.includes(t('parcels.empty')),'수령 후 빈 목록');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 GUI 소포 수령·응답 유실·동일 요청 재시도·단일 지급'});
}catch(currentError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentError)});}})();
