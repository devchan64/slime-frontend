export type HuntLedgerEntry = {
  id:number; monsterInstanceId:string; monsterTypeId:string; battleId:string;
  spawnId:string; mapId:string; quantity:number; result:string; createdAt:number;
};
export type HuntLedgerPage = {
  entries:HuntLedgerEntry[]; totals:{monsterTypeId:string;quantity:number}[]; nextCursor:number|null;
};
export function parseHuntLedgerPage(receivedLedgerValue:unknown, requestedLedgerCursor=0):HuntLedgerPage {
  const currentLedgerPage=receivedLedgerValue as HuntLedgerPage;
  const invalidLedgerMessage='사냥 원장 응답이 올바르지 않습니다.';
  if(!Number.isSafeInteger(requestedLedgerCursor)||requestedLedgerCursor<0||!currentLedgerPage
    ||!Array.isArray(currentLedgerPage.entries)||!Array.isArray(currentLedgerPage.totals)) throw new Error(invalidLedgerMessage);
  const seenSpeciesIdentifiers=new Set<string>();
  for(const currentSpeciesTotal of currentLedgerPage.totals){
    if(!currentSpeciesTotal||typeof currentSpeciesTotal.monsterTypeId!=='string'||!currentSpeciesTotal.monsterTypeId
      ||seenSpeciesIdentifiers.has(currentSpeciesTotal.monsterTypeId)||!Number.isSafeInteger(currentSpeciesTotal.quantity)||currentSpeciesTotal.quantity<1)
      throw new Error(invalidLedgerMessage);
    seenSpeciesIdentifiers.add(currentSpeciesTotal.monsterTypeId);
  }
  let previousEntryIdentifier=requestedLedgerCursor;
  const seenInstanceIdentifiers=new Set<string>();
  for(const currentLedgerEntry of currentLedgerPage.entries){
    if(!currentLedgerEntry||!Number.isSafeInteger(currentLedgerEntry.id)||currentLedgerEntry.id<=previousEntryIdentifier
      ||!['monsterInstanceId','monsterTypeId','battleId','spawnId','mapId','result'].every(currentEntryKey=>
        typeof currentLedgerEntry[currentEntryKey as keyof HuntLedgerEntry]==='string'&&String(currentLedgerEntry[currentEntryKey as keyof HuntLedgerEntry]).length>0)
      ||seenInstanceIdentifiers.has(currentLedgerEntry.monsterInstanceId)||!seenSpeciesIdentifiers.has(currentLedgerEntry.monsterTypeId)
      ||!Number.isSafeInteger(currentLedgerEntry.quantity)||currentLedgerEntry.quantity<1
      ||!Number.isFinite(currentLedgerEntry.createdAt)||currentLedgerEntry.createdAt<0||!Number.isFinite(new Date(currentLedgerEntry.createdAt*1000).getTime()))
      throw new Error(invalidLedgerMessage);
    previousEntryIdentifier=currentLedgerEntry.id;seenInstanceIdentifiers.add(currentLedgerEntry.monsterInstanceId);
  }
  if(currentLedgerPage.nextCursor!==null&&(!currentLedgerPage.entries.length||currentLedgerPage.nextCursor!==previousEntryIdentifier))
    throw new Error(invalidLedgerMessage);
  return currentLedgerPage;
}
