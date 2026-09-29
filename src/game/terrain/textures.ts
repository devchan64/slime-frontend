import woodDoorWallSource from "../../assets/world/common/buildings/wood-door-wall-v1.png";
import woodWindowWallSource from "../../assets/world/common/buildings/wood-window-wall-v1.png";
import unifiedWoodWallSource from "../../assets/world/common/buildings/wood-wall-v2.png";
import stonewarmRoofImageSource from "../../assets/world/stonewarm/buildings/stone-roof-v1.png";
import stonewarmGuildRoofSource from "../../assets/world/stonewarm/buildings/red-stone-roof-v2.png";
import extendedAshSource from "../../assets/terrain/extension-v1/ash-128.webp";
import extendedBoulderSource from "../../assets/terrain/extension-v1/boulder-128.webp";
import extendedGravelSource from "../../assets/terrain/extension-v1/gravel-128.webp";
import extendedLeafLitterSource from "../../assets/terrain/extension-v1/leaf-litter-128.webp";
import extendedMossSource from "../../assets/terrain/extension-v1/moss-128.webp";
import extendedMudSource from "../../assets/terrain/extension-v1/mud-128.webp";
import iseulonLimestoneFloorTypeASource from "../../assets/world/isloon/terrain/limestone-floor-type-a-v1.png";
import reedhavenDirtRoadSource from "../../assets/world/reedhaven/terrain/dirt-road-v1.png";
import stonewarmGravelPavingSource from "../../assets/world/stonewarm/terrain/gravel-paving-v1.png";
import stonewarmMarblePavingSource from "../../assets/world/stonewarm/terrain/marble-paving-v1.png";
import extendedReedBedSource from "../../assets/terrain/extension-v1/reed-bed-128.webp";
import extendedStoneSource from "../../assets/terrain/extension-v1/stone-128.webp";
import extendedTreeBaseSource from "../../assets/terrain/extension-v1/tree-base-128.webp";
import cliffWallPatternSource from "../../assets/terrain/cliffs/dew-meadow-cliff-face-v1.png";
import Phaser from "phaser";
import grassTileImageSource from "../../assets/terrain/grass-v4.png";
import dew from "../../assets/terrain/dew-v3.webp";
import road from "../../assets/terrain/road-v3.webp";
import water from "../../assets/terrain/water-v3.webp";
import flowers from "../../assets/terrain/flowers-v3.webp";
import { FIELD_TERRAIN_KINDS, TEXTURE_SIZE } from "./meadow";
import { GAME_TILE_SOURCE_SIZE } from "./renderMetrics";
import { ROAD_TILE_COUNT, roadFrame } from "./roadTiles";

export const WOOD_DOOR_WALL_TEXTURE = "wood-door-wall-v1";
export const WOOD_WINDOW_WALL_TEXTURE = "wood-window-wall-v1";
export const UNIFIED_WOOD_WALL_TEXTURE = "unified-wood-wall-v2";
export const STONEWARM_ROOF_TEXTURE = "stonewarm-stone-roof";
export const STONEWARM_GUILD_ROOF_TEXTURE = "stonewarm-guild-red-stone-roof-v2";
export const TERRAIN_ATLAS = "meadow-terrain";
export const CLIFF_WALL_TEXTURE = "dew-meadow-cliff-face-v1";
export const STONEWARM_PAVING_FRAME = "stonewarm-paving";
export const STONEWARM_MARBLE_PAVING_FRAME = "stonewarm-marble-paving";
export const ISEULON_GRASS_FRAME = "iseulon-grass-mud-frame";
export const REEDHAVEN_DIRT_ROAD_FRAME = "reedhaven-dirt-road";
// 이슬 지면은 통행 가능한 풀밭이며 수면 텍스처를 사용하지 않는다.
// 서버의 wall 지형도 현재 절벽 재질로 표시하며 이동 불가 코드 자체는 유지한다.
const SOURCES = { grass: grassTileImageSource, dew, road, flowers, water, "ash": extendedAshSource, "boulder": extendedBoulderSource, "gravel": extendedGravelSource, "leaf-litter": extendedLeafLitterSource, "moss": extendedMossSource, "mud": extendedMudSource, "paving": iseulonLimestoneFloorTypeASource, "reed-bed": extendedReedBedSource, "stone": extendedStoneSource, "tree-base": extendedTreeBaseSource, "wall": cliffWallPatternSource };
const SOURCE_KINDS = FIELD_TERRAIN_KINDS;
const SPECIAL_TERRAIN_SOURCES = [
  { frame: ISEULON_GRASS_FRAME, source: grassTileImageSource },
  { frame: REEDHAVEN_DIRT_ROAD_FRAME, source: reedhavenDirtRoadSource },
  { frame: STONEWARM_PAVING_FRAME, source: stonewarmGravelPavingSource },
  { frame: STONEWARM_MARBLE_PAVING_FRAME, source: stonewarmMarblePavingSource },
];
const TRANSPARENT_TERRAIN_KINDS = new Set<string>(["boulder", "tree-base"]);
const FRAME_W = TEXTURE_SIZE;
const FRAME_H = TEXTURE_SIZE / 2;
const FRAME_PADDING = 2;
const FRAME_STRIDE = FRAME_W + FRAME_PADDING * 2;
const ATLAS_COLUMNS = 8;
const FRAME_COUNT = SOURCE_KINDS.length + SPECIAL_TERRAIN_SOURCES.length + ROAD_TILE_COUNT * 2;
const framePosition = (index: number) => ({ x: (index % ATLAS_COLUMNS) * FRAME_STRIDE + FRAME_PADDING,
  y: Math.floor(index / ATLAS_COLUMNS) * (FRAME_H + FRAME_PADDING * 2) + FRAME_PADDING });
