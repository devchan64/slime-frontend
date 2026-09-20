export const SCOUTING_RISK_LABELS = {LOW:'field.scoutRiskLow',EVEN:'field.scoutRiskEven',HIGH:'field.scoutRiskHigh',VERY_HIGH:'field.scoutRiskVeryHigh',UNKNOWN:'field.scoutRiskUnknown'} as const;
export type ScoutingObservation = {monsterId:string;mapId:string;succeeded:boolean;observedAt:number;expiresAt:number;fpCost:number;riskGrade?:keyof typeof SCOUTING_RISK_LABELS;riskVersion?:1;countBand?:{minimumCount:number;maximumCount:number|null}};
export function parseScoutingObservation(currentResponseValue: unknown): ScoutingObservation {
  if (!currentResponseValue || typeof currentResponseValue !== 'object' || Array.isArray(currentResponseValue)) throw new Error('정찰 응답이 올바르지 않습니다.');
  const currentResponseRecord=currentResponseValue as Record<string,unknown>;
  const currentExpectedFields=['monsterId','mapId','succeeded','observedAt','expiresAt','fpCost',...(currentResponseRecord.succeeded===true?['countBand',...(currentResponseRecord.riskGrade!==undefined || currentResponseRecord.riskVersion!==undefined?['riskGrade','riskVersion']:[])]:[])].sort();
  if (Object.keys(currentResponseRecord).sort().join()!==currentExpectedFields.join()
    || typeof currentResponseRecord.monsterId!=='string' || !currentResponseRecord.monsterId
    || typeof currentResponseRecord.mapId!=='string' || !currentResponseRecord.mapId
    || typeof currentResponseRecord.succeeded!=='boolean'
    || typeof currentResponseRecord.observedAt!=='number' || !Number.isFinite(currentResponseRecord.observedAt) || currentResponseRecord.observedAt<0
    || typeof currentResponseRecord.expiresAt!=='number' || !Number.isFinite(currentResponseRecord.expiresAt) || currentResponseRecord.expiresAt<=currentResponseRecord.observedAt
    || !Number.isSafeInteger(currentResponseRecord.fpCost) || Number(currentResponseRecord.fpCost)<1) throw new Error('정찰 응답 필드가 올바르지 않습니다.');
  if(currentResponseRecord.riskGrade!==undefined && (currentResponseRecord.riskVersion!==1
    || typeof currentResponseRecord.riskGrade!=='string' || !Object.hasOwn(SCOUTING_RISK_LABELS,currentResponseRecord.riskGrade)))throw new Error('정찰 위험도 형식이 올바르지 않습니다.');
  if (currentResponseRecord.succeeded) {
    const currentCountBand=currentResponseRecord.countBand as ScoutingObservation['countBand'];
    if (!currentCountBand || Object.keys(currentCountBand).sort().join()!=='maximumCount,minimumCount'
      || !Number.isSafeInteger(currentCountBand.minimumCount) || currentCountBand.minimumCount<1
      || (currentCountBand.maximumCount!==null && (!Number.isSafeInteger(currentCountBand.maximumCount) || currentCountBand.maximumCount<currentCountBand.minimumCount))) throw new Error('정찰 인원 구간이 올바르지 않습니다.');
  }
  return structuredClone(currentResponseRecord) as ScoutingObservation;
}
