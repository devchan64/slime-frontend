export type BridgePosition = {column:number;row:number};
export type TerrainBridge = {id:string;start:BridgePosition;end:BridgePosition;elevation:number;material:'timber'|'stone'|'farm-timber'};
export function enumerateBridgeCells(currentBridgeRecord:TerrainBridge):BridgePosition[];
export function findBridgeSurface(currentCellPosition:BridgePosition,currentMapSurface:{bridges?:TerrainBridge[]}):TerrainBridge|undefined;
export function canTraverseBridgeEdge(currentStartPosition:BridgePosition,currentEndPosition:BridgePosition,currentMapSurface:{bridges?:TerrainBridge[]}):boolean;
export function validateBridgeSurfaces(currentMapSurface:{columns:number;rows:number;elevations:number[][];bridges?:TerrainBridge[]}):void;
export function prepareBridgeTraversalSurface<T extends {columns:number;rows:number;elevations:number[][];blocked:BridgePosition[];bridges?:TerrainBridge[]}>(currentMapSurface:T):T;
