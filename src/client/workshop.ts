import {ApiError} from './response';
export type WorkshopContractKind='craft'|'repair'|'consumable';
export type WorkshopPriceQuote={quantity?:number;unitDurationSeconds?:number;unitCostP?:number;costP:number;durationSeconds:number;definitionSnapshot?:{name:string;englishName:string};instanceVersion?:number;
  before?:{currentDurability:number;maxDurability:number};after?:{currentDurability:number;maxDurability:number}};
export type WorkshopQuoteResponse={characterVersion:number;quoteToken:string;quote:WorkshopPriceQuote;materials:{quantity:number;nameTranslations:{ko:string;en:string}}[]};
export type WorkshopContractPage={characterVersion:number;serverTime:number;nextCursor:string|null;entries:{contractId:string;kind:WorkshopContractKind;
  quote:WorkshopPriceQuote;startedAt:number;readyAt:number;claimedAt:number|null;status:'CLAIMED'|'READY'|'IN_PROGRESS'}[]};
const WORKSHOP_UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireWorkshopCondition(currentConditionResult:unknown):asserts currentConditionResult{
  if(!currentConditionResult)throw new Error('공방 응답 형식이 올바르지 않습니다.');
}
function isWorkshopWholeNumber(currentNumberValue:unknown){return Number.isSafeInteger(currentNumberValue)&&Number(currentNumberValue)>=0;}
function validateWorkshopQuote(currentQuoteValue:any,currentContractKind:WorkshopContractKind){
  requireWorkshopCondition(currentQuoteValue&&isWorkshopWholeNumber(currentQuoteValue.costP)&&isWorkshopWholeNumber(currentQuoteValue.durationSeconds)&&currentQuoteValue.durationSeconds>0);
  if(currentContractKind==='consumable')requireWorkshopCondition(Number.isSafeInteger(currentQuoteValue.quantity)&&currentQuoteValue.quantity>0&&currentQuoteValue.quantity<=1000
    &&Number.isSafeInteger(currentQuoteValue.unitDurationSeconds)&&currentQuoteValue.unitDurationSeconds>0
    &&Number.isSafeInteger(currentQuoteValue.unitCostP)&&currentQuoteValue.unitCostP>0
    &&currentQuoteValue.durationSeconds===currentQuoteValue.quantity*currentQuoteValue.unitDurationSeconds
    &&currentQuoteValue.costP===currentQuoteValue.quantity*currentQuoteValue.unitCostP);
  if(currentContractKind!=='repair')requireWorkshopCondition(typeof currentQuoteValue.definitionSnapshot?.name==='string'&&typeof currentQuoteValue.definitionSnapshot?.englishName==='string');
  else for(const currentDurabilitySnapshot of [currentQuoteValue.before,currentQuoteValue.after])
    requireWorkshopCondition(currentDurabilitySnapshot&&isWorkshopWholeNumber(currentDurabilitySnapshot.currentDurability)&&isWorkshopWholeNumber(currentDurabilitySnapshot.maxDurability)
      &&currentDurabilitySnapshot.currentDurability<=currentDurabilitySnapshot.maxDurability);
}
export function parseWorkshopQuote(currentResponseValue:any,currentContractKind:WorkshopContractKind):WorkshopQuoteResponse{
  requireWorkshopCondition(currentResponseValue&&isWorkshopWholeNumber(currentResponseValue.characterVersion)&&typeof currentResponseValue.quoteToken==='string'&&/^[0-9a-f]{64}$/.test(currentResponseValue.quoteToken));
  validateWorkshopQuote(currentResponseValue.quote,currentContractKind);
  if(currentContractKind==='repair')requireWorkshopCondition(isWorkshopWholeNumber(currentResponseValue.quote.instanceVersion)&&currentResponseValue.quote.instanceVersion>0);
  requireWorkshopCondition(Array.isArray(currentResponseValue.materials));
  for(const currentMaterialRecord of currentResponseValue.materials)requireWorkshopCondition(currentMaterialRecord&&isWorkshopWholeNumber(currentMaterialRecord.quantity)&&currentMaterialRecord.quantity>0
    &&typeof currentMaterialRecord.nameTranslations?.ko==='string'&&typeof currentMaterialRecord.nameTranslations?.en==='string');
  return currentResponseValue;
}
export function parseWorkshopContracts(currentResponseValue:any,currentContractKind:WorkshopContractKind):WorkshopContractPage{
  requireWorkshopCondition(currentResponseValue&&isWorkshopWholeNumber(currentResponseValue.characterVersion)&&Number.isFinite(currentResponseValue.serverTime)
    &&(currentResponseValue.nextCursor===null||typeof currentResponseValue.nextCursor==='string'&&WORKSHOP_UUID_PATTERN.test(currentResponseValue.nextCursor))&&Array.isArray(currentResponseValue.entries));
  const currentContractIdentifiers=new Set<string>();
  for(const currentContractRecord of currentResponseValue.entries){
    requireWorkshopCondition(currentContractRecord&&typeof currentContractRecord.contractId==='string'&&WORKSHOP_UUID_PATTERN.test(currentContractRecord.contractId)
      &&!currentContractIdentifiers.has(currentContractRecord.contractId)&&currentContractRecord.kind===currentContractKind
      &&Number.isFinite(currentContractRecord.startedAt)&&Number.isFinite(currentContractRecord.readyAt)&&currentContractRecord.readyAt>currentContractRecord.startedAt
      &&(currentContractRecord.claimedAt===null||Number.isFinite(currentContractRecord.claimedAt)));
    currentContractIdentifiers.add(currentContractRecord.contractId);
    requireWorkshopCondition(currentContractRecord.status===(currentContractRecord.claimedAt!==null?'CLAIMED':currentResponseValue.serverTime>=currentContractRecord.readyAt?'READY':'IN_PROGRESS'));
    validateWorkshopQuote(currentContractRecord.quote,currentContractKind);
  }
  return currentResponseValue;
}
export function parseWorkshopCatalog(currentResponseValue:any):{id:string;name:string;englishName:string}[]{
  requireWorkshopCondition(currentResponseValue&&Array.isArray(currentResponseValue.items));
  const currentCatalogIdentifiers=new Set<string>();
  for(const currentCatalogItem of currentResponseValue.items){
    requireWorkshopCondition(currentCatalogItem&&[currentCatalogItem.id,currentCatalogItem.name,currentCatalogItem.englishName].every(currentTextValue=>typeof currentTextValue==='string'&&!!currentTextValue.trim())&&!currentCatalogIdentifiers.has(currentCatalogItem.id));
    currentCatalogIdentifiers.add(currentCatalogItem.id);
  }
  return currentResponseValue.items;
}


