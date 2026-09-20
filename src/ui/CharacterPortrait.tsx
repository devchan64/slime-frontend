import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "../i18n";
import standingPortraitMetadata from "../assets/characters/default/standing-v3/idle-v3.animation.json";

const DEFAULT_CHARACTER_PORTRAIT = new URL("../assets/characters/default/standing-v3/idle-v3.png", import.meta.url).href;
const CHARACTER_PORTRAIT_CLIP = standingPortraitMetadata.clips.find(currentClipRecord => currentClipRecord.clipId === "idle.down_right");
if (!CHARACTER_PORTRAIT_CLIP?.frames.length) throw new Error("캐릭터 초상화의 스탠딩 클립이 없습니다.");
const CHARACTER_PORTRAIT_FRAMES = CHARACTER_PORTRAIT_CLIP.frames.map(currentClipFrame => {
  const currentFrameRecord = standingPortraitMetadata.frames.find(currentFrameRecord => currentFrameRecord.frameId === currentClipFrame.frameId);
  if (!currentFrameRecord || currentClipFrame.durationMs <= 0) throw new Error("캐릭터 초상화의 스탠딩 프레임이 올바르지 않습니다.");
  return { ...currentFrameRecord, durationMs: currentClipFrame.durationMs };
});
const CHARACTER_PORTRAIT_BASE = CHARACTER_PORTRAIT_FRAMES[0];

type CharacterPortraitProps = { playStandingAnimation?: boolean };

// 설정 화면에서는 스탠딩을 반복하고 다른 초상화는 첫 프레임을 표시한다.
export function CharacterPortrait({ playStandingAnimation = false }: CharacterPortraitProps) {
  const { t: translatePortraitLabel } = useTranslation();
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  useEffect(() => {
    if (!playStandingAnimation) {
      setCurrentFrameIndex(0);
      return;
    }
    const frameTimeoutHandle = window.setTimeout(() => {
      setCurrentFrameIndex(previousFrameIndex => (previousFrameIndex + 1) % CHARACTER_PORTRAIT_FRAMES.length);
    }, CHARACTER_PORTRAIT_FRAMES[currentFrameIndex].durationMs);
    return () => window.clearTimeout(frameTimeoutHandle);
  }, [playStandingAnimation, currentFrameIndex]);
  const currentPortraitFrame = CHARACTER_PORTRAIT_FRAMES[currentFrameIndex];
  const currentPortraitRect = currentPortraitFrame.rect;
  const currentPortraitViewbox = `${currentPortraitRect.x} ${currentPortraitRect.y} ${currentPortraitRect.width} ${currentPortraitRect.height}`;
  return <svg class="character-portrait" width={CHARACTER_PORTRAIT_BASE.rect.width} height={CHARACTER_PORTRAIT_BASE.rect.height}
    viewBox={`0 0 ${CHARACTER_PORTRAIT_BASE.rect.width} ${CHARACTER_PORTRAIT_BASE.rect.height}`}
    role="img" aria-label={translatePortraitLabel("character.portrait")} overflow="hidden">
    <svg x={CHARACTER_PORTRAIT_BASE.anchor.x - currentPortraitFrame.anchor.x}
      y={CHARACTER_PORTRAIT_BASE.anchor.y - currentPortraitFrame.anchor.y}
      width={currentPortraitRect.width} height={currentPortraitRect.height} viewBox={currentPortraitViewbox} overflow="hidden">
      <image href={DEFAULT_CHARACTER_PORTRAIT} width={standingPortraitMetadata.sheet.width} height={standingPortraitMetadata.sheet.height} />
    </svg>
  </svg>;
}
