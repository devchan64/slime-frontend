export type SkillCardDefinitionEntry={cardId:string;definitionVersion:number;nameTranslations:Record<'ko'|'en',string>;grantsSkill:string;literacyRequired:number;learned:boolean};
export type SkillCardCatalogEntry=SkillCardDefinitionEntry&{priceP:number;owned:boolean};
export type StoredSkillCardEntry=SkillCardDefinitionEntry&{currentLiteracy:number;acquiredAt:number;source:'purchase'|'event'|'legacy_book';storage:'ACCOUNT';expiresAt:null};
export type SkillCardInventoryResponse={characterVersion:number;cards:StoredSkillCardEntry[];catalog?:SkillCardCatalogEntry[]};
export type SkillCardCommandIdentity={kind:'purchase';cardId:string;facilityId:string;definitionVersion:number;priceP:number}|{kind:'use';cardId:string};
export type SkillCardRequestPayload={requestId:string;expectedVersion:number;cardId?:string;definitionVersion?:number;priceP?:number};
export function parseSkillCardInventory(currentResponseValue:unknown):SkillCardInventoryResponse;
export function validateSkillCardCommandResponse(currentCommandResult:unknown,currentExpectedCommand:{characterId:string;generation:number;expectedVersion:number;requestId:string;command:SkillCardCommandIdentity;grantsSkill?:string}):void;