const ROAD_SHAPE = { inset: TEXTURE_SIZE * .08, radius: TEXTURE_SIZE * .2, half: TEXTURE_SIZE / 2 };
const FLOWER_BLEND = { center: TEXTURE_SIZE / 2, radius: TEXTURE_SIZE * .64, innerStop: .8 };

function readValidatedTileSource(scene: Phaser.Scene, sourceKey: string) {
  const sourceImage = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  if (sourceImage.width !== GAME_TILE_SOURCE_SIZE || sourceImage.height !== GAME_TILE_SOURCE_SIZE) {
    throw new Error(`타일 원본 크기 오류: ${sourceKey}는 ${GAME_TILE_SOURCE_SIZE}×${GAME_TILE_SOURCE_SIZE}px여야 합니다. 실제 ${sourceImage.width}×${sourceImage.height}px.`);
  }
  return sourceImage;
}

// 연결된 변은 타일 끝까지 흙으로 채우고, 끊긴 변과 모서리에는 풀밭을 남긴다.
function clipRoad(ctx: CanvasRenderingContext2D, mask: number) {
  const { inset, radius, half } = ROAD_SHAPE;
  const width = TEXTURE_SIZE - inset * 2;
  ctx.beginPath();
  ctx.roundRect(inset, inset, width, width, radius);
  if (mask & 1) ctx.rect(inset, 0, width, half);
  if (mask & 2) ctx.rect(half, inset, half, width);
  if (mask & 4) ctx.rect(inset, half, width, half);
  if (mask & 8) ctx.rect(0, inset, half, width);
  if ((mask & 3) === 3) ctx.rect(half, 0, half, half);
  if ((mask & 6) === 6) ctx.rect(half, half, half, half);
  if ((mask & 12) === 12) ctx.rect(0, half, half, half);
  if ((mask & 9) === 9) ctx.rect(0, 0, half, half);
  ctx.clip();
}

export function preloadTerrain(scene: Phaser.Scene) {
  scene.load.image(UNIFIED_WOOD_WALL_TEXTURE, unifiedWoodWallSource);
  scene.load.image(WOOD_WINDOW_WALL_TEXTURE, woodWindowWallSource);
  scene.load.image(WOOD_DOOR_WALL_TEXTURE, woodDoorWallSource);
  scene.load.image(STONEWARM_GUILD_ROOF_TEXTURE, stonewarmGuildRoofSource);
  scene.load.image(STONEWARM_ROOF_TEXTURE, stonewarmRoofImageSource);
  for (const kind of SOURCE_KINDS) scene.load.image(`terrain-source-${kind}`, SOURCES[kind]);
  for (const specialSourceRecord of SPECIAL_TERRAIN_SOURCES) scene.load.image(`terrain-source-${specialSourceRecord.frame}`, specialSourceRecord.source);
  scene.load.image(CLIFF_WALL_TEXTURE, cliffWallPatternSource);
}

export function resolveGrassFrameForMap(currentMapIdentifier: string) {
  return currentMapIdentifier === "iseulon" ? ISEULON_GRASS_FRAME : "grass";
}

export function resolvePavingFrameForMap(mapIdentifier: string) {
  if (mapIdentifier === "stonewarm") return STONEWARM_MARBLE_PAVING_FRAME;
  if (mapIdentifier === "reedhaven") return REEDHAVEN_DIRT_ROAD_FRAME;
  return "paving";
}

