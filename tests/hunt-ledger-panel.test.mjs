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

test('사냥 기록 페이지는 실패 시 유지되고 재시도·이전·새로고침에서 올바른 커서를 요청한다',async()=>{
  const savedHookValues=[];
  const requestedLedgerUrls=[];
  const previousTestHarness=globalThis.huntSessionHarness;
  let currentHookIndex=0;
  let currentRequestResolver;
  let currentRequestRejecter;
  globalThis.huntSessionHarness={
    useState(initialHookValue){const currentHookSlot=currentHookIndex++;if(!(currentHookSlot in savedHookValues))savedHookValues[currentHookSlot]=initialHookValue;return [savedHookValues[currentHookSlot],updatedHookValue=>{savedHookValues[currentHookSlot]=updatedHookValue;}];},
    useRef(initialHookValue){const currentHookSlot=currentHookIndex++;return savedHookValues[currentHookSlot]??(savedHookValues[currentHookSlot]={current:initialHookValue});},
    useEffect(){}
  };
  const currentSessionClient={tokens:{user_id:'owner-one'},state:{generation:1,me:{id:'character-one'}},request(currentRequestUrl){
    requestedLedgerUrls.push(currentRequestUrl);
    return new Promise((resolveCurrentRequest,rejectCurrentRequest)=>{currentRequestResolver=resolveCurrentRequest;currentRequestRejecter=rejectCurrentRequest;});
  }};
  function collectRenderedNodes(currentRenderedValue){
    if(Array.isArray(currentRenderedValue))return currentRenderedValue.flatMap(collectRenderedNodes);
    if(!currentRenderedValue||typeof currentRenderedValue!=='object')return [];
    return [currentRenderedValue,...collectRenderedNodes(currentRenderedValue.props?.children)];
  }
  function renderLedgerNodes(){currentHookIndex=0;return collectRenderedNodes(HuntLedgerPanel({gameSessionClient:currentSessionClient}));}
  function findLedgerButton(currentButtonLabel){return renderLedgerNodes().find(currentRenderedNode=>currentRenderedNode.type==='button'&&currentRenderedNode.props.children===currentButtonLabel);}
  function createLedgerResponse(currentEntryIdentifier,currentNextCursor){return {
    entries:[{id:currentEntryIdentifier,monsterInstanceId:'monster-'+currentEntryIdentifier,monsterTypeId:'slime',battleId:'battle-one',spawnId:'spawn-one',mapId:'forest',quantity:1,result:'WIN',createdAt:1}],
    totals:[{monsterTypeId:'slime',quantity:11}],nextCursor:currentNextCursor,
  };}
  function currentEntryIdentifiers(){return renderLedgerNodes().filter(currentRenderedNode=>currentRenderedNode.type==='li'&&typeof currentRenderedNode.key==='number').map(currentRenderedNode=>currentRenderedNode.key);}
  async function completeLedgerRequest(currentLedgerResponse){currentRequestResolver(currentLedgerResponse);await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));}
  try{
    findLedgerButton('hunts.refresh').props.onClick();
    await completeLedgerRequest(createLedgerResponse(10,10));
    assert.equal(findLedgerButton('hunts.previous').props.disabled,true);
    findLedgerButton('hunts.next').props.onClick();
    assert.equal(findLedgerButton('hunts.next').props.disabled,true);
    currentRequestRejecter(new Error('조회 실패'));
    await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
    assert.deepEqual(currentEntryIdentifiers(),[10]);
    assert.equal(findLedgerButton('hunts.previous').props.disabled,true);
    assert.ok(renderLedgerNodes().some(currentRenderedNode=>currentRenderedNode.props?.role==='alert'));
    findLedgerButton('hunts.next').props.onClick();
    await completeLedgerRequest(createLedgerResponse(11,null));
    assert.deepEqual(currentEntryIdentifiers(),[11]);
    assert.equal(findLedgerButton('hunts.next').props.disabled,true);
    findLedgerButton('hunts.previous').props.onClick();
    await completeLedgerRequest(createLedgerResponse(10,10));
    assert.deepEqual(currentEntryIdentifiers(),[10]);
    findLedgerButton('hunts.next').props.onClick();
    await completeLedgerRequest(createLedgerResponse(11,null));
    findLedgerButton('hunts.refresh').props.onClick();
    await completeLedgerRequest(createLedgerResponse(10,10));
    assert.equal(findLedgerButton('hunts.previous').props.disabled,true);
    assert.deepEqual(requestedLedgerUrls,[0,10,10,0,10,0].map(currentLedgerCursor=>'/v1/characters/me/hunts?after='+currentLedgerCursor+'&limit=10'));
  }finally{globalThis.huntSessionHarness=previousTestHarness;}
});
