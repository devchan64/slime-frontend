import {render} from 'preact';
import {WorkshopPanel} from '../../src/ui/WorkshopPanel';
import {ApiError} from '../../src/client/response';
import {t,setLocale} from '../../src/i18n';
const currentAssertions:string[]=[];
const currentRootElement=document.getElementById('root')!;
const settleProductionRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,250));
function assertProductionCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);currentAssertions.push(currentMessage);}
function findProductionButton(currentLocaleKey:string){const currentButton=[...document.querySelectorAll('button')].find(currentElement=>currentElement.textContent===t(currentLocaleKey));if(!currentButton)throw new Error(currentLocaleKey);return currentButton;}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 const currentCreatedRequests:any[]=[];
 const currentQuotedRequests:any[]=[];
 let currentCreationCount=0;
 const currentTestState={generation:1,epoch:1,map:{id:'iseulon'},location:{id:'iseulon'},me:{id:'hero',version:4,mode:'FIELD',position:{x:1,z:1}}};
 const currentGameClient:any={tokens:{user_id:'owner'},state:currentTestState,accept(currentState:any){this.state=currentState;},async request(currentPath:string,currentBody:any){
  if(currentPath.includes('/workshop-results/'))throw new ApiError('WORKSHOP_RESULT_NOT_FOUND','없음',404);
  if(currentPath.includes('/contracts?'))return {characterVersion:this.state.me.version,serverTime:100,nextCursor:null,entries:[]};
  if(currentPath.includes('/catalog?'))return {items:[{id:'leather-vest',name:'가죽 조끼',englishName:'Leather Vest',materialSelection:{requiredQuantity:4,defaultMaterialId:'tanned-leather-low',choices:[{materialId:'tanned-leather-low',grade:'low',ownedQuantity:2,nameTranslations:{ko:'하급 가죽',en:'Low leather'}},{materialId:'tanned-leather-medium',grade:'medium',ownedQuantity:2,nameTranslations:{ko:'중급 가죽',en:'Medium leather'}}]}}]};
  if(currentPath.endsWith('/production-quote')){
   currentQuotedRequests.push(structuredClone(currentBody));
   return {characterVersion:4,quoteToken:'a'.repeat(64),quote:{costP:14,durationSeconds:600,definitionId:'leather-vest',definitionSnapshot:{name:'가죽 조끼',englishName:'Leather Vest'},selectedMaterials:currentBody.materialInputs,productionResult:{productId:'leather-vest',usage:'equipment',itemLevel:2,levelPolicyVersion:1,performanceVersion:1,quality:{numerator:3,denominator:2},performance:{attack_flat_bonus:0,defense_flat_bonus:2,maximum_durability_value:72}}},materials:currentBody.materialInputs.map((currentEntry:any)=>({...currentEntry,ownedQuantity:2,consumedQuantity:2,missingQuantity:0,nameTranslations:{ko:'가죽',en:'Leather'}}))};
  }
  if(currentPath.endsWith('/contracts')){
   currentCreatedRequests.push(structuredClone(currentBody));
   if(++currentCreationCount===1)throw new TypeError('응답 유실');
   return {state:{...currentTestState,me:{...currentTestState.me,version:5}}};
  }
  throw new Error('예기치 않은 요청 '+currentPath);
 }};
 render(<WorkshopPanel gameSessionClient={currentGameClient} currentFacilityIdentifier="iseulon-workshop" actionsAreDisabled={false}/>,currentRootElement);
 await settleProductionRender();findProductionButton('workshop.title').click();await settleProductionRender();
 const currentItemSelect=document.querySelector('select')!;currentItemSelect.value='leather-vest';currentItemSelect.dispatchEvent(new Event('change',{bubbles:true}));await settleProductionRender();
 let currentMaterialInputs=[...document.querySelectorAll<HTMLInputElement>('fieldset input')];
 assertProductionCondition(currentMaterialInputs.length===2&&currentMaterialInputs[0].value==='4','기본 재료 수량과 허용 등급 표시');
 currentMaterialInputs[0].value='2';currentMaterialInputs[0].dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();
 assertProductionCondition(findProductionButton('workshop.quote').disabled,'필요 수량 미달은 견적 차단');
 currentMaterialInputs[1].value='2';currentMaterialInputs[1].dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();
 findProductionButton('workshop.quote').click();await settleProductionRender();
 assertProductionCondition(currentQuotedRequests[0].materialInputs.every((currentEntry:any)=>currentEntry.quantity===2),'혼합 등급 2+2 견적 전송');
 assertProductionCondition(document.body.textContent!.includes('Lv.2'),'서버 산정 레벨 표시');
 findProductionButton('workshop.confirm').click();await settleProductionRender();
 assertProductionCondition(document.querySelector('fieldset')!.disabled,'결과 불명 중 선택 재료 변경 차단');
 findProductionButton('workshop.confirm').click();await settleProductionRender();
 assertProductionCondition(currentCreatedRequests.length===2&&JSON.stringify(currentCreatedRequests[0])===JSON.stringify(currentCreatedRequests[1]),'같은 재료·요청 ID·견적으로 재시도');
 assertProductionCondition(currentGameClient.state.me.version===5,'성공 상태 반영');
 const currentOriginalRequest=currentGameClient.request.bind(currentGameClient);
 currentGameClient.request=async(currentPath:string,currentBody:any)=>{
  if(currentPath.includes('/catalog?kind=consumable'))return {items:[{id:'gel-ration',name:'젤 곡물식',englishName:'Gel Ration',materialSlots:[
   {slotId:'gelatin',requiredQuantity:2,defaultMaterialId:'gelatin-low',choices:[{materialId:'gelatin-low',grade:'low',ownedQuantity:10,nameTranslations:{ko:'젤라틴',en:'Gelatin'}}]},
   {slotId:'flour',requiredQuantity:1,defaultMaterialId:'grain-flour-low',choices:[{materialId:'grain-flour-low',grade:'low',ownedQuantity:10,nameTranslations:{ko:'곡물가루',en:'Flour'}}]}]}]};
  if(currentPath.endsWith('/production-quote')){
   currentQuotedRequests.push(structuredClone(currentBody));
   return {characterVersion:5,quoteToken:'b'.repeat(64),quote:{definitionId:'gel-ration',definitionSnapshot:{name:'젤 곡물식',englishName:'Gel Ration',effect:'restore_hp'},quantity:2,unitCostP:1,costP:2,unitDurationSeconds:90,durationSeconds:180,requiredMaterials:currentBody.materialInputs,
    productionResult:{productId:'gel-ration',usage:'consumable',itemLevel:1,levelPolicyVersion:1,performanceVersion:1,quality:{numerator:1,denominator:1},performance:{restoration_hp_value:3}}},materials:currentBody.materialInputs.map((currentEntry:any)=>({...currentEntry,ownedQuantity:10,consumedQuantity:currentEntry.quantity,missingQuantity:0,nameTranslations:{ko:'재료',en:'Material'}}))};
  }
  return currentOriginalRequest(currentPath,currentBody);
 };
 findProductionButton('workshop.consumable').click();await settleProductionRender();
 const currentConsumableSelect=document.querySelector('select')!;currentConsumableSelect.value='gel-ration';currentConsumableSelect.dispatchEvent(new Event('change',{bubbles:true}));await settleProductionRender();
 assertProductionCondition(document.querySelectorAll('fieldset').length===2,'소모품 슬롯별 입력 표시');
 const currentOrderQuantity=document.querySelector<HTMLInputElement>('input[max="1000"]')!;
 currentOrderQuantity.value='2';currentOrderQuantity.dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();
 assertProductionCondition(findProductionButton('workshop.quote').disabled,'주문 수량 변경 후 슬롯 부족 차단');
 currentMaterialInputs=[...document.querySelectorAll<HTMLInputElement>('fieldset input')];
 for(const [currentInputIndex,currentInputQuantity] of [[0,5],[1,1]]){currentMaterialInputs[currentInputIndex].value=String(currentInputQuantity);currentMaterialInputs[currentInputIndex].dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();}
 assertProductionCondition(findProductionButton('workshop.quote').disabled,'총합이 같아도 슬롯별 초과·부족 차단');
 for(const [currentInputIndex,currentInputQuantity] of [[0,4],[1,2]]){currentMaterialInputs[currentInputIndex].value=String(currentInputQuantity);currentMaterialInputs[currentInputIndex].dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();}
 findProductionButton('workshop.quote').click();await settleProductionRender();
 assertProductionCondition(currentQuotedRequests.at(-1).kind==='consumable'&&currentQuotedRequests.at(-1).quantity===2,'소모품 종류와 주문량 전송');
 findProductionButton('workshop.confirm').click();await settleProductionRender();
 assertProductionCondition(currentCreatedRequests.at(-1).quantity===2&&JSON.stringify(currentCreatedRequests.at(-1).materialInputs)===JSON.stringify(currentQuotedRequests.at(-1).materialInputs),'견적 재료와 주문량 그대로 계약 생성');
 const currentPreviousRequest=currentGameClient.request;
 currentGameClient.request=async(currentPath:string,currentBody?:any)=>{
  if(currentPath.includes('/catalog?kind=material'))return {items:[{id:'leather-cord',name:'가죽끈',englishName:'Leather Cord',materialSlots:[{slotId:'leather',requiredQuantity:1,defaultMaterialId:'tanned-leather-low',choices:['low','medium'].map(currentGradeName=>({materialId:'tanned-leather-'+currentGradeName,grade:currentGradeName,ownedQuantity:10,nameTranslations:{ko:currentGradeName,en:currentGradeName}}))}]}]};
  if(currentPath.endsWith('/production-quote')&&currentBody.kind==='material'){
   currentQuotedRequests.push(currentBody);
   return {characterVersion:5,ownedCoins:100,quoteToken:'c'.repeat(64),quote:{definitionId:'leather-cord',definitionSnapshot:{name:'가죽끈',englishName:'Leather Cord'},quantity:4,unitCostP:2,unitDurationSeconds:45,costP:8,durationSeconds:180,requiredMaterials:currentBody.materialInputs,productionResult:{productId:'leather-cord',usage:'material',itemLevel:1,levelPolicyVersion:1,performanceVersion:1,quality:{numerator:5,denominator:4},performance:{material_strength_percent:100}}},materials:currentBody.materialInputs.map((currentInputRecord:any)=>({...currentInputRecord,ownedQuantity:10,consumedQuantity:currentInputRecord.quantity,missingQuantity:0,nameTranslations:{ko:'가죽',en:'Leather'}}))};
  }
  return currentPreviousRequest(currentPath,currentBody);
 };
 findProductionButton('workshop.material').click();await settleProductionRender();
 const currentMaterialSelect=document.querySelector('select')!;currentMaterialSelect.value='leather-cord';currentMaterialSelect.dispatchEvent(new Event('change',{bubbles:true}));await settleProductionRender();
 const currentMaterialQuantity=document.querySelector<HTMLInputElement>('input[max="1000"]')!;currentMaterialQuantity.value='4';currentMaterialQuantity.dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();
 assertProductionCondition(findProductionButton('workshop.quote').disabled,'중간재 주문량에 맞지 않는 재료 차단');
 currentMaterialInputs=[...document.querySelectorAll<HTMLInputElement>('fieldset input')];
 for(const [currentInputIndex,currentInputQuantity] of [[0,3],[1,1]]){currentMaterialInputs[currentInputIndex].value=String(currentInputQuantity);currentMaterialInputs[currentInputIndex].dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();}
 findProductionButton('workshop.quote').click();await settleProductionRender();
 assertProductionCondition(currentQuotedRequests.at(-1).kind==='material'&&currentQuotedRequests.at(-1).quantity===4,'중간재 혼합 견적 전송');
 findProductionButton('workshop.confirm').click();await settleProductionRender();
 assertProductionCondition(currentCreatedRequests.at(-1).kind==='material'&&currentCreatedRequests.at(-1).quantity===4&&JSON.stringify(currentCreatedRequests.at(-1).materialInputs)===JSON.stringify(currentQuotedRequests.at(-1).materialInputs),'중간재 견적과 같은 수량·재료 계약');
 const currentBeforeBatchRequest=currentGameClient.request;
 currentGameClient.request=async(currentPath:string,currentBody?:any)=>{
  if(currentPath.includes('/catalog?kind=craft'))return {items:[{id:'round-shield',name:'원방패',englishName:'Shield',materialSlots:[{slotId:'wood',requiredQuantity:4,defaultMaterialId:'processed-lumber-low',choices:[{materialId:'processed-lumber-low',grade:'low',ownedQuantity:4,nameTranslations:{ko:'목재',en:'Wood'}}]}],batchSlots:[{materialId:'leather-cord',requiredQuantity:1,nameTranslations:{ko:'가죽끈',en:'Leather Cord'},choices:[{batchId:'selected-batch',ownedQuantity:1,itemLevel:1}]}]}]};
  if(currentPath.endsWith('/production-quote')&&currentBody.batchInputs){
   currentQuotedRequests.push(currentBody);
   return {characterVersion:5,ownedCoins:100,quoteToken:'d'.repeat(64),quote:{definitionId:'round-shield',definitionSnapshot:{name:'원방패',englishName:'Shield'},costP:12,durationSeconds:600,selectedMaterials:currentBody.materialInputs,requestedBatches:currentBody.batchInputs},materials:currentBody.materialInputs.map((currentInputRecord:any)=>({...currentInputRecord,ownedQuantity:4,consumedQuantity:4,missingQuantity:0,nameTranslations:{ko:'목재',en:'Wood'}}))};
  }
  return currentBeforeBatchRequest(currentPath,currentBody);
 };
 findProductionButton('workshop.craft').click();await settleProductionRender();
 const currentShieldSelect=document.querySelector('select')!;currentShieldSelect.value='round-shield';currentShieldSelect.dispatchEvent(new Event('change',{bubbles:true}));await settleProductionRender();
 assertProductionCondition(findProductionButton('workshop.quote').disabled,'장비 배치 미선택은 견적 차단');
 const currentBatchInput=document.querySelectorAll('fieldset')[1].querySelector('input')!;
 currentBatchInput.value='2';currentBatchInput.dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();
 assertProductionCondition(findProductionButton('workshop.quote').disabled,'보유 배치 수량 초과는 견적 차단');
 currentBatchInput.value='1';currentBatchInput.dispatchEvent(new Event('input',{bubbles:true}));await settleProductionRender();
 findProductionButton('workshop.quote').click();await settleProductionRender();
 assertProductionCondition(currentQuotedRequests.at(-1).batchInputs[0].batchId==='selected-batch','장비 견적에 보유 배치 선택 전송');
 findProductionButton('workshop.confirm').click();await settleProductionRender();
 assertProductionCondition(JSON.stringify(currentCreatedRequests.at(-1).batchInputs)===JSON.stringify(currentQuotedRequests.at(-1).batchInputs),'장비 계약에 견적 배치 선택 보존');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertions});
}catch(currentFailure){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailure),assertions:currentAssertions});}})();
