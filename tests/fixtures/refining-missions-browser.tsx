import {render} from 'preact';
import {RefiningMissionPanel} from '../../src/ui/RefiningMissionPanel';
import {setLocale,t} from '../../src/i18n';
const currentRootElement=document.getElementById('root')!;
const currentAssertions:string[]=[];
const currentRequestRecords:any[]=[];
function assertMissionBrowser(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);currentAssertions.push(currentMessage);}
const settleMissionRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,250));
function findMissionButton(currentLocaleKey:string){const currentButtonElement=[...document.querySelectorAll('button')].find(currentElement=>currentElement.textContent===t(currentLocaleKey));if(!currentButtonElement)throw new Error(currentLocaleKey);return currentButtonElement;}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 const currentMissionRecord={characterId:'hero',requestId:'11111111-1111-4111-8111-111111111111',status:'ACTIVE',acceptedAt:100,quote:{definitionSnapshot:{missionId:'refine-hide',cityId:'iseulon',receiverNpcId:'merchant',collectionId:'hide',grade:'low',quantity:2,rewardP:10},deposit:{depositP:96},rewardP:10,refining:{collectionId:'hide',inputQuantity:6,outputQuantity:2,grade:'low',costP:12,durationSeconds:60,outputMaterial:{name:'가죽',englishName:'Leather'}}}};
 let currentRequestCount=0;
 const currentGameClient:any={tokens:{user_id:'owner'},state:{generation:1,me:{id:'hero',version:4,mode:'FIELD'}},accept(currentAcceptedState:any){this.state=currentAcceptedState;},async request(currentRequestPath:string,currentRequestBody:any){
  if(!currentRequestBody)return {characterVersion:4,serverTime:110,nextOffset:null,entries:[structuredClone(currentMissionRecord)]};
  currentRequestRecords.push({path:currentRequestPath,body:structuredClone(currentRequestBody)});
  if(++currentRequestCount===1)throw new TypeError('응답 유실');
  return {receipt:{...structuredClone(currentMissionRecord),status:'CANCELLED',cancelledAt:120},state:{generation:1,me:{id:'hero',version:5,mode:'FIELD'}}};
 }};
 const renderMissionPanel=()=>render(<RefiningMissionPanel gameSessionClient={currentGameClient} actionsAreDisabled={false} characterStateVersion={currentGameClient.state.me.version}/>,currentRootElement);
 renderMissionPanel();await settleMissionRender();
 assertMissionBrowser(document.body.textContent!.includes(t('missions.payment',{deposit:96,cost:12,reward:10})),'담보·비용·보수 표시');
 assertMissionBrowser(document.body.textContent!.includes(t('missions.noRefund')),'무환불 안내 표시');
 findMissionButton('missions.cancel').click();await settleMissionRender();
 assertMissionBrowser(currentRequestRecords.length===0,'취소 선택만으로 서버 변경 없음');
 findMissionButton('missions.keep').click();await settleMissionRender();
 assertMissionBrowser(!document.querySelector('[role="group"]'),'임무 유지 시 확인창 닫힘');
 currentGameClient.state.me.version=5;renderMissionPanel();await settleMissionRender();
 assertMissionBrowser(findMissionButton('missions.cancel').disabled,'상태 변경 후 오래된 목록 취소 차단');
 currentGameClient.state.me.version=4;renderMissionPanel();await settleMissionRender();
 findMissionButton('missions.cancel').click();await settleMissionRender();
 findMissionButton('missions.confirm').click();findMissionButton('missions.confirm').click();await settleMissionRender();
 assertMissionBrowser(currentRequestRecords.length===1,'확정 연속 클릭은 한 요청');
 assertMissionBrowser(findMissionButton('missions.refresh').disabled,'응답 유실 동안 목록 교체 차단');
 findMissionButton('missions.retry').click();await settleMissionRender();
 assertMissionBrowser(currentRequestRecords.length===2&&JSON.stringify(currentRequestRecords[0])===JSON.stringify(currentRequestRecords[1]),'동일 경로와 본문으로 재시도');
 assertMissionBrowser(currentGameClient.state.me.version===5&&document.body.textContent!.includes(t('missions.cancelled')),'영수증 검증 후 상태 반영');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertions});
}catch(currentFailure){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailure),assertions:currentAssertions});}})();
