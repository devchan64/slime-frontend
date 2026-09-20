import {useTranslation} from '../i18n';
import {validateCitizenshipSummary,type CitizenshipSummary} from '../client/citizenshipSummary';

export function CharacterCitizenships({currentCitizenshipSummary}:{currentCitizenshipSummary?:CitizenshipSummary}){
  const {t:translateCitizenshipText,locale:currentDisplayLocale}=useTranslation();
  const currentValidatedSummary=currentCitizenshipSummary===undefined?undefined:validateCitizenshipSummary(currentCitizenshipSummary);
  function formatCitizenshipTime(currentTimestampValue:number){
    return new Date(currentTimestampValue*1000).toLocaleString(currentDisplayLocale,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
  }
  return <details class="character-citizenships">
    <summary>{translateCitizenshipText('citizenship.title')}{currentValidatedSummary && ` · ${translateCitizenshipText('citizenship.validCount',{count:currentValidatedSummary.records.filter(currentCitizenshipRecord=>currentCitizenshipRecord.status==='VALID').length})}`}</summary>
    {!currentValidatedSummary?<p>{translateCitizenshipText('citizenship.unavailable')}</p>:<>
      {!currentValidatedSummary.records.length&&<p>{translateCitizenshipText('citizenship.empty')}</p>}
      <ul>{currentValidatedSummary.records.map((currentCitizenshipRecord,currentRecordIndex)=><li key={`${currentCitizenshipRecord.cityId}:${currentRecordIndex}`}>
        <strong>{currentCitizenshipRecord.cityName}</strong>
        <span class={`citizenship-status is-${currentCitizenshipRecord.status.toLowerCase()}`}>{translateCitizenshipText(`citizenship.${currentCitizenshipRecord.status.toLowerCase()}`)}</span>
        <small>{translateCitizenshipText(`citizenship.${currentCitizenshipRecord.source}`)}</small>
        <dl><div><dt>{translateCitizenshipText('citizenship.starts')}</dt><dd>{formatCitizenshipTime(currentCitizenshipRecord.startsAt)}</dd></div>
          <div><dt>{translateCitizenshipText('citizenship.expires')}</dt><dd>{formatCitizenshipTime(currentCitizenshipRecord.expiresAt)}</dd></div></dl>
      </li>)}</ul>
      <small>{translateCitizenshipText('citizenship.checked')}</small>
    </>}
    <p>{translateCitizenshipText('citizenship.help')}</p>
  </details>;
}
