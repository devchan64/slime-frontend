import { useTranslation } from "../i18n";
const DEFAULT_CHARACTER = new URL("../assets/characters/default-v1.png", import.meta.url).href;

// 필드와 캐릭터 창에서 같은 기본 외형을 사용한다.
export function CharacterPortrait() {
  const { t } = useTranslation();
  return <img src={DEFAULT_CHARACTER} class="character-portrait" width="1254" height="1254"
    alt={t("character.portrait")} />;
}
