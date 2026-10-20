export {resolveGuardDisplayPlacement,projectGuardDisplayCenter,GUARD_CENTER_FOOTPRINT_SIZE} from './guard-placement.mjs';
import type Phaser from 'phaser';
import type {SurfacePosition,SurfacePoint,SurfaceRecord,RenderOptions} from '../field-surface/field-surface.mjs';
export const FIELD_RENDERER_VERSION:string;
export const FIELD_ACTOR_CONTACT_SHADOW_PROFILES:Readonly<Record<string,Readonly<{width:number;height:number;alpha:number;coreAlpha:number;coreScale:number;scale:number;opacityScale:number}>>>;
export const FIELD_ACTOR_CONTACT_SHADOW_COLOR:number;
export function resolveFieldActorContactShadow(currentShadowProfileName?:string):{color:number;outer:{width:number;height:number;alpha:number};core:{width:number;height:number;alpha:number}};
export function drawFieldActorContactShadow(currentShadowGraphics:Phaser.GameObjects.Graphics,currentScreenPosition:SurfacePoint,currentShadowProfileName?:string):{color:number;outer:{width:number;height:number;alpha:number};core:{width:number;height:number;alpha:number}};
export function resolveFieldSurfaceDepth(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions?:RenderOptions):number;
export const FIELD_MESH_BOUNDARY_STYLE:Readonly<{color:number;width:number;alpha:number}>;
export const FIELD_SAFE_TOWER_PROFILE:Readonly<{anchorX:number;anchorY:number;bodyTop:number;displayHeight:number}>;
export const FIELD_SAFE_AURA_PROFILE:Readonly<{columns:number;rows:number;frames:number;height:number;alpha:number;frameDuration:number;horizontalCrop:number;topCrop:number;bottomCrop:number}>;
export function buildFieldCellGeometry(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions?:RenderOptions):{points:SurfacePoint[];top:boolean;kind:string}[];
export function buildFieldPanelVertices(currentPanelPoints:SurfacePoint[]):{center:SurfacePoint;vertices:number[]};
export function drawFieldMeshBoundary(currentGameScene:Phaser.Scene,currentPanelPoints:SurfacePoint[],currentRenderDepth:number):Phaser.GameObjects.Graphics;
export function drawFieldTexturePanel(currentGameScene:Phaser.Scene,currentPanelPoints:SurfacePoint[],currentTextureKey:string,currentRenderDepth:number,currentUvCorners?:number[]):Phaser.GameObjects.Mesh;
export function drawFieldCellObjects(currentGameScene:Phaser.Scene,currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions:RenderOptions,currentTextureKeys:{ground:string;cliff:string;tread:string;underlay?:string;resolveGroundMaterial?:(currentCellPosition:SurfacePosition)=>string;roadConnectionMask?:number;fullTileRoad?:boolean},currentRenderDepth:number,currentShowMesh?:boolean,currentBillboardRecords?:FieldSceneryRecord[]):Phaser.GameObjects.GameObject[];
export function buildFieldBoundaryPanels(currentCellPosition:SurfacePosition,currentSafeCenter:SurfacePosition,currentSafeRadius:number,currentScreenCenter:SurfacePoint,currentRenderOptions?:RenderOptions):SurfacePoint[][];
export function resolveFieldAuraUvs(currentFrameIndex:number,currentImageWidth:number,currentImageHeight:number):number[];
export function drawFieldAuraPanel(currentGameScene:Phaser.Scene,currentPanelPoints:SurfacePoint[],currentTextureKey:string,currentRenderDepth:number):Phaser.GameObjects.Mesh;
export function drawFieldTowerObject(currentGameScene:Phaser.Scene,currentScreenPosition:SurfacePoint,currentTextureKey:string,currentRenderDepth?:number):Phaser.GameObjects.Image;
export {resolveMapRenderOptions} from './render-constants.mjs';
export {FIELD_RENDER_METRICS,projectSurfaceCell,projectSurfaceVertex} from '../field-surface/field-surface.mjs';

export const FIELD_ELEVATION_EDGE_STYLE:Readonly<{color:number;width:number;alpha:number}>;
export function buildFieldElevationEdges(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions?:RenderOptions):SurfacePoint[][];

export function drawFieldElevationOutline(currentGameScene:Phaser.Scene,currentEdgeSegments:SurfacePoint[][],currentRenderDepth:number,currentOutlineStyle?:Readonly<{color:number;width:number;alpha:number}>):Phaser.GameObjects.Graphics;

export function buildFieldRoadEdges(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentConnectionMask:number,currentRenderOptions?:RenderOptions,currentFullTileRoad?:boolean):SurfacePoint[][];

export function buildFieldCliffEdges(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentFacePoints:SurfacePoint[],currentRenderOptions?:RenderOptions):SurfacePoint[][];

