export type SkillbookCatalogEntry = {definitionId:string;definitionVersion:number;priceP:number;literacyRequired:number;grantsSkill:string;owned:boolean;nameTranslations:Record<'ko'|'en',string>};
export type OwnedSkillbookEntry = Omit<SkillbookCatalogEntry,'owned'> & {requestId:string;facilityId:string;purchasedAt:number;firstReadAt:number|null;weightG:number};
export type SkillbookInventoryResponse = {characterVersion:number;books:OwnedSkillbookEntry[];catalog?:SkillbookCatalogEntry[]};
export function parseSkillbookInventory(currentResponseValue:unknown):SkillbookInventoryResponse {
  const currentBookResponse=currentResponseValue as SkillbookInventoryResponse;
  if(!currentBookResponse||!Number.isSafeInteger(currentBookResponse.characterVersion)||currentBookResponse.characterVersion<0||!Array.isArray(currentBookResponse.books)
    ||(currentBookResponse.catalog!==undefined&&!Array.isArray(currentBookResponse.catalog)))throw new Error('스킬북 목록 응답이 올바르지 않습니다.');
  for(const currentEntryCollection of [currentBookResponse.books,currentBookResponse.catalog??[]]){
    const currentBookIdentifiers=new Set<string>();
    for(const currentBookEntry of currentEntryCollection){
      if(!currentBookEntry||typeof currentBookEntry.definitionId!=='string'||!currentBookEntry.definitionId||currentBookIdentifiers.has(currentBookEntry.definitionId)
        ||![currentBookEntry.definitionVersion,currentBookEntry.priceP,currentBookEntry.literacyRequired].every(currentNumericValue=>Number.isSafeInteger(currentNumericValue)&&currentNumericValue>=1)
        ||typeof currentBookEntry.grantsSkill!=='string'||!currentBookEntry.grantsSkill||!currentBookEntry.nameTranslations?.ko||!currentBookEntry.nameTranslations?.en
        ||typeof currentBookEntry.nameTranslations.ko!=='string'||typeof currentBookEntry.nameTranslations.en!=='string')throw new Error('스킬북 정의 응답이 올바르지 않습니다.');
      currentBookIdentifiers.add(currentBookEntry.definitionId);
    }
  }
  for(const currentBookEntry of currentBookResponse.books){
    if(typeof currentBookEntry.requestId!=='string'||!currentBookEntry.requestId||typeof currentBookEntry.facilityId!=='string'||!currentBookEntry.facilityId
      ||!Number.isFinite(currentBookEntry.purchasedAt)||currentBookEntry.purchasedAt<0
      ||!(currentBookEntry.firstReadAt===null||Number.isFinite(currentBookEntry.firstReadAt)&&currentBookEntry.firstReadAt>=currentBookEntry.purchasedAt)
      ||!Number.isSafeInteger(currentBookEntry.weightG)||currentBookEntry.weightG<0)throw new Error('스킬북 소유 응답이 올바르지 않습니다.');
  }
  for(const currentBookEntry of currentBookResponse.catalog??[]){if(typeof currentBookEntry.owned!=='boolean'
    ||currentBookEntry.owned!==currentBookResponse.books.some(currentOwnedEntry=>currentOwnedEntry.definitionId===currentBookEntry.definitionId))throw new Error('스킬북 소유 여부가 일치하지 않습니다.');}
  return currentBookResponse;
}
