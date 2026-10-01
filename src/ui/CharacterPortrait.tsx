import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "../i18n";
import characterIdlePortraitMetadata from "../../../slime-assets/assets/characters/default/animations/idle-v6/down-left-8frames-v1/idle-v6.animation.json";

const DEFAULT_CHARACTER_PORTRAIT = new URL("../../../slime-assets/assets/characters/default/animations/idle-v6/down-left-8frames-v1/idle-v6.png", import.meta.url).href;
const CHARACTER_PORTRAIT_CLIP = characterIdlePortraitMetadata.clips.find(currentClipRecord => currentClipRecord.clipId === "idle.down_left");
if (!CHARACTER_PORTRAIT_CLIP?.frames.length) throw new Error("캐릭터 초상화의 대기 클립이 없습니다.");
const CHARACTER_PORTRAIT_FRAMES = CHARACTER_PORTRAIT_CLIP.frames.map(currentClipFrame => {
  const currentFrameRecord = characterIdlePortraitMetadata.frames.find(currentFrameRecord => currentFrameRecord.frameId === currentClipFrame.frameId);
  if (!currentFrameRecord || currentClipFrame.durationMs <= 0) throw new Error("캐릭터 초상화의 대기 프레임이 올바르지 않습니다.");
  return { ...currentFrameRecord, durationMs: currentClipFrame.durationMs };
});
const CHARACTER_PORTRAIT_BASE = CHARACTER_PORTRAIT_FRAMES[0];

type CharacterPortraitProps = { playIdleAnimation?: boolean };

// 설정 화면에서는 대기를 반복하고 다른 초상화는 첫 프레임을 표시한다.
export function CharacterPortrait({ playIdleAnimation = false }: CharacterPortraitProps) {
  const { t: translatePortraitLabel } = useTranslation();
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  useEffect(() => {
    if (!playIdleAnimation) {
      setCurrentFrameIndex(0);
      return;
    }
    const frameTimeoutHandle = window.setTimeout(() => {
      setCurrentFrameIndex(previousFrameIndex => (previousFrameIndex + 1) % CHARACTER_PORTRAIT_FRAMES.length);
    }, CHARACTER_PORTRAIT_FRAMES[currentFrameIndex].durationMs);
    return () => window.clearTimeout(frameTimeoutHandle);
  }, [playIdleAnimation, currentFrameIndex]);
  const currentPortraitFrame = CHARACTER_PORTRAIT_FRAMES[currentFrameIndex];
  const currentPortraitRect = currentPortraitFrame.rect;
  const currentPortraitViewbox = `${currentPortraitRect.x} ${currentPortraitRect.y} ${currentPortraitRect.width} ${currentPortraitRect.height}`;
  return <svg class="character-portrait" width={CHARACTER_PORTRAIT_BASE.rect.width} height={CHARACTER_PORTRAIT_BASE.rect.height}
    viewBox={`0 0 ${CHARACTER_PORTRAIT_BASE.rect.width} ${CHARACTER_PORTRAIT_BASE.rect.height}`}
    role="img" aria-label={translatePortraitLabel("character.portrait")} overflow="hidden">
    <svg x={CHARACTER_PORTRAIT_BASE.anchor.x - currentPortraitFrame.anchor.x}
      y={CHARACTER_PORTRAIT_BASE.anchor.y - currentPortraitFrame.anchor.y}
      width={currentPortraitRect.width} height={currentPortraitRect.height} viewBox={currentPortraitViewbox} overflow="hidden">
      <image href={DEFAULT_CHARACTER_PORTRAIT} width={characterIdlePortraitMetadata.sheet.width} height={characterIdlePortraitMetadata.sheet.height} />
    </svg>
  </svg>;
}
