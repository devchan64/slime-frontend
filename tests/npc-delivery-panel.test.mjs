import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBuildResult=await build({entryPoints:['src/ui/NpcDialogue.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'npc-hooks',setup(currentBuildContext){
 currentBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},currentImportValue=>({path:currentImportValue.path,namespace:'npc-test'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'npc-test'},currentImportValue=>({loader:'js',contents:currentImportValue.path==='preact/hooks'?`export const useState=value=>globalThis.npcDeliveryHarness.useState(value);export const useRef=value=>globalThis.npcDeliveryHarness.useRef(value);export const useEffect=callback=>globalThis.npcDeliveryHarness.effects.push(callback);`:`export const getLocale=()=>'ko';export const useTranslation=()=>({locale:'ko',t:(key,values)=>values?key+JSON.stringify(values):key});`}));
}}]});
const {NpcDialogue}=await import(`data:text/javascript;base64,${Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64')}`);
function findDeliveryButton(currentNodeValue,currentButtonText){
 if(!currentNodeValue||typeof currentNodeValue!=='object')return null;
 if(currentNodeValue.type==='button'&&String(currentNodeValue.props.children).startsWith(currentButtonText))return currentNodeValue;
 for(const currentChildNode of [currentNodeValue.props?.children].flat(Infinity)){const currentFoundNode=findDeliveryButton(currentChildNode,currentButtonText);if(currentFoundNode)return currentFoundNode;}return null;
}
for(const currentChangeKind of ['none','version','epoch','location'])test('전달 확인·취소·중복 클릭·상태 변경: '+currentChangeKind,async()=>{
 const currentStateSlots=[],currentReferenceSlots=[],currentEffectCallbacks=[],currentRequestCalls=[];
 let currentStateCursor=0,currentReferenceCursor=0,currentAcceptedCount=0;
 const currentClientState={generation:1,epoch:1,location:{id:'city'},me:{id:'character',name:'여행자',version:2,mode:'FIELD',position:{column:1,row:1}}};
 const currentDialoguePage={serverTime:30,characterVersion:2,npc:{id:'npc',name:'모라',cityId:'iseulon',facilityId:'iseulon-market'},acceptedCount:1,maximumAcceptedCount:5,entries:[{eventId:'first',title:'첫 납품',status:'ACCEPTED',dialogue:'전달해 주세요.',items:[{itemId:'protein-jelly',required:2,owned:3,nameTranslations:{ko:'단백질젤리',en:'Protein jelly'}}],moneyP:4,action:'complete',canExecute:true,blockedReasons:[],giverNpcId:'npc',receiverNpcId:'npc'}]};
 const currentClientMock={tokens:{user_id:'owner'},state:currentClientState,accept:()=>{currentAcceptedCount++;},request:async(currentRequestPath,currentRequestBody)=>{currentRequestCalls.push({currentRequestPath,currentRequestBody});return currentRequestBody?{state:currentClientState}:currentDialoguePage;}};
 const previousTestHarness=globalThis.npcDeliveryHarness;
 globalThis.npcDeliveryHarness={effects:currentEffectCallbacks,useState:currentInitialValue=>{const currentSlotIndex=currentStateCursor++;if(!(currentSlotIndex in currentStateSlots))currentStateSlots[currentSlotIndex]=currentInitialValue;return [currentStateSlots[currentSlotIndex],currentNextValue=>{currentStateSlots[currentSlotIndex]=currentNextValue;}];},useRef:currentInitialValue=>{const currentSlotIndex=currentReferenceCursor++;return currentReferenceSlots[currentSlotIndex]??={current:currentInitialValue};}};
 function renderDeliveryPanel(){currentStateCursor=0;currentReferenceCursor=0;return NpcDialogue({gameSessionClient:currentClientMock,currentNpcIdentifier:'npc',currentNpcName:'모라',actionsAreDisabled:false,currentCharacterVersion:currentClientState.me.version});}
 async function settleDeliveryWork(){await new Promise(resolvePendingWork=>setImmediate(resolvePendingWork));}
 try{
  let currentPanelTree=renderDeliveryPanel();currentEffectCallbacks[0]();findDeliveryButton(currentPanelTree,'npc.talk').props.onClick();
  currentPanelTree=renderDeliveryPanel();findDeliveryButton(currentPanelTree,'journal.refresh').props.onClick();await settleDeliveryWork();
  currentPanelTree=renderDeliveryPanel();findDeliveryButton(currentPanelTree,'npc.complete').props.onClick();
  currentPanelTree=renderDeliveryPanel();assert.match(JSON.stringify(currentPanelTree),/여행자/);assert.match(JSON.stringify(currentPanelTree),/단백질젤리/);assert.match(JSON.stringify(currentPanelTree),/quantity\\?":2/);
  assert.equal(currentRequestCalls.filter(currentRequestCall=>currentRequestCall.currentRequestBody).length,0);
  findDeliveryButton(currentPanelTree,'npc.deliveryCancel').props.onClick();assert.equal(findDeliveryButton(renderDeliveryPanel(),'npc.deliveryConfirm'),null);
  findDeliveryButton(renderDeliveryPanel(),'npc.complete').props.onClick();
  const currentConfirmButton=findDeliveryButton(renderDeliveryPanel(),'npc.deliveryConfirm');
  if(currentChangeKind==='version')currentClientState.me.version++;
  if(currentChangeKind==='epoch')currentClientState.epoch++;
  if(currentChangeKind==='location')currentClientState.location.id='other';
  currentConfirmButton.props.onClick();currentConfirmButton.props.onClick();await settleDeliveryWork();
  const currentPostedRequests=currentRequestCalls.filter(currentRequestCall=>currentRequestCall.currentRequestBody);
  assert.equal(currentPostedRequests.length,currentChangeKind==='none'?1:0);assert.equal(currentAcceptedCount,currentChangeKind==='none'?1:0);
  if(currentChangeKind==='none')assert.deepEqual(currentPostedRequests[0],{currentRequestPath:'/v1/game/main-events/first/complete',currentRequestBody:{npcId:'npc',expectedVersion:2}});
 }finally{globalThis.npcDeliveryHarness=previousTestHarness;}
});
