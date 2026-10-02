import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/ui/GuildTradePanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'guild-panel-hooks',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/\.css$/},currentImportValue=>({path:currentImportValue.path,namespace:'guild-css-test'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'guild-css-test'},()=>({contents:'',loader:'js'}));
  currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportValue=>({path:currentImportValue.path,namespace:'guild-panel-test'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'guild-panel-test'},currentImportValue=>({loader:'js',contents:currentImportValue.path==='preact/hooks'?`
    export const useState=value=>globalThis.guildPanelHarness.useState(value);
    export const useRef=value=>globalThis.guildPanelHarness.useRef(value);
    export const useEffect=callback=>globalThis.guildPanelHarness.useEffect(callback);
  `:`export const useTranslation=()=>({t:key=>key,locale:'ko'});`}));
}}]});
const {GuildTradePanel}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function findPanelButton(currentTreeNode,currentButtonLabel){
  if(!currentTreeNode||typeof currentTreeNode!=='object')return null;
  if(currentTreeNode.type==='button'&&currentTreeNode.props.children===currentButtonLabel)return currentTreeNode;
  for(const currentChildNode of [currentTreeNode.props?.children].flat(Infinity)){const currentButtonNode=findPanelButton(currentChildNode,currentButtonLabel);if(currentButtonNode)return currentButtonNode;}
  return null;
}
async function inspectGuildPanelSession(currentSessionMutation){
  const currentHookValues=[];const currentEffectCallbacks=[];let currentHookIndex=0;let currentStateWrites=0;let currentRequestCount=0;let resolvePendingRequest;
  const previousHarnessValue=globalThis.guildPanelHarness;
  globalThis.guildPanelHarness={useState(currentInitialValue){currentHookIndex++;return [currentInitialValue,()=>{currentStateWrites++;}];},useRef(currentInitialValue){const currentHookSlot=currentHookIndex++;return currentHookValues[currentHookSlot]={current:currentInitialValue};},useEffect(currentCallbackValue){currentEffectCallbacks.push(currentCallbackValue);}};
  const currentSessionClient={tokens:{user_id:'account'},state:{generation:1,epoch:1,location:{id:'source-channel'},me:{id:'owner',version:1,mode:'FIELD',battleId:null,position:{column:31,row:16}},map:{id:'moss-clearing'}},request:()=>{currentRequestCount++;return new Promise(currentResolveValue=>{resolvePendingRequest=currentResolveValue;});}};
  try{
    const currentPanelTree=GuildTradePanel({gameSessionClient:currentSessionClient,currentFacilityIdentifier:'iseulon-guild',actionsAreDisabled:false});
    const currentCleanupCallbacks=currentEffectCallbacks.map(currentCallbackValue=>currentCallbackValue());
    const currentQuoteButton=findPanelButton(currentPanelTree,'guild.title');
    currentQuoteButton.props.onClick();currentQuoteButton.props.onClick();assert.equal(currentRequestCount,1);
    currentSessionMutation(currentSessionClient,currentCleanupCallbacks);
    currentQuoteButton.props.onClick();assert.equal(currentRequestCount,1);
    const previousStateWrites=currentStateWrites;
    resolvePendingRequest({characterVersion:1,policyVersion:1,maximumQuantity:100,items:[]});
    await new Promise(currentResolveValue=>setImmediate(currentResolveValue));
    return currentStateWrites-previousStateWrites;
  }finally{globalThis.guildPanelHarness=previousHarnessValue;}
}
test('길드 판매창의 중복 조회와 세션·맵·조우 변경 뒤 늦은 목록 반영을 차단한다',async()=>{
  for(const currentSessionMutation of [
    currentSessionClient=>{currentSessionClient.tokens.user_id='another';},
    currentSessionClient=>{currentSessionClient.state.generation++;},
    currentSessionClient=>{currentSessionClient.state.epoch++;},
    currentSessionClient=>{currentSessionClient.state.map.id='other-map';},
    currentSessionClient=>{currentSessionClient.state.reservation={id:'reserved'};},
    currentSessionClient=>{currentSessionClient.state.battle={id:'battle'};},
    currentSessionClient=>{currentSessionClient.state.location.id='other-channel';},
    currentSessionClient=>{currentSessionClient.state.me.id='another';},
    currentSessionClient=>{currentSessionClient.state.me.position={column:1,row:1};},
    currentSessionClient=>{currentSessionClient.state.me.battleId='battle';},
    (_,currentCleanupCallbacks)=>{currentCleanupCallbacks.forEach(currentCallbackValue=>currentCallbackValue?.());},
  ])assert.equal(await inspectGuildPanelSession(currentSessionMutation),0);
  assert.ok(await inspectGuildPanelSession(()=>{})>0);
});
