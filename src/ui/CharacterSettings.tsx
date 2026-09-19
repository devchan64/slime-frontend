import type { State } from "../client/types";

const ATTRIBUTES = [
  { id: "body", name: "신체" }, { id: "intellect", name: "지성" }, { id: "spirit", name: "영성" },
] as const;

type Props = {
  expanded?: boolean;
  me: State["me"];
  disabled: boolean;
  command: (path: string, body?: Record<string, unknown>) => unknown;
};

export function CharacterSettings({ me, disabled, command, expanded = false }: Props) {
  const content = <>
    <p><strong>남은 CP {me.cp}</strong></p>
    <p>시작 CP 10 · 능력치별 상승 비용은 1, 2, 4, 8… CP입니다.</p>
    {ATTRIBUTES.map(({ id, name }) => {
      const level = me.attributes[id];
      const cost = 2 ** (level - 1);
      return <div class="attribute-row" key={id}>
        <span>{name} <strong>Lv. {level}</strong></span>
        <button disabled={disabled || !["LOBBY", "FIELD"].includes(me.mode) || !!me.battleId || me.cp < cost}
          onClick={() => command("/v1/characters/me/attributes", { attribute: id })}
          aria-label={`${name} 1레벨 상승, ${cost} CP 사용`}>+1 · {cost} CP</button>
      </div>;
    })}
    <small>분배 즉시 저장됩니다. 전투 수치와의 연결은 준비 중입니다.</small>
  </>;
  return expanded ? <section class="character-settings">{content}</section> :
    <details class="card character-settings"><summary>캐릭터 설정 · 남은 CP {me.cp}</summary>{content}</details>;
}
