import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/ui/AccountRewardsPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'reward-panel-hooks',setup(buildContextValue){
  buildContextValue.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},importPathData=>({path:importPathData.path,namespace:'reward-test-hooks'}));
  buildContextValue.onLoad({filter:/.*/,namespace:'reward-test-hooks'},importPathData=>({contents:importPathData.path==='preact/hooks'?`
    export const useState=(initialValue)=>globalThis.rewardPanelHarness.useState(initialValue);
    export const useRef=(initialValue)=>globalThis.rewardPanelHarness.useRef(initialValue);
    export const useEffect=(callback)=>globalThis.rewardPanelHarness.useEffect(callback);
  `:`export const useTranslation=()=>({t:(messageKey)=>messageKey,locale:'ko'});`,loader:'js'}));
}}]});
const {AccountRewardsPanel}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function createPanelHarness(gameSessionClient){
  const savedHookValues=[];const queuedEffectCalls=[];const effectCleanupCalls=[];let currentHookIndex=0;
  const previousPanelHarness=globalThis.rewardPanelHarness;
  globalThis.rewardPanelHarness={
    useState(initialHookValue){const savedHookIndex=currentHookIndex++;if(!(savedHookIndex in savedHookValues))savedHookValues[savedHookIndex]=initialHookValue;return [savedHookValues[savedHookIndex],updatedHookValue=>{savedHookValues[savedHookIndex]=typeof updatedHookValue==='function'?updatedHookValue(savedHookValues[savedHookIndex]):updatedHookValue;}];},
    useRef(initialHookValue){const savedHookIndex=currentHookIndex++;return savedHookValues[savedHookIndex]??=( {current:initialHookValue});},
    useEffect(effectCallbackValue){const savedHookIndex=currentHookIndex++;if(!savedHookValues[savedHookIndex]){savedHookValues[savedHookIndex]=true;queuedEffectCalls.push(effectCallbackValue);}}
  };
  return {
    renderRewardPanel(){currentHookIndex=0;const renderedRewardTree=AccountRewardsPanel({gameSessionClient,actionsAreDisabled:false});for(const effectCallbackValue of queuedEffectCalls.splice(0))effectCleanupCalls.push(effectCallbackValue());return renderedRewardTree;},
    closeRewardPanel(){for(const effectCleanupValue of effectCleanupCalls)effectCleanupValue?.();globalThis.rewardPanelHarness=previousPanelHarness;}
  };
}
function findRewardButtons(renderedRewardTree){
  if(Array.isArray(renderedRewardTree))return renderedRewardTree.flatMap(findRewardButtons);
  if(!renderedRewardTree||typeof renderedRewardTree!=='object')return [];
  return [...(renderedRewardTree.type==='button'?[renderedRewardTree]:[]),...findRewardButtons(renderedRewardTree.props?.children)];
}
const finishPendingPromises=()=>new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
function sampleRewardPage(expirationSecondsValue=1000){return {serverTime:100,nextCursor:null,entries:[{id:'reward-one',storedAt:50,expiresAt:expirationSecondsValue,materials:[{materialId:'jelly',quantity:3,nameTranslations:{ko:'젤리',en:'Jelly'}}]}]};}
test('보관함의 연속 수령 클릭은 한 번만 요청하며 성공 후 가방 상태를 갱신한다',async()=>{
  const observedRequestPaths=[];let finishClaimRequest;const receivedPlayerStates=[];
  const currentSessionClient={tokens:{user_id:'owner'},state:{generation:1},request:async requestPathValue=>{
    observedRequestPaths.push(requestPathValue);
    if(requestPathValue.endsWith('/claim'))return new Promise(resolveClaimRequest=>{finishClaimRequest=resolveClaimRequest;});
    return requestPathValue==='/v1/game/state'?{generation:1,me:{materials:{jelly:3}}}:sampleRewardPage();
  },accept:receivedPlayerState=>receivedPlayerStates.push(receivedPlayerState)};
  const currentPanelHarness=createPanelHarness(currentSessionClient);
  try{
    currentPanelHarness.renderRewardPanel();await finishPendingPromises();
    const claimRewardButton=findRewardButtons(currentPanelHarness.renderRewardPanel()).find(rewardButtonNode=>rewardButtonNode.props.children==='rewards.claim');
    claimRewardButton.props.onClick();claimRewardButton.props.onClick();
    assert.equal(observedRequestPaths.filter(requestPathValue=>requestPathValue.endsWith('/claim')).length,1);
    finishClaimRequest({status:'CLAIMED'});await finishPendingPromises();
    assert.equal(receivedPlayerStates.length,1);
    assert.equal(findRewardButtons(currentPanelHarness.renderRewardPanel()).some(rewardButtonNode=>rewardButtonNode.props.children==='rewards.claim'),false);
  }finally{currentPanelHarness.closeRewardPanel();}
});
test('만료된 보상은 수령 버튼을 잠근다',async()=>{
  const currentSessionClient={tokens:{user_id:'owner'},state:{generation:1},request:async()=>sampleRewardPage(100),accept:()=>assert.fail('만료 보상의 상태를 적용했습니다.')};
  const currentPanelHarness=createPanelHarness(currentSessionClient);
  try{
    currentPanelHarness.renderRewardPanel();await finishPendingPromises();
    const claimRewardButton=findRewardButtons(currentPanelHarness.renderRewardPanel()).find(rewardButtonNode=>rewardButtonNode.props.children==='rewards.claim');
    assert.equal(claimRewardButton.props.disabled,true);
  }finally{currentPanelHarness.closeRewardPanel();}
});

