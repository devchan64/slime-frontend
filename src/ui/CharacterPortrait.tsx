const DEFAULT_CHARACTER = new URL("../assets/characters/default-v1.png", import.meta.url).href;

// 필드와 캐릭터 창에서 같은 기본 외형을 사용한다.
export function CharacterPortrait() {
  return <img src={DEFAULT_CHARACTER} class="character-portrait" width="1254" height="1254"
    alt="청록색 천 의상과 가죽 장화를 착용한 기본 모험가" />;
}
