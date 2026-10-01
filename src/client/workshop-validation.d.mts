import type {WorkshopContractKind,WorkshopQuoteResponse,WorkshopContractPage} from './workshop';
export function parseWorkshopQuote(currentResponseValue:unknown,currentContractKind:WorkshopContractKind,currentRequestedSelection?:{targetId:string;quantity?:number}):WorkshopQuoteResponse;
export function parseWorkshopContracts(currentResponseValue:unknown,currentContractKind:WorkshopContractKind):WorkshopContractPage;
export function parseWorkshopCatalog(currentResponseValue:unknown):{id:string;name:string;englishName:string}[];
