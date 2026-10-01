export type SkillbookPurchaseRequest={requestId:string;expectedVersion:number;definitionId:string;definitionVersion:number;priceP:number};
export declare function validateSkillbookCommandResponse(currentCommandResult:unknown,currentExpectedCommand:{
 characterId:string;generation:number;expectedVersion:number;definitionId:string;
 purchase?:{requestId:string;facilityId:string;definitionVersion:number;priceP:number};
}):void;
