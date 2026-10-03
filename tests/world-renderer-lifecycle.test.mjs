import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// App의 실제 월드 effect를 실행하고 모듈 로딩과 Phaser만 제어한다.
const currentAppSource = ts.createSourceFile('App.tsx',await readFile('src/ui/App.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const currentWorldEffects = [];
function collectWorldEffects(currentSyntaxNode) {
 if(ts.isCallExpression(currentSyntaxNode)&&currentSyntaxNode.expression.getText(currentAppSource)==='useEffect'
  &&currentSyntaxNode.arguments[1]?.getText(currentAppSource)==='[inWorld]')currentWorldEffects.push(currentSyntaxNode.arguments[0]);
 ts.forEachChild(currentSyntaxNode,collectWorldEffects);
}
collectWorldEffects(currentAppSource);
assert.equal(currentWorldEffects.length,1);
const currentEffectJavaScript = ts.transpileModule(`const executeWorldEffect = ${currentWorldEffects[0].getText(currentAppSource)};`,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
 transformers:{before:[currentTransformContext=>currentRootNode=>{
  function replaceRendererImport(currentSyntaxNode){
   if(ts.isCallExpression(currentSyntaxNode)&&currentSyntaxNode.expression.kind===ts.SyntaxKind.ImportKeyword)
    return ts.factory.createCallExpression(ts.factory.createIdentifier('loadRendererModule'),undefined,[]);
   return ts.visitEachChild(currentSyntaxNode,replaceRendererImport,currentTransformContext);
  }
  return ts.visitNode(currentRootNode,replaceRendererImport);
 }]},
}).outputText;

function createRendererHarness(){
 const currentRecordedEvents=[];
 const currentRendererCallbacks={};
 let resolveRendererModule,rejectRendererModule;
 const currentModulePromise=new Promise((resolveCurrentModule,rejectCurrentModule)=>{resolveRendererModule=resolveCurrentModule;rejectRendererModule=rejectCurrentModule;});
 const recordCurrentEvent=currentEventName=>(...currentEventValues)=>currentRecordedEvents.push([currentEventName,...currentEventValues]);
 const currentEffectContext={inWorld:true,container:{current:{}},renderer:{current:null},stopWalking:{current:false},
  battleReport:null,battleReportSceneSnapshot:{current:null},stateRef:{current:null},
  loadRendererModule:()=>currentModulePromise,client:{disconnect:recordCurrentEvent('disconnect')},console:{error:recordCurrentEvent('error')}};
 for(const currentSetterName of ['setRenderFailed','setRenderError','setRenderedLocation','setConnected','setStatus','setSelected','setBattleSelectionIntent'])currentEffectContext[currentSetterName]=recordCurrentEvent(currentSetterName);
 const cleanupCurrentEffect=vm.runInNewContext(currentEffectJavaScript+'\nexecuteWorldEffect();',currentEffectContext);
 const currentRendererModule={createGame(currentParentElement,currentSelectCallback,currentReadyCallback,currentFailureCallback){
  currentRecordedEvents.push(['create']);
  Object.assign(currentRendererCallbacks,{select:currentSelectCallback,ready:currentReadyCallback,failure:currentFailureCallback});
  return {scene:{},game:{canvas:{addEventListener(currentEventName,currentEventCallback){currentRendererCallbacks[currentEventName]=currentEventCallback;},removeEventListener:recordCurrentEvent('remove')},destroy:recordCurrentEvent('destroy')}};
 }};
 return {currentRecordedEvents,currentRendererCallbacks,cleanupCurrentEffect,resolveRendererModule:()=>resolveRendererModule(currentRendererModule),rejectRendererModule:()=>rejectRendererModule(new Error('초기화 실패'))};
}
const flushRendererCallbacks=()=>new Promise(currentResolveCallback=>setImmediate(currentResolveCallback));

for(const currentOutcomeName of ['resolveRendererModule','rejectRendererModule'])test(`화면 종료 뒤 ${currentOutcomeName}는 현재 연결과 화면을 변경하지 않는다`,async()=>{
 const currentRendererHarness=createRendererHarness();
 currentRendererHarness.cleanupCurrentEffect();
 const currentOriginalEvents=[...currentRendererHarness.currentRecordedEvents];
 currentRendererHarness[currentOutcomeName]();await flushRendererCallbacks();
 assert.deepEqual(currentRendererHarness.currentRecordedEvents,currentOriginalEvents);
});

test('살아 있는 장면 콜백은 적용하고 종료 뒤 준비·선택·실패·컨텍스트 손실은 무시한다',async()=>{
 const currentRendererHarness=createRendererHarness();
 currentRendererHarness.resolveRendererModule();await flushRendererCallbacks();
 const currentCallbacks=currentRendererHarness.currentRendererCallbacks;
 currentCallbacks.ready('field-one');currentCallbacks.select({column:1,row:2});currentCallbacks.failure('render-failure');
 assert.ok(currentRendererHarness.currentRecordedEvents.some(currentEvent=>currentEvent[0]==='setRenderedLocation'&&currentEvent[1]==='field-one'));
 assert.ok(currentRendererHarness.currentRecordedEvents.some(currentEvent=>currentEvent[0]==='setSelected'));
 assert.ok(currentRendererHarness.currentRecordedEvents.some(currentEvent=>currentEvent[0]==='setRenderError'&&currentEvent[1]==='render-failure'));
 currentRendererHarness.cleanupCurrentEffect();
 const currentOriginalEvents=[...currentRendererHarness.currentRecordedEvents];
 currentCallbacks.ready('old-field');currentCallbacks.select({column:3,row:4});currentCallbacks.failure('late-failure');
 currentCallbacks.webglcontextlost({preventDefault(){throw new Error('종료된 화면의 이벤트');}});
 assert.deepEqual(currentRendererHarness.currentRecordedEvents,currentOriginalEvents);
});

test('현재 화면의 초기화 실패는 연결을 끊고 오류를 표시한다',async()=>{
 const currentRendererHarness=createRendererHarness();
 currentRendererHarness.rejectRendererModule();await flushRendererCallbacks();
 assert.equal(currentRendererHarness.currentRecordedEvents.filter(currentEvent=>currentEvent[0]==='disconnect').length,1);
 assert.ok(currentRendererHarness.currentRecordedEvents.some(currentEvent=>currentEvent[0]==='setRenderError'&&currentEvent[1].key==='app.webglUnsupported'));
 currentRendererHarness.cleanupCurrentEffect();
});
