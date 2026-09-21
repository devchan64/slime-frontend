import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBuildResult=await build({entryPoints:['src/ui/RefiningContractsPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'refining-hooks',setup(currentBuildContext){
 currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImport=>({path:currentImport.path,namespace:'refining-test'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'refining-test'},currentImport=>({loader:'js',contents:currentImport.path==='preact/hooks'?`export const useState=(value)=>globalThis.refiningHarness.useState(value);export const useRef=(value)=>({current:value});export const useEffect=(callback)=>globalThis.refiningHarness.effects.push(callback);`:`export const useTranslation=()=>({locale:'ko',t:key=>key});`}));
}}]});
const {RefiningContractsPanel}=await import(`data:text/javascript;base64,${Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64')}`);
function findClaimButton(currentNodeValue){
 if(!currentNodeValue||typeof currentNodeValue!=='object')return null;
 if(currentNodeValue.type==='button'&&currentNodeValue.props.children==='workshop.claim')return currentNodeValue;
 for(const currentChildNode of [currentNodeValue.props?.children].flat(Infinity)){const currentResultNode=findClaimButton(currentChildNode);if(currentResultNode)return currentResultNode;}
 return null;
}
test('정제 수령은 원래 세션에서 한 번 요청하고 상태·목록을 갱신한다',async()=>{
 for(const changeSessionBeforeClick of [false,true]){
  const currentRequestCalls=[];let currentStateIndex=0;let currentAcceptedCount=0;
  const currentPanelPage={serverTime:150,characterVersion:1,nextCursor:null,entries:[{contractId:'one',facilityId:'workshop',startedAt:100,readyAt:130,claimedAt:null,status:'READY',quote:{grade:'low',outputQuantity:1,inputQuantity:2,costP:1,durationSeconds:30,outputMaterial:{materialId:'leather',name:'가죽',englishName:'Leather'}}}]};
  const currentClientState={generation:1,location:{id:'city'},me:{id:'character',mode:'FIELD',battleId:null,position:{column:1,row:1},version:1}};
  const currentClientMock={tokens:{user_id:'owner'},state:currentClientState,request:async(currentPath,currentBody)=>{currentRequestCalls.push({currentPath,currentBody});return currentBody?{state:currentClientState}:currentPanelPage;},accept:()=>{currentAcceptedCount++;}};
  const previousTestHarness=globalThis.refiningHarness;
  globalThis.refiningHarness={effects:[],useState:currentInitialValue=>[currentStateIndex++===0?currentPanelPage:currentInitialValue,()=>{}]};
  let currentCleanupCallbacks=[];
  try{
   const currentPanelTree=RefiningContractsPanel({gameSessionClient:currentClientMock,currentFacilityIdentifier:'workshop',actionsAreDisabled:false});
   currentCleanupCallbacks=globalThis.refiningHarness.effects.map(currentEffect=>currentEffect());
   if(changeSessionBeforeClick)currentClientMock.tokens.user_id='other';
   const currentClaimButton=findClaimButton(currentPanelTree);assert.ok(currentClaimButton);
   currentClaimButton.props.onClick();currentClaimButton.props.onClick();
   await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
   assert.equal(currentRequestCalls.length,changeSessionBeforeClick?0:2);
   assert.equal(currentAcceptedCount,changeSessionBeforeClick?0:1);
   if(!changeSessionBeforeClick)assert.deepEqual(currentRequestCalls[0].currentBody,{expectedVersion:1});
  }finally{currentCleanupCallbacks.forEach(currentCleanup=>currentCleanup?.());globalThis.refiningHarness=previousTestHarness;}
 }
});
