import {render} from 'preact';
import {ChannelPanel} from '../../src/ui/ChannelPanel';
import {WorldDrawer} from '../../src/ui/WorldDrawer';
import {ApiError} from '../../src/client/response';
import type {Client} from '../../src/client/api';
import type {State} from '../../src/client/types';
import {t,setLocale} from '../../src/i18n';

const currentAssertionLabels:string[]=[];
const currentCommandRecords:Array<{path:string;body:unknown}>=[];
const currentTransferFlags:boolean[]=[];
const currentInitialState={protocolVersion:1,generation:1,epoch:2,cursor:1,serverTime:100,channel:{id:'meadow',address:'a1',mapDefinitionId:'meadow'},
  location:{id:'map:meadow',kind:'FIELD',mapId:'meadow',chatRoomId:'map:meadow',roomReady:true},map:{id:'meadow'},
  me:{id:'hero',mode:'FIELD',battleId:null,partyId:null,hp:10,fp:10,version:1},battle:null,reservation:null} as State;
const currentChannelRecords=[
  {id:'meadow',address:'a1',mapDefinitionId:'meadow',status:'OPEN',onlineUsers:2,reservedSeats:2,capacity:30},
  {id:'channel-'+'x'.repeat(85),address:'aa22',mapDefinitionId:'meadow',status:'OPEN',onlineUsers:3,reservedSeats:4,capacity:30},
  {id:'full',address:'ba234',mapDefinitionId:'meadow',status:'OPEN',onlineUsers:29,reservedSeats:30,capacity:30},
  {id:'closed',address:'z9',mapDefinitionId:'meadow',status:'DRAINING',onlineUsers:0,reservedSeats:0,capacity:30},
  {id:'city',address:'b3',mapDefinitionId:'iseulon',status:'OPEN',onlineUsers:0,reservedSeats:0,capacity:30},
];
let currentPanelRevision=0;
let currentRequestHandler:((currentRequestPath:string)=>Promise<unknown>)|null=null;
let currentCommandHandler:((currentCommandBody:unknown)=>Promise<unknown>)|null=null;
const currentFixtureClient={tokens:{user_id:'owner'},state:structuredClone(currentInitialState),
  async request(currentRequestPath:string){return currentRequestHandler ? currentRequestHandler(currentRequestPath) : currentRequestPath==='/v1/game/state' ? structuredClone(this.state) : structuredClone(currentChannelRecords);},
  async command(currentCommandPath:string,currentCommandBody:unknown){currentCommandRecords.push({path:currentCommandPath,body:currentCommandBody});return currentCommandHandler ? currentCommandHandler(currentCommandBody) : {state:this.state};},
  accept(currentReceivedState:State){this.state=currentReceivedState;renderCurrentPanel();},
};
function renderCurrentPanel(){render(<WorldDrawer title={t('channels.title')} onClose={()=>{}}><ChannelPanel key={currentPanelRevision} gameSessionClient={currentFixtureClient as unknown as Client}
  currentGameState={currentFixtureClient.state} actionsAreDisabled={false} onChannelTransferChange={currentPendingFlag=>currentTransferFlags.push(currentPendingFlag)}/></WorldDrawer>,document.getElementById('root')!);}
function verifyCurrentCondition(currentConditionValue:unknown,currentAssertionLabel:string){if(!currentConditionValue)throw new Error(currentAssertionLabel);currentAssertionLabels.push(currentAssertionLabel);}
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,80));
const findNamedButton=(currentButtonText:string)=>[...document.querySelectorAll('button')].find(currentButtonElement=>currentButtonElement.textContent===currentButtonText)!;
const findChannelButton=(currentChannelAddress:string)=>document.querySelector<HTMLButtonElement>(`[data-channel-address="${currentChannelAddress}"] button`)!;
async function enterChannelAddress(currentAddressText:string){const currentInputElement=document.querySelector<HTMLInputElement>('#channel-address-input')!;currentInputElement.value=currentAddressText;currentInputElement.dispatchEvent(new Event('input',{bubbles:true}));await waitRenderCycle();}

