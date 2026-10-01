/** 전체 디자인 참조는 승인된 렌더링 묶음과 정확히 일치해야 한다. */
export type CostumeAppearanceReference={costumeId:string;costumeVersion:number;designId:string;designVersion:number};
const LEGACY_DEFAULT_COSTUME_REFERENCE:Readonly<CostumeAppearanceReference>=Object.freeze({costumeId:'default',costumeVersion:1,designId:'default',designVersion:1});
const SUPPORTED_CHARACTER_DESIGNS:Readonly<Record<string,string>>=Object.freeze({'default@1':'human'});
const COSTUME_REFERENCE_IDENTIFIER=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export function resolveCostumeActorKind(currentReferenceValue:unknown):string{
 const currentReferenceRecord=currentReferenceValue===undefined?LEGACY_DEFAULT_COSTUME_REFERENCE:currentReferenceValue as CostumeAppearanceReference;
 if(!currentReferenceRecord||typeof currentReferenceRecord!=='object'||Array.isArray(currentReferenceRecord)||Object.keys(currentReferenceRecord).sort().join(',')!=='costumeId,costumeVersion,designId,designVersion'
  ||[currentReferenceRecord.costumeId,currentReferenceRecord.designId].some(currentIdentifierValue=>typeof currentIdentifierValue!=='string'||!COSTUME_REFERENCE_IDENTIFIER.test(currentIdentifierValue))
  ||[currentReferenceRecord.costumeVersion,currentReferenceRecord.designVersion].some(currentVersionValue=>!Number.isSafeInteger(currentVersionValue)||currentVersionValue<1))throw new Error('캐릭터 전체 디자인 참조가 올바르지 않습니다.');
 const currentActorKind=SUPPORTED_CHARACTER_DESIGNS[currentReferenceRecord.designId+'@'+currentReferenceRecord.designVersion];
 if(!currentActorKind)throw new Error('지원하지 않는 캐릭터 디자인입니다: '+currentReferenceRecord.designId+'@'+currentReferenceRecord.designVersion);
 return currentActorKind;
}
export function validateSceneCostumeReferences(currentSceneState:{me:{costumeAppearance?:unknown};members?:{costumeAppearance?:unknown}[];battle?:{units:{side:string;costumeAppearance?:unknown}[]}|null}){
 resolveCostumeActorKind(currentSceneState.me.costumeAppearance);
 for(const currentMemberRecord of currentSceneState.members??[])resolveCostumeActorKind(currentMemberRecord.costumeAppearance);
 for(const currentUnitRecord of currentSceneState.battle?.units??[])if(currentUnitRecord.side==='ally')resolveCostumeActorKind(currentUnitRecord.costumeAppearance);
}
