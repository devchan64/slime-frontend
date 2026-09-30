/** 서버가 계산한 실효과만 표시하며 클라이언트에서 피해를 재계산하지 않는다. */
export function formatSkillEffectPreview(currentTargetPreview: {damage:number;healing?:number;drainHealing?:number},
  translateEffectMessage: (currentMessageKey:string,currentMessageValues:Record<string,number>)=>string):string {
  for(const currentEffectValue of [currentTargetPreview.damage,currentTargetPreview.healing ?? 0,currentTargetPreview.drainHealing ?? 0])
    if(!Number.isSafeInteger(currentEffectValue)||currentEffectValue<0)throw new Error('스킬 예상 효과는 0 이상의 정수여야 합니다.');
  if(currentTargetPreview.healing!==undefined)return translateEffectMessage('battle.expectedHealing',{healing:currentTargetPreview.healing});
  const currentDamageText=translateEffectMessage('battle.expectedDamage',{damage:currentTargetPreview.damage});
  return currentTargetPreview.drainHealing===undefined?currentDamageText:
    `${currentDamageText} · ${translateEffectMessage('battle.expectedDrain',{healing:currentTargetPreview.drainHealing})}`;
}
