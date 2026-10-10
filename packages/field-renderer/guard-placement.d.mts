type GuardCellPosition={column:number;row:number};
type GuardMapRecord={id?:string;columns:number;rows:number;terrainRows?:string[];terrainCodes?:Record<string,string>;blocked?:GuardCellPosition[];elevations?:number[][];elevationTiles?:{cell:GuardCellPosition}[]};
export const GUARD_CENTER_FOOTPRINT_SIZE:number;
export function resolveGuardDisplayPlacement(currentGatePosition:GuardCellPosition,currentMapRecord:GuardMapRecord):{position:GuardCellPosition;cells:GuardCellPosition[];width:number;height:number;distance:number};
export function projectGuardDisplayCenter(currentPlacementRecord:{cells:GuardCellPosition[]},projectCurrentCell:(currentCell:GuardCellPosition)=>{x:number;y:number}):{x:number;y:number};
