import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/ui/ParcelPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'parcel-panel-hooks',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportValue=>({path:currentImportValue.path,namespace:'parcel-panel-test'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'parcel-panel-test'},currentImportValue=>({loader:'js',contents:currentImportValue.path==='preact/hooks'?`
    export const useState=value=>globalThis.parcelPanelHarness.useState(value);
    export const useRef=value=>globalThis.parcelPanelHarness.useRef(value);
    export const useEffect=callback=>globalThis.parcelPanelHarness.useEffect(callback);
  `:`export const useTranslation=()=>({t:key=>key,locale:'ko'});`}));
}}]});
const {ParcelPanel}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function findPanelButton(currentTreeNode,currentButtonLabel){
  if(!currentTreeNode||typeof currentTreeNode!=='object')return null;
  if(currentTreeNode.type==='button'&&currentTreeNode.props.children===currentButtonLabel)return currentTreeNode;
  for(const currentChildNode of [currentTreeNode.props?.children].flat(Infinity)){const currentButtonNode=findPanelButton(currentChildNode,currentButtonLabel);if(currentButtonNode)return currentButtonNode;}
  return null;
}
async function inspectParcelPanelSession(currentSessionMutation){
  const currentHookValues=[];const currentEffectCallbacks=[];let currentHookIndex=0;let currentStateWrites=0;let currentRequestCount=0;let resolvePendingRequest;
  const previousHarnessValue=globalThis.parcelPanelHarness;
  globalThis.parcelPanelHarness={useState(currentInitialValue){currentHookIndex++;return [currentInitialValue,()=>{currentStateWrites++;}];},useRef(currentInitialValue){const currentHookSlot=currentHookIndex++;return currentHookValues[currentHookSlot]={current:currentInitialValue};},useEffect(currentCallbackValue){currentEffectCallbacks.push(currentCallbackValue);}};
  const currentSessionClient={tokens:{user_id:'account'},state:{generation:1,epoch:1,location:{id:'source-channel'},me:{id:'owner',version:1,mode:'FIELD',battleId:null,position:{column:31,row:16}},map:{id:'moss-clearing'}},request:()=>{currentRequestCount++;return new Promise(currentResolveValue=>{resolvePendingRequest=currentResolveValue;});}};
  try{
    const currentPanelTree=ParcelPanel({gameSessionClient:currentSessionClient,actionsAreDisabled:false});
    const currentCleanupCallbacks=currentEffectCallbacks.map(currentCallbackValue=>currentCallbackValue());
    const currentQuoteButton=findPanelButton(currentPanelTree,'parcels.refresh');
    currentQuoteButton.props.onClick();currentQuoteButton.props.onClick();assert.equal(currentRequestCount,1);
    const previousStateWrites=currentStateWrites;
    currentSessionMutation(currentSessionClient,currentCleanupCallbacks);
    currentQuoteButton.props.onClick();assert.equal(currentRequestCount,1);
    resolvePendingRequest({characterVersion:1,serverTime:100,nextCursor:null,entries:[]});
    await new Promise(currentResolveValue=>setImmediate(currentResolveValue));
    return currentStateWrites-previousStateWrites;
  }finally{globalThis.parcelPanelHarness=previousHarnessValue;}
}

test('계정 소포 목록은 계정·캐릭터·세대 변경에서 폐기하고 이동·조우 중에는 유지한다',async()=>{
  for(const currentSessionMutation of [
    currentSessionClient=>{currentSessionClient.tokens.user_id='other';},
    currentSessionClient=>{currentSessionClient.state.generation++;},
    currentSessionClient=>{currentSessionClient.state.me.id='other';},
    (_,currentCleanupCallbacks)=>{currentCleanupCallbacks.forEach(currentCallbackValue=>currentCallbackValue?.());},
  ])assert.equal(await inspectParcelPanelSession(currentSessionMutation),0);
  for(const currentSessionMutation of [()=>{},
    currentSessionClient=>{currentSessionClient.state.epoch++;},
    currentSessionClient=>{currentSessionClient.state.me.position.column++;},
    currentSessionClient=>{currentSessionClient.state.map.id='other';},
    currentSessionClient=>{currentSessionClient.state.location.id='other';},
    currentSessionClient=>{currentSessionClient.state.reservation={id:'reservation'};},
    currentSessionClient=>{currentSessionClient.state.battle={id:'battle'};},
    currentSessionClient=>{currentSessionClient.state.me.mode='MENU';},
  ])assert.ok(await inspectParcelPanelSession(currentSessionMutation)>0);
});
