import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBuildResult=await build({entryPoints:['src/ui/SponsorGate.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'loading-gate-harness',setup(currentBuildContext){
 currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentModuleRecord=>({path:currentModuleRecord.path,namespace:'loading-test'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'loading-test'},currentModuleRecord=>({loader:'js',contents:currentModuleRecord.path==='preact/hooks'?`export const useState=value=>globalThis.loadingGateHarness.useState(value);export const useEffect=callback=>globalThis.loadingGateHarness.effects.push(callback);`:`export const useTranslation=()=>({t:key=>key,locale:'ko'});`}));
}}]});
const {SponsorGate}=await import('data:text/javascript;base64,'+Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64'));
function collectLoadingNodes(currentTreeNode,currentNodeType){
 if(!currentTreeNode||typeof currentTreeNode!=='object')return [];
 return [...(currentTreeNode.type===currentNodeType?[currentTreeNode]:[]),...[currentTreeNode.props?.children].flat(Infinity).flatMap(currentChildNode=>collectLoadingNodes(currentChildNode,currentNodeType))];
}
test('광고 승인 후에도 외부 광고를 유지하며 승인된 같은 시도를 재요청하지 않는다',()=>{
 const currentApprovedAttempt={attemptId:'attempt',displayUrl:'https://example.com/ad',text:'광고',verified:true};
 let currentStateIndex=0;let currentRequestCount=0;
 globalThis.loadingGateHarness={effects:[],useState:currentInitialValue=>[[currentApprovedAttempt,'',0][currentStateIndex++]??currentInitialValue,()=>{}]};
 try{
  const currentGateTree=SponsorGate({client:{request(){currentRequestCount++;}},generation:1,epoch:1,room:'map:a',approved:true,onReady(){},onExit(){}});
  assert.equal(collectLoadingNodes(currentGateTree,'iframe').length,1);
  for(const currentEffectCallback of globalThis.loadingGateHarness.effects)currentEffectCallback();
  assert.equal(currentRequestCount,0);
 }finally{delete globalThis.loadingGateHarness;}
});
test('서버 승인 뒤에도 채팅 연결 전에는 준비 완료를 통지하지 않는다',async()=>{
 let currentReadyCount=0;let resolveChatConnection;
 const currentAttemptRecord={attemptId:'attempt',displayUrl:null,text:'광고',verified:true,verification:'default_timer',generation:1,epoch:1,room:'map:a'};
 globalThis.loadingGateHarness={effects:[],useState:currentInitialValue=>[currentInitialValue,()=>{}]};
 try{
  SponsorGate({client:{request:async()=>currentAttemptRecord,connectChat:()=>new Promise(currentResolveCallback=>{resolveChatConnection=currentResolveCallback;})},generation:1,epoch:1,room:'map:a',onReady(){currentReadyCount++;},onExit(){}});
  const currentCleanupCallbacks=globalThis.loadingGateHarness.effects.map(currentEffectCallback=>currentEffectCallback());
  await new Promise(currentResolveCallback=>setImmediate(currentResolveCallback));
  assert.equal(currentReadyCount,0);resolveChatConnection();
  await new Promise(currentResolveCallback=>setImmediate(currentResolveCallback));
  assert.equal(currentReadyCount,1);currentCleanupCallbacks.forEach(currentCleanupCallback=>currentCleanupCallback?.());
 }finally{delete globalThis.loadingGateHarness;}
});
