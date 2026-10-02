import type {WorkshopReadKind,WorkshopQuoteResponse,WorkshopContractPage} from './workshop';
export function parseWorkshopQuote(currentResponseValue:unknown,currentContractKind:WorkshopReadKind,currentRequestedSelection?:{targetId:string;quantity?:number;materialInputs?:import('./workshop').WorkshopMaterialInput[]}):WorkshopQuoteResponse;
export function parseWorkshopContracts<CurrentWorkshopKind extends WorkshopReadKind>(currentResponseValue:unknown,currentContractKind:CurrentWorkshopKind):WorkshopContractPage<CurrentWorkshopKind>;
export function parseWorkshopCatalog(currentResponseValue:unknown):{id:string;name:string;englishName:string;materialSelection?:import('./workshop').WorkshopMaterialSelection;materialSlots?:(import('./workshop').WorkshopMaterialSelection & {slotId:string})[]}[];

export function matchesWorkshopMaterials(currentExpectedMaterials:unknown,currentActualMaterials:unknown):boolean;
