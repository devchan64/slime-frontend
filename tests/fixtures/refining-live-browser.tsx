import {render} from 'preact';
import {RefiningContractsPanel} from '../../src/ui/RefiningContractsPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,100));
function assertBrowserCondition(currentCheckedCondition:unknown,currentFailureMessage:string){if(!currentCheckedCondition)throw new Error(currentFailureMessage);}
function renderProcessingPanel(){render(<RefiningContractsPanel gameSessionClient={currentGameClient} currentFacilityIdentifier="iseulon-workshop" actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function clickProcessingButton(currentButtonKey:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){
  const currentButtonElement=[...document.querySelectorAll('button')].find(currentButtonElement=>currentButtonElement.textContent===t(currentButtonKey));
  if(currentButtonElement&&!currentButtonElement.disabled){currentButtonElement.click();await waitRenderCycle();return;}
  await waitRenderCycle();
 }
 throw new Error('버튼 대기 시간 초과: '+currentButtonKey+' '+document.body.textContent);
}
async function waitProcessingText(currentExpectedText:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(document.body.textContent!.includes(currentExpectedText))return;await waitRenderCycle();}
 throw new Error('화면 대기 시간 초과: '+currentExpectedText+' '+document.body.textContent);
}
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();setLocale('ko');
 currentGameClient.tokens=currentTestContext.tokens;
 currentGameClient.onState=()=>renderProcessingPanel();
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 await waitRenderCycle();await waitRenderCycle();
 await clickProcessingButton('workshop.refiningBrowse');
 await waitProcessingText('하급 정련 철괴');
 const currentRecipeSelect=document.querySelector('select')!;
 const currentIronOption=[...currentRecipeSelect.options].find(currentOptionElement=>currentOptionElement.textContent==='하급 정련 철괴')!;
 assertBrowserCondition(currentIronOption,'철괴 레시피');
 currentRecipeSelect.value=currentIronOption.value;currentRecipeSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitRenderCycle();
 await clickProcessingButton('workshop.refiningQuote');
 await clickProcessingButton('workshop.refiningSubmit');
 await waitProcessingText(t('workshop.refiningCreated'));
 await waitProcessingText(t('workshop.inprogress'));
 assertBrowserCondition(currentGameClient.state!.me.coins===99,'단일 비용 차감');
 await fetch('/test-complete-contract',{method:'POST'});
 await clickProcessingButton('journal.refresh');
 await clickProcessingButton('workshop.claim');
 await waitProcessingText(t('workshop.claimed'));
 assertBrowserCondition(currentGameClient.state!.me.refinedMaterials['iron-ingot-low']===1,'철괴 한 개 수령');
 assertBrowserCondition(![...document.querySelectorAll('button')].some(currentButtonElement=>currentButtonElement.textContent===t('workshop.claim')),'수령 버튼 제거');
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 assertBrowserCondition(currentGameClient.state!.me.coins===99&&currentGameClient.state!.me.refinedMaterials['iron-ingot-low']===1,'서버 재조회 결과 보존');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 GUI 견적·계약·목록 갱신·수령·저장 결과'});
}catch(currentBrowserError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentBrowserError)});}})();
