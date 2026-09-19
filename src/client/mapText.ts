import type { State } from './types';
export type MapNameTranslations = Record<'ko' | 'en', string>;

export function localizedMapName(original: string, translations: MapNameTranslations | undefined, locale: 'ko' | 'en'): string {
  if (translations === undefined) return original; // 이전 v1 원문 계약
  if (!translations || typeof translations !== 'object' || Object.keys(translations).sort().join() !== 'en,ko'
      || Object.values(translations).some(value => typeof value !== 'string' || !value.trim()))
    throw new Error('맵 이름에는 유효한 한국어·영어 번역이 필요합니다.');
  return translations[locale];
}

/** 표시용 복사본만 변환한다. 서버 상태·좌표·연결 ID는 유지한다. */
export function localizedFieldMap(map: State['map'], locale: 'ko' | 'en'): State['map'] {
  return {...map, name: localizedMapName(map.name, map.nameTranslations, locale),
    connections: map.connections.map(gate => ({...gate,
      targetName: localizedMapName(gate.targetName ?? gate.target, gate.targetNameTranslations, locale)}))};
}
