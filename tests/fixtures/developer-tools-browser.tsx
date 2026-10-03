import {render} from 'preact';
import {DeveloperToolsPanel} from '../../src/ui/DeveloperToolsPanel';
import {ApiError} from '../../src/client/response';
import {t,setLocale} from '../../src/i18n';
const currentAssertionsList:string[]=[];
const waitForDeveloperRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
function assertDeveloperBrowserState(currentConditionValue:unknown,currentAssertionText:string){if(!currentConditionValue)throw new Error(currentAssertionText);currentAssertionsList.push(currentAssertionText);}
function clickDeveloperButton(currentMessageKey:string){
 const currentButtonElement=[...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t(currentMessageKey));
 assertDeveloperBrowserState(currentButtonElement&&!currentButtonElement.disabled,'사용 가능한 버튼: '+currentMessageKey);currentButtonElement!.click();
}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 let currentAccessDenied=true;
 let currentResponseLost=true;
 let currentStateReadLost=false;
 let currentPostRequestCount=0;
 let currentConfirmedReceipt:any=null;
 let currentConfirmedPayload:any=null;
 let currentConfirmationCount=0;
 const currentRequestPayloads:any[]=[];
 const currentClientStub:any={tokens:{user_id:'test'},state:{generation:1,me:{id:'test',name:'test',mode:'FIELD',version:1,cp:10,sp:2,coins:20}},
  accept(currentIncomingState:any){this.state=currentIncomingState;},
  async request(currentRequestPath:string,currentRequestPayload:any){
   if(currentRequestPath==='/v1/developer/capabilities'){
    if(currentAccessDenied)throw new ApiError('DEVELOPER_FORBIDDEN','권한 없음',403);
    return {accountId:'test',targetScope:'SELF',assets:['CP','SP','P']};
   }
   if(currentRequestPath==='/v1/developer/inventory')return {characterId:'test',version:currentConfirmedReceipt?2:1,balances:{CP:currentConfirmedReceipt?11:10,SP:2,P:20}};
   if(currentRequestPath==='/v1/developer/adjustments'&&!currentRequestPayload)return {characterId:'test',entries:currentConfirmedReceipt?[currentConfirmedReceipt]:[],nextCursor:null};
   if(currentRequestPath==='/v1/developer/adjustments'){
    currentPostRequestCount++;currentRequestPayloads.push(currentRequestPayload);
    if(!currentConfirmedReceipt){currentConfirmedPayload=currentRequestPayload;currentConfirmedReceipt={ok:true,...currentRequestPayload,actorId:'test',characterId:'test',before:10,after:11,version:2,createdAt:100};}
    else assertDeveloperBrowserState(JSON.stringify(currentRequestPayload)===JSON.stringify(currentConfirmedPayload),'재시도 요청 ID·내용 보존');
    if(currentResponseLost){currentResponseLost=false;throw new Error('응답 유실');}
    return currentConfirmedReceipt;
   }
   if(currentRequestPath==='/v1/game/state'){
    if(currentStateReadLost){currentStateReadLost=false;throw new Error('상태 조회 유실');}
    return {...this.state,me:{...this.state.me,version:2,cp:11}};
   }
   throw new Error('예상하지 않은 요청 '+currentRequestPath);
  }};
 const currentRootElement=document.getElementById('root')!;
 render(<DeveloperToolsPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,currentRootElement);await waitForDeveloperRender();
 assertDeveloperBrowserState(!document.querySelector('button'),'일반 계정 개발자 버튼 숨김');
 render(null,currentRootElement);currentAccessDenied=false;
 render(<DeveloperToolsPanel gameSessionClient={currentClientStub} actionsAreDisabled={false}/>,currentRootElement);await waitForDeveloperRender();
 clickDeveloperButton('app.developerTitle');await waitForDeveloperRender();
 assertDeveloperBrowserState(document.body.textContent!.includes('10 → 11'),'적용 전 잔고 미리보기');
 window.confirm=()=>{currentConfirmationCount++;return true;};
 clickDeveloperButton('app.developerApply');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentConfirmationCount===1,'변경 확인 한 번');
 assertDeveloperBrowserState(document.body.textContent!.includes(t('app.developerUncertain')),'응답 유실 안내');
 assertDeveloperBrowserState(document.querySelector('fieldset')!.disabled,'불명확한 요청 중 새 변경 금지');
 currentStateReadLost=true;clickDeveloperButton('app.developerRetry');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentPostRequestCount===2,'원 요청 재확인');
 clickDeveloperButton('app.developerRetry');await waitForDeveloperRender();
 assertDeveloperBrowserState(currentPostRequestCount===2,'확정 영수증 뒤 조회 실패는 변경 API 재호출 없음');
 assertDeveloperBrowserState(currentClientStub.state.me.cp===11,'최신 상태 반영');
 assertDeveloperBrowserState(document.querySelector('li')?.textContent?.includes('10 → 11'),'서버 변경 이력 표시');
 assertDeveloperBrowserState(!document.querySelector('fieldset')!.disabled,'성공 후 조작 복구');
 assertDeveloperBrowserState(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();
