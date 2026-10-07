/** 게임 구현을 그대로 배포한다. 검수기는 등록 에셋을 아래 논리 경로에 연결한다. */
export {drawBlockStructure} from '../../src/game/terrain/blockStructureRendering';
export {createTerrainAtlas,TERRAIN_ATLAS,resolveGrassFrameForMap,resolvePavingFrameForMap} from '../../src/game/terrain/textures';
export {cellDepth,TERRAIN_DEPTH,mapAnnotationDepth} from '../../src/game/terrain/elevation';
export {resolveMapTileSize} from '../../src/game/terrain/renderMetrics';
export {selectFieldRoadFrame,roadConnections,waterConnections} from '../../src/game/terrain/roadTiles';
import {preloadTerrain} from '../../src/game/terrain/textures';
import type Phaser from 'phaser';
export function collectTerrainTextureSources():Record<string,string> {
 const registeredTextureSources:Record<string,string>={};
 preloadTerrain({load:{image(currentTextureKey:string,currentAssetPath:string){registeredTextureSources[currentTextureKey]=currentAssetPath;}}} as unknown as Phaser.Scene);
 return registeredTextureSources;
}
export {BUILDING_RENDER_BLOCK_HEIGHT,buildRenderedBlockFaces} from '../../src/game/terrain/blockGeometry';
