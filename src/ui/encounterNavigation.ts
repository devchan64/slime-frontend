import type {Position, State} from '../client/types';
import {encounterRoute, fieldDistance} from './fieldNavigation';

export async function approachMonster(monsterId: string, controls: {
  state: () => State | null; stopped: () => boolean;
  move: (position: Position) => Promise<unknown>; reserve: (monsterId: string) => Promise<unknown>;
  progress: (completed: number, total: number) => void; pause: () => Promise<void>;
}) {
  const initial = controls.state();
  if (!initial || initial.me.mode !== 'FIELD') throw new Error('탐색 중에만 조우할 수 있습니다.');
  const locationId = initial.location.id, generation = initial.generation;
  const maxSteps = initial.map.columns * initial.map.rows;
  for (let completed = 0; completed <= maxSteps; completed++) {
    const latest = controls.state();
    if (controls.stopped()) return;
    if (!latest || latest.me.mode !== 'FIELD' || latest.location.id !== locationId || latest.generation !== generation) return;
    if (latest.me.fp !== undefined && latest.me.fp < 0) throw new Error('FP가 음수여서 필드 행동을 할 수 없습니다. 충전을 기다려 주세요.');
    const monster = latest.monsters.find(m => m.id === monsterId);
    if (!monster || monster.state !== 'AVAILABLE') throw new Error('선택한 몬스터와 더 이상 조우할 수 없습니다.');
    if (fieldDistance(latest.me.position, monster.position) <= 1) {
      await controls.reserve(monsterId);
      return;
    }
    const route = encounterRoute(latest.me.position, monster.position, latest.map);
    if (!route?.length) throw new Error('몬스터에게 접근할 수 있는 경로가 없습니다.');
    if (latest.me.fp !== undefined && latest.me.fp < 1) throw new Error('이동에 필요한 FP가 부족합니다. 1칸당 1 FP가 필요합니다.');
    if (completed === maxSteps) throw new Error('몬스터 접근 거리가 길어 이동을 멈췄습니다. 다시 선택해 주세요.');
    controls.progress(completed, completed + route.length);
    await controls.move(route[0]);
    await controls.pause();
  }
}
