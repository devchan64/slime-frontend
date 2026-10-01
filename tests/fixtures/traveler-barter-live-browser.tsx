import {render} from 'preact';
import {TravelerPermitPanel} from '../../src/ui/TravelerPermitPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
const currentOriginalFetch=window.fetch.bind(window);
const currentRecordedPurchases:string[]=[];
let currentGuardDefinition:any;
let currentResponseDiscarded=false;
function assertBrowserCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);}
function renderTravelerPanel(){render(<TravelerPermitPanel gameSessionClient={currentGameClient} currentGuardDefinition={currentGuardDefinition} actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function waitTravelerCondition(currentPredicate:()=>boolean,currentDescription:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(currentPredicate())return;await currentWaitRender();}
 throw new Error(currentDescription+' '+document.body.textContent);
}
async function clickTravelerButton(currentTranslationKey:string){
 await waitTravelerCondition(()=>[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t(currentTranslationKey)&&!currentButton.disabled),'버튼 대기 '+currentTranslationKey);
 [...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t(currentTranslationKey))!.click();
 await currentWaitRender();
}
window.fetch=async(currentInput,currentOptions)=>{
 const currentResponse=await currentOriginalFetch(currentInput,currentOptions);
 if(String(currentInput).endsWith('/traveler-permit-purchases')){
  currentRecordedPurchases.push(String(currentOptions?.body));
  if(currentResponse.ok&&!currentResponseDiscarded){currentResponseDiscarded=true;await currentResponse.arrayBuffer();throw new TypeError('실제 발급 응답 유실 검사');}
 }
 return currentResponse;
};
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();
 setLocale('ko');currentGameClient.tokens=currentTestContext.tokens;currentGuardDefinition=currentTestContext.guard;
 currentGameClient.onState=()=>renderTravelerPanel();
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 await currentWaitRender();await currentWaitRender();
 (document.querySelector('input[type=checkbox]') as HTMLInputElement).click();await currentWaitRender();
 const currentNumberInputs=[...document.querySelectorAll<HTMLInputElement>('input[type=number]')];
 assertBrowserCondition(currentNumberInputs.length===2,'현금과 보유 재료 입력');
 for(const [currentInputIndex,currentInputValue] of ['2','4'].entries()){
  currentNumberInputs[currentInputIndex].value=currentInputValue;currentNumberInputs[currentInputIndex].dispatchEvent(new Event('input',{bubbles:true}));await currentWaitRender();
 }
 await clickTravelerButton('citizenship.permitPrice');
 await waitTravelerCondition(()=>document.body.textContent!.includes(t('citizenship.barterTotal',{total:6,excess:1})),'실제 견적 합계·초과액 표시');
 await clickTravelerButton('citizenship.permitPurchase');
 await waitTravelerCondition(()=>document.body.textContent!.includes(t('citizenship.permitUncertain')),'응답 유실 후 미확정 안내');
 assertBrowserCondition(document.querySelector('fieldset')!.disabled,'재시도 전 납부 선택 잠금');
 await clickTravelerButton('citizenship.permitRetry');
 await waitTravelerCondition(()=>document.body.textContent!.includes(t('citizenship.permitPurchased')),'실제 발급 완료 표시');
 assertBrowserCondition(currentRecordedPurchases.length===2&&currentRecordedPurchases[0]===currentRecordedPurchases[1],'동일 요청으로 재시도');
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 assertBrowserCondition(currentGameClient.state!.me.coins===0,'현금 2p 단일 차감과 거스름돈 없음');
 assertBrowserCondition(!currentGameClient.state!.me.bag!.items.some(currentItem=>currentItem.id==='protein-jelly'),'재료 4개 단일 차감');
 assertBrowserCondition(currentGameClient.state!.me.travelerPermitSummary!.records.length===1,'증서 한 개 발급');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 GUI 혼합 견적·응답 유실·동일 요청 재시도·단일 발급'});
}catch(currentError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentError)});}})();
