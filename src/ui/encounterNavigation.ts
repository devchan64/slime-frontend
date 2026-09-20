import { LocalizedError } from '../client/notice';
import type {Position, State} from '../client/types';
import {encounterRoute, fieldDistance} from './fieldNavigation';
import {fieldActionContext, canContinueFieldAction} from './fieldActionContext';

export async function approachMonster(monsterId: string, controls: {
  state: () => State | null; stopped: () => boolean;
  move: (position: Position) => Promise<unknown>; reserve: (monsterId: string) => Promise<unknown>;
  progress: (completed: number, total: number) => void; pause: () => Promise<void>;
}) {
  const initial = controls.state();
  if (!initial || initial.me.mode !== 'FIELD') throw new LocalizedError('field.approachFieldRequired');
  const context = fieldActionContext(initial);
  const maxSteps = initial.map.columns * initial.map.rows;
  for (let completed = 0; completed <= maxSteps; completed++) {
    const latest = controls.state();
    if (controls.stopped()) return;
    if (!canContinueFieldAction(context, latest)) return;
    if (latest.me.hp === 0) throw new LocalizedError('field.healthDepleted');
    if (latest.me.fp !== undefined && latest.me.fp < 0) throw new LocalizedError('field.approachFpDebt');
    const monster = latest.monsters.find(m => m.id === monsterId);
    if (!monster || monster.state !== 'AVAILABLE') throw new LocalizedError('field.approachTargetLost');
    if (fieldDistance(latest.me.position, monster.position) <= 1) {
      await controls.reserve(monsterId);
      return;
    }
    const route = encounterRoute(latest.me.position, monster.position, latest.map);
    if (!route?.length) throw new LocalizedError('field.noApproach');
    if (latest.me.fp !== undefined && latest.me.fp < 1) throw new LocalizedError('field.insufficientFp');
    if (completed === maxSteps) throw new LocalizedError('field.approachTooLong');
    controls.progress(completed, completed + route.length);
    await controls.move(route[0]);
    await controls.pause();
  }
}
