export type RefiningContractEntry = {
  contractId:string; facilityId:string; startedAt:number; readyAt:number; claimedAt:number|null;
  status:'IN_PROGRESS'|'READY'|'CLAIMED';
  quote:{processingMethod?:'refining'|'smelting';grade:'low'|'medium'|'high';outputQuantity:number;inputQuantity:number;costP:number;durationSeconds:number;
    outputMaterial:{materialId:string;name:string;englishName:string;materialKind?:'material'|'essence';essenceAttribute?:string|null}};
};
export type RefiningContractPage = {serverTime:number;characterVersion:number;entries:RefiningContractEntry[];nextCursor:string|null};
export type RefiningRecipeEntry = RefiningContractEntry['quote'] & {collectionId:string};
export type RefiningCatalogData = {facilityId:string;available:boolean;unavailableReason:string|null;entries:RefiningRecipeEntry[];grades:string[]};
export type RefiningQuoteData = {quote:RefiningRecipeEntry & {ownedQuantity:number};quoteToken:string;characterVersion:number;ownedCoins:number};
export {parseRefiningContracts,parseRefiningCatalog,parseRefiningQuote} from './refining-validation.mjs';
