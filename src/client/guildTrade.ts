export type GuildMaterialCatalog={characterVersion:number;policyVersion:number;maximumQuantity:number;items:{materialId:string;quantity:number;unitPriceP:number;nameTranslations:{ko:string;en:string}}[]};
export type GuildMaterialQuote={characterVersion:number;policyVersion:number;materialId:string;quantity:number;unitPriceP:number;totalPriceP:number;maximumQuantity:number};
function requireGuildResponseCondition(currentValidationResult:unknown):asserts currentValidationResult{
  if(!currentValidationResult)throw new Error('길드 거래 응답 형식이 올바르지 않습니다.');
}
function isGuildPositiveInteger(currentNumericValue:unknown){return Number.isSafeInteger(currentNumericValue)&&Number(currentNumericValue)>0;}
export function parseGuildMaterialCatalog(currentResponseValue:any):GuildMaterialCatalog{
  requireGuildResponseCondition(currentResponseValue&&Number.isSafeInteger(currentResponseValue.characterVersion)&&currentResponseValue.characterVersion>=0
    &&isGuildPositiveInteger(currentResponseValue.policyVersion)&&isGuildPositiveInteger(currentResponseValue.maximumQuantity)&&Array.isArray(currentResponseValue.items));
  const currentMaterialIdentifiers=new Set<string>();
  for(const currentMaterialEntry of currentResponseValue.items){
    requireGuildResponseCondition(currentMaterialEntry&&typeof currentMaterialEntry.materialId==='string'&&currentMaterialEntry.materialId.length>0&&!currentMaterialIdentifiers.has(currentMaterialEntry.materialId)
      &&isGuildPositiveInteger(currentMaterialEntry.quantity)&&isGuildPositiveInteger(currentMaterialEntry.unitPriceP)
      &&typeof currentMaterialEntry.nameTranslations?.ko==='string'&&typeof currentMaterialEntry.nameTranslations?.en==='string');
    currentMaterialIdentifiers.add(currentMaterialEntry.materialId);
  }
  return currentResponseValue;
}
export function parseGuildMaterialQuote(currentResponseValue:any,currentMaterialIdentifier:string,currentSaleQuantity:number):GuildMaterialQuote{
  requireGuildResponseCondition(currentResponseValue&&Number.isSafeInteger(currentResponseValue.characterVersion)&&currentResponseValue.characterVersion>=0
    &&isGuildPositiveInteger(currentResponseValue.policyVersion)&&isGuildPositiveInteger(currentResponseValue.maximumQuantity)
    &&currentResponseValue.materialId===currentMaterialIdentifier&&currentResponseValue.quantity===currentSaleQuantity
    &&isGuildPositiveInteger(currentResponseValue.unitPriceP)&&isGuildPositiveInteger(currentResponseValue.totalPriceP)
    &&currentSaleQuantity<=currentResponseValue.maximumQuantity&&currentResponseValue.totalPriceP===currentSaleQuantity*currentResponseValue.unitPriceP);
  return currentResponseValue;
}
export function validateGuildSaleReceipt(currentReceiptValue:any,currentOriginalRequest:Record<string,unknown>,currentFacilityIdentifier:string){
  requireGuildResponseCondition(currentReceiptValue&&typeof currentReceiptValue.saleId==='string'&&/^[0-9a-f-]{36}$/i.test(currentReceiptValue.saleId)
    &&currentReceiptValue.facilityId===currentFacilityIdentifier&&Number.isFinite(currentReceiptValue.completedAt)
    &&currentReceiptValue.totalPriceP===Number(currentOriginalRequest.quantity)*Number(currentOriginalRequest.unitPriceP));
  for(const currentFieldName of ['requestId','materialId','quantity','policyVersion','unitPriceP'])
    requireGuildResponseCondition(currentReceiptValue[currentFieldName]===currentOriginalRequest[currentFieldName]);
}
