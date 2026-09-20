import type { Position } from '../../client/types';

export type ActorPickRegion = {
  position: Position; depth: number; left: number; right: number; top: number; bottom: number;
};

export function pickActorPosition(pointerWorldPoint: {x: number; y: number}, visibleActorRegions: ActorPickRegion[],
  previousSelectedPosition: Position | null): Position | null {
  const matchedActorRegions = visibleActorRegions.filter(currentActorRegion =>
    pointerWorldPoint.x >= currentActorRegion.left && pointerWorldPoint.x <= currentActorRegion.right
    && pointerWorldPoint.y >= currentActorRegion.top && pointerWorldPoint.y <= currentActorRegion.bottom)
    .sort((firstActorRegion, secondActorRegion) => secondActorRegion.depth - firstActorRegion.depth
      || firstActorRegion.position.row - secondActorRegion.position.row
      || firstActorRegion.position.column - secondActorRegion.position.column);
  const uniqueActorPositions = matchedActorRegions.map(currentActorRegion => currentActorRegion.position)
    .filter((currentActorPosition, currentActorIndex, allActorPositions) => allActorPositions.findIndex(
      otherActorPosition => otherActorPosition.column === currentActorPosition.column
        && otherActorPosition.row === currentActorPosition.row) === currentActorIndex);
  if (!uniqueActorPositions.length) return null;
  const previousActorIndex = uniqueActorPositions.findIndex(currentActorPosition =>
    currentActorPosition.column === previousSelectedPosition?.column && currentActorPosition.row === previousSelectedPosition.row);
  return {...uniqueActorPositions[(previousActorIndex + 1) % uniqueActorPositions.length]};
}
