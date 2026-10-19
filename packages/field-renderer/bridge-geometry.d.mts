import type {SurfacePosition,SurfacePoint,SurfaceRecord,RenderOptions} from '../field-surface/field-surface.mjs';
export function resolveBridgeTextureKey(currentMaterialName:'timber'|'stone'):string;
export function buildBridgeCellGeometry(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions:RenderOptions):{kind:'bridge';part:string;top:boolean;textureKey:string;depthOffset:number;depthAnchor?:SurfacePosition;structureLayer?:number;points:SurfacePoint[];uvCorners:number[]}[];

export function resolveBridgeTextureKeys(currentMaterialName:'timber'|'stone'):string[];
