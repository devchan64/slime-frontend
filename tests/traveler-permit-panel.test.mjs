import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/ui/TravelerPermitPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'permit-panel-hooks',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportValue=>({path:currentImportValue.path,namespace:'permit-panel-test'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'permit-panel-test'},currentImportValue=>({loader:'js',contents:currentImportValue.path==='preact/hooks'?`
    export const useState=value=>globalThis.permitPanelHarness.useState(value);
    export const useRef=value=>globalThis.permitPanelHarness.useRef(value);
    export const useEffect=callback=>globalThis.permitPanelHarness.useEffect(callback);
  `:`export const useTranslation=()=>({t:key=>key,locale:'ko'});`}));
}}]});
const {TravelerPermitPanel}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
const currentGuardDefinition={id:'guard-one',cityId:'iseulon',mapId:'moss-clearing',connectionId:'gate-one',name:'경비센터',position:{column:31,row:16}};
function findPanelButton(currentTreeNode,currentButtonLabel){
  if(!currentTreeNode||typeof currentTreeNode!=='object')return null;
  if(currentTreeNode.type==='button'&&currentTreeNode.props.children===currentButtonLabel)return currentTreeNode;
  for(const currentChildNode of [currentTreeNode.props?.children].flat(Infinity)){const currentButtonNode=findPanelButton(currentChildNode,currentButtonLabel);if(currentButtonNode)return currentButtonNode;}
  return null;
}
async function inspectPermitPanelSession(currentSessionMutation){
  const currentHookValues=[];const currentEffectCallbacks=[];let currentHookIndex=0;let currentStateWrites=0;let currentRequestCount=0;let resolvePendingRequest;
  const previousHarnessValue=globalThis.permitPanelHarness;
  globalThis.permitPanelHarness={useState(currentInitialValue){currentHookIndex++;return [currentInitialValue,()=>{currentStateWrites++;}];},useRef(currentInitialValue){const currentHookSlot=currentHookIndex++;return currentHookValues[currentHookSlot]={current:currentInitialValue};},useEffect(currentCallbackValue){currentEffectCallbacks.push(currentCallbackValue);}};
  const currentSessionClient={tokens:{user_id:'account'},state:{generation:1,epoch:1,location:{id:'source-channel'},me:{id:'owner',version:1,mode:'FIELD',battleId:null,position:{column:31,row:16}},map:{id:'moss-clearing'}},request:()=>{currentRequestCount++;return new Promise(currentResolveValue=>{resolvePendingRequest=currentResolveValue;});}};
  try{
    const currentPanelTree=TravelerPermitPanel({gameSessionClient:currentSessionClient,currentGuardDefinition,actionsAreDisabled:false});
    const currentCleanupCallbacks=currentEffectCallbacks.map(currentCallbackValue=>currentCallbackValue());
    const currentQuoteButton=findPanelButton(currentPanelTree,'citizenship.permitPrice');
    currentQuoteButton.props.onClick();currentQuoteButton.props.onClick();assert.equal(currentRequestCount,1);
    const previousStateWrites=currentStateWrites;
    currentSessionMutation(currentSessionClient,currentCleanupCallbacks);
    currentQuoteButton.props.onClick();assert.equal(currentRequestCount,1);
    resolvePendingRequest({guardCenterId:'guard-one',cityId:'iseulon',priceP:5,validitySeconds:604800,policyVersion:1,serverTime:100,expiresAt:160});
    await new Promise(currentResolveValue=>setImmediate(currentResolveValue));
    return currentStateWrites-previousStateWrites;
  }finally{globalThis.permitPanelHarness=previousHarnessValue;}
}
test('발급 창구의 중복 클릭과 계정·캐릭터·채널·위치·전투·화면 종료 뒤 늦은 응답을 차단한다',async()=>{
  for(const currentSessionMutation of [
    currentSessionClient=>{currentSessionClient.tokens.user_id='another';},
    currentSessionClient=>{currentSessionClient.state.generation++;},
    currentSessionClient=>{currentSessionClient.state.epoch++;},
    currentSessionClient=>{currentSessionClient.state.location.id='other-channel';},
    currentSessionClient=>{currentSessionClient.state.me.id='another';},
    currentSessionClient=>{currentSessionClient.state.me.position={column:1,row:1};},
    currentSessionClient=>{currentSessionClient.state.me.battleId='battle';},
    (_,currentCleanupCallbacks)=>{currentCleanupCallbacks.forEach(currentCallbackValue=>currentCallbackValue?.());},
  ])assert.equal(await inspectPermitPanelSession(currentSessionMutation),0);
  assert.ok(await inspectPermitPanelSession(()=>{})>0);
});
