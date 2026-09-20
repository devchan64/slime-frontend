import { useTranslation } from "../i18n";
import { localizedSkill } from "../client/skillText";
import { growthCost } from "./growthCost";
import { useState } from "preact/hooks";
import type { State } from "../client/types";
import { CharacterPortrait } from "./CharacterPortrait";
import { EquipmentPanel } from './EquipmentPanel';
import type { Client } from '../client/api';

const ATTRIBUTES = [
  { id: "body", icon: "◇" },
  { id: "intellect", icon: "▱" },
  { id: "spirit", icon: "✧" },
] as const;

const SKILL_DEFINITIONS = [
  { id: "physical_activity", name: "신체활동", icon: "◇", description: "걷기·달리기·뛰기·주먹질·발차기 · 레벨 1부터 일반 공격 스킬 포함" },
  { id: "literacy", name: "문해", icon: "▱", description: "읽고 쓰는 능숙함" },
  { id: "speaking", name: "말하기", icon: "✧", description: "말로 표현하고 전달하는 능숙함" },
] as const;

type Props = {
  expanded?: boolean;
  gameSessionClient?: Client;
  me: State["me"];
  disabled: boolean;
  command: (path: string, body?: Record<string, unknown>) => unknown;
};

export function CharacterSettings({ me, disabled, command, expanded = false, gameSessionClient }: Props) {
  const { t, locale } = useTranslation();
  const [category, setCategory] = useState<"attributes" | "skills" | "equipment">("attributes");
  const entries = category === "attributes" ? ATTRIBUTES.map(entry => ({ ...entry, name: t(`character.${entry.id}Name`), description: t(`character.${entry.id}Description`) })) : Object.keys(me.skills).map(id => {
    // 직전 v1 서버는 생성 시 지급 스킬의 메타데이터를 제공하지 않는다.
    const definition = me.skillDefinitions?.[id] ?? SKILL_DEFINITIONS.find(skill => skill.id === id);
    if (!definition) throw new Error(`보유 스킬 정의가 없습니다: ${id}`);
    return localizedSkill(definition, locale);
  });
  const levels: Record<string, number> = category === "attributes" ? me.attributes : me.skills;
  const currency = category === "skills" ? "SP" : "CP";
  const balance = category === "skills" ? me.sp : me.cp;
  const attributeGrowth = growthCost("attributes", me.attributes, me.skills, me.skillGrowthBaselines);
  const locked = !["LOBBY", "FIELD"].includes(me.mode) || !!me.battleId;
  const content = <div class="character-sheet">
    <section class="character-identity" aria-label={t("character.identity")}>
      <span class="character-kicker">{t("character.adventurer")}</span>
      <h2>{me.name}</h2>
      <div class="portrait-stage"><CharacterPortrait playStandingAnimation /></div>
      <span class="costume-label">{t("character.costume")}</span>
      <dl class="character-resources">
        <div><dt>{t("character.coins")}</dt><dd>{me.coins}</dd></div>
      </dl>
    </section>
    <section class="character-growth" aria-label={t("character.growth")}>
      {category !== 'equipment' && <><div class="growth-heading"><div><span class="character-kicker">{t("character.direction")}</span><h3>{t("character.growth")}</h3></div>
        <div class="cp-balance" role="status" aria-live="polite"><span>{t("character.available", { currency })}</span><strong>{balance ?? t("character.connectionRequired")}<small> {currency}</small></strong></div>
      </div>
      <dl class="character-resources cp-breakdown" aria-label={t("character.breakdown")}><div><dt>{t("character.generalPoints")}</dt><dd>{me.cpGeneral} <small>CP</small></dd></div><div><dt>{t("character.seasonPoints")}</dt><dd>{me.cpSeasonal} <small>CP</small></dd></div></dl>
      <p class="growth-intro">{t("character.intro")}<br />{t("character.currencies")}</p></>}
      <div class="growth-categories" role="group" aria-label={t("character.category")}>
        <button class="secondary" aria-pressed={category === "attributes"} onClick={() => setCategory("attributes")}>{t("character.attributes")}</button>
        <button class="secondary" aria-pressed={category === "skills"} onClick={() => setCategory("skills")}>{t("character.skills")}</button>
        {gameSessionClient && <button class="secondary" aria-pressed={category === 'equipment'} onClick={() => setCategory('equipment')}>{t('equipment.title')}</button>}
      </div>
      {category === 'equipment' && gameSessionClient ? <EquipmentPanel gameSessionClient={gameSessionClient}
        actionsAreDisabled={disabled || !!me.battleId || !['LOBBY','FIELD','AWAY'].includes(me.mode)} characterStateVersion={me.version} /> : <>
      <p class="growth-help">{category === "skills" && t("character.skillList")}</p>
      {category === "skills" && me.battleSkillSlotLimit !== undefined && <section class="skill-loadout" aria-label={t("character.battleSlots")}>
        <h4>{t("character.battleSlots")} · {(me.battleSkillLoadout ?? []).length}/{me.battleSkillSlotLimit}</h4>
        <p>{t("character.battleSlotsHelp")}</p>
        <div class="skill-loadout-options">{entries.map(({id, name}) => {
          const loadout = me.battleSkillLoadout ?? [];
          const index = loadout.indexOf(id);
          return <label key={id}><input type="checkbox" checked={index >= 0}
            disabled={disabled || locked || (index < 0 && loadout.length >= me.battleSkillSlotLimit!)}
            onChange={() => command("/v1/characters/me/skill-loadout", {skills: index >= 0 ? loadout.filter(key => key !== id) : [...loadout, id]})} />
            <span>{index >= 0 ? `${index + 1}. ` : ""}{name} · Lv. {me.skills[id]}{me.skillUseLocks?.[id] && ` · ${t('character.skillUseLocked')}`}</span></label>;
        })}</div>
      </section>}
      {category === "attributes" && <p class="growth-help">{t("character.nextCost", { category: t("character.attributes"), count: attributeGrowth.count, cost: attributeGrowth.label, currency })}</p>}
      <div class="attribute-list">{entries.map(({ id, name, icon, description }) => {
        const level = levels[id];
        const growth = category === "skills" ? growthCost("skills", me.attributes, me.skills, me.skillGrowthBaselines, id) : attributeGrowth;
        const cost = growth.cost;
        const insufficient = balance === undefined || balance < cost;
        return <div class={`attribute-card attribute-${id}`} key={id}>
          <span class="attribute-icon" aria-hidden="true">{icon}</span>
          <div class="attribute-info"><div><strong>{name}</strong><span>Lv. {level}{category === "skills" && level === 0 ? t("character.noEffect") : ""}</span></div><p>{description}</p>{category === 'skills' && me.skillUseLocks?.[id] && <p class="growth-help">{t('character.skillBookSold')}</p>}</div>
          <button disabled={disabled || locked || insufficient}
            onClick={() => command(`/v1/characters/me/${category}`, category === "skills" ? { skill: id } : { attribute: id })}
            aria-label={t("character.raiseLabel", { name, level, next: level + 1, cost: growth.label, currency })}>
            <strong>{t("character.raise")}</strong><span>{insufficient ? t("character.insufficient", { currency, cost: growth.label }) : t("character.spend", { cost: growth.label, currency })}</span>
          </button>
        </div>;
      })}</div>
      <p class="growth-help">{locked ? t("character.locked") : t("character.saved")}</p>
      <details class="growth-rules"><summary>{t("character.rulesTitle")}</summary><p>{t("character.rules")}</p></details>
      </>}
    </section>
  </div>;
  return expanded ? <section class="character-settings">{content}</section> :
    <details class="card character-settings"><summary>{t("character.summary", { cp: me.cp, sp: me.sp ?? t("character.connectionRequired") })}</summary>{content}</details>;
}
