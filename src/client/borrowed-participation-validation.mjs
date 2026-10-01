export const BORROWED_EXCLUSION_LABELS = {
  EXPIRED: 'battle.supportExpired', OUT_OF_RANGE: 'battle.supportCpMismatch',
  MIGRATION_REQUIRED: 'battle.supportMigration', RECOVERY_PENDING: 'battle.supportRecovering', IN_BATTLE: 'battle.supportBusy',
};
export function parseBorrowedParticipation(currentResponseValue) {
  const currentResponseRecord=currentResponseValue;
  const validateParticipantEntry=(currentParticipantEntry)=>!!currentParticipantEntry
    && typeof currentParticipantEntry.loanId==='string' && !!currentParticipantEntry.loanId
    && typeof currentParticipantEntry.name==='string' && !!currentParticipantEntry.name;
  if(!currentResponseRecord || !Number.isFinite(currentResponseRecord.serverTime)
    || !Array.isArray(currentResponseRecord.participants) || !currentResponseRecord.participants.every(validateParticipantEntry)
    || !Array.isArray(currentResponseRecord.excluded) || !currentResponseRecord.excluded.every(currentExcludedEntry=>
      validateParticipantEntry(currentExcludedEntry) && Object.hasOwn(BORROWED_EXCLUSION_LABELS,currentExcludedEntry.reason)))
    throw new Error('대여 참가 명단 응답 형식이 올바르지 않습니다.');
  const currentParticipantIdentifiers=[...currentResponseRecord.participants,...currentResponseRecord.excluded].map(currentEntry=>currentEntry.loanId);
  if(new Set(currentParticipantIdentifiers).size!==currentParticipantIdentifiers.length)throw new Error('대여 참가 명단에 중복이 있습니다.');
  return structuredClone(currentResponseRecord);
}