(async()=>{try{
  setLocale(location.hash==='#en'?'en':'ko');renderCurrentPanel();await waitRenderCycle();await waitRenderCycle();
  verifyCurrentCondition(document.querySelector('dialog[open]'),'채널 대화상자 열림');
  verifyCurrentCondition(document.querySelectorAll('[data-channel-address]').length===4,'같은 맵의 채널만 표시');
  verifyCurrentCondition(findChannelButton('a1').disabled && findChannelButton('ba234').disabled && findChannelButton('z9').disabled,'현재·만석·입장 중지 채널 비활성');
  verifyCurrentCondition(document.body.textContent!.includes(t('channels.population',{used:30,capacity:30,online:29})),'접속과 전투 예약 좌석 구분');
  verifyCurrentCondition(document.body.textContent!.includes(t('channels.full')),'만석 해결 안내');
  await enterChannelAddress('AA00022');
  verifyCurrentCondition(!findNamedButton(t('channels.joinAddress')).disabled,'대소문자·선행 0 주소 허용');
  findNamedButton(t('channels.joinAddress')).click();await waitRenderCycle();
  verifyCurrentCondition(JSON.stringify(currentCommandRecords[0])===JSON.stringify({path:'/v1/channels/joins',body:{address:'aa22'}}),'정규 주소를 공통 명령 클라이언트로 전송');
  let rejectPendingCommand:(currentError:Error)=>void=()=>{};
  currentCommandHandler=()=>new Promise((_,currentRejectHandler)=>{rejectPendingCommand=currentRejectHandler;});
  const currentJoinButton=findChannelButton('aa22');currentJoinButton.click();currentJoinButton.click();await waitRenderCycle();
  verifyCurrentCondition(currentCommandRecords.length===2,'동일 프레임 중복 클릭 방지');
  verifyCurrentCondition(findChannelButton('aa22').disabled,'요청 중 추가 이동 금지');
  rejectPendingCommand(new Error('연결 결과 불명'));await waitRenderCycle();
  verifyCurrentCondition(document.body.textContent!.includes(t('channels.uncertain')) && findChannelButton('aa22').disabled,'불명확한 결과는 상태 확인 전 이동 금지');
  findNamedButton(t('channels.checkState')).click();await waitRenderCycle();await waitRenderCycle();
  verifyCurrentCondition(!findChannelButton('aa22').disabled,'상태와 목록 재조회 후 이동 재개');
  currentCommandHandler=async()=>{throw new ApiError('CHANNEL_FULL','full',409,{ko:'경합으로 만석입니다.',en:'Channel filled during transfer.'});};
  findChannelButton('aa22').click();await waitRenderCycle();
  verifyCurrentCondition(document.querySelector('[role="alert"]')?.textContent===(location.hash==='#en'?'Channel filled during transfer.':'경합으로 만석입니다.'),'서버의 만석 경합 오류를 선택 언어로 표시');
  verifyCurrentCondition(!document.body.textContent!.includes(t('channels.uncertain')),'확정 거절은 결과 불명과 구분');
  currentRequestHandler=async()=>currentChannelRecords.map(currentChannelEntry=>currentChannelEntry.address==='aa22'
    ? {...currentChannelEntry,onlineUsers:30,reservedSeats:30}:structuredClone(currentChannelEntry));
  findNamedButton(t('channels.refresh')).click();await waitRenderCycle();
  verifyCurrentCondition(findChannelButton('aa22').disabled && findNamedButton(t('channels.joinAddress')).disabled,'만석 경합 후 갱신한 목록과 주소 입력 모두 이동 차단');
  verifyCurrentCondition(document.querySelector('[data-channel-address="aa22"]')?.textContent?.includes(t('channels.population',{used:30,capacity:30,online:30})),'갱신한 서버 정원 표시');
  const currentCommandsBeforeRefresh=currentCommandRecords.length;
  currentRequestHandler=null;
  findNamedButton(t('channels.refresh')).click();await waitRenderCycle();
  verifyCurrentCondition(!findChannelButton('aa22').disabled && !findNamedButton(t('channels.joinAddress')).disabled,'좌석이 빈 새 목록에서는 목록과 주소 이동 재개');
  verifyCurrentCondition(currentCommandRecords.length===currentCommandsBeforeRefresh,'목록 갱신만으로 이동 명령을 자동 재전송하지 않음');
  currentFixtureClient.state={...currentFixtureClient.state,me:{...currentFixtureClient.state.me,partyId:'party'}};renderCurrentPanel();await waitRenderCycle();
  verifyCurrentCondition(findChannelButton('aa22').disabled && document.body.textContent!.includes(t('channels.leaveParty')),'파티 탈퇴 안내');
  currentFixtureClient.state=structuredClone(currentInitialState);currentPanelRevision++;
  let resolvePendingListing:(currentValue:unknown)=>void=()=>{};
  currentRequestHandler=()=>new Promise(currentResolveHandler=>{resolvePendingListing=currentResolveHandler;});
  renderCurrentPanel();await waitRenderCycle();currentFixtureClient.tokens.user_id='other-owner';resolvePendingListing(currentChannelRecords);await waitRenderCycle();
  verifyCurrentCondition(!document.querySelector('[data-channel-address]'),'계정 교체 뒤 늦은 목록 응답 무시');
  currentFixtureClient.tokens.user_id='owner';currentRequestHandler=null;currentCommandHandler=null;currentPanelRevision++;renderCurrentPanel();await waitRenderCycle();await waitRenderCycle();
  await enterChannelAddress('a0');verifyCurrentCondition(findNamedButton(t('channels.joinAddress')).disabled && document.body.textContent!.includes(t('channels.invalidAddress')),'잘못된 주소 형식 안내');
  await enterChannelAddress('b3');verifyCurrentCondition(findNamedButton(t('channels.joinAddress')).disabled && document.body.textContent!.includes(t('channels.differentMap')),'다른 맵 주소는 웨이포인트 안내');
  await enterChannelAddress('');
  const currentDialogElement=document.querySelector('dialog')!;
  verifyCurrentCondition(currentDialogElement.scrollWidth<=currentDialogElement.clientWidth,'모바일 긴 채널 ID 가로 넘침 없음');
  verifyCurrentCondition(currentTransferFlags.join(',')==='true,false,true,false,true,false','전송 종료·실패 시 전환 잠금 해제');
  currentRequestHandler=async()=>Array.from({length:21},(_,currentEntryIndex)=>({...currentChannelRecords[0],id:`page-${currentEntryIndex}`,address:`a${currentEntryIndex+1}`}));
  findNamedButton(t('channels.refresh')).click();await waitRenderCycle();
  verifyCurrentCondition(document.querySelectorAll('[data-channel-address]').length===10,'채널 첫 페이지 10개');
  findNamedButton(t('channels.nextPage')).click();await waitRenderCycle();
  verifyCurrentCondition(!!document.querySelector('[data-channel-address="a11"]')&&!document.querySelector('[data-channel-address="a1"]'),'채널 다음 페이지 교체');
  findNamedButton(t('channels.nextPage')).click();await waitRenderCycle();
  verifyCurrentCondition(document.querySelectorAll('[data-channel-address]').length===1&&findNamedButton(t('channels.nextPage')).disabled,'채널 마지막 페이지와 다음 버튼 차단');
  findNamedButton(t('channels.previousPage')).click();await waitRenderCycle();
  verifyCurrentCondition(!!document.querySelector('[data-channel-address="a11"]'),'채널 이전 페이지 복귀');
  findNamedButton(t('channels.refresh')).click();await waitRenderCycle();
  verifyCurrentCondition(!!document.querySelector('[data-channel-address="a11"]'),'채널 새로고침 현재 페이지 유지');
  currentRequestHandler=async()=>[currentChannelRecords[0]];
  findNamedButton(t('channels.refresh')).click();await waitRenderCycle();
  verifyCurrentCondition(document.querySelectorAll('[data-channel-address]').length===1&&!document.querySelector('.record-page-navigation'),'채널 감소 시 유효 페이지로 이동');
  currentRequestHandler=async()=>Array.from({length:21},(_,currentEntryIndex)=>({...currentChannelRecords[0],id:`page-${currentEntryIndex}`,address:`a${currentEntryIndex+1}`}));
  findNamedButton(t('channels.refresh')).click();await waitRenderCycle();
  verifyCurrentCondition(!!document.querySelector('[data-channel-address="a1"]')&&findNamedButton(t('channels.previousPage')).disabled,'목록 재증가 시 이전의 무효 페이지로 돌아가지 않음');
  document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionLabels,commands:currentCommandRecords});
}catch(currentFailureError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailureError),stack:(currentFailureError as Error).stack,assertions:currentAssertionLabels});}})();
