/** 공개 v2 셀 애니메이션 계약과 시간 기반 재생. 서버 상태를 변경하지 않는다. */
export const DIRECTIONS = ['down_left', 'down_right', 'up_left', 'up_right'] as const;
export type Direction = typeof DIRECTIONS[number];
export type CellFrame = { frameId: string; rect: { x: number; y: number; width: number; height: number }; anchor: { x: number; y: number } };
export type CellClip = { clipId: string; action: string; direction: Direction; frames: { frameId: string; durationMs: number }[]; loop: boolean; nextClipId: string | null };
export type CellAnimationData = { animationId: string; version: string; sheet: { width: number; height: number }; frames: CellFrame[]; clips: CellClip[] };
type RecordValue = Record<string, unknown>;
function object(value: unknown, keys: string[], label: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))
    throw new Error(`${label}: 필드가 누락되었거나 알 수 없는 필드가 있습니다.`);
  return value as RecordValue;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || value.trim() !== value || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error('관리 식별자 형식이 올바르지 않습니다.');
  return value;
}
function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error('안전한 정수 범위의 값이 필요합니다.');
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || !value.length) throw new Error('비어 있지 않은 목록이 필요합니다.');
  return value;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function validateCellAnimation(value: unknown): CellAnimationData {
  const data = object(value, ['animationId','version','sheet','frames','clips'], 'animation');
  id(data.animationId); id(data.version);
  const sheet = object(data.sheet, ['width','height'], 'sheet');
  const width = integer(sheet.width, 1), height = integer(sheet.height, 1);
  const frames = new Map<string, CellFrame>();
  for (const value of list(data.frames)) {
    const frame = object(value, ['frameId','rect','anchor'], 'frame'), key = id(frame.frameId);
    if (frames.has(key)) throw new Error('프레임 ID가 중복되었습니다.');
    const rect = object(frame.rect, ['x','y','width','height'], 'rect');
    const x = integer(rect.x), y = integer(rect.y), w = integer(rect.width, 1), h = integer(rect.height, 1);
    if (x > width - w || y > height - h) throw new Error('프레임 영역이 시트 범위를 벗어났습니다.');
    const anchor = object(frame.anchor, ['x','y'], 'anchor');
    for (const [key, maximum] of [['x', w], ['y', h]] as const) {
      const coordinate = anchor[key];
      if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || coordinate < 0 || coordinate > maximum) throw new Error('기준점이 프레임 범위를 벗어났습니다.');
    }
    frames.set(key, value as CellFrame);
  }
  const clips = new Map<string, CellClip>(), pairs = new Set<string>(), actions = new Set<string>(), used = new Set<string>();
  for (const value of list(data.clips)) {
    const clip = object(value, ['clipId','action','direction','frames','loop','nextClipId'], 'clip');
    const key = id(clip.clipId), action = id(clip.action);
    if (typeof clip.direction !== 'string' || !DIRECTIONS.includes(clip.direction as Direction)) throw new Error('쿼터뷰 네 방향 중 하나가 필요합니다.');
    const pair = JSON.stringify([action, clip.direction]);
    if (clips.has(key) || pairs.has(pair)) throw new Error('클립 ID 또는 동작/방향 조합이 중복되었습니다.');
    pairs.add(pair); actions.add(action);
    let duration = 0;
    for (const value of list(clip.frames)) {
      const item = object(value, ['frameId','durationMs'], 'clip.frame'), key = id(item.frameId);
      if (!frames.has(key)) throw new Error('존재하지 않는 프레임 참조입니다.');
      used.add(key); duration += integer(item.durationMs, 1);
      if (!Number.isSafeInteger(duration)) throw new Error('클립 재생 시간 합계가 안전한 범위를 넘었습니다.');
    }
    if (typeof clip.loop !== 'boolean') throw new Error('loop에는 참/거짓이 필요합니다.');
    if (clip.nextClipId !== null) {
      id(clip.nextClipId);
      if (clip.loop) throw new Error('반복 클립에는 종료 후 클립을 지정할 수 없습니다.');
    }
    clips.set(key, value as CellClip);
  }
  if (used.size !== frames.size) throw new Error('사용하지 않는 프레임이 있습니다.');
  for (const action of actions) for (const direction of DIRECTIONS)
    if (!pairs.has(JSON.stringify([action, direction]))) throw new Error('모든 동작에 네 방향 클립이 필요합니다.');
  for (const clip of clips.values()) if (clip.nextClipId !== null && clips.get(clip.nextClipId)?.direction !== clip.direction)
    throw new Error('종료 후 클립은 존재하며 같은 방향이어야 합니다.');
  return freeze(structuredClone(value as CellAnimationData));
}

export type CellSample = { clipId: string; frame: CellFrame; completed: boolean };
type CompiledClip = { data: CellClip; ends: number[]; duration: number };
export class CellAnimation {
  readonly data: CellAnimationData;
  private frames: Map<string, CellFrame>;
  private clips = new Map<string, CompiledClip>();
  private actions = new Map<string, string>();
  constructor(value: unknown) {
    this.data = validateCellAnimation(value);
    this.frames = new Map(this.data.frames.map(frame => [frame.frameId, frame]));
    for (const clip of this.data.clips) {
      let total = 0;
      const ends = clip.frames.map(frame => total += frame.durationMs);
      this.clips.set(clip.clipId, { data: clip, ends, duration: total });
      this.actions.set(JSON.stringify([clip.action, clip.direction]), clip.clipId);
    }
  }
  clip(action: string, direction: Direction): string {
    const id = this.actions.get(JSON.stringify([action, direction]));
    if (!id) throw new Error(`등록되지 않은 동작/방향입니다: ${action}/${direction}`);
    return id;
  }
  sample(clipId: string, elapsedMs: number): CellSample {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > Number.MAX_SAFE_INTEGER) throw new Error('재생 경과 시간이 올바르지 않습니다.');
    let remaining = elapsedMs;
    const visited = new Map<string, number>();
    for (;;) {
      const clip = this.clips.get(clipId);
      if (!clip) throw new Error(`등록되지 않은 클립입니다: ${clipId}`);
      const previous = visited.get(clipId);
      if (previous !== undefined) {
        remaining %= previous - remaining;
        visited.clear();
      }
      visited.set(clipId, remaining);
      if (clip.data.loop) remaining %= clip.duration;
      if (remaining >= clip.duration) {
        if (clip.data.nextClipId !== null) {
          remaining -= clip.duration; clipId = clip.data.nextClipId; continue;
        }
        return { clipId, frame: this.frames.get(clip.data.frames.at(-1)!.frameId)!, completed: true };
      }
      let low = 0, high = clip.ends.length - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (remaining < clip.ends[middle]) high = middle; else low = middle + 1;
      }
      return { clipId, frame: this.frames.get(clip.data.frames[low].frameId)!, completed: false };
    }
  }
}
