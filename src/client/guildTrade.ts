export type GuildMaterialCatalog={characterVersion:number;policyVersion:number;maximumQuantity:number;items:{materialId:string;quantity:number;unitPriceP:number;nameTranslations:{ko:string;en:string}}[]};
export type GuildMaterialQuote={characterVersion:number;policyVersion:number;materialId:string;quantity:number;unitPriceP:number;totalPriceP:number;maximumQuantity:number};
export {parseGuildMaterialCatalog,parseGuildMaterialQuote,validateGuildSaleReceipt,parseCitizenshipPriceQuote,validateCitizenshipPurchaseReceipt} from './guild-trade-validation.mjs';
