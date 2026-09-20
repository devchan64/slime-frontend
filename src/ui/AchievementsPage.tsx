import { useEffect, useState } from 'preact/hooks';
import type { Client } from '../client/api';
import { noticeText, type Notice } from '../client/notice';
import { useTranslation } from '../i18n';
import { localizedSkill, type SkillDefinition } from '../client/skillText';
import { localizedAchievement, type AchievementDefinition as Definition } from '../client/achievementText';
type Scope = 'GENERAL' | 'SEASONAL';
type Progress = {completedAt:number|null;checklist:Record<string,{count:number}>};
type Ledger = {id:string;achievementId:string;scope:Scope;seasonId:string|null;amount:number;createdAt:number;sourceType:string};
type Data = {catalog:Record<string,Definition>;progress:Record<string,Progress>;season:string;skills:Record<string,SkillDefinition>;cp:number;sp?:number;cpLedger:Ledger[];spLedger:Ledger[]};
export function AchievementsPage({client,disabled,onReturn}:{client:Client;disabled:boolean;onReturn:()=>unknown}){
  const {t,locale}=useTranslation();
  const [data,setData]=useState<Data|null>(null);
  const [currentAchievementNotice,setAchievementRequestNotice]=useState<Notice>('');
  const [attempt,setAttempt]=useState(0);
  const [scope,setScope]=useState<Scope>('GENERAL');
  useEffect(()=>{
    let cancelled=false;setAchievementRequestNotice('');setData(null);
    Promise.all([client.request('/v1/achievements'),client.request('/v1/characters/me/achievements')])
      .then(([catalog,progress])=>{if(!cancelled)setData({catalog:catalog.achievements,progress:progress.achievements,season:progress.seasonId,skills:catalog.skillDefinitions ?? {},cp:progress.cp,sp:progress.sp,cpLedger:progress.cpLedger,spLedger:progress.spLedger ?? []});})
      .catch(currentRequestError=>{if(!cancelled)setAchievementRequestNotice(currentRequestError as Error);});
    return ()=>{cancelled=true;};
  },[client,attempt]);
  const number=(value:number)=>value.toLocaleString(locale);
  const catalog=data?Object.fromEntries(Object.entries(data.catalog).map(([id,d])=>[id,localizedAchievement(d,locale)])):{};
  const items=Object.entries(catalog).filter(([,d])=>d.scope===scope);
  const completed=items.filter(([id])=>data?.progress[id]?.completedAt!=null).length;
  const ledger=data?[...data.cpLedger.map(entry=>({...entry,currency:'CP'})),...data.spLedger.map(entry=>({...entry,currency:'SP'}))]
    .filter(entry=>entry.scope===scope).sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id)||a.currency.localeCompare(b.currency)):[];
  return <main class="achievements-page"><div class="achievement-heading"><div><h1>{t('achievements.title')}</h1><p>{t('achievements.away')}</p></div><button disabled={disabled} onClick={onReturn}>{t('achievements.return')}</button></div>
    {currentAchievementNotice?<p role="alert">{noticeText(currentAchievementNotice,locale,t)} <button class="secondary" onClick={()=>setAttempt(v=>v+1)}>{t('achievements.retry')}</button></p>:!data?<p role="status">{t('achievements.loading')}</p>:<>
      <section class="card achievement-overview" aria-label={t('achievements.balance')}>
        <div><strong>{t('achievements.balance')}</strong><p>{number(data.cp)} CP · {data.sp===undefined?t('achievements.unsupported'):number(data.sp)} SP</p></div>
        <p>{t('achievements.balanceHelp')}</p>
        <div class="growth-categories" role="group" aria-label={t('achievements.category')}>
          {(['GENERAL','SEASONAL'] as const).map(value=><button key={value} class="secondary" aria-pressed={scope===value} onClick={()=>setScope(value)}>{t(`achievements.${value.toLowerCase()}`)}</button>)}
        </div>
      </section>
      <section class="card" aria-label={t(`achievements.${scope.toLowerCase()}`)}>
        <h2>{t(`achievements.${scope.toLowerCase()}`)} <small>{t('achievements.completedCount',{done:completed,total:items.length})}</small></h2>
        {scope==='SEASONAL'&&<p>{t('achievements.season',{season:data.season})}</p>}
        {!items.length?<p>{t('achievements.empty')}</p>:items.map(([id,d])=>{
          const progress=data.progress[id];
          return <article class="achievement-item" key={id}><h3>{d.name} <small>{t(progress?.completedAt!=null?'achievements.complete':'achievements.inProgress')}</small></h3>
            <p>{t('achievements.reward')} · {[d.cp>0?`${number(d.cp)} CP`:null,d.sp?`${number(d.sp)} SP`:null].filter(Boolean).join(' · ')}{(d.skills??[]).map(id=>{
              const skill=data.skills[id];
              if(!skill)throw new Error(`업적 보상 스킬 정의가 없습니다: ${id}`);
              return <span key={id}> · {t('achievements.skill',{name:localizedSkill(skill,locale).name})}</span>;
            })}</p>
            <ul>{Object.entries(d.checklist).map(([key,c])=>{
              const count=progress?.checklist[key]?.count??0;
              return <li key={key}><div class="achievement-progress-label"><span>{c.description}</span><strong>{number(count)} / {number(c.target)}</strong></div><progress value={count} max={c.target} aria-label={c.description} /></li>;
            })}</ul>
          </article>;
        })}
      </section>
      <details class="card achievement-history"><summary>{t('achievements.history',{count:ledger.length})}</summary>
        <p>{t('achievements.historyHelp')}</p>
        {!ledger.length?<p>{t('achievements.noHistory')}</p>:<ul>{ledger.map(entry=><li key={`${entry.currency}:${entry.id}`}>
          <div><strong>{catalog[entry.achievementId]?.name??entry.achievementId}</strong><span>+{number(entry.amount)} {entry.currency}</span></div>
          <small>{entry.sourceType==='achievement_migration'?t('achievements.supplement'):t('achievements.awarded')}{entry.seasonId?` · ${entry.seasonId}`:''} · {new Date(entry.createdAt*1000).toLocaleString(locale)}</small>
        </li>)}</ul>}
      </details>
    </>}
  </main>;
}
