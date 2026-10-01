import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentPanelBuild=await build({entryPoints:['src/ui/CityTaxPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'tax-panel-test',setup(currentBuildContext){
 currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportRequest=>({path:currentImportRequest.path,namespace:'tax-panel-test'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'tax-panel-test'},currentImportRequest=>({loader:'js',contents:currentImportRequest.path==='preact/hooks'?`export const useState=value=>globalThis.taxPanelHarness.useState(value);export const useRef=value=>({current:value});export const useEffect=callback=>globalThis.taxPanelHarness.useEffect(callback);`:`export const useTranslation=()=>({t:key=>key,locale:'en'});`}));
}}]});
const {CityTaxPanel}=await import(`data:text/javascript;base64,${Buffer.from(currentPanelBuild.outputFiles[0].text).toString('base64')}`);
const currentStartTime=Date.parse('2026-10-01T04:00:00+09:00')/1000;
const currentValidPage={version:1,policyVersion:2,startsAt:currentStartTime,expiresAt:currentStartTime+86400,evaluatedAt:currentStartTime,observedAt:currentStartTime+1,timezone:'Asia/Seoul',refreshHour:4,entries:[{cityId:'iseulon',cityName:'이슬온',paidCitizenshipCount:1,taxBasisPoints:1000}]};
for(const currentTransitionKind of ['same','owner','generation','character','logout','unmount'])for(const currentResponseFails of [false,true])test(`세율 응답 ${currentTransitionKind} / 오류 ${currentResponseFails}`,async()=>{
 let currentStateWrites=0,currentRequestCount=0,resolveCurrentRequest,rejectCurrentRequest;
 const currentCleanupCallbacks=[];
 globalThis.taxPanelHarness={useState:currentInitialValue=>[currentInitialValue,()=>currentStateWrites++],useEffect:currentCallback=>currentCleanupCallbacks.push(currentCallback())};
 const currentSessionClient={tokens:{user_id:'owner'},state:{generation:1,me:{id:'hero'}},request:currentRequestPath=>{
  assert.equal(currentRequestPath,'/v1/economy/city-taxes');currentRequestCount++;
  return new Promise((currentResolveFunction,currentRejectFunction)=>{resolveCurrentRequest=currentResolveFunction;rejectCurrentRequest=currentRejectFunction;});
 }};
 try{
  const currentPanelTree=CityTaxPanel({gameSessionClient:currentSessionClient});
  const currentRefreshButton=currentPanelTree.props.children.find(currentChildNode=>currentChildNode?.type==='button');
  currentRefreshButton.props.onClick();currentRefreshButton.props.onClick();assert.equal(currentRequestCount,1);
  const currentInitialWrites=currentStateWrites;
  if(currentTransitionKind==='owner')currentSessionClient.tokens.user_id='other';
  if(currentTransitionKind==='generation')currentSessionClient.state.generation=2;
  if(currentTransitionKind==='character')currentSessionClient.state.me.id='other';
  if(currentTransitionKind==='logout')currentSessionClient.state=null;
  if(currentTransitionKind==='unmount')currentCleanupCallbacks.forEach(currentCleanup=>currentCleanup());
  if(currentResponseFails)rejectCurrentRequest(new Error('server failure'));else resolveCurrentRequest(currentValidPage);
  await new Promise(currentResolveFunction=>setImmediate(currentResolveFunction));
  assert.equal(currentStateWrites-currentInitialWrites,currentTransitionKind==='same'?2:0);
 }finally{currentCleanupCallbacks.forEach(currentCleanup=>currentCleanup());delete globalThis.taxPanelHarness;}
});
