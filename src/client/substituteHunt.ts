export type SubstituteHuntQuote = {policyVersion:number;encounterId:string;encounterCatalogVersion:number;speciesId:string;monsterReferenceVersion:number;csp:number;enemyCount:number;fpCost:number};
export type SubstituteHuntEntry = SubstituteHuntQuote & {skillVariantId:string|null;nameTranslations:{ko:string;en:string};eligible:boolean;available:boolean;unavailableReason:'INVALID_STATE'|'FIRST_HUNT_REQUIRED'|'INSUFFICIENT_FP'|null};
export type SubstituteHuntCatalog = {characterVersion:number;fp:number;encounters:SubstituteHuntEntry[]};
export type SubstituteHuntReceipt = {ok:true;kind:'substitute_hunt';requestId:string;substituteHunt:SubstituteHuntQuote & {dropCatalogVersion:number;dissectionPolicyVersion:number;materials:{materialId:string;quantity:number}[];fpConsumed:number;fpRemaining:number;characterVersion:number}};
export {parseSubstituteHuntCatalog,parseSubstituteHuntReceipt} from './substitute-hunt-validation.mjs';
