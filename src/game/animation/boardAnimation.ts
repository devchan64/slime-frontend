import {CellAnimation, validateCellAnimation} from './cellAnimation';

export const BOARD_ANIMATION_FRAME_RATE = 8;
export const BOARD_ANIMATION_FRAME_DURATION = 1000 / BOARD_ANIMATION_FRAME_RATE;

/** 원본 메타데이터를 보존하며 맵 개체에 임시 8fps 재생 설정을 적용한다. */
export function createBoardActorAnimation(sourceAnimationMetadata: unknown): CellAnimation {
  const validatedAnimationData = validateCellAnimation(sourceAnimationMetadata);
  return new CellAnimation({...validatedAnimationData,
    clips: validatedAnimationData.clips.map(currentAnimationClip => ({...currentAnimationClip,
      frames: currentAnimationClip.frames.map(currentFrameRecord => ({...currentFrameRecord, durationMs: BOARD_ANIMATION_FRAME_DURATION})),
    })),
  });
}
