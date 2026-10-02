// 표시 HP가 0이어도 내부 소수 HP가 남아 있으면 전투불능이 아니다.
export function isHealthDepleted(currentHealthRecord) {
  if (currentHealthRecord.healthDepleted !== undefined) {
    if (typeof currentHealthRecord.healthDepleted !== 'boolean') throw new Error('HP 소진 상태는 참/거짓이어야 합니다.');
    return currentHealthRecord.healthDepleted;
  }
  return typeof currentHealthRecord.hp === 'number' && currentHealthRecord.hp <= 0;
}

// 표시 HP가 최대치로 올림되어도 실제로 덜 회복된 상태를 구분한다.
export function isHealthFull(currentHealthRecord) {
  if (currentHealthRecord.healthFull !== undefined) {
    if (typeof currentHealthRecord.healthFull !== 'boolean') throw new Error('HP 완충 상태는 참/거짓이어야 합니다.');
    return currentHealthRecord.healthFull;
  }
  return typeof currentHealthRecord.hp === 'number' && typeof currentHealthRecord.maxHp === 'number'
    && currentHealthRecord.hp >= currentHealthRecord.maxHp;
}
