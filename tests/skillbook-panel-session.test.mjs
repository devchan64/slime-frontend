import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/ui/SkillCardPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'skillbook-panel-hooks',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportValue=>({path:currentImportValue.path,namespace:'skillbook-panel-test'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'skillbook-panel-test'},currentImportValue=>({loader:'js',contents:currentImportValue.path==='preact/hooks'?`
    export const useState=value=>globalThis.skillbookPanelHarness.useState(value);
    export const useRef=value=>globalThis.skillbookPanelHarness.useRef(value);
    export const useEffect=callback=>globalThis.skillbookPanelHarness.useEffect(callback);
  `:`export const useTranslation=()=>({t:key=>key,locale:'ko'});`}));
}}]});
const {SkillCardPanel}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function findPanelButton(currentTreeNode,currentButtonLabel){
  if(!currentTreeNode||typeof currentTreeNode!=='object')return null;
  if(currentTreeNode.type==='button'&&currentTreeNode.props.children===currentButtonLabel)return currentTreeNode;
  for(const currentChildNode of [currentTreeNode.props?.children].flat(Infinity)){const currentButtonNode=findPanelButton(currentChildNode,currentButtonLabel);if(currentButtonNode)return currentButtonNode;}
  return null;
}
async function inspectBookPanelSession(currentSessionMutation,currentFacilityIdentifier){
  const currentHookValues=[];const currentEffectCallbacks=[];let currentHookIndex=0;let currentStateWrites=0;let currentRequestCount=0;let resolvePendingRequest;
  const previousHarnessValue=globalThis.skillbookPanelHarness;
  globalThis.skillbookPanelHarness={useState(currentInitialValue){currentHookIndex++;return [currentInitialValue,()=>{currentStateWrites++;}];},useRef(currentInitialValue){const currentHookSlot=currentHookIndex++;return currentHookValues[currentHookSlot]={current:currentInitialValue};},useEffect(currentCallbackValue){currentEffectCallbacks.push(currentCallbackValue);}};
  const currentSessionClient={tokens:{user_id:'account'},state:{generation:1,epoch:1,location:{id:'source-channel'},me:{id:'owner',version:1,mode:'FIELD',battleId:null,position:{column:31,row:16}},map:{id:'moss-clearing'}},request:()=>{currentRequestCount++;return new Promise(currentResolveValue=>{resolvePendingRequest=currentResolveValue;});}};
  try{
    const currentPanelTree=SkillCardPanel({gameSessionClient:currentSessionClient,currentFacilityIdentifier,actionsAreDisabled:false});
    const currentCleanupCallbacks=currentEffectCallbacks.map(currentCallbackValue=>currentCallbackValue());
    const currentQuoteButton=findPanelButton(currentPanelTree,'cards.refresh');
    currentQuoteButton.props.onClick();currentQuoteButton.props.onClick();assert.equal(currentRequestCount,1);
    const previousStateWrites=currentStateWrites;
    currentSessionMutation(currentSessionClient,currentCleanupCallbacks);
    currentQuoteButton.props.onClick();assert.equal(currentRequestCount,1);
    resolvePendingRequest({characterVersion:1,cards:[],catalog:[]});
    await new Promise(currentResolveValue=>setImmediate(currentResolveValue));
    return currentStateWrites-previousStateWrites;
  }finally{globalThis.skillbookPanelHarness=previousHarnessValue;}
}

for(const currentFacilityIdentifier of [undefined,'iseulon-bookshop'])test('카드 늦은 응답의 계정·세대 경계 '+(currentFacilityIdentifier??'bag'),async()=>{
  for(const currentSessionMutation of [
    currentSessionClient=>{currentSessionClient.tokens.user_id='other';},
    currentSessionClient=>{currentSessionClient.state.generation++;},
    currentSessionClient=>{currentSessionClient.state.epoch++;},
    currentSessionClient=>{currentSessionClient.state.me.id='other';},
    (_,currentCleanupCallbacks)=>{currentCleanupCallbacks.forEach(currentCallbackValue=>currentCallbackValue?.());},
  ])assert.equal(await inspectBookPanelSession(currentSessionMutation,currentFacilityIdentifier),0);
  assert.ok(await inspectBookPanelSession(()=>{},currentFacilityIdentifier)>0);
});
test('현장 이탈은 서점 목록만 무효화하고 보관함 목록에는 장소 제한을 추가하지 않는다',async()=>{
  for(const currentSessionMutation of [
    currentSessionClient=>{currentSessionClient.state.me.position.column++;},
    currentSessionClient=>{currentSessionClient.state.map.id='other';},
    currentSessionClient=>{currentSessionClient.state.location.id='other';},
    currentSessionClient=>{currentSessionClient.state.reservation={id:'reservation'};},
    currentSessionClient=>{currentSessionClient.state.battle={id:'battle'};},
  ]){
    assert.equal(await inspectBookPanelSession(currentSessionMutation,'iseulon-bookshop'),0);
    assert.ok(await inspectBookPanelSession(currentSessionMutation,undefined)>0);
  }
});
