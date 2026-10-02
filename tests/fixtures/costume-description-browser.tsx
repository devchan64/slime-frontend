import {render} from 'preact';
import {CostumeDescription} from '../../src/ui/CostumeDescription';
import type {Client} from '../../src/client/api';
import {t,setLocale,getLocale} from '../../src/i18n';
const currentAssertionLabels:string[]=[];
let currentSponsorRequests=0,currentSponsorFails=false;
let currentRequestCount=0,currentDesignVersion=1,currentRequestFails=true;
const currentFixtureClient={tokens:{user_id:'owner'},state:{generation:1,epoch:1,location:{chatRoomId:'map:iseulon'},me:{id:'hero'}},readServerTimestamp:()=>100,async request(currentRequestPath:string,currentRequestBody?:unknown){
 if(currentRequestPath.endsWith('/sponsorship-sessions')){currentSponsorRequests++;if(currentSponsorFails)throw new Error('광고 조회 실패');return {serverTime:100,session:null};}
 if(currentRequestPath!=='/v2/costumes'||currentRequestBody)throw new Error('잘못된 요청');
 currentRequestCount++;if(currentRequestFails){currentRequestFails=false;throw new Error('조회 실패');}
 return {version:2,defaultCostumeId:'default',entries:[{costumeId:'default',version:1,designId:'default',designVersion:currentDesignVersion,nameTranslations:{ko:'서버 기본 의상',en:'Server default outfit'},descriptionTranslations:{ko:'서버 설명 <img src=x onerror=alert(1)>',en:'Server details <img src=x onerror=alert(1)>'}}]};
}};
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,120));
function verifyCostumeCondition(currentConditionValue:unknown,currentAssertionLabel:string){if(!currentConditionValue)throw new Error(currentAssertionLabel);currentAssertionLabels.push(currentAssertionLabel);}
function renderCostumeDescription(){render(<CostumeDescription gameSessionClient={currentFixtureClient as unknown as Client}/>,document.getElementById('root')!);}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');renderCostumeDescription();await waitRenderCycle();
 verifyCostumeCondition(currentRequestCount===0&&currentSponsorRequests===0,'닫힌 설명은 조회하지 않음');
 document.querySelector('summary')!.click();await waitRenderCycle();
 verifyCostumeCondition(document.querySelector('[role="alert"]')?.textContent?.includes('조회 실패'),'조회 실패 표시');
 document.querySelector<HTMLButtonElement>('button')!.click();await waitRenderCycle();
 verifyCostumeCondition(document.body.textContent?.includes(getLocale()==='ko'?'서버 기본 의상':'Server default outfit'),'서버 이름 표시');
 verifyCostumeCondition(!/표준 가치|Standard value/.test(document.body.textContent??''),'표준 가치 비공개');
 verifyCostumeCondition(document.body.textContent?.includes('<img src=x onerror=alert(1)>')&&!document.querySelector('img'),'설명 HTML을 텍스트로 표시');
 setLocale(getLocale()==='ko'?'en':'ko');await waitRenderCycle();
 verifyCostumeCondition(document.body.textContent?.includes(getLocale()==='ko'?'서버 설명':'Server details'),'현재 언어의 서버 설명 표시');
 verifyCostumeCondition(currentRequestCount===2,'언어 변경으로 중복 조회하지 않음');
 document.querySelector('summary')!.click();await waitRenderCycle();document.querySelector('summary')!.click();await waitRenderCycle();
 verifyCostumeCondition(currentRequestCount===2,'다시 펼칠 때 기존 설명 재사용');
 verifyCostumeCondition(currentSponsorRequests===3,'설명 준비·언어 변경·다시 열기에 광고 세션 조회');
 document.querySelector('summary')!.click();await waitRenderCycle();currentSponsorFails=true;
 document.querySelector('summary')!.click();await waitRenderCycle();
 verifyCostumeCondition(document.body.textContent?.includes(t('character.costumeSponsorUnavailable')),'광고 실패 안내');
 verifyCostumeCondition(document.body.textContent?.includes('<img src=x onerror=alert(1)>'),'광고 실패에도 코스튬 설명 유지');
 document.querySelector('summary')!.click();await waitRenderCycle();currentSponsorFails=false;
 document.querySelector('summary')!.click();await waitRenderCycle();
 verifyCostumeCondition(!document.body.textContent?.includes(t('character.costumeSponsorUnavailable')),'다시 열어 광고 재시도');
 render(null,document.getElementById('root')!);currentDesignVersion=2;renderCostumeDescription();await waitRenderCycle();document.querySelector('summary')!.click();await waitRenderCycle();
 verifyCostumeCondition(document.body.textContent?.includes(t('character.costumeUnsupported')),'미리보기와 다른 전체 디자인 버전 거절');
 verifyCostumeCondition(!document.body.textContent?.includes('<img'),'불일치 설명을 표시하지 않음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionLabels});
}catch(currentFailureError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailureError),assertions:currentAssertionLabels});}})();
