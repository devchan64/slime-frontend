import {render} from 'preact';
import {ParcelArrivalNotice} from '../../src/ui/ParcelArrivalNotice';
import {setLocale, t} from '../../src/i18n';
const currentRootElement=document.getElementById('root')!;
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,120));
const currentAssertionMessages:string[]=[];
function assertParcelBrowser(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);currentAssertionMessages.push(currentMessage);}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 let currentRequestCount=0;
 const currentClientStub:any={request:async(currentRequestPath:string)=>{
  assertParcelBrowser(currentRequestPath==='/v1/game/parcels/notice','알림 전용 API');currentRequestCount++;
  return {characterId:'hero',pendingCount:2,serverTime:100};
 }};
 render(<div class="app-shell world-shell"><ParcelArrivalNotice currentGameClient={currentClientStub} currentCharacterIdentifier="hero"/><header>SLIME</header><main>Battle</main></div>,currentRootElement);
 await currentWaitRender();
 assertParcelBrowser(document.body.textContent!.includes(t('parcels.arrived',{count:2})),'도착 건수와 길드 수령 안내');
 assertParcelBrowser(document.querySelector('[role="status"]')?.getAttribute('aria-live')==='polite','접근 가능한 알림');
 assertParcelBrowser(document.querySelectorAll('button').length===0,'원격 수령 버튼 없음');
 assertParcelBrowser(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');
 render(null,currentRootElement);
 let currentDeferredResolve:(currentResult:unknown)=>void=()=>{};
 const currentDeferredClient:any={request:()=>new Promise(currentResolve=>{currentDeferredResolve=currentResolve;})};
 render(<ParcelArrivalNotice currentGameClient={currentDeferredClient} currentCharacterIdentifier="hero"/>,currentRootElement);
 await currentWaitRender();render(null,currentRootElement);
 currentDeferredResolve({characterId:'hero',pendingCount:99,serverTime:100});await currentWaitRender();
 assertParcelBrowser(!document.body.textContent!.includes('99'),'로그아웃 후 늦은 알림 폐기');
 const currentEmptyClient:any={request:async()=>({characterId:'other',pendingCount:0,serverTime:100})};
 render(<ParcelArrivalNotice currentGameClient={currentEmptyClient} currentCharacterIdentifier="other"/>,currentRootElement);
 await currentWaitRender();assertParcelBrowser(!document.querySelector('[role="status"]')?.textContent,'다른 캐릭터 빈 알림');
 render(null,currentRootElement);
 const currentFailedClient:any={request:async()=>{throw new Error('offline');}};
 render(<ParcelArrivalNotice currentGameClient={currentFailedClient} currentCharacterIdentifier="hero"/>,currentRootElement);
 await currentWaitRender();assertParcelBrowser(document.body.textContent!.includes(t('parcels.noticeFailed')),'실패를 소포 없음으로 오인하지 않음');
 render(null,currentRootElement);
 render(<div class="app-shell world-shell"><ParcelArrivalNotice currentGameClient={currentClientStub} currentCharacterIdentifier="hero"/><header>SLIME</header><main>Battle</main></div>,currentRootElement);
 await currentWaitRender();
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionMessages});
}catch(currentFailure){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailure),assertions:currentAssertionMessages});}})();
