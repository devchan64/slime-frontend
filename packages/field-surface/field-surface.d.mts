export type SurfacePosition = {column:number;row:number};
export type SurfacePoint = {x:number;y:number};
export type SurfaceStair = {cell:SurfacePosition;lower:SurfacePosition};
export type SurfaceRecord = {columns:number;rows:number;elevations?:number[][];heightSource?:{surface:SurfaceRecord;position:(currentCellPosition:SurfacePosition)=>SurfacePosition};elevationTiles?:SurfaceStair[];elevationTileIndex?:ReadonlyMap<string,SurfaceStair>};
export type RenderOptions = {tileWidth:number;tileHeight:number;elevationHeight:number;baseThickness:number;originX?:number;originY?:number;rotation?:number};
export const FIELD_SURFACE_VERSION:string;
export const FIELD_RENDER_METRICS:Readonly<RenderOptions>;
export function readSurfaceHeight(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord):number;
export function rotateSurfacePosition(currentCellPosition:SurfacePosition,currentQuarterTurns?:number):SurfacePosition;
export function projectSurfaceVertex(currentVertexPosition:SurfacePosition & {height?:number},currentRenderOptions:RenderOptions):SurfacePoint;
export function findSurfaceStair(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord):SurfaceStair|undefined;
export function projectSurfaceCell(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions:RenderOptions):SurfacePoint;
export function buildSurfaceCliffs(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions:RenderOptions):Array<SurfacePoint[] & {rampWall?:boolean}>;
export function buildSurfaceStairs(currentStairRecord:SurfaceStair,currentMapSurface:SurfaceRecord,currentRenderOptions:RenderOptions):{points:SurfacePoint[];top:boolean}[];
export function containsSurfacePoint(currentScreenPoint:SurfacePoint,currentPolygonPoints:SurfacePoint[]):boolean;

export function resolveCliffTextureScale(currentRenderOptions:RenderOptions,currentTextureWidth:number,currentTextureHeight:number):{scaleX:number;scaleY:number};

export const CHARACTER_OUTLINE_STYLE:Readonly<{color:number;cssColor:string;width:number;outerStrength:number;quality:number}>;
