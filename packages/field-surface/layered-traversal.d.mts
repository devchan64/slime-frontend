import type {TerrainBridge} from './terrain-bridges.mjs';
export type LayeredPosition = {column:number;row:number;surfaceId?:string};
export type LayeredSurface = {columns:number;rows:number;elevations:number[][];blocked:LayeredPosition[];bridges?:TerrainBridge[]};
export type LayeredTraversal = {
 listSurfacePositions():Readonly<LayeredPosition>[];
 readSurfaceElevation(currentCellPosition:LayeredPosition):number;
 listSurfaceNeighbors(currentCellPosition:LayeredPosition):Readonly<LayeredPosition>[];
 canTraverseStep(currentStartPosition:LayeredPosition,currentEndPosition:LayeredPosition):boolean;
 findSurfaceRoute(currentStartPosition:LayeredPosition,currentEndPosition:LayeredPosition):Readonly<LayeredPosition>[]|null;
};
export function layeredPositionKey(currentCellPosition:LayeredPosition):string;
export function buildLayeredTraversal(currentMapSurface:LayeredSurface):LayeredTraversal;
