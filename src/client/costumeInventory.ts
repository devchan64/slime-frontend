import {type CostumeCatalogEntry} from './costumeCatalog';
export type OwnedCostumeEntry=CostumeCatalogEntry&{valueP:number;source:'parcel'|'shop';acquiredAt:number};
export type CostumeInventoryPage={characterVersion:number;defaultCostumeId:string;entries:OwnedCostumeEntry[]};
export {parseCostumeInventory} from './costume-inventory-validation.mjs';
