import { useTranslation } from "../i18n";
import standingPortraitMetadata from "../assets/characters/character-default-white-shirt-standing-v2/idle-v2.animation.json";
const DEFAULT_CHARACTER_PORTRAIT = new URL("../assets/characters/character-default-white-shirt-standing-v2/idle-v2.png", import.meta.url).href;
const CHARACTER_PORTRAIT_FRAME = standingPortraitMetadata.frames.find(currentFrameRecord => currentFrameRecord.frameId === 'down_right.0');
if (!CHARACTER_PORTRAIT_FRAME) throw new Error('캐릭터 초상화의 스탠딩 프레임이 없습니다.');
const CHARACTER_PORTRAIT_RECT = CHARACTER_PORTRAIT_FRAME.rect;
const CHARACTER_PORTRAIT_VIEWBOX = `${CHARACTER_PORTRAIT_RECT.x} ${CHARACTER_PORTRAIT_RECT.y} ${CHARACTER_PORTRAIT_RECT.width} ${CHARACTER_PORTRAIT_RECT.height}`;

// 필드와 캐릭터 창에서 같은 기본 외형을 사용한다.
export function CharacterPortrait() {
  const { t } = useTranslation();
  return <svg class="character-portrait" width={CHARACTER_PORTRAIT_RECT.width} height={CHARACTER_PORTRAIT_RECT.height}
    viewBox={CHARACTER_PORTRAIT_VIEWBOX} role="img" aria-label={t("character.portrait")} overflow="hidden">
    <image href={DEFAULT_CHARACTER_PORTRAIT} width={standingPortraitMetadata.sheet.width} height={standingPortraitMetadata.sheet.height} />
  </svg>;
}
