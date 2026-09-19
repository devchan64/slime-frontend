import Phaser from "phaser";
import grass from "../../assets/terrain/grass.webp";
import dew from "../../assets/terrain/dew.webp";
import road from "../../assets/terrain/road.webp";
import flowers from "../../assets/terrain/flowers.webp";
import { TERRAIN_KINDS, TEXTURE_SIZE } from "./meadow";

export const TERRAIN_ATLAS = "meadow-terrain";
const SOURCES = { grass, dew, road, flowers };
const FRAME_W = TEXTURE_SIZE;
const FRAME_H = TEXTURE_SIZE / 2;
const FRAME_PADDING = 2;
const FRAME_STRIDE = FRAME_W + FRAME_PADDING * 2;

export function preloadTerrain(scene: Phaser.Scene) {
  for (const kind of TERRAIN_KINDS) scene.load.image(`terrain-source-${kind}`, SOURCES[kind]);
}

// 투명 여백을 둔 단일 아틀라스로 구성해 타일 간 텍스처 번짐을 방지한다.
export function createTerrainAtlas(scene: Phaser.Scene) {
  if (scene.textures.exists(TERRAIN_ATLAS)) return;
  const atlas = scene.textures.createCanvas(TERRAIN_ATLAS,
    FRAME_STRIDE * TERRAIN_KINDS.length, FRAME_H + FRAME_PADDING * 2);
  if (!atlas) throw new Error("초원 타일 아틀라스를 만들 수 없습니다.");
  const ctx = atlas.getContext();
  TERRAIN_KINDS.forEach((kind, index) => {
    const sourceKey = `terrain-source-${kind}`;
    if (!scene.textures.exists(sourceKey)) throw new Error(`초원 타일 누락: ${kind}`);
    const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
    const x = index * FRAME_STRIDE + FRAME_PADDING;
    ctx.save();
    ctx.translate(x + FRAME_W / 2, FRAME_PADDING);
    ctx.transform(FRAME_W / (2 * TEXTURE_SIZE), FRAME_H / (2 * TEXTURE_SIZE),
      -FRAME_W / (2 * TEXTURE_SIZE), FRAME_H / (2 * TEXTURE_SIZE), 0, 0);
    ctx.drawImage(source, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.restore();
    atlas.add(kind, 0, x, FRAME_PADDING, FRAME_W, FRAME_H);
  });
  atlas.refresh();
}
