import Phaser from 'phaser';
import type { Position } from '../../client/types';
import { createSafeBarrierAuraSprite } from '../animation/safeBarrierAuraSprite';
import { TILE_W, TILE_H } from './meadow';

const SAFE_BOUNDARY_DIRECTIONS = [
  { column: 1, row: 0, edge: [1, 2] },
  { column: 0, row: 1, edge: [2, 3] },
  { column: -1, row: 0, edge: [3, 0] },
  { column: 0, row: -1, edge: [0, 1] },
];

const SAFE_BARRIER_SEGMENT_OVERLAP_PIXELS = 4;

function resolveAuraWallAngle(boundaryStartPoint: { x: number; y: number }, boundaryEndPoint: { x: number; y: number }, protectedCenterPoint: { x: number; y: number }) {
  const currentBoundaryAngle = Phaser.Math.Angle.BetweenPoints(boundaryStartPoint, boundaryEndPoint);
  const boundaryCenterPoint = { x: (boundaryStartPoint.x + boundaryEndPoint.x) / 2, y: (boundaryStartPoint.y + boundaryEndPoint.y) / 2 };
  const protectedDirection = { x: protectedCenterPoint.x - boundaryCenterPoint.x, y: protectedCenterPoint.y - boundaryCenterPoint.y };
  const currentWallRiseDirection = { x: Math.sin(currentBoundaryAngle), y: -Math.cos(currentBoundaryAngle) };
  return currentWallRiseDirection.x * protectedDirection.x + currentWallRiseDirection.y * protectedDirection.y >= 0
    ? currentBoundaryAngle : currentBoundaryAngle + Math.PI;
}

/** 화면 회전 후 안전 타일의 바깥 변마다 25px 높이 오러 벽을 배치한다. */
export function drawSafeBoundaryAura(scene: Phaser.Scene, boundarySpriteObjects: Phaser.GameObjects.Image[],
  projectedCellPosition: {x: number; y: number}, rotatedCellPosition: Position,
  rotatedCenterPosition: Position, protectedCenterPoint: { x: number; y: number }, safeZoneRadius: number, boundaryDepth: number) {
  const boundaryVertexPoints = [
    {x: projectedCellPosition.x, y: projectedCellPosition.y - TILE_H / 2},
    {x: projectedCellPosition.x + TILE_W / 2, y: projectedCellPosition.y},
    {x: projectedCellPosition.x, y: projectedCellPosition.y + TILE_H / 2},
    {x: projectedCellPosition.x - TILE_W / 2, y: projectedCellPosition.y},
  ];
  for (const boundaryDirectionEntry of SAFE_BOUNDARY_DIRECTIONS) {
    const neighborCenterDistance = Math.abs(rotatedCellPosition.column + boundaryDirectionEntry.column - rotatedCenterPosition.column)
      + Math.abs(rotatedCellPosition.row + boundaryDirectionEntry.row - rotatedCenterPosition.row);
    if (neighborCenterDistance <= safeZoneRadius) continue;
    const boundaryStartPoint = boundaryVertexPoints[boundaryDirectionEntry.edge[0]];
    const boundaryEndPoint = boundaryVertexPoints[boundaryDirectionEntry.edge[1]];
    const boundaryWidthPixels = Phaser.Math.Distance.BetweenPoints(boundaryStartPoint, boundaryEndPoint) + SAFE_BARRIER_SEGMENT_OVERLAP_PIXELS;
    boundarySpriteObjects.push(createSafeBarrierAuraSprite(scene,
      {x: (boundaryStartPoint.x + boundaryEndPoint.x) / 2, y: (boundaryStartPoint.y + boundaryEndPoint.y) / 2},
      boundaryWidthPixels, resolveAuraWallAngle(boundaryStartPoint, boundaryEndPoint, protectedCenterPoint), boundaryDepth));
  }
}
