import {render} from 'preact';
import {AchievementsPage} from '../../src/ui/AchievementsPage';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentRequestBodies:string[]=[];
const originalBrowserFetch=window.fetch.bind(window);
let currentDropFirstResponse=true;
let rejectNextCatalogRequest=false;
window.fetch=async(currentRequestInput,currentRequestOptions)=>{
 if(rejectNextCatalogRequest&&String(currentRequestInput)==='/v1/game/substitute-hunts/catalog'){rejectNextCatalogRequest=false;throw new TypeError('검사: 목록 조회 실패');}
 const currentHttpResponse=await originalBrowserFetch(currentRequestInput,currentRequestOptions);
 if(String(currentRequestInput)==='/v1/game/substitute-hunts'&&currentRequestOptions?.method==='POST'){
  currentRequestBodies.push(String(currentRequestOptions.body));
  if(currentDropFirstResponse&&currentHttpResponse.ok){currentDropFirstResponse=false;throw new TypeError('검사: 서버 지급 후 응답 유실');}
 }
 return currentHttpResponse;
};
function assertHuntBrowserCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);}
function renderHuntBrowserPanel(){render(<AchievementsPage client={currentGameClient} disabled={false} onReturn={()=>{throw new Error('자리비움을 해제하면 안 됩니다.');}}/>,document.getElementById('root')!);}
async function waitHuntBrowserCondition(currentCondition:()=>boolean){const currentDeadlineTime=performance.now()+10000;while(performance.now()<currentDeadlineTime){if(currentCondition())return;await new Promise(currentResolve=>setTimeout(currentResolve,50));}throw new Error('화면 조건 대기 실패: '+document.body.textContent);}
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();setLocale('ko');currentGameClient.tokens=currentTestContext.tokens;currentGameClient.onState=renderHuntBrowserPanel;
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 document.querySelector<HTMLButtonElement>('[aria-expanded="false"]')!.click();
 const currentBeforeState=currentGameClient.state!;
 const currentCatalogData=await currentGameClient.request('/v1/game/substitute-hunts/catalog');
 const currentPassiveQuote=currentCatalogData.encounters.find((currentEntry:any)=>currentEntry.encounterId==='passive');
 await waitHuntBrowserCondition(()=>!!document.querySelector<HTMLButtonElement>('[data-hunt-encounter="passive"]')&&!document.querySelector<HTMLButtonElement>('[data-hunt-encounter="passive"]')!.disabled);
 assertHuntBrowserCondition(document.body.textContent?.includes(t('hunts.fpCost',{amount:currentPassiveQuote.fpCost})),'소비 FP 표시');
 document.querySelector<HTMLButtonElement>('[data-hunt-encounter="passive"]')!.click();
 await waitHuntBrowserCondition(()=>document.body.textContent?.includes(t('hunts.uncertain'))??false);
 render(null,document.getElementById('root')!);renderHuntBrowserPanel();
 document.querySelector<HTMLButtonElement>('[aria-expanded="false"]')!.click();
 await waitHuntBrowserCondition(()=>[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t('hunts.retry')&&!currentButton.disabled));
 [...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t('hunts.retry'))!.click();
 await waitHuntBrowserCondition(()=>document.body.textContent?.includes(t('hunts.completed',{amount:currentPassiveQuote.fpCost}))??false);
 assertHuntBrowserCondition(currentRequestBodies.length===2&&currentRequestBodies[0]===currentRequestBodies[1],'재시도 요청 ID·버전 보존');
 const currentAfterState=await currentGameClient.request('/v1/game/state');
 assertHuntBrowserCondition(currentAfterState.me.fp===currentBeforeState.me.fp-currentPassiveQuote.fpCost,'FP 일회 차감');
 assertHuntBrowserCondition(currentAfterState.me.mode==='AWAY','자리비움 보존');
 assertHuntBrowserCondition(document.body.textContent?.includes('단백질젤리'),'실제 획득 재료 이름 표시');
 await waitHuntBrowserCondition(()=>[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t('hunts.refreshTargets')&&!currentButton.disabled));
 rejectNextCatalogRequest=true;
 [...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t('hunts.refreshTargets'))!.click();
 await waitHuntBrowserCondition(()=>!!document.querySelector('[role="alert"]'));
 [...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t('hunts.refreshTargets'))!.click();
 await waitHuntBrowserCondition(()=>!document.querySelector('[role="alert"]')&&[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t('hunts.refreshTargets')&&!currentButton.disabled));
 assertHuntBrowserCondition(currentRequestBodies.length===2,'목록 복구 중 사냥 재전송 없음');
 setLocale('en');await waitHuntBrowserCondition(()=>document.body.textContent?.includes(t('hunts.substituteTitle'))??false);
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 대체 사냥 지급·응답 유실·메뉴 재진입·같은 요청 재시도·번역'});
}catch(currentBrowserError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentBrowserError)});}})();
