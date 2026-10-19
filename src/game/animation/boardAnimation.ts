import {CellAnimation, validateCellAnimation} from './cellAnimation';

export const BOARD_ANIMATION_FRAME_RATE = 6;
export const BOARD_ANIMATION_FRAME_DURATION = 1000 / BOARD_ANIMATION_FRAME_RATE;

/** 원본 메타데이터를 보존하며 맵 개체에 공용 6fps 재생 설정을 적용한다. */
export function createBoardActorAnimation(sourceAnimationMetadata: unknown): CellAnimation {
  const validatedAnimationData = validateCellAnimation(sourceAnimationMetadata);
  return new CellAnimation({...validatedAnimationData,
    clips: validatedAnimationData.clips.map(currentAnimationClip => ({...currentAnimationClip,
      frames: currentAnimationClip.frames.map((currentFrameRecord, currentFrameIndex) => ({...currentFrameRecord, durationMs: Math.round((currentFrameIndex + 1) * BOARD_ANIMATION_FRAME_DURATION) - Math.round(currentFrameIndex * BOARD_ANIMATION_FRAME_DURATION)})),
    })),
  });
}
