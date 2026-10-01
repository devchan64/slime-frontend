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
for(const currentFirstSubmissionFails of [false,true])test('가공 의뢰 완료 알림·세션 차단 및 전송 실패 재시도: '+currentFirstSubmissionFails,async()=>{
 const currentStateSlots=[],currentReferenceSlots=[],currentEffects=[];let currentStateCursor=0,currentReferenceCursor=0;
 const currentRecipeEntry={collectionId:'hide',grade:'low',outputQuantity:1,inputQuantity:2,costP:1,durationSeconds:30,outputMaterial:{materialId:'leather-low',name:'하급 가죽',englishName:'Low leather'}};
 const currentRequestCalls=[];
 const currentClientState={generation:1,location:{id:'city'},me:{id:'character',mode:'FIELD',battleId:null,position:{column:1,row:1},version:1}};
 let currentAcceptedCount=0,currentCreatedNotifications=0;
 const currentClientMock={tokens:{user_id:'owner'},state:currentClientState,accept:()=>{currentAcceptedCount++;},request:async(currentPath,currentBody)=>{
  currentRequestCalls.push({currentPath,currentBody});
  if(currentBody){
   if(currentFirstSubmissionFails&&currentRequestCalls.filter(currentRequestCall=>currentRequestCall.currentBody).length===1)throw new TypeError('network');
   return {state:currentClientState};
  }
  if(currentPath.includes('catalog'))return {facilityId:'workshop',available:true,unavailableReason:null,grades:['low'],entries:[currentRecipeEntry]};
  return {quote:{...currentRecipeEntry,ownedQuantity:2},quoteToken:'a'.repeat(64),characterVersion:1,ownedCoins:10};
 }};
 const previousTestHarness=globalThis.refiningCreateHarness;
 globalThis.refiningCreateHarness={effects:currentEffects,useState:currentInitialValue=>{
  const currentSlotIndex=currentStateCursor++;if(!(currentSlotIndex in currentStateSlots))currentStateSlots[currentSlotIndex]=currentInitialValue;
  return [currentStateSlots[currentSlotIndex],currentNextValue=>{currentStateSlots[currentSlotIndex]=currentNextValue;}];
 },useRef:currentInitialValue=>{const currentSlotIndex=currentReferenceCursor++;return currentReferenceSlots[currentSlotIndex]??=( {current:currentInitialValue});}};
 function renderRefiningPanel(){currentStateCursor=0;currentReferenceCursor=0;return RefiningCreatePanel({gameSessionClient:currentClientMock,currentFacilityIdentifier:'workshop',actionsAreDisabled:false,onRefiningCreated:()=>{currentCreatedNotifications++;}});}
 try{
  let currentPanelTree=renderRefiningPanel();currentEffects[0]();
  findRefiningButton(currentPanelTree,'workshop.refiningBrowse').props.onClick();await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
  currentPanelTree=renderRefiningPanel();findRefiningButton(currentPanelTree,'workshop.refiningQuote').props.onClick();await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
  currentPanelTree=renderRefiningPanel();const currentSubmitButton=findRefiningButton(currentPanelTree,'workshop.refiningSubmit');assert.ok(currentSubmitButton);
  currentSubmitButton.props.onClick();currentSubmitButton.props.onClick();await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
  if(currentFirstSubmissionFails){
   assert.equal(currentCreatedNotifications,0);assert.equal(currentAcceptedCount,0);
   findRefiningButton(renderRefiningPanel(),'workshop.refiningSubmit').props.onClick();
   await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));
   assert.deepEqual(currentRequestCalls[2].currentBody,currentRequestCalls[3].currentBody);
  }
  assert.equal(currentRequestCalls.filter(currentRequestCall=>currentRequestCall.currentBody).length,currentFirstSubmissionFails?2:1);assert.equal(currentAcceptedCount,1);assert.equal(currentCreatedNotifications,1);
  assert.equal(currentRequestCalls[2].currentBody.quantity,1);assert.equal(currentRequestCalls[2].currentBody.quoteToken,'a'.repeat(64));
  currentClientMock.tokens.user_id='other';findRefiningButton(renderRefiningPanel(),'workshop.refiningBrowse').props.onClick();await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));assert.equal(currentRequestCalls.length,currentFirstSubmissionFails?4:3);
 }finally{globalThis.refiningCreateHarness=previousTestHarness;}
});
