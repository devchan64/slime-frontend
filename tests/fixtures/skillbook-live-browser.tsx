import {render} from 'preact';
import {SkillbookPanel} from '../../src/ui/SkillbookPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentOriginalFetch=window.fetch.bind(window);
const currentPurchaseRequests:string[]=[];
const currentReadingRequests:string[]=[];
const currentRenderPause=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
function assertBrowserCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);}
function renderBookshopPanel(){render(<SkillbookPanel gameSessionClient={currentGameClient} currentFacilityIdentifier="iseulon-bookshop" actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function waitBrowserCondition(currentPredicate:()=>boolean,currentMessage:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(currentPredicate())return;await currentRenderPause();}
 throw new Error(currentMessage+' '+document.body.textContent);
}
async function clickBookshopButton(currentButtonText:string){
 await waitBrowserCondition(()=>[...document.querySelectorAll('li:first-child button')].some(currentButton=>currentButton.textContent===currentButtonText&&!(currentButton as HTMLButtonElement).disabled),'서점 버튼 대기 '+currentButtonText);
 (document.querySelector('li:first-child button') as HTMLButtonElement).click();
 await currentRenderPause();
}
window.fetch=async(currentInput,currentOptions)=>{
 const currentResponse=await currentOriginalFetch(currentInput,currentOptions);
 const currentRequestPath=String(currentInput);
 if(currentOptions?.method==='POST'&&(currentRequestPath.endsWith('/purchases')||currentRequestPath.endsWith('/read'))){
  const currentRecordedRequests=currentRequestPath.endsWith('/purchases')?currentPurchaseRequests:currentReadingRequests;
  currentRecordedRequests.push(String(currentOptions.body));
  if(currentRecordedRequests.length===1&&currentResponse.ok){await currentResponse.arrayBuffer();throw new TypeError('실제 서점 완료 응답 유실');}
 }
 return currentResponse;
};
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();
 setLocale('ko');currentGameClient.tokens=currentTestContext.tokens;
 currentGameClient.onState=renderBookshopPanel;
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 const currentOriginalVersion=currentGameClient.state!.me.version;
 await clickBookshopButton(t('books.buy',{price:100}));
 await waitBrowserCondition(()=>currentPurchaseRequests.length===1&&document.body.textContent!.includes('실제 서점 완료 응답 유실'),'구매 응답 유실 표시');
 await clickBookshopButton(t('books.buy',{price:100}));
 await clickBookshopButton(t('books.read'));
 await waitBrowserCondition(()=>currentReadingRequests.length===1&&document.body.textContent!.includes('실제 서점 완료 응답 유실'),'열람 응답 유실 표시');
 await clickBookshopButton(t('books.read'));
 await waitBrowserCondition(()=>document.body.textContent!.includes(t('books.readComplete')),'열람 완료 표시');
 assertBrowserCondition(currentPurchaseRequests.length===2&&currentPurchaseRequests[0]===currentPurchaseRequests[1],'구매 원본 요청 유지');
 assertBrowserCondition(currentReadingRequests.length===2&&currentReadingRequests[0]===currentReadingRequests[1],'열람 원본 요청 유지');
 assertBrowserCondition(Object.keys(JSON.parse(currentReadingRequests[0])).join(',')==='expectedVersion','열람 요청 계약');
 const currentFinishedVersion=currentGameClient.state!.me.version;
 assertBrowserCondition(currentFinishedVersion===currentOriginalVersion+3,'최초 소지 업적·구매·첫 열람의 단일 반영');
 await clickBookshopButton(t('books.reread'));
 await waitBrowserCondition(()=>currentReadingRequests.length===3&&document.body.textContent!.includes(t('books.readComplete')),'재열람 완료');
 assertBrowserCondition(currentGameClient.state!.me.version===currentFinishedVersion,'재열람으로 버전 불변');
 assertBrowserCondition(currentGameClient.state!.me.coins===400,'100p 한 번 결제');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 GUI 구매·열람 응답 유실 재시도와 재열람 검증'});
}catch(currentError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentError)});}})();
