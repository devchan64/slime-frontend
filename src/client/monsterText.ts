import type { Battle, State, Appearance } from './types';

/** 이전 v1 원문은 보존하고, 새 번역 계약은 두 언어를 모두 검증한다. */
export function localizedMonster<T extends Appearance & {name?: string}>(monster: T, locale: 'ko' | 'en'): T {
  const names = monster.nameTranslations;
  if (names === undefined) return monster;
  if (!names || typeof names !== 'object' || Object.keys(names).sort().join() !== 'en,ko'
      || Object.values(names).some(name => typeof name !== 'string' || !name.trim()))
    throw new Error('몬스터 이름에는 유효한 한국어·영어 번역이 필요합니다.');
  return {...monster, name: names[locale]};
}

export function localizedBattle(battle: Battle, locale: 'ko' | 'en'): Battle {
  return {...battle, units: battle.units.map(unit => unit.side === 'enemy' ? localizedMonster(unit, locale) : unit)};
}

export function localizedMonsters(state: State, locale: 'ko' | 'en'): State {
  return {...state, monsters: state.monsters.map(monster => localizedMonster(monster, locale)),
    battle: state.battle ? localizedBattle(state.battle, locale) : state.battle};
}