export async function recoverWorkshopCreationResult(currentRequestClient:{request:(currentRequestPath:string,currentRequestBody?:Record<string,unknown>)=>Promise<any>},
  currentOriginalRequest:Record<string,unknown>,currentFacilityIdentifier:string):Promise<boolean>{
  let currentReceiptResponse;
  try{currentReceiptResponse=await currentRequestClient.request(`/v1/game/workshop-results/${encodeURIComponent(String(currentOriginalRequest.requestId))}?kind=${currentOriginalRequest.kind}`);}
  catch(currentRecoveryError){
    // 이 시점에 기록이 없다는 응답만 원본 ID의 명시적 재시도를 허용한다. 통신 장애는 미확정으로 유지한다.
    if(currentRecoveryError instanceof ApiError&&currentRecoveryError.status===404&&currentRecoveryError.code==='WORKSHOP_RESULT_NOT_FOUND')return false;
    throw currentRecoveryError;
  }
  requireWorkshopCondition(currentReceiptResponse&&currentReceiptResponse.requestId===currentOriginalRequest.requestId
    &&currentReceiptResponse.kind===currentOriginalRequest.kind&&currentReceiptResponse.facilityId===currentFacilityIdentifier
    &&currentReceiptResponse.targetId===currentOriginalRequest.targetId
    &&(currentOriginalRequest.kind!=='consumable'||currentReceiptResponse.quantity===(currentOriginalRequest.quantity??1))
    &&currentReceiptResponse.expectedInstanceVersion===(currentOriginalRequest.expectedInstanceVersion??null)
    &&typeof currentReceiptResponse.contractId==='string'&&WORKSHOP_UUID_PATTERN.test(currentReceiptResponse.contractId)
    &&isWorkshopWholeNumber(currentReceiptResponse.costP));
  return true;
}
