export {resolveGuardDisplayPlacement,projectGuardDisplayCenter,GUARD_CENTER_FOOTPRINT_SIZE} from './guard-placement.mjs';
import type Phaser from 'phaser';
import type {SurfacePosition,SurfacePoint,SurfaceRecord,RenderOptions} from '../field-surface/field-surface.mjs';
export const FIELD_RENDERER_VERSION:string;
export const FIELD_ACTOR_CONTACT_SHADOW_PROFILES:Readonly<Record<string,Readonly<{width:number;height:number;alpha:number;coreAlpha:number;coreScale:number;scale:number;opacityScale:number}>>>;
export const FIELD_ACTOR_CONTACT_SHADOW_COLOR:number;
export function resolveFieldActorContactShadow(currentShadowProfileName?:string):{color:number;outer:{width:number;height:number;alpha:number};core:{width:number;height:number;alpha:number}};
export function drawFieldActorContactShadow(currentShadowGraphics:Phaser.GameObjects.Graphics,currentScreenPosition:SurfacePoint,currentShadowProfileName?:string):{color:number;outer:{width:number;height:number;alpha:number};core:{width:number;height:number;alpha:number}};
export function prepareFieldConnectedTexture(currentGameScene:Phaser.Scene,currentSourceKey:string,currentGrassKey:string,currentConnectionMask:number):string;
export const FIELD_MESH_BOUNDARY_STYLE:Readonly<{color:number;width:number;alpha:number}>;
export const FIELD_SAFE_TOWER_PROFILE:Readonly<{anchorX:number;anchorY:number;bodyTop:number;displayHeight:number}>;
export const FIELD_SAFE_AURA_PROFILE:Readonly<{columns:number;rows:number;frames:number;height:number;alpha:number;frameDuration:number;horizontalCrop:number;topCrop:number;bottomCrop:number}>;
export function buildFieldCellGeometry(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions?:RenderOptions):{points:SurfacePoint[];top:boolean;kind:string}[];
export function buildFieldPanelVertices(currentPanelPoints:SurfacePoint[]):{center:SurfacePoint;vertices:number[]};
export function drawFieldMeshBoundary(currentGameScene:Phaser.Scene,currentPanelPoints:SurfacePoint[],currentRenderDepth:number):Phaser.GameObjects.Graphics;
export function drawFieldTexturePanel(currentGameScene:Phaser.Scene,currentPanelPoints:SurfacePoint[],currentTextureKey:string,currentRenderDepth:number,currentUvCorners?:number[]):Phaser.GameObjects.Mesh;
export function drawFieldCellObjects(currentGameScene:Phaser.Scene,currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions:RenderOptions,currentTextureKeys:{ground:string;cliff:string;tread:string;underlay?:string;resolveGroundMaterial?:(currentCellPosition:SurfacePosition)=>string;roadConnectionMask?:number;fullTileRoad?:boolean},currentRenderDepth:number,currentShowMesh?:boolean):Phaser.GameObjects.GameObject[];
export function buildFieldBoundaryPanels(currentCellPosition:SurfacePosition,currentSafeCenter:SurfacePosition,currentSafeRadius:number,currentScreenCenter:SurfacePoint,currentRenderOptions?:RenderOptions):SurfacePoint[][];
export function resolveFieldAuraUvs(currentFrameIndex:number,currentImageWidth:number,currentImageHeight:number):number[];
export function drawFieldAuraPanel(currentGameScene:Phaser.Scene,currentPanelPoints:SurfacePoint[],currentTextureKey:string,currentRenderDepth:number):Phaser.GameObjects.Mesh;
export function drawFieldTowerObject(currentGameScene:Phaser.Scene,currentScreenPosition:SurfacePoint,currentTextureKey:string,currentRenderDepth?:number):Phaser.GameObjects.Image;
export {FIELD_RENDER_METRICS,projectSurfaceCell,projectSurfaceVertex} from '../field-surface/field-surface.mjs';

export const FIELD_ELEVATION_EDGE_STYLE:Readonly<{color:number;width:number;alpha:number}>;
export function buildFieldElevationEdges(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentRenderOptions?:RenderOptions):SurfacePoint[][];

export function drawFieldElevationOutline(currentGameScene:Phaser.Scene,currentEdgeSegments:SurfacePoint[][],currentRenderDepth:number,currentOutlineStyle?:Readonly<{color:number;width:number;alpha:number}>):Phaser.GameObjects.Graphics;

export function buildFieldRoadEdges(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentConnectionMask:number,currentRenderOptions?:RenderOptions,currentFullTileRoad?:boolean):SurfacePoint[][];

export function buildFieldCliffEdges(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,currentFacePoints:SurfacePoint[],currentRenderOptions?:RenderOptions):SurfacePoint[][];

export function buildFieldMaterialEdges(currentCellPosition:SurfacePosition,currentMapSurface:SurfaceRecord,resolveGroundMaterial:(currentCellPosition:SurfacePosition)=>string,currentRenderOptions?:RenderOptions):SurfacePoint[][];

export function drawTownMaterialEdges(currentGameScene:Phaser.Scene,currentCellPosition:SurfacePosition,resolveGroundMaterial:(currentCellPosition:SurfacePosition)=>string,projectGroundPosition:(currentCellPosition:SurfacePosition)=>SurfacePoint,resolveGroundDepth:(currentCellPosition:SurfacePosition)=>number,currentSurfaceDepth:number):Phaser.GameObjects.Graphics[];

export const FIELD_GROUND_EDGE_STYLE:Readonly<{color:number;width:number;alpha:number}>;

export type FieldSceneryTileAnchor = 'north-west'|'north'|'north-east'|'west'|'center'|'east'|'south-west'|'south'|'south-east';
export type FieldSceneryRecord = {tileAnchor?:FieldSceneryTileAnchor;id:string;position:{column:number;row:number}} & ({kind:'ward-tower'} | {kind:'decoration';textureKey:string;displayHeight:number;anchorX:number;anchorY:number});
export function drawFieldSceneryObject(currentGameScene:Phaser.Scene,currentObjectRecord:FieldSceneryRecord,currentScreenPosition:SurfacePoint,currentRenderDepth:number,currentTowerTextureKey?:string):Phaser.GameObjects.Image;

export const FIELD_SCENERY_TILE_ANCHORS:Readonly<Record<FieldSceneryTileAnchor,Readonly<{column:number;row:number}>>>;
export function resolveFieldSceneryPlacement(currentObjectRecord:FieldSceneryRecord,currentTileCenter:SurfacePoint,currentRenderOptions?:{tileWidth:number;tileHeight:number;rotation?:number}):{position:{column:number;row:number};screen:SurfacePoint};
