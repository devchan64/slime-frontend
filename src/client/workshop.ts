import {matchesWorkshopMaterials,matchesWorkshopBatches} from './workshop-validation.mjs';
import {ApiError} from './response';
export type WorkshopBatchInput={batchId:string;quantity:number};
export type WorkshopBatchSlot={materialId:string;requiredQuantity:number;nameTranslations:{ko:string;en:string};choices:{batchId:string;ownedQuantity:number;itemLevel:number}[]};
export type WorkshopMaterialInput={materialId:string;quantity:number};
export type WorkshopMaterialSelection={requiredQuantity:number;defaultMaterialId:string;choices:{materialId:string;grade:'low'|'medium'|'high';ownedQuantity:number;nameTranslations:{ko:string;en:string}}[]};
export type WorkshopContractKind='craft'|'repair'|'consumable'|'material';
export type WorkshopReadKind=WorkshopContractKind;
export type WorkshopPriceQuote={requestedBatches?:WorkshopBatchInput[];productionResult?:{itemLevel:number;performanceVersion:number};baseCostP?:number;missingMaterialValueP?:number;missingMaterialCostP?:number;quantity?:number;unitDurationSeconds?:number;unitCostP?:number;costP:number;durationSeconds:number;definitionSnapshot?:{name:string;englishName:string};instanceVersion?:number;
  before?:{currentDurability:number;maxDurability:number};after?:{currentDurability:number;maxDurability:number}};
export type WorkshopQuoteResponse={characterVersion:number;ownedCoins?:number;quoteToken:string;quote:WorkshopPriceQuote;materials:{quantity:number;ownedQuantity?:number;materialId?:string;consumedQuantity?:number;missingQuantity?:number;nameTranslations:{ko:string;en:string}}[]};
export type WorkshopContractPage<CurrentWorkshopKind extends WorkshopReadKind=WorkshopContractKind>={characterVersion:number;serverTime:number;nextCursor:string|null;entries:{contractId:string;kind:CurrentWorkshopKind;
  quote:WorkshopPriceQuote;startedAt:number;readyAt:number;claimedAt:number|null;status:'CLAIMED'|'READY'|'IN_PROGRESS'}[]};
export {parseWorkshopQuote,parseWorkshopContracts,parseWorkshopCatalog} from './workshop-validation.mjs';
const WORKSHOP_UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireWorkshopCondition(currentConditionResult:unknown):asserts currentConditionResult{
  if(!currentConditionResult)throw new Error('공방 응답 형식이 올바르지 않습니다.');
}
function isWorkshopWholeNumber(currentNumberValue:unknown){return Number.isSafeInteger(currentNumberValue)&&Number(currentNumberValue)>=0;}
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
    &&(!['consumable','material'].includes(String(currentOriginalRequest.kind))||currentReceiptResponse.quantity===(currentOriginalRequest.quantity??1))
    &&(currentOriginalRequest.batchInputs===undefined||matchesWorkshopBatches(currentOriginalRequest.batchInputs,currentReceiptResponse.batches))
    &&(currentOriginalRequest.materialInputs===undefined||matchesWorkshopMaterials(currentOriginalRequest.materialInputs,currentReceiptResponse.materials))
    &&currentReceiptResponse.expectedInstanceVersion===(currentOriginalRequest.expectedInstanceVersion??null)
    &&typeof currentReceiptResponse.contractId==='string'&&WORKSHOP_UUID_PATTERN.test(currentReceiptResponse.contractId)
    &&isWorkshopWholeNumber(currentReceiptResponse.costP));
  return true;
}
