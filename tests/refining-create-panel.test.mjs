import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBuildResult=await build({entryPoints:['src/ui/RefiningCreatePanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'refining-hooks',setup(currentBuildContext){
 currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImport=>({path:currentImport.path,namespace:'refining-test'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'refining-test'},currentImport=>({loader:'js',contents:currentImport.path==='preact/hooks'?`export const useState=(value)=>globalThis.refiningCreateHarness.useState(value);export const useRef=(value)=>globalThis.refiningCreateHarness.useRef(value);export const useEffect=(callback)=>globalThis.refiningCreateHarness.effects.push(callback);`:`export const useTranslation=()=>({locale:'ko',t:key=>key});`}));
}}]});
const {RefiningCreatePanel}=await import(`data:text/javascript;base64,${Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64')}`);

function findRefiningButton(currentNodeValue,currentButtonText){
 if(!currentNodeValue||typeof currentNodeValue!=='object')return null;
 if(currentNodeValue.type==='button'&&currentNodeValue.props.children===currentButtonText)return currentNodeValue;
 for(const currentChildNode of [currentNodeValue.props?.children].flat(Infinity)){const currentFoundNode=findRefiningButton(currentChildNode,currentButtonText);if(currentFoundNode)return currentFoundNode;}return null;
}
test('정제 의뢰는 견적 이후 한 번 제출하고 세션 변경 시 차단한다',async()=>{
 const currentStateSlots=[],currentReferenceSlots=[],currentEffects=[];let currentStateCursor=0,currentReferenceCursor=0;
 const currentRecipeEntry={collectionId:'hide',grade:'low',outputQuantity:1,inputQuantity:2,costP:1,durationSeconds:30,outputMaterial:{materialId:'leather-low',name:'하급 가죽',englishName:'Low leather'}};
 const currentRequestCalls=[];
 const currentClientState={generation:1,location:{id:'city'},me:{id:'character',mode:'FIELD',battleId:null,position:{column:1,row:1},version:1}};
 let currentAcceptedCount=0;
 const currentClientMock={tokens:{user_id:'owner'},state:currentClientState,accept:()=>{currentAcceptedCount++;},request:async(currentPath,currentBody)=>{
  currentRequestCalls.push({currentPath,currentBody});
  if(currentBody)return {state:currentClientState};
  if(currentPath.includes('catalog'))return {facilityId:'workshop',available:true,unavailableReason:null,grades:['low'],entries:[currentRecipeEntry]};
  return {quote:{...currentRecipeEntry,ownedQuantity:2},quoteToken:'a'.repeat(64),characterVersion:1,ownedCoins:10};
 }};
 const previousTestHarness=globalThis.refiningCreateHarness;
 globalThis.refiningCreateHarness={effects:currentEffects,useState:currentInitialValue=>{
  const currentSlotIndex=currentStateCursor++;if(!(currentSlotIndex in currentStateSlots))currentStateSlots[currentSlotIndex]=currentInitialValue;
  return [currentStateSlots[currentSlotIndex],currentNextValue=>{currentStateSlots[currentSlotIndex]=currentNextValue;}];
 },useRef:currentInitialValue=>{const currentSlotIndex=currentReferenceCursor++;return currentReferenceSlots[currentSlotIndex]??=( {current:currentInitialValue});}};
 function renderRefiningPanel(){currentStateCursor=0;currentReferenceCursor=0;return RefiningCreatePanel({gameSessionClient:currentClientMock,currentFacilityIdentifier:'workshop',actionsAreDisabled:false});}
 try{
  let currentPanelTree=renderRefiningPanel();currentEffects[0]();
  findRefiningButton(currentPanelTree,'workshop.refiningBrowse').props.onClick();await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
  currentPanelTree=renderRefiningPanel();findRefiningButton(currentPanelTree,'workshop.refiningQuote').props.onClick();await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
  currentPanelTree=renderRefiningPanel();const currentSubmitButton=findRefiningButton(currentPanelTree,'workshop.refiningSubmit');assert.ok(currentSubmitButton);
  currentSubmitButton.props.onClick();currentSubmitButton.props.onClick();await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
  assert.equal(currentRequestCalls.filter(currentRequestCall=>currentRequestCall.currentBody).length,1);assert.equal(currentAcceptedCount,1);
  assert.equal(currentRequestCalls[2].currentBody.quantity,1);assert.equal(currentRequestCalls[2].currentBody.quoteToken,'a'.repeat(64));
  currentClientMock.tokens.user_id='other';findRefiningButton(renderRefiningPanel(),'workshop.refiningBrowse').props.onClick();await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));assert.equal(currentRequestCalls.length,3);
 }finally{globalThis.refiningCreateHarness=previousTestHarness;}
});
