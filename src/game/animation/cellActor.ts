import type Phaser from 'phaser';
import { CellAnimation, type Direction } from './cellAnimation';

const bindings = new WeakMap<Phaser.Textures.Texture, string>();
const frameName = (animation: CellAnimation, id: string) => `cell:${animation.data.animationId}@${animation.data.version}:${id}`;

/** 이미 로드한 시트를 명시된 프레임으로 등록한다. 텍스처나 누락 방향을 대체하지 않는다. */
export function bindCellTexture(scene: Phaser.Scene, key: string, animation: CellAnimation) {
  if (!scene.textures.exists(key)) throw new Error(`셀 애니메이션 이미지가 로드되지 않았습니다: ${key}`);
  const texture = scene.textures.get(key), source = texture.getSourceImage();
  if (source.width !== animation.data.sheet.width || source.height !== animation.data.sheet.height)
    throw new Error('로드된 시트와 애니메이션 크기가 다릅니다.');
  const signature = JSON.stringify(animation.data), bound = bindings.get(texture);
  if (bound !== undefined) {
    if (bound !== signature) throw new Error('같은 텍스처의 셀 애니메이션 계약을 바꿀 수 없습니다.');
    return;
  }
  for (const frame of animation.data.frames)
    if (texture.has(frameName(animation, frame.frameId))) throw new Error('셀 프레임 이름이 기존 텍스처와 충돌합니다.');
  for (const frame of animation.data.frames) {
    const { x, y, width, height } = frame.rect;
    if (!texture.add(frameName(animation, frame.frameId), 0, x, y, width, height)) throw new Error('셀 프레임 등록에 실패했습니다.');
  }
  bindings.set(texture, signature);
}

type Options = { x: number; y: number; scale: number; action: string; direction: Direction };
/** 맵과 전투가 공유할 표현 전용 어댑터. image 위치·깊이는 호출자가 관리한다. */
export class CellActor {
  readonly image: Phaser.GameObjects.Image;
  private clipId: string;
  private startedAt: number;
  private disposed = false;
  private advance = (now: number) => this.update(now);
  private shutdown = () => this.destroy();
  private detach = () => {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.events.off('update', this.advance);
    this.scene.events.off('shutdown', this.shutdown);
  };
  constructor(private scene: Phaser.Scene, private key: string, readonly animation: CellAnimation, options: Options) {
    if (![options.x, options.y, options.scale, scene.time.now].every(Number.isFinite) || options.scale <= 0)
      throw new Error('셀 개체의 위치·크기·시각이 올바르지 않습니다.');
    this.clipId = animation.clip(options.action, options.direction);
    this.startedAt = scene.time.now;
    bindCellTexture(scene, key, animation);
    this.image = scene.add.image(options.x, options.y, key).setScale(options.scale);
    this.image.once('destroy', this.detach);
    this.scene.events.on('update', this.advance);
    this.scene.events.once('shutdown', this.shutdown);
    this.update(this.startedAt);
  }
  play(action: string, direction: Direction, restart = false) {
    if (this.disposed) throw new Error('제거된 셀 개체는 재생할 수 없습니다.');
    const next = this.animation.clip(action, direction);
    if (next !== this.clipId || restart) {
      this.clipId = next;
      this.startedAt = this.scene.time.now;
    }
    this.update(this.scene.time.now);
  }
  update(now: number) {
    if (this.disposed) return;
    const sample = this.animation.sample(this.clipId, now - this.startedAt), frame = sample.frame;
    this.image.setTexture(this.key, frameName(this.animation, frame.frameId))
      .setOrigin(frame.anchor.x / frame.rect.width, frame.anchor.y / frame.rect.height);
  }
  destroy() {
    if (this.disposed) return;
    this.detach();
    this.image.destroy();
  }
}
