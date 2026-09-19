import type { State } from '../client/types';

/** 한 지시가 시작된 공간·캐릭터를 값으로 캡처한다. 후속 상태 객체를 보관하지 않는다. */
export function fieldActionContext(state: State) {
  return {
    characterId: state.me.id,
    generation: state.generation,
    epoch: state.epoch,
    locationId: state.location.id,
    interruptionId: state.me.lastFieldInterruption?.battleId,
  };
}

export function canContinueFieldAction(context: ReturnType<typeof fieldActionContext>, state: State | null): state is State {
  return !!state && state.me.mode === 'FIELD'
    && state.me.id === context.characterId
    && state.generation === context.generation
    && state.epoch === context.epoch
    && state.location.id === context.locationId
    && state.me.lastFieldInterruption?.battleId === context.interruptionId;
}
