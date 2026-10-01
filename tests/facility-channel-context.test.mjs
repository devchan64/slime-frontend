import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
function findFacilityButton(currentTreeNode){
 if(!currentTreeNode||typeof currentTreeNode!=='object')return null;
 if(currentTreeNode.type==='button'&&currentTreeNode.props.onClick)return currentTreeNode;
 for(const currentChildNode of [currentTreeNode.props?.children].flat(Infinity)){const currentFoundButton=findFacilityButton(currentChildNode);if(currentFoundButton)return currentFoundButton;}return null;
}
for(const currentPanelName of ['CitizenshipPricePanel','GuildRecruitmentPanel','PartyFormationPanel']){
 const currentBuildResult=await build({entryPoints:['src/ui/'+currentPanelName+'.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'facility-context-hooks',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportValue=>({path:currentImportValue.path,namespace:'facility-context-test'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'facility-context-test'},currentImportValue=>({loader:'js',contents:currentImportValue.path==='preact/hooks'?`export const useState=value=>[value,()=>{}];export const useRef=value=>({current:value});export const useEffect=callback=>globalThis.facilityContextEffects.push(callback);`:`export const useTranslation=()=>({t:key=>key,locale:'ko'});`}));
 }}]});
 const currentPanelModule=await import(`data:text/javascript;base64,${Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64')}`);
 test(currentPanelName+'는 같은 맵·좌표의 다른 채널에서 이전 화면 요청을 차단한다',async()=>{
  for(const currentMutationKind of ['unchanged','epoch','location']){
   const previousEffectHooks=globalThis.facilityContextEffects;globalThis.facilityContextEffects=[];
   let currentRequestCount=0;
   const currentSessionClient={tokens:{user_id:'owner'},state:{generation:1,epoch:1,location:{id:'channel-one'},map:{id:'city'},me:{id:'hero',mode:'FIELD',position:{column:1,row:2}}},request:async()=>{currentRequestCount++;throw new Error('검사 응답 종료');}};
   let currentCleanupCallbacks=[];
   try{
    const currentPanelTree=currentPanelModule[currentPanelName]({gameSessionClient:currentSessionClient,currentFacilityIdentifier:'city-guild',actionsAreDisabled:false});
    currentCleanupCallbacks=globalThis.facilityContextEffects.map(currentEffectCallback=>currentEffectCallback());
    if(currentMutationKind==='epoch')currentSessionClient.state.epoch++;
    if(currentMutationKind==='location')currentSessionClient.state.location.id='channel-two';
    const currentButtonNode=findFacilityButton(currentPanelTree);assert.ok(currentButtonNode);currentButtonNode.props.onClick();
    await new Promise(currentResolveCallback=>setImmediate(currentResolveCallback));
    assert.equal(currentRequestCount,currentMutationKind==='unchanged'?1:0);
   }finally{currentCleanupCallbacks.forEach(currentCleanupCallback=>currentCleanupCallback?.());globalThis.facilityContextEffects=previousEffectHooks;}
  }
 });
}
