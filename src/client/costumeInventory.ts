import {parseCostumeCatalog,type CostumeCatalogEntry} from './costumeCatalog';
export type OwnedCostumeEntry=CostumeCatalogEntry&{valueP:number;source:'parcel'|'shop';acquiredAt:number};
export type CostumeInventoryPage={characterVersion:number;defaultCostumeId:string;entries:OwnedCostumeEntry[]};
export function parseCostumeInventory(currentResponseValue:unknown):CostumeInventoryPage{
 if(!currentResponseValue||typeof currentResponseValue!=='object'||Array.isArray(currentResponseValue)||Object.keys(currentResponseValue).sort().join(',')!=='characterVersion,defaultCostumeId,entries')throw new Error('코스튬 소유 목록 필드가 올바르지 않습니다.');
 const currentResponseRecord=currentResponseValue as CostumeInventoryPage;
 if(!Number.isSafeInteger(currentResponseRecord.characterVersion)||currentResponseRecord.characterVersion<0||typeof currentResponseRecord.defaultCostumeId!=='string'||!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(currentResponseRecord.defaultCostumeId)||!Array.isArray(currentResponseRecord.entries))throw new Error('코스튬 소유 목록이 올바르지 않습니다.');
 const currentSeenIdentifiers=new Set<string>();
 for(const currentOwnedEntry of currentResponseRecord.entries){
  if(!currentOwnedEntry||typeof currentOwnedEntry!=='object'||Array.isArray(currentOwnedEntry))throw new Error('코스튬 소유 항목이 올바르지 않습니다.');
  const {valueP:currentValuePoints,source:currentSourceKind,acquiredAt:currentAcquiredTime,...currentDefinitionRecord}=currentOwnedEntry;
  parseCostumeCatalog({version:2,defaultCostumeId:currentDefinitionRecord.costumeId,entries:[{...currentDefinitionRecord,valueP:currentValuePoints}]});
  if(!Number.isSafeInteger(currentValuePoints)||currentValuePoints<1||(currentSourceKind!=='parcel'&&currentSourceKind!=='shop')||!Number.isFinite(currentAcquiredTime)||currentAcquiredTime<0||!Number.isFinite(new Date(currentAcquiredTime*1000).getTime())||currentSeenIdentifiers.has(currentDefinitionRecord.costumeId))throw new Error('코스튬 획득 기록이 올바르지 않습니다.');
  currentSeenIdentifiers.add(currentDefinitionRecord.costumeId);
 }
 return currentResponseRecord;
}
