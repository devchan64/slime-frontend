export function validateGuildMembership(currentMembershipValue,currentCharacterIdentifier) {
  if(currentMembershipValue === null || currentMembershipValue === undefined)return currentMembershipValue;
  if(typeof currentMembershipValue !== 'object'||Array.isArray(currentMembershipValue))throw new Error('길드 소속 정보가 올바르지 않습니다.');
  const currentMembershipRecord=currentMembershipValue;
  if(Object.keys(currentMembershipRecord).sort().join(',')!=='certificateStatus,characterId,guildId'
    ||currentMembershipRecord.guildId!=='adventurers-guild'||currentMembershipRecord.characterId!==currentCharacterIdentifier
    ||currentMembershipRecord.certificateStatus!=='ISSUED')throw new Error('길드 자격증 소유자 또는 상태가 올바르지 않습니다.');
  return currentMembershipRecord;
}
