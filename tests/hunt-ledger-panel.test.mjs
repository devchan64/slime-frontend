import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild = await build({entryPoints:['src/ui/HuntLedgerPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{
  name:'hunt-session-hooks',setup(currentBuildContext){
    currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportPath=>({path:currentImportPath.path,namespace:'hunt-session-test'}));
    currentBuildContext.onLoad({filter:/.*/,namespace:'hunt-session-test'},currentImportPath=>({loader:'js',contents:currentImportPath.path==='preact/hooks' ? `
      export const useState=(value)=>globalThis.huntSessionHarness.useState(value);
      export const useRef=(value)=>globalThis.huntSessionHarness.useRef(value);
      export const useEffect=(callback)=>globalThis.huntSessionHarness.useEffect(callback);
    ` : `export const useTranslation=()=>({t:key=>key,locale:'ko'});`}));
  }
}]});
const {HuntLedgerPanel} = await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);

async function inspectDelayedHuntResponse(changeCurrentSession, rejectedRequestValue) {
  const savedHookValues=[];const queuedEffectCalls=[];const effectCleanupCalls=[];
  let currentHookIndex=0;let currentStateWrites=0;let completeCurrentRequest;let rejectCurrentRequest;
  const previousTestHarness=globalThis.huntSessionHarness;
  globalThis.huntSessionHarness={
    useState(initialHookValue){const currentHookSlot=currentHookIndex++;savedHookValues[currentHookSlot]=initialHookValue;return [initialHookValue,updatedHookValue=>{currentStateWrites++;savedHookValues[currentHookSlot]=updatedHookValue;}];},
    useRef(initialHookValue){const currentHookSlot=currentHookIndex++;return savedHookValues[currentHookSlot]={current:initialHookValue};},
    useEffect(currentEffectCallback){queuedEffectCalls.push(currentEffectCallback);}
  };
  const currentCharacterState={id:'character-one',version:1};
  const currentSessionClient={tokens:{user_id:'owner-one'},state:{generation:1,me:currentCharacterState},
    request:()=>new Promise((resolveCurrentRequest,rejectPendingRequest)=>{completeCurrentRequest=resolveCurrentRequest;rejectCurrentRequest=rejectPendingRequest;})};
  try {
    HuntLedgerPanel({gameSessionClient:currentSessionClient});
    for(const currentEffectCallback of queuedEffectCalls) effectCleanupCalls.push(currentEffectCallback());
    const previousStateWrites=currentStateWrites;
    changeCurrentSession(currentSessionClient,effectCleanupCalls);
    if(rejectedRequestValue) rejectCurrentRequest(new Error('이전 세션 오류'));
    else completeCurrentRequest({entries:[],totals:[],nextCursor:null});
    await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
    return currentStateWrites-previousStateWrites;
  } finally {
    for(const currentEffectCleanup of effectCleanupCalls) currentEffectCleanup?.();
    globalThis.huntSessionHarness=previousTestHarness;
  }
}

test('사냥 원장의 늦은 성공과 오류는 계정·세대·캐릭터 전환 및 화면 종료 후 반영하지 않는다',async()=>{
  const changeSessionCases=[
    currentSessionClient=>{currentSessionClient.tokens={user_id:'owner-two'};},
    currentSessionClient=>{currentSessionClient.state.generation++;},
    currentSessionClient=>{currentSessionClient.state.me={id:'character-two',version:1};},
    currentSessionClient=>{currentSessionClient.tokens=null;currentSessionClient.state=null;},
    (currentSessionClient,currentCleanupCallbacks)=>{for(const currentCleanupCallback of currentCleanupCallbacks)currentCleanupCallback?.();},
  ];
  for(const changeCurrentSession of changeSessionCases)
    for(const rejectedRequestValue of [false,true])
      assert.equal(await inspectDelayedHuntResponse(changeCurrentSession,rejectedRequestValue),0);
});

test('동일 세션의 성공과 오류는 정상적으로 화면 상태를 갱신한다',async()=>{
  for(const rejectedRequestValue of [false,true])
    assert.ok(await inspectDelayedHuntResponse(()=>{},rejectedRequestValue)>0);
});
