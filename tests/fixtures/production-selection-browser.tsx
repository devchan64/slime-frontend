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
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertions});
}catch(currentFailure){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailure),assertions:currentAssertions});}})();
