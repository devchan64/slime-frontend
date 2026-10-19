import type {LayeredPosition,LayeredTraversal} from './layered-traversal.mjs';
export type LayeredRenderOptions={tileWidth:number;tileHeight:number;elevationHeight:number;originX?:number;originY?:number;rotation?:number};
export function projectLayeredPosition(currentCellPosition:LayeredPosition,currentTraversalGraph:LayeredTraversal,currentRenderOptions:LayeredRenderOptions):{x:number;y:number};
export function pickLayeredPosition(currentScreenPoint:{x:number;y:number},currentSurfaceIdentifier:string,currentTraversalGraph:LayeredTraversal,currentRenderOptions:LayeredRenderOptions):Readonly<LayeredPosition>|null;
