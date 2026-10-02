// 표시 HP가 0이어도 내부 소수 HP가 남아 있으면 전투불능이 아니다.
export function isHealthDepleted(currentHealthRecord) {
  if (currentHealthRecord.healthDepleted !== undefined) {
    if (typeof currentHealthRecord.healthDepleted !== 'boolean') throw new Error('HP 소진 상태는 참/거짓이어야 합니다.');
    return currentHealthRecord.healthDepleted;
  }
  return typeof currentHealthRecord.hp === 'number' && currentHealthRecord.hp <= 0;
}
