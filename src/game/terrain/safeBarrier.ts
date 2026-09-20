import type Phaser from 'phaser';
import type { Position } from '../../client/types';
import { TILE_W, TILE_H } from './meadow';

const SAFE_BARRIER_STYLE = {
  boundaryGlowColor: 0x66e8d0, boundaryLineColor: 0xd3fff1,
  boundaryGlowWidth: 9, boundaryLineWidth: 2,
  boundaryGlowAlpha: 0.24, boundaryLineAlpha: 0.95,
};
const SAFE_BOUNDARY_DIRECTIONS = [
  { column: 1, row: 0, edge: [1, 2] },
  { column: 0, row: 1, edge: [2, 3] },
  { column: -1, row: 0, edge: [3, 0] },
  { column: 0, row: -1, edge: [0, 1] },
];

/** 화면 회전 후 좌표로 실제 안전 타일의 바깥 변만 표시한다. */
export function drawSafeBoundary(boundaryGraphicsObject: Phaser.GameObjects.Graphics,
  projectedCellPosition: {x: number; y: number}, rotatedCellPosition: Position,
  rotatedCenterPosition: Position, safeZoneRadius: number) {
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
    boundaryGraphicsObject.lineStyle(SAFE_BARRIER_STYLE.boundaryGlowWidth, SAFE_BARRIER_STYLE.boundaryGlowColor, SAFE_BARRIER_STYLE.boundaryGlowAlpha);
    boundaryGraphicsObject.lineBetween(boundaryStartPoint.x, boundaryStartPoint.y, boundaryEndPoint.x, boundaryEndPoint.y);
    boundaryGraphicsObject.lineStyle(SAFE_BARRIER_STYLE.boundaryLineWidth, SAFE_BARRIER_STYLE.boundaryLineColor, SAFE_BARRIER_STYLE.boundaryLineAlpha);
    boundaryGraphicsObject.lineBetween(boundaryStartPoint.x, boundaryStartPoint.y, boundaryEndPoint.x, boundaryEndPoint.y);
  }
}
