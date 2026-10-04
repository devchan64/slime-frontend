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

/** 화면 회전 후 안전 타일의 바깥 변마다 25px 높이 오러 벽을 배치한다. */
export function drawSafeBoundaryAura(scene: Phaser.Scene, boundarySpriteObjects: Phaser.GameObjects.Mesh[],
  projectedCellPosition: {x: number; y: number}, rotatedCellPosition: Position,
  rotatedCenterPosition: Position, safeZoneRadius: number, boundaryDepth: number) {
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
    boundarySpriteObjects.push(createSafeBarrierAuraSprite(scene, boundaryStartPoint, boundaryEndPoint, boundaryDepth));
  }
}