// 투명 여백을 둔 단일 아틀라스로 구성해 타일 간 텍스처 번짐을 방지한다.
export function createTerrainAtlas(scene: Phaser.Scene) {
  if (scene.textures.exists(TERRAIN_ATLAS)) return;
  const atlas = scene.textures.createCanvas(TERRAIN_ATLAS,
    FRAME_STRIDE * ATLAS_COLUMNS, (FRAME_H + FRAME_PADDING * 2) * Math.ceil(FRAME_COUNT / ATLAS_COLUMNS));
  if (!atlas) throw new Error("초원 타일 아틀라스를 만들 수 없습니다.");
  const ctx = atlas.getContext();
  const grassSource = readValidatedTileSource(scene, "terrain-source-grass");
  readValidatedTileSource(scene, CLIFF_WALL_TEXTURE);
  const flowerPatch = document.createElement("canvas");
  flowerPatch.width = flowerPatch.height = TEXTURE_SIZE;
  const flowerContext = flowerPatch.getContext("2d");
  if (!flowerContext) throw new Error("꽃밭 경계 합성 캔버스를 만들 수 없습니다.");
  flowerContext.drawImage(scene.textures.get("terrain-source-flowers").getSourceImage() as HTMLImageElement,
    0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  flowerContext.globalCompositeOperation = "destination-in";
  const { center, radius, innerStop } = FLOWER_BLEND;
  const fade = flowerContext.createRadialGradient(center, center, 0, center, center, radius);
  fade.addColorStop(innerStop, "#fff");
  fade.addColorStop(1, "#ffffff00");
  flowerContext.fillStyle = fade;
  flowerContext.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  SOURCE_KINDS.forEach((kind, index) => {
    const sourceKey = `terrain-source-${kind}`;
    if (!scene.textures.exists(sourceKey)) throw new Error(`초원 타일 누락: ${kind}`);
    const source = readValidatedTileSource(scene, sourceKey);
    const { x, y } = framePosition(index);
    ctx.save();
    ctx.translate(x + FRAME_W / 2, y);
    ctx.transform(FRAME_W / (2 * TEXTURE_SIZE), FRAME_H / (2 * TEXTURE_SIZE),
      -FRAME_W / (2 * TEXTURE_SIZE), FRAME_H / (2 * TEXTURE_SIZE), 0, 0);
    if (kind === "flowers") {
      ctx.drawImage(grassSource, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      ctx.drawImage(flowerPatch, 0, 0);
    } else {
      if (TRANSPARENT_TERRAIN_KINDS.has(kind)) ctx.drawImage(grassSource, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      ctx.drawImage(source, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    }
    ctx.restore();
    atlas.add(kind, 0, x, y, FRAME_W, FRAME_H);
  });
  SPECIAL_TERRAIN_SOURCES.forEach((specialSourceRecord, specialSourceIndex) => {
    const source = readValidatedTileSource(scene, `terrain-source-${specialSourceRecord.frame}`);
    const { x, y } = framePosition(SOURCE_KINDS.length + specialSourceIndex);
    ctx.save();
    ctx.translate(x + FRAME_W / 2, y);
    ctx.transform(FRAME_W / (2 * TEXTURE_SIZE), FRAME_H / (2 * TEXTURE_SIZE),
      -FRAME_W / (2 * TEXTURE_SIZE), FRAME_H / (2 * TEXTURE_SIZE), 0, 0);
    ctx.drawImage(source, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.restore();
    atlas.add(specialSourceRecord.frame, 0, x, y, FRAME_W, FRAME_H);
  });
  for (const [surfaceIndex, surface] of ["road", "water"].entries()) {
    const surfaceSource = readValidatedTileSource(scene, `terrain-source-${surface}`);
    for (let mask = 0; mask < ROAD_TILE_COUNT; mask++) {
      const { x, y } = framePosition(SOURCE_KINDS.length + SPECIAL_TERRAIN_SOURCES.length + surfaceIndex * ROAD_TILE_COUNT + mask);
      ctx.save();
      ctx.translate(x + FRAME_W / 2, y);
      ctx.transform(FRAME_W / (2 * TEXTURE_SIZE), FRAME_H / (2 * TEXTURE_SIZE),
        -FRAME_W / (2 * TEXTURE_SIZE), FRAME_H / (2 * TEXTURE_SIZE), 0, 0);
      ctx.drawImage(grassSource, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      clipRoad(ctx, mask);
      ctx.drawImage(surfaceSource, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      ctx.restore();
      atlas.add(surface === "road" ? roadFrame(mask) : `water-${mask}`, 0, x, y, FRAME_W, FRAME_H);
    }
  }
  atlas.refresh();
}
