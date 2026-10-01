export type SubstituteHuntQuote = {policyVersion:number;encounterId:string;encounterCatalogVersion:number;speciesId:string;monsterReferenceVersion:number;csp:number;enemyCount:number;fpCost:number};
export type SubstituteHuntEntry = SubstituteHuntQuote & {skillVariantId:string|null;nameTranslations:{ko:string;en:string};eligible:boolean;available:boolean;unavailableReason:'INVALID_STATE'|'FIRST_HUNT_REQUIRED'|'INSUFFICIENT_FP'|null};
export type SubstituteHuntCatalog = {characterVersion:number;fp:number;encounters:SubstituteHuntEntry[]};
export type SubstituteHuntReceipt = {ok:true;kind:'substitute_hunt';requestId:string;substituteHunt:SubstituteHuntQuote & {dropCatalogVersion:number;dissectionPolicyVersion:number;materials:{materialId:string;quantity:number}[];fpConsumed:number;fpRemaining:number;characterVersion:number}};
function requireHuntResponse(currentResponseCondition:unknown):asserts currentResponseCondition {if(!currentResponseCondition)throw new Error('대체 사냥 응답 형식이 올바르지 않습니다.');}
function isHuntRecord(currentResponseValue:unknown):currentResponseValue is Record<string,unknown>{return !!currentResponseValue&&typeof currentResponseValue==='object'&&!Array.isArray(currentResponseValue);}
function isHuntInteger(currentResponseValue:unknown,currentMinimumValue=0):currentResponseValue is number{return typeof currentResponseValue==='number'&&Number.isSafeInteger(currentResponseValue)&&currentResponseValue>=currentMinimumValue;}
function isHuntIdentifier(currentResponseValue:unknown):currentResponseValue is string{return typeof currentResponseValue==='string'&&/^[a-z][a-z0-9-]*$/.test(currentResponseValue);}
function validateHuntQuote(currentResponseValue:unknown):asserts currentResponseValue is SubstituteHuntQuote {
 requireHuntResponse(isHuntRecord(currentResponseValue));
 for(const currentVersionField of ['policyVersion','encounterCatalogVersion','monsterReferenceVersion'])requireHuntResponse(isHuntInteger(currentResponseValue[currentVersionField],1));
 requireHuntResponse(isHuntIdentifier(currentResponseValue.encounterId)&&isHuntIdentifier(currentResponseValue.speciesId));
 requireHuntResponse(isHuntInteger(currentResponseValue.csp,1)&&isHuntInteger(currentResponseValue.enemyCount,1)&&isHuntInteger(currentResponseValue.fpCost,1));
 requireHuntResponse(currentResponseValue.fpCost===currentResponseValue.csp*currentResponseValue.enemyCount);
}
export function parseSubstituteHuntCatalog(currentResponseValue:unknown):SubstituteHuntCatalog {
 requireHuntResponse(isHuntRecord(currentResponseValue)&&isHuntInteger(currentResponseValue.characterVersion)&&isHuntInteger(currentResponseValue.fp,-Number.MAX_SAFE_INTEGER)&&currentResponseValue.fp<=1000&&Array.isArray(currentResponseValue.encounters));
 const currentEncounterIdentifiers=new Set<string>();
 for(const currentEntryValue of currentResponseValue.encounters){
  requireHuntResponse(isHuntRecord(currentEntryValue));validateHuntQuote(currentEntryValue);
  requireHuntResponse(!currentEncounterIdentifiers.has(currentEntryValue.encounterId));currentEncounterIdentifiers.add(currentEntryValue.encounterId);
  const currentEntryRecord=currentEntryValue as unknown as Record<string,unknown>;
  requireHuntResponse(currentEntryRecord.skillVariantId===null||isHuntIdentifier(currentEntryRecord.skillVariantId));
  requireHuntResponse(isHuntRecord(currentEntryRecord.nameTranslations)&&['ko','en'].every(currentLocaleCode=>typeof (currentEntryRecord.nameTranslations as Record<string,unknown>)[currentLocaleCode]==='string'&&((currentEntryRecord.nameTranslations as Record<string,string>)[currentLocaleCode]).trim()));
  requireHuntResponse(typeof currentEntryRecord.eligible==='boolean'&&typeof currentEntryRecord.available==='boolean');
  requireHuntResponse([null,'INVALID_STATE','FIRST_HUNT_REQUIRED','INSUFFICIENT_FP'].includes(currentEntryRecord.unavailableReason as string|null));
  requireHuntResponse(currentEntryRecord.available===(currentEntryRecord.unavailableReason===null));
  requireHuntResponse(!currentEntryRecord.available||(currentEntryRecord.eligible&&currentResponseValue.fp>=currentEntryValue.fpCost));
 }
 return currentResponseValue as unknown as SubstituteHuntCatalog;
}
export function parseSubstituteHuntReceipt(currentResponseValue:unknown,currentRequestIdentifier:string,currentEncounterIdentifier:string):SubstituteHuntReceipt {
 requireHuntResponse(isHuntRecord(currentResponseValue)&&currentResponseValue.ok===true&&currentResponseValue.kind==='substitute_hunt'&&currentResponseValue.requestId===currentRequestIdentifier);
 const currentResultValue=currentResponseValue.substituteHunt;requireHuntResponse(isHuntRecord(currentResultValue));validateHuntQuote(currentResultValue);
 const currentResultRecord=currentResultValue as unknown as Record<string,unknown>;
 requireHuntResponse(currentResultValue.encounterId===currentEncounterIdentifier&&currentResultRecord.fpConsumed===currentResultValue.fpCost&&isHuntInteger(currentResultRecord.fpRemaining)&&Number(currentResultRecord.fpRemaining)<=1000);
 for(const currentResultField of ['dropCatalogVersion','dissectionPolicyVersion','characterVersion'])requireHuntResponse(isHuntInteger(currentResultRecord[currentResultField],1));
 requireHuntResponse(Array.isArray(currentResultRecord.materials));
 for(const currentMaterialEntry of currentResultRecord.materials)requireHuntResponse(isHuntRecord(currentMaterialEntry)&&isHuntIdentifier(currentMaterialEntry.materialId)&&isHuntInteger(currentMaterialEntry.quantity,1));
 return currentResponseValue as unknown as SubstituteHuntReceipt;
}
