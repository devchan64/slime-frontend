import extendedAshSource from "../../assets/terrain/extension-v1/ash-128.webp";
import extendedBoulderSource from "../../assets/terrain/extension-v1/boulder-128.webp";
import extendedGravelSource from "../../assets/terrain/extension-v1/gravel-128.webp";
import extendedLeafLitterSource from "../../assets/terrain/extension-v1/leaf-litter-128.webp";
import extendedMossSource from "../../assets/terrain/extension-v1/moss-128.webp";
import extendedMudSource from "../../assets/terrain/extension-v1/mud-128.webp";
import iseulonPavingSource from "../../assets/world/isloon/terrain/paving-v1.png";
import extendedReedBedSource from "../../assets/terrain/extension-v1/reed-bed-128.webp";
import extendedStoneSource from "../../assets/terrain/extension-v1/stone-128.webp";
import extendedTreeBaseSource from "../../assets/terrain/extension-v1/tree-base-128.webp";
import cliffWallPatternSource from "../../assets/terrain/cliffs/dew-meadow-cliff-face-v1.png";
import Phaser from "phaser";
import grass from "../../assets/terrain/grass-v3.webp";
import dew from "../../assets/terrain/dew-v3.webp";
import road from "../../assets/terrain/road-v3.webp";
import water from "../../assets/terrain/water-v3.webp";
import flowers from "../../assets/terrain/flowers-v3.webp";
import { FIELD_TERRAIN_KINDS, TEXTURE_SIZE } from "./meadow";
import { ROAD_TILE_COUNT, roadFrame } from "./roadTiles";

export const TERRAIN_ATLAS = "meadow-terrain";
export const CLIFF_WALL_TEXTURE = "dew-meadow-cliff-face-v1";
// 이슬 지면은 통행 가능한 풀밭이며 수면 텍스처를 사용하지 않는다.
// 서버의 wall 지형도 현재 절벽 재질로 표시하며 이동 불가 코드 자체는 유지한다.
const SOURCES = { grass, dew, road, flowers, water, "ash": extendedAshSource, "boulder": extendedBoulderSource, "gravel": extendedGravelSource, "leaf-litter": extendedLeafLitterSource, "moss": extendedMossSource, "mud": extendedMudSource, "paving": iseulonPavingSource, "reed-bed": extendedReedBedSource, "stone": extendedStoneSource, "tree-base": extendedTreeBaseSource, "wall": cliffWallPatternSource };
const SOURCE_KINDS = FIELD_TERRAIN_KINDS;
const TRANSPARENT_TERRAIN_KINDS = new Set<string>(["boulder", "tree-base"]);
const FRAME_W = TEXTURE_SIZE;
const FRAME_H = TEXTURE_SIZE / 2;
const FRAME_PADDING = 2;
const FRAME_STRIDE = FRAME_W + FRAME_PADDING * 2;
const ATLAS_COLUMNS = 8;
const FRAME_COUNT = SOURCE_KINDS.length + ROAD_TILE_COUNT * 2;
const framePosition = (index: number) => ({ x: (index % ATLAS_COLUMNS) * FRAME_STRIDE + FRAME_PADDING,
  y: Math.floor(index / ATLAS_COLUMNS) * (FRAME_H + FRAME_PADDING * 2) + FRAME_PADDING });
const ROAD_SHAPE = { inset: TEXTURE_SIZE * .08, radius: TEXTURE_SIZE * .2, half: TEXTURE_SIZE / 2 };
const FLOWER_BLEND = { center: TEXTURE_SIZE / 2, radius: TEXTURE_SIZE * .64, innerStop: .8 };

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
  for (const kind of SOURCE_KINDS) scene.load.image(`terrain-source-${kind}`, SOURCES[kind]);
  scene.load.image(CLIFF_WALL_TEXTURE, cliffWallPatternSource);
}

// 투명 여백을 둔 단일 아틀라스로 구성해 타일 간 텍스처 번짐을 방지한다.
export function createTerrainAtlas(scene: Phaser.Scene) {
  if (scene.textures.exists(TERRAIN_ATLAS)) return;
  const atlas = scene.textures.createCanvas(TERRAIN_ATLAS,
    FRAME_STRIDE * ATLAS_COLUMNS, (FRAME_H + FRAME_PADDING * 2) * Math.ceil(FRAME_COUNT / ATLAS_COLUMNS));
  if (!atlas) throw new Error("초원 타일 아틀라스를 만들 수 없습니다.");
  const ctx = atlas.getContext();
  const grassSource = scene.textures.get("terrain-source-grass").getSourceImage() as HTMLImageElement;
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
    const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
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
  for (const [surfaceIndex, surface] of ["road", "water"].entries()) {
    const surfaceSource = scene.textures.get(`terrain-source-${surface}`).getSourceImage() as HTMLImageElement;
    for (let mask = 0; mask < ROAD_TILE_COUNT; mask++) {
      const { x, y } = framePosition(SOURCE_KINDS.length + surfaceIndex * ROAD_TILE_COUNT + mask);
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