export function buildFieldMaterialEdges(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,resolveGroundMaterial:(currentCellPosition:SurfacePosition)=>string,currentRenderOptions?:RenderOptions):SurfacePoint[][];

export function drawTownMaterialEdges(currentGameScene:Phaser.Scene,currentCellPosition:SurfacePosition,resolveGroundMaterial:(currentCellPosition:SurfacePosition)=>string,projectGroundPosition:(currentCellPosition:SurfacePosition)=>SurfacePoint,resolveGroundDepth:(currentCellPosition:SurfacePosition)=>number,currentSurfaceDepth:number):Phaser.GameObjects.Graphics[];

export const FIELD_GROUND_EDGE_STYLE:Readonly<{color:number;width:number;alpha:number}>;

export type FieldSceneryTileAnchor = 'back'|'center'|'front';
export type FieldSceneryRecord = {shadowOffsetColumn?:number;shadowOffsetRow?:number;shadowScaleX?:number;shadowScaleY?:number;billboardPlacementAnchor?:'top'|'bottom';billboardBlocksMovement?:boolean;tileAnchor?:FieldSceneryTileAnchor;groundFootprintColumns?:number;groundFootprintRows?:number;id:string;position:{column:number;row:number}} & ({kind:'ward-tower'} | {kind:'decoration';textureKey:string;displayHeight:number;anchorX:number;anchorY:number;frameSize?:null} | {kind:'billboard';textureKey:string;displayHeight:number;anchorX:number;anchorY:number;frameSize:number});
export function drawFieldSceneryObject(currentGameScene:Phaser.Scene,currentObjectRecord:FieldSceneryRecord,currentScreenPosition:SurfacePoint,currentRenderDepth:number,currentTowerTextureKey?:string,currentRenderOptions?:{billboardScale?:number;billboardShadows?:boolean;tileWidth?:number;tileHeight?:number;rotation?:number}):Phaser.GameObjects.Image|Phaser.GameObjects.Image[];

export const FIELD_SCENERY_TILE_ANCHORS:Readonly<Record<FieldSceneryTileAnchor,Readonly<{column:number;row:number}>>>;
export function resolveFieldSceneryPlacement(currentObjectRecord:FieldSceneryRecord,currentTileCenter:SurfacePoint,currentRenderOptions?:{tileWidth:number;tileHeight:number;rotation?:number}):{position:{column:number;row:number};screen:SurfacePoint};

export function resolveBillboardGroundDepth(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions:RenderOptions,currentRenderDepth:number,currentBillboardRecords?:FieldSceneryRecord[]):number;

export function resolveFieldGroundMaterial(currentCellPosition:SurfacePosition,currentGroundOverrides:readonly {position:SurfacePosition;textureKey:string}[],resolveDefaultMaterial:(currentCellPosition:SurfacePosition)=>string):string;

export const FIELD_OCCLUSION_ALPHA:number;
export function markFieldOcclusionObject<T>(currentRenderObject:T,currentPanelPoints?:SurfacePoint[]):T;
export function updateFieldActorOcclusion(currentGameScene:Phaser.Scene):void;
export function shouldFadeFieldOccluder(currentOccluderBounds:{x:number;y:number;width:number;height:number},currentOccluderDepth:number,currentActorBounds:{x:number;y:number;width:number;height:number},currentActorDepth:number):boolean;

export {findBridgeSurface,canTraverseBridgeEdge,validateBridgeSurfaces,prepareBridgeTraversalSurface} from '../field-surface/terrain-bridges.mjs';

export {buildLayeredTraversal,layeredPositionKey} from '../field-surface/layered-traversal.mjs';
export {projectLayeredPosition,pickLayeredPosition} from '../field-surface/layered-projection.mjs';

export function buildFieldCliffTextureLayers(currentFacePoints:SurfacePoint[],currentSourceWidth:number,currentSourceHeight:number):{points:SurfacePoint[];uvCorners:number[]}[];

export function resolveFieldSceneryDepth(currentObjectRecord:FieldSceneryRecord,currentMapSurface:SurfaceRecord,currentRenderOptions?:RenderOptions):number;

export function drawBillboardContactShadow(currentGameScene:Phaser.Scene,currentObjectRecord:FieldSceneryRecord,currentScreenPosition:SurfacePoint,currentRenderDepth:number,currentRenderOptions?:{billboardScale?:number;billboardShadows?:boolean;tileWidth?:number;tileHeight?:number;rotation?:number}):Phaser.GameObjects.Graphics|null;

export function buildBillboardShadowPolygon(currentColumnCount:number,currentRowCount:number,currentCenterPoint:SurfacePoint,currentRenderOptions:{tileWidth:number;tileHeight:number;rotation?:number},currentLayerScale?:number):SurfacePoint[];
