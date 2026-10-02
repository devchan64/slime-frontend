export type RefiningMissionRecord = {characterId:string;requestId:string;status:'ACTIVE'|'CANCELLED'|'COMPLETED';acceptedAt:number;cancelledAt?:number|null;completedAt?:number|null;quote:{definitionSnapshot:{missionId:string;cityId:string;receiverNpcId:string;collectionId:string;grade:string;quantity:number;rewardP:number};deposit:{depositP:number};rewardP:number;refining:{inputQuantity:number;outputQuantity:number;costP:number;durationSeconds:number;grade:string;outputMaterial:{name:string;englishName:string}}}};
export type RefiningMissionPage = {characterVersion:number;serverTime:number;nextOffset:number|null;entries:RefiningMissionRecord[]};
export const MISSION_REQUEST_ID_PATTERN:RegExp;
export function validateMissionRecord(currentValue:unknown,currentCharacterIdentifier:string):RefiningMissionRecord;
export function validateMissionPage(currentValue:unknown,currentCharacterIdentifier:string,currentPageOffset?:number):RefiningMissionPage;

export function validateMissionCancellation(currentReceiptValue:unknown,currentOriginalRecord:RefiningMissionRecord,currentCharacterIdentifier:string):RefiningMissionRecord;
