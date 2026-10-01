import {render} from 'preact';
import {CostumeDescription} from '../../src/ui/CostumeDescription';
import type {Client} from '../../src/client/api';
import {setLocale} from '../../src/i18n';
const currentAssertionLabels:string[]=[];
let currentSessionRequestCount=0;
const currentFixtureClient={tokens:{user_id:'test'},state:{generation:1,epoch:1,location:{chatRoomId:'map:iseulon'},me:{id:'hero'}},
 readServerTimestamp:()=>Date.now()/1000,
 async request(currentRequestPath:string,currentRequestBody?:unknown){
  if(currentRequestPath.endsWith('/sponsorship-sessions'))currentSessionRequestCount++;
  const currentResponse=await fetch(currentRequestPath,{method:currentRequestBody===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Test-Room':this.state.location.chatRoomId,'X-Test-Epoch':String(this.state.epoch)},body:currentRequestBody===undefined?undefined:JSON.stringify(currentRequestBody)});
  if(!currentResponse.ok)throw new Error('테스트 API 응답 실패');return currentResponse.json();
 }};
function verifyBrowserCondition(currentConditionValue:unknown,currentAssertionLabel:string){if(!currentConditionValue)throw new Error(currentAssertionLabel);currentAssertionLabels.push(currentAssertionLabel);}
function readSponsorElement(){return document.querySelector('.costume-sponsorship section');}
function renderCostumeFixture(){render(<CostumeDescription gameSessionClient={currentFixtureClient as unknown as Client}/>,document.getElementById('root')!);}
async function waitBrowserCondition(readCurrentCondition:()=>unknown){const currentWaitStarted=performance.now();while(!readCurrentCondition()){if(performance.now()-currentWaitStarted>5000)throw new Error('브라우저 상태 대기 시간 초과: '+document.body.textContent);await new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,20));}}
(async()=>{try{
 setLocale('ko');renderCostumeFixture();await new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,100));
 document.querySelector('summary')!.click();await waitBrowserCondition(()=>readSponsorElement());
 verifyBrowserCondition(readSponsorElement()?.getAttribute('aria-label')==='스폰서 광고','실제 SDK의 광고 구분 표시');
 verifyBrowserCondition(readSponsorElement()?.textContent?.includes('<img src=x onerror=alert(1)>')&&!document.querySelector('img'),'광고 본문의 HTML 비실행');
 document.querySelector('summary')!.click();await waitBrowserCondition(()=>!readSponsorElement());verifyBrowserCondition(!readSponsorElement(),'설명 닫기 시 SDK DOM 제거');
 document.querySelector('summary')!.click();await waitBrowserCondition(()=>readSponsorElement());verifyBrowserCondition(document.querySelectorAll('.costume-sponsorship section').length===1,'다시 열어 중복 없는 광고 표시');
 setLocale('en');await waitBrowserCondition(()=>readSponsorElement()?.getAttribute('aria-label')==='Sponsored advertisement');verifyBrowserCondition(readSponsorElement()?.textContent?.includes('Test sponsor'),'영어 광고로 교체');
 currentFixtureClient.state={...currentFixtureClient.state,epoch:2,location:{chatRoomId:'map:other'}};renderCostumeFixture();
 verifyBrowserCondition(!readSponsorElement(),'채널 변경 렌더에서 이전 광고 즉시 제거');
 await waitBrowserCondition(()=>readSponsorElement());verifyBrowserCondition(readSponsorElement()?.textContent?.includes('map:other'),'새 공간에 서명된 광고만 표시');
 await waitBrowserCondition(()=>!readSponsorElement());verifyBrowserCondition(!readSponsorElement(),'실제 SDK 타이머로 세션 만료 시 제거');
 document.querySelector('summary')!.click();await new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,50));
 const currentPreviousRequests=currentSessionRequestCount;document.querySelector('summary')!.click();
 await waitBrowserCondition(()=>currentSessionRequestCount>currentPreviousRequests);
 render(null,document.getElementById('root')!);await new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,900));verifyBrowserCondition(!readSponsorElement(),'화면 제거 후 늦은 응답 미표시');
 await fetch('/result',{method:'POST',body:JSON.stringify({status:'PASS',assertions:currentAssertionLabels})});
}catch(currentFailureError){await fetch('/result',{method:'POST',body:JSON.stringify({status:'FAIL',error:String(currentFailureError),assertions:currentAssertionLabels})});}})();
