import { useState } from "preact/hooks";
import type { State } from "../client/types";
import { CharacterPortrait } from "./CharacterPortrait";

const ATTRIBUTES = [
  { id: "body", name: "신체", icon: "◇", description: "몸을 움직이는 기반 역량" },
  { id: "intellect", name: "지성", icon: "▱", description: "이해하고 판단하는 기반 역량" },
  { id: "spirit", name: "영성", icon: "✧", description: "영적 활동의 기반 역량" },
] as const;

const SKILL_DEFINITIONS = [
  { id: "physical_activity", name: "신체활동", icon: "◇", description: "걷기·달리기·뛰기·주먹질·발차기 · 레벨 1부터 일반 공격 스킬 포함" },
  { id: "literacy", name: "문해", icon: "▱", description: "읽고 쓰는 능숙함" },
  { id: "speaking", name: "말하기", icon: "✧", description: "말로 표현하고 전달하는 능숙함" },
] as const;

type Props = {
  expanded?: boolean;
  me: State["me"];
  disabled: boolean;
  command: (path: string, body?: Record<string, unknown>) => unknown;
};

export function CharacterSettings({ me, disabled, command, expanded = false }: Props) {
  const [category, setCategory] = useState<"attributes" | "skills">("attributes");
  const entries = category === "attributes" ? ATTRIBUTES : SKILL_DEFINITIONS.filter(skill => Object.hasOwn(me.skills, skill.id));
  const levels: Record<string, number> = category === "attributes" ? me.attributes : me.skills;
  const locked = !["LOBBY", "FIELD"].includes(me.mode) || !!me.battleId;
  const content = <div class="character-sheet">
    <section class="character-identity" aria-label="내 캐릭터">
      <span class="character-kicker">나의 모험가</span>
      <h2>{me.name}</h2>
      <div class="portrait-stage"><CharacterPortrait /></div>
      <span class="costume-label">기본 모험가 의상</span>
      <dl class="character-resources">
        <div><dt>보유 재화</dt><dd>{me.coins}</dd></div>
      </dl>
    </section>
    <section class="character-growth" aria-label="캐릭터 성장">
      <div class="growth-heading"><div><span class="character-kicker">성장의 방향</span><h3>캐릭터 성장</h3></div>
        <div class="cp-balance" role="status" aria-live="polite"><span>사용 가능한 CP</span><strong>{me.cp}<small> CP</small></strong></div>
      </div>
      <dl class="character-resources cp-breakdown" aria-label="캐릭터 포인트 구분"><div><dt>일반포인트</dt><dd>{me.cpGeneral} <small>CP</small></dd></div><div><dt>시즌포인트</dt><dd>{me.cpSeasonal} <small>CP</small></dd></div></dl>
      <p class="growth-intro">어떤 모험가로 성장할까요?<br />능력치와 스킬 성장에는 시즌포인트를 먼저 사용하고, 부족한 만큼 일반포인트를 사용합니다.</p>
      <div class="growth-categories" role="group" aria-label="성장 항목 선택">
        <button class="secondary" aria-pressed={category === "attributes"} onClick={() => setCategory("attributes")}>능력치</button>
        <button class="secondary" aria-pressed={category === "skills"} onClick={() => setCategory("skills")}>스킬</button>
      </div>
      <p class="growth-help">{category === "skills" && "신체활동·문해·말하기는 캐릭터 생성 시 제공됩니다. 이후 습득한 스킬도 이 목록에서 관리합니다."}</p>
      <div class="attribute-list">{entries.map(({ id, name, icon, description }) => {
        const level = levels[id];
        const cost = 2 ** (level - 1);
        const insufficient = me.cp < cost;
        return <div class={`attribute-card attribute-${id}`} key={id}>
          <span class="attribute-icon" aria-hidden="true">{icon}</span>
          <div class="attribute-info"><div><strong>{name}</strong><span>Lv. {level}</span></div><p>{description}</p></div>
          <button disabled={disabled || locked || insufficient}
            onClick={() => command(`/v1/characters/me/${category}`, category === "skills" ? { skill: id } : { attribute: id })}
            aria-label={`${name} 레벨 ${level}에서 ${level + 1}로 상승, ${cost} CP 사용`}>
            <strong>+1 레벨</strong><span>{insufficient ? `CP 부족 · ${cost} 필요` : `${cost} CP 사용`}</span>
          </button>
        </div>;
      })}</div>
      <p class="growth-help">{locked ? "전투·조우가 끝나면 CP를 분배할 수 있습니다." : "성장은 즉시 저장됩니다. 같은 항목의 다음 비용만 2배가 됩니다."}</p>
      <details class="growth-rules"><summary>성장 규칙 안내</summary><p>시작 시 10 CP를 받습니다. 능력치·스킬별 비용은 1 → 2 → 4 → 8 CP 순서로 증가합니다. 분배 후 되돌리기는 제공하지 않으며, 전투 수치 연결은 준비 중입니다.</p></details>
    </section>
  </div>;
  return expanded ? <section class="character-settings">{content}</section> :
    <details class="card character-settings"><summary>캐릭터 설정 · 남은 CP {me.cp}</summary>{content}</details>;
}
