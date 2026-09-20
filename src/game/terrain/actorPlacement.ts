import type {Position} from '../../client/types';
import type {Surface} from './elevation';

/** 논리 셀은 유지하고, 지도 안의 연속된 표시 셀 중앙에 발밑을 맞춘다. */
export function calculateActorPlacement(actorLogicalPosition: Position, actorDisplayTiles: number,
  currentMapSurface: Surface, projectTerrainCell: (cellPosition: Position) => {x:number;y:number},
  calculateTerrainDepth: (cellPosition: Position) => number) {
  if (actorDisplayTiles !== 1 && actorDisplayTiles !== 2) throw new Error('지원하지 않는 표시 영역입니다.');
  if (currentMapSurface.columns < actorDisplayTiles || currentMapSurface.rows < actorDisplayTiles)
    throw new Error('개체 표시 영역보다 지도가 작습니다.');
  const firstDisplayColumn = Math.min(actorLogicalPosition.column, currentMapSurface.columns - actorDisplayTiles);
  const firstDisplayRow = Math.min(actorLogicalPosition.row, currentMapSurface.rows - actorDisplayTiles);
  const actorDisplayCells = Array.from({length:actorDisplayTiles * actorDisplayTiles}, (_, displayCellIndex) => ({
    column:firstDisplayColumn + displayCellIndex % actorDisplayTiles,
    row:firstDisplayRow + Math.floor(displayCellIndex / actorDisplayTiles),
  }));
  const projectedDisplayCells = actorDisplayCells.map(projectTerrainCell);
  return {x:projectedDisplayCells.reduce((totalProjectedValue,currentProjectedCell) => totalProjectedValue + currentProjectedCell.x,0) / projectedDisplayCells.length,
    y:projectedDisplayCells.reduce((totalProjectedValue,currentProjectedCell) => totalProjectedValue + currentProjectedCell.y,0) / projectedDisplayCells.length,
    depth:Math.max(...actorDisplayCells.map(calculateTerrainDepth)), cells:actorDisplayCells};
}
