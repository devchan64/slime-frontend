import type {Position} from './types';

// 서버 JSON 객체의 필드 순서와 관계없이 같은 열·행은 같은 위치다.
export function createPositionIdentity(currentPositionValue:Position|null|undefined):string {
  return currentPositionValue===null||currentPositionValue===undefined
    ? 'unavailable'
    : JSON.stringify([currentPositionValue.column,currentPositionValue.row]);
}