test('수령 요청 중 화면을 닫으면 늦은 응답으로 현재 세션을 갱신하지 않는다',async()=>{
  const observedRequestPaths=[];let finishClaimRequest;
  const currentSessionClient={tokens:{user_id:'owner'},state:{generation:1},request:async requestPathValue=>{
    observedRequestPaths.push(requestPathValue);
    if(requestPathValue.endsWith('/claim'))return new Promise(resolveClaimRequest=>{finishClaimRequest=resolveClaimRequest;});
    return sampleRewardPage();
  },accept:()=>assert.fail('닫힌 화면의 응답을 적용했습니다.')};
  const currentPanelHarness=createPanelHarness(currentSessionClient);
  currentPanelHarness.renderRewardPanel();await finishPendingPromises();
  const claimRewardButton=findRewardButtons(currentPanelHarness.renderRewardPanel()).find(rewardButtonNode=>rewardButtonNode.props.children==='rewards.claim');
  claimRewardButton.props.onClick();currentPanelHarness.closeRewardPanel();
  finishClaimRequest({status:'CLAIMED'});await finishPendingPromises();
  assert.equal(observedRequestPaths.includes('/v1/game/state'),false);
});

test('모두 수령은 추가 페이지를 펼치지 않고 전체 수령 API를 한 번 호출한다',async()=>{
  const observedRequestPaths=[];let finishClaimRequest;const receivedPlayerStates=[];
  const currentSessionClient={tokens:{user_id:'owner'},state:{generation:1},request:async requestPathValue=>{
    observedRequestPaths.push(requestPathValue);
    if(requestPathValue.endsWith('/claim-all'))return new Promise(resolveClaimRequest=>{finishClaimRequest=resolveClaimRequest;});
    return requestPathValue==='/v1/game/state'?{generation:1,me:{materials:{jelly:303}}}:{...sampleRewardPage(),nextCursor:'more-rewards'};
  },accept:receivedPlayerState=>receivedPlayerStates.push(receivedPlayerState)};
  const currentPanelHarness=createPanelHarness(currentSessionClient);
  try{
    currentPanelHarness.renderRewardPanel();await finishPendingPromises();
    const claimRewardButton=findRewardButtons(currentPanelHarness.renderRewardPanel()).find(rewardButtonNode=>rewardButtonNode.props.children==='rewards.claimAll');
    assert.equal(claimRewardButton.props.disabled,false);
    claimRewardButton.props.onClick();claimRewardButton.props.onClick();
    assert.equal(observedRequestPaths.filter(requestPathValue=>requestPathValue.endsWith('/claim-all')).length,1);
    finishClaimRequest({claimedCount:101,materials:[]});await finishPendingPromises();
    assert.equal(receivedPlayerStates.length,1);
    assert.equal(observedRequestPaths.filter(requestPathValue=>requestPathValue==='/v1/accounts/me/rewards').length,2);
    assert.equal(observedRequestPaths.some(requestPathValue=>requestPathValue.includes('?after=')),false);
  }finally{currentPanelHarness.closeRewardPanel();}
});
