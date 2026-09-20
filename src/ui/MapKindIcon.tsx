import {useTranslation} from '../i18n';

export function MapKindIcon({targetMapSafeTown}:{targetMapSafeTown?:boolean}) {
  const {t:translateMapLabel}=useTranslation();
  return <svg class="map-kind-icon" viewBox="0 0 24 24" role="img" aria-label={translateMapLabel(targetMapSafeTown === undefined ? 'app.mapUnknownKind' : targetMapSafeTown ? 'app.mapTown' : 'app.mapField')}>
    {targetMapSafeTown === undefined ? <path d="M4 12h16m-6-6 6 6-6 6"/> : targetMapSafeTown ? <path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/> : <path d="m2 20 7-14 5 9 3-6 5 11ZM7 10l2 2 2-2"/>}
  </svg>;
}
