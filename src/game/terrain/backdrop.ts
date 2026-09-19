import Phaser from "phaser";
import background from "../../assets/terrain/meadow-backdrop.webp";

const BACKDROP_KEY = "meadow-backdrop";
const BACKDROP_DEPTH = -3;
const HORIZONTAL_MARGIN = 1.5;
const VERTICAL_MARGIN = 2;
const CENTER = 0.5;
const THEMES: Record<string, number> = {
  meadow: 0xffffff, grove: 0x8db69e, "mist-lake": 0xa6c8cb, "wind-hills": 0xe0cba1,
};

export function preloadBackdrop(scene: Phaser.Scene) {
  scene.load.image(BACKDROP_KEY, background);
}

export function createBackdrop(scene: Phaser.Scene) {
  if (!scene.textures.exists(BACKDROP_KEY)) throw new Error("환경 배경 이미지가 없습니다.");
  return scene.add.image(0, 0, BACKDROP_KEY).setDepth(BACKDROP_DEPTH);
}

// 지면과 같은 월드 좌표를 사용해 카메라 이동·줌에서도 풍경과 타일이 함께 움직인다.
export function fitBackdrop(image: Phaser.GameObjects.Image, camera: Phaser.Cameras.Scene2D.Camera,
  center: { x: number; y: number }, width: number, height: number, mapId: string) {
  const tint = THEMES[mapId];
  if (tint === undefined) throw new Error(`지원하지 않는 맵 배경입니다: ${mapId}`);
  const scale = Math.max(width * HORIZONTAL_MARGIN / image.width, height * VERTICAL_MARGIN / image.height);
  image.setPosition(center.x, center.y).setScale(scale).setTint(tint);
  camera.setBounds(center.x - image.displayWidth * CENTER, center.y - image.displayHeight * CENTER,
    image.displayWidth, image.displayHeight);
}
