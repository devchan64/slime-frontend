import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild = await build({entryPoints:['src/ui/BagPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{
  name:'bag-session-hooks',setup(currentBuildContext){
    currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportPath=>({path:currentImportPath.path,namespace:'bag-session-test'}));
    currentBuildContext.onLoad({filter:/.*/,namespace:'bag-session-test'},currentImportPath=>({loader:'js',contents:currentImportPath.path==='preact/hooks' ? `
      export const useState=(value)=>globalThis.bagSessionHarness.useState(value);
      export const useRef=(value)=>globalThis.bagSessionHarness.useRef(value);
      export const useEffect=(callback)=>globalThis.bagSessionHarness.useEffect(callback);
    ` : `export const useTranslation=()=>({t:key=>key,locale:'ko'});`}));
  }
}]});
const {BagPanel} = await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);

async function inspectDelayedBagResponse(changeCurrentSession, rejectedRequestValue, invokePreviousRefresh = false) {
  const savedHookValues=[];const queuedEffectCalls=[];const effectCleanupCalls=[];
  let currentConsumableCalls=0;let currentRequestCount=0;let currentHookIndex=0;let currentStateWrites=0;let completeCurrentRequest;let rejectCurrentRequest;
  const previousTestHarness=globalThis.bagSessionHarness;
  globalThis.bagSessionHarness={
    useState(initialHookValue){const currentHookSlot=currentHookIndex++;if(currentHookSlot===1 && invokePreviousRefresh==='consume') initialHookValue={items:[],nextCursor:null,bag:{items:[{id:'healing',kind:'consumable',nameTranslations:{ko:'회복약',en:'Potion'},quantity:1,weightG:1,valueP:null,useAction:{type:'RESTORE_HP',restorationHp:1,consumedOnSuccess:1}}],knownWeightG:1,capacityG:1000,unknownWeightQuantity:0}};savedHookValues[currentHookSlot]=initialHookValue;return [initialHookValue,updatedHookValue=>{currentStateWrites++;savedHookValues[currentHookSlot]=updatedHookValue;}];},
    useRef(initialHookValue){const currentHookSlot=currentHookIndex++;return savedHookValues[currentHookSlot]={current:initialHookValue};},
    useEffect(currentEffectCallback){queuedEffectCalls.push(currentEffectCallback);}
  };
  const currentCharacterState={id:'character-one',version:1,mode:'FIELD',hp:1,maxHp:10,fp:1};
  const currentSessionClient={tokens:{user_id:'owner-one'},state:{generation:1,me:currentCharacterState},
    request:()=>{currentRequestCount++;return new Promise((resolveCurrentRequest,rejectPendingRequest)=>{completeCurrentRequest=resolveCurrentRequest;rejectCurrentRequest=rejectPendingRequest;});}};
  try {
    const currentPanelTree=BagPanel({me:currentCharacterState,gameSessionClient:currentSessionClient,actionsAreDisabled:false,submitConsumableUse:()=>{currentConsumableCalls++;}});
    for(const currentEffectCallback of queuedEffectCalls) effectCleanupCalls.push(currentEffectCallback());
    const previousStateWrites=currentStateWrites;
    changeCurrentSession(currentSessionClient,effectCleanupCalls);
    if(invokePreviousRefresh) {
      if(invokePreviousRefresh==='consume') {
        function findConsumableButton(currentNodeValue) {
          if(!currentNodeValue || typeof currentNodeValue!=='object') return null;
          if(currentNodeValue.type==='button' && currentNodeValue.props.children==='app.useHealingItem') return currentNodeValue;
          for(const currentChildNode of [currentNodeValue.props?.children].flat(Infinity)) {
            const currentMatchedNode=findConsumableButton(currentChildNode);
            if(currentMatchedNode) return currentMatchedNode;
          }
          return null;
        }
        findConsumableButton(currentPanelTree).props.onClick();
        return currentConsumableCalls;
      }
      const previousRequestCount=currentRequestCount;
      currentPanelTree.props.children[0].props.onClick();
      return currentRequestCount-previousRequestCount;
    }
    if(rejectedRequestValue) rejectCurrentRequest(new Error('이전 세션 오류'));
    else completeCurrentRequest({serverTime:100,characterVersion:1,items:[],slots:{},knownEquipmentWeightG:0,nextCursor:null,
      bag:{items:[],capacityG:1000,knownWeightG:0,unknownWeightQuantity:0}});
    await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
    return currentStateWrites-previousStateWrites;
  } finally {
    for(const currentEffectCleanup of effectCleanupCalls) currentEffectCleanup?.();
    globalThis.bagSessionHarness=previousTestHarness;
  }
}

test('가방의 늦은 성공과 오류는 계정·세대·캐릭터 전환 및 화면 종료 후 반영하지 않는다',async()=>{
  const changeSessionCases=[
    currentSessionClient=>{currentSessionClient.tokens={user_id:'owner-two'};},
    currentSessionClient=>{currentSessionClient.state.generation++;},
    currentSessionClient=>{currentSessionClient.state.me={id:'character-two',version:1};},
    currentSessionClient=>{currentSessionClient.tokens=null;currentSessionClient.state=null;},
    (currentSessionClient,currentCleanupCallbacks)=>{for(const currentCleanupCallback of currentCleanupCallbacks)currentCleanupCallback?.();},
  ];
  for(const changeCurrentSession of changeSessionCases)
    for(const rejectedRequestValue of [false,true])
      assert.equal(await inspectDelayedBagResponse(changeCurrentSession,rejectedRequestValue),0);
});

test('동일 세션의 성공과 오류는 정상적으로 화면 상태를 갱신한다',async()=>{
  for(const rejectedRequestValue of [false,true])
    assert.ok(await inspectDelayedBagResponse(()=>{},rejectedRequestValue)>0);
});


test('이전 가방 화면의 새로고침은 세션 변경과 종료 후 송신하지 않는다',async()=>{
  for(const changeCurrentSession of [
    currentSessionClient=>{currentSessionClient.tokens={user_id:'owner-two'};},
    currentSessionClient=>{currentSessionClient.state.generation++;},
    currentSessionClient=>{currentSessionClient.state.me={id:'character-two',version:1};},
    (currentSessionClient,currentCleanupCallbacks)=>{for(const currentCleanupCallback of currentCleanupCallbacks)currentCleanupCallback?.();},
  ]) assert.equal(await inspectDelayedBagResponse(changeCurrentSession,false,true),0);
});


test('소모품 사용은 화면을 연 세션에서만 실행한다',async()=>{
  assert.equal(await inspectDelayedBagResponse(()=>{},false,'consume'),1);
  assert.equal(await inspectDelayedBagResponse(currentSessionClient=>{currentSessionClient.state.generation++;},false,'consume'),0);
  assert.equal(await inspectDelayedBagResponse(currentSessionClient=>{currentSessionClient.tokens={user_id:'other'};},false,'consume'),0);
});
