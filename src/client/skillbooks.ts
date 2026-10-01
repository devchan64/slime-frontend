export type SkillbookCatalogEntry = {definitionId:string;definitionVersion:number;priceP:number;literacyRequired:number;grantsSkill:string;owned:boolean;nameTranslations:Record<'ko'|'en',string>};
export type OwnedSkillbookEntry = Omit<SkillbookCatalogEntry,'owned'> & {requestId:string;facilityId:string;purchasedAt:number;firstReadAt:number|null;weightG:number};
export type SkillbookInventoryResponse = {characterVersion:number;books:OwnedSkillbookEntry[];catalog?:SkillbookCatalogEntry[]};
export {parseSkillbookInventory} from './skillbook-validation.mjs';
