import {render} from 'preact';
import {EquipmentPanel} from '../../src/ui/EquipmentPanel';
import {setLocale,t} from '../../src/i18n';
const currentRootElement=document.getElementById('root')!;
const currentAssertions:string[]=[];
function assertEquipmentBrowser(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);currentAssertions.push(currentMessage);}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 const currentInstanceIdentifier='11111111-1111-4111-8111-111111111111';
 const currentItemRecord={instanceId:currentInstanceIdentifier,definitionId:'iron-sword',definitionVersion:2,stateVersion:1,nameTranslations:{ko:'중량 검사 검',en:'Weight test sword'},description:'검',slot:'main_hand',equippedSlot:null,reserved:false,currentDurability:80,maxDurability:80,weightG:40000,statBonus:{attackFlat:2,defenseFlat:0}};
 const currentBaseSummary={policyVersion:1,totalWeightG:0,baseMaxAp:4,penaltyAp:0,effectiveMaxAp:4};
 const currentHeavySummary={policyVersion:1,totalWeightG:40000,baseMaxAp:4,penaltyAp:4,effectiveMaxAp:0};
 let currentInventoryPage:any={serverTime:100,characterVersion:1,items:[currentItemRecord],slots:{},knownEquipmentWeightG:40000,nextCursor:null,actionPoints:currentBaseSummary,equipActionPoints:{[currentInstanceIdentifier]:currentHeavySummary},unequipActionPoints:{}};
 let currentMutationCount=0;
 const currentGameClient:any={tokens:{user_id:'hero'},state:{generation:1},request:async(currentRequestPath:string,currentRequestBody:any)=>{
  if(currentRequestBody)currentMutationCount++;
  if(currentRequestPath!=='/v1/game/equipment')throw new Error('예기치 않은 요청');
  return structuredClone(currentInventoryPage);
 }};
 const renderEquipmentPanel=()=>render(<EquipmentPanel gameSessionClient={currentGameClient} actionsAreDisabled={false} characterStateVersion={currentInventoryPage.characterVersion}/>,currentRootElement);
 renderEquipmentPanel();await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,250));
 assertEquipmentBrowser(document.body.textContent!.includes(t('equipment.actionPoints',{base:4,weight:0,penalty:0,maximum:4})),'미장착 무게 제외 요약');
 assertEquipmentBrowser(document.body.textContent!.includes(t('equipment.equipAp',{maximum:0})),'장착 전 최대 AP 0 안내');
 currentInventoryPage={...currentInventoryPage,characterVersion:2,items:[{...currentItemRecord,equippedSlot:'main_hand'}],slots:{main_hand:{...currentItemRecord,equippedSlot:'main_hand'}},actionPoints:currentHeavySummary,unequipActionPoints:{main_hand:currentBaseSummary}};
 renderEquipmentPanel();await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,250));
 assertEquipmentBrowser(document.body.textContent!.includes(t('equipment.actionPoints',{base:4,weight:40000,penalty:4,maximum:0})),'장착 후 AP 요약');
 assertEquipmentBrowser(document.body.textContent!.includes(t('equipment.zeroActionPoints')),'행동 불가 및 해소 안내');
 assertEquipmentBrowser(document.body.textContent!.includes(t('equipment.unequipAp',{maximum:4})),'해제 후 최대 AP 복구 안내');
 assertEquipmentBrowser(currentMutationCount===0,'미리보기는 장비 변경 명령 없음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertions});
}catch(currentFailure){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailure),assertions:currentAssertions});}})();
