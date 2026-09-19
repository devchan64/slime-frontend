import { useEffect, useState } from 'preact/hooks';
import type { Client } from '../client/api';
type Definition = {name:string;scope:'GENERAL'|'SEASONAL';cp:number;sp?:number;skills?:string[];checklist:Record<string,{description:string;target:number}>};
type Progress = {completedAt:number|null;checklist:Record<string,{count:number}>};
export function AchievementsPage({client,disabled,onReturn}:{client:Client;disabled:boolean;onReturn:()=>unknown}){
  const [data,setData]=useState<{catalog:Record<string,Definition>;progress:Record<string,Progress>;season:string;skills:Record<string,{name:string}>}|null>(null);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let cancelled=false;setError('');
    Promise.all([client.request('/v1/achievements'),client.request('/v1/characters/me/achievements')])
      .then(([catalog,progress])=>{if(!cancelled)setData({catalog:catalog.achievements,progress:progress.achievements,season:progress.seasonId,skills:catalog.skillDefinitions ?? {}});})
      .catch(e=>{if(!cancelled)setError((e as Error).message);});
    return ()=>{cancelled=true;};
  },[client,attempt]);
  return <main class="achievements-page"><div class="achievement-heading"><div><h1>업적</h1><p>자리비움 · 맵에서의 이동과 조우가 중단됩니다.</p></div><button disabled={disabled} onClick={onReturn}>맵으로 돌아가기</button></div>
    {error?<p role="alert">{error} <button class="secondary" onClick={()=>setAttempt(v=>v+1)}>다시 불러오기</button></p>:!data?<p role="status">업적을 불러오는 중입니다.</p>:<>
      {(['GENERAL','SEASONAL'] as const).map(scope=>{
        const items=Object.entries(data.catalog).filter(([,d])=>d.scope===scope);
        return <section class="card"><h2>{scope==='GENERAL'?'일반업적':'시즌업적'}</h2>{scope==='SEASONAL'&&<p>현재 시즌: {data.season}</p>}
          {!items.length?<p>등록된 업적이 없습니다.</p>:items.map(([id,d])=>{
            const progress=data.progress[id];
            return <article class="achievement-item" key={id}><h3>{d.name} <small>{progress?.completedAt!=null?'달성 완료':'진행 중'}</small></h3>
              <p>보상 · {d.cp > 0 ? `${d.cp} CP` : ''}{d.sp!==undefined?` · ${d.sp} SP`:''}{(d.skills ?? []).map(id => <span key={id}> · 스킬 획득: {data.skills[id]?.name ?? id}</span>)}</p>
              <ul>{Object.entries(d.checklist).map(([key,c])=><li key={key}>{c.description} · {progress?.checklist[key]?.count ?? 0}/{c.target}</li>)}</ul></article>;
          })}</section>;
      })}
    </>}
  </main>;
}
