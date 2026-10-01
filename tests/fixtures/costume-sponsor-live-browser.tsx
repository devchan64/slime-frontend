import {render} from 'preact';
import {CostumeDescription} from '../../src/ui/CostumeDescription';
import {Client} from '../../src/client/api';
import {setLocale} from '../../src/i18n';
const currentGameClient=new Client();
async function waitDisplayCondition(readCurrentCondition:()=>unknown){const currentDeadlineTime=performance.now()+10000;while(!readCurrentCondition()){if(performance.now()>currentDeadlineTime)throw new Error('표시 대기 시간 초과: '+document.body.textContent);await new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,20));}}
function renderCostumePanel(){render(<CostumeDescription gameSessionClient={currentGameClient}/>,document.getElementById('root')!);}
function readSponsorElement(){return document.querySelector('.costume-sponsorship section');}
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();setLocale('ko');currentGameClient.tokens=currentTestContext.tokens;
 currentGameClient.onState=renderCostumePanel;currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 await new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,100));document.querySelector('summary')!.click();
 await waitDisplayCondition(()=>readSponsorElement());
 if(!readSponsorElement()?.textContent?.includes(currentTestContext.message))throw new Error('서버 광고 본문 불일치');
 if(readSponsorElement()?.getAttribute('aria-label')!=='스폰서 광고')throw new Error('광고 표시 누락');
 document.querySelector('summary')!.click();await waitDisplayCondition(()=>!readSponsorElement());
 document.querySelector('summary')!.click();await waitDisplayCondition(()=>readSponsorElement());
 if(document.querySelectorAll('.costume-sponsorship section').length!==1)throw new Error('광고 중복');
 render(null,document.getElementById('root')!);
 if(readSponsorElement())throw new Error('화면 정리 실패');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 인증·카탈로그·서명 세션·SDK SRI·광고 본문·닫기·재열기·정리'});
}catch(currentFailureError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentFailureError)+' '+String((globalThis as unknown as {__TEST_SPONSOR_ERROR?:string}).__TEST_SPONSOR_ERROR)});}})();
