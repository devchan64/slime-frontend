import {useTranslation} from '../i18n';
import type {TravelerPermitSummary} from '../client/travelerPermits';

const TRAVELER_PERMIT_STATUS_KEYS = {VALID:'citizenship.valid',EXPIRED:'citizenship.expired',PENDING:'citizenship.pending'} as const;
export function TravelerPermitList({currentPermitSummary, currentCharacterName}: {currentPermitSummary?: TravelerPermitSummary; currentCharacterName: string}) {
  const {t: translatePermitText, locale: currentDisplayLocale} = useTranslation();
  function formatPermitTimestamp(currentTimestampValue: number) {
    return new Date(currentTimestampValue * 1000).toLocaleString(currentDisplayLocale,
      {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
  }
  return <section aria-label={translatePermitText('citizenship.permitTitle')}>
    <h3>{translatePermitText('citizenship.permitTitle')}</h3>
    {currentPermitSummary === undefined ? <p>{translatePermitText('citizenship.permitUnavailable')}</p> : <>
      {!currentPermitSummary.records.length && <p>{translatePermitText('citizenship.permitEmpty')}</p>}
      {!!currentPermitSummary.records.length && <p>{translatePermitText('citizenship.checked')}</p>}
      <ul class="bag-items">{currentPermitSummary.records.map(currentPermitRecord => <li key={currentPermitRecord.instanceId}>
        <div><strong>{currentPermitRecord.nameTranslations[currentDisplayLocale]} · {currentPermitRecord.cityName}</strong>
          <span>{translatePermitText(TRAVELER_PERMIT_STATUS_KEYS[currentPermitRecord.status])}</span></div>
        <p>{translatePermitText('citizenship.permitOwner')}: {currentCharacterName}</p>
        <p>{translatePermitText('citizenship.permitIssuer')}: {currentPermitRecord.cityName} · {translatePermitText('citizenship.permitIssuer')}</p>
        <p>{translatePermitText('citizenship.permitIssued')}: {formatPermitTimestamp(currentPermitRecord.issuedAt)}</p>
        <p>{translatePermitText('citizenship.expires')}: {formatPermitTimestamp(currentPermitRecord.expiresAt)}</p>
      </li>)}</ul>
    </>}
  </section>;
}
