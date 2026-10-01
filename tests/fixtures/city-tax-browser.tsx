import {render} from 'preact';
import {CityTaxPanel} from '../../src/ui/CityTaxPanel';
import type {Client} from '../../src/client/api';
import {t,setLocale,getLocale} from '../../src/i18n';
const currentAssertionLabels:string[]=[];
const currentStartTimestamp=Date.parse('2026-10-01T04:00:00+09:00')/1000;
const currentTaxFixture={version:1,policyVersion:2,startsAt:currentStartTimestamp,expiresAt:currentStartTimestamp+86400,evaluatedAt:currentStartTimestamp,observedAt:currentStartTimestamp+2,timezone:'Asia/Seoul',refreshHour:4,entries:[{cityId:'iseulon',cityName:'이슬온 <img src=x>',paidCitizenshipCount:12,taxBasisPoints:333}]};
let currentRequestCount=0,currentRequestMode='failure';
let completePendingRequest:((currentResponseValue:unknown)=>void)|undefined;
const currentFixtureClient={tokens:{user_id:'owner'},state:{generation:1,me:{id:'hero'}},async request(currentRequestPath:string,currentRequestBody?:unknown){
 if(currentRequestPath!=='/v1/economy/city-taxes'||currentRequestBody)throw new Error('잘못된 요청');
 currentRequestCount++;
 if(currentRequestMode==='failure')throw new Error('503 CITY_TAX_UNAVAILABLE');
 if(currentRequestMode==='pending')return new Promise(currentResolveRequest=>{completePendingRequest=currentResolveRequest;});
 if(currentRequestMode==='invalid')return {...currentTaxFixture,refreshHour:0};
 return currentTaxFixture;
}};
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,120));
function verifyTaxCondition(currentConditionValue:unknown,currentAssertionLabel:string){if(!currentConditionValue)throw new Error(currentAssertionLabel);currentAssertionLabels.push(currentAssertionLabel);}
function renderTaxFixture(){render(<main class="lobby field-menu-page"><section class="card"><CityTaxPanel gameSessionClient={currentFixtureClient as unknown as Client}/></section></main>,document.getElementById('root')!);}
function clickRefreshButton(){document.querySelector<HTMLButtonElement>('button')!.click();}
(async()=>{try{
 setLocale(location.hash.startsWith('#en')?'en':'ko');renderTaxFixture();await waitRenderCycle();
 document.querySelector('summary')!.click();await waitRenderCycle();
 verifyTaxCondition(currentRequestCount===0,'펼치기만으로 조회하지 않음');
 clickRefreshButton();await waitRenderCycle();
 verifyTaxCondition(document.querySelector('[role="alert"]')?.textContent?.includes('CITY_TAX_UNAVAILABLE'),'실패 표시');
 currentRequestMode='pending';clickRefreshButton();clickRefreshButton();await waitRenderCycle();
 verifyTaxCondition(currentRequestCount===2&&document.querySelector<HTMLButtonElement>('button')!.disabled,'대기 중 중복 클릭 차단');
 completePendingRequest!(currentTaxFixture);await waitRenderCycle();
 verifyTaxCondition(document.body.textContent?.includes('3.33%')&&document.body.textContent.includes('04:00'),'세율과 한국 시각 표시');
 verifyTaxCondition(!document.querySelector('img')&&document.body.textContent?.includes('<img src=x>'),'도시 이름 HTML 비실행');
 verifyTaxCondition(!document.querySelector('[role="alert"]'),'재시도 성공 시 오류 제거');
 setLocale(getLocale()==='ko'?'en':'ko');await waitRenderCycle();
 verifyTaxCondition(document.querySelector('summary')?.textContent===t('taxes.title')&&currentRequestCount===2,'언어 변경과 요청 수 유지');
 currentRequestMode='invalid';clickRefreshButton();await waitRenderCycle();
 verifyTaxCondition(document.body.textContent?.includes(t('taxes.invalid'))&&!document.querySelector('li'),'잘못된 응답 거절과 이전 결과 제거');
 currentRequestMode='pending';clickRefreshButton();await waitRenderCycle();render(null,document.getElementById('root')!);
 completePendingRequest!(currentTaxFixture);await waitRenderCycle();
 verifyTaxCondition(!document.querySelector('.city-tax-panel'),'화면 종료 후 늦은 응답 무시');
 currentRequestMode='success';renderTaxFixture();await waitRenderCycle();document.querySelector('summary')!.click();clickRefreshButton();await waitRenderCycle();
 verifyTaxCondition(document.documentElement.scrollWidth<=window.innerWidth,'가로 넘침 없음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionLabels});
}catch(currentFailureError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailureError),assertions:currentAssertionLabels});}})();
