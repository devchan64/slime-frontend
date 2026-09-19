import Phaser from 'phaser';
import type { Surface, TerrainLink } from './elevation';
import { connectorPlacement } from './connectorPlacement';

const ASSET_SIZE = 128;
const ASSETS = import.meta.glob('../../assets/terrain/connectors/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function preloadConnectors(scene: Phaser.Scene) {
  for (const [path, url] of Object.entries(ASSETS)) {
    const key = path.split('/').pop()!.replace('.svg', '');
    scene.load.svg(key, url, { width: ASSET_SIZE * 2, height: ASSET_SIZE * 2 });
  }
}
export function drawConnector(scene: Phaser.Scene, link: TerrainLink, map: Surface, depth: number) {
  const {key,x,y}=connectorPlacement(link,map);
  if (!scene.textures.exists(key)) throw new Error(`높이 연결 에셋이 없습니다: ${key}`);
  return scene.add.image(x,y,key).setDisplaySize(ASSET_SIZE,ASSET_SIZE).setDepth(depth);
}
