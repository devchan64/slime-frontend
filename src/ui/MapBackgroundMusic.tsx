import {useEffect, useRef, useState} from 'preact/hooks';
import {useTranslation} from '../i18n';
import registeredMapMusic from '../../../slime-assets/assets/audio/map-bgm.yaml';

const MUSIC_PREFERENCE_STORAGE = 'slime.map-music.v1';
const DEFAULT_MUSIC_PREFERENCE = {volume: 50, variant: 'instrumental' as const};
type MapMusicPreference = {volume: number; variant: 'vocal' | 'instrumental'};
function readMapMusicPreference(): MapMusicPreference {
  const currentStoredValue = localStorage.getItem(MUSIC_PREFERENCE_STORAGE);
  if (currentStoredValue === null) return DEFAULT_MUSIC_PREFERENCE;
  const currentStoredRecord = JSON.parse(currentStoredValue);
  if (!currentStoredRecord || Object.keys(currentStoredRecord).sort().join() !== 'variant,volume' || !Number.isInteger(currentStoredRecord.volume) || currentStoredRecord.volume < 0 || currentStoredRecord.volume > 100 || !['vocal','instrumental'].includes(currentStoredRecord.variant)) throw Error('배경음악 설정 형식 오류');
  return currentStoredRecord;
}
export function useMapBackgroundMusic(currentMapIdentifier: string | null) {
  const [currentMusicPreference, setCurrentMusicPreference] = useState<MapMusicPreference | null>(() => {
    try { return readMapMusicPreference(); } catch { return null; }
  });
  const [currentPlaybackStatus, setCurrentPlaybackStatus] = useState('idle');
  const [currentStorageFailure, setCurrentStorageFailure] = useState(false);
  const currentAudioReference = useRef<HTMLAudioElement | null>(null);
  const currentSourceReference = useRef('');
  const currentPlayPending = useRef(false);
  const currentTrackUrl = currentMapIdentifier && currentMusicPreference ? registeredMapMusic[currentMapIdentifier]?.[currentMusicPreference.variant] ?? '' : '';
  const resumeMusicPlayback = () => {
    const currentAudioElement = currentAudioReference.current;
    if (!currentAudioElement || !currentSourceReference.current || !currentAudioElement.paused || currentPlayPending.current || currentAudioElement.volume === 0 || document.hidden || currentAudioElement.error) return;
    const requestedSourceUrl = currentSourceReference.current;
    currentPlayPending.current = true;
    void currentAudioElement.play().then(() => {
      if (currentAudioReference.current === currentAudioElement && requestedSourceUrl === currentSourceReference.current) setCurrentPlaybackStatus('playing');
    }).catch((currentPlaybackError: DOMException) => {
      if (currentAudioReference.current === currentAudioElement && requestedSourceUrl === currentSourceReference.current) setCurrentPlaybackStatus(currentPlaybackError.name === 'NotAllowedError' ? 'blocked' : currentPlaybackError.name === 'AbortError' ? 'idle' : 'error');
    }).finally(() => {
      if (requestedSourceUrl === currentSourceReference.current) currentPlayPending.current = false;
    });
  };
  useEffect(() => {
    const currentAudioElement = new Audio();
    currentAudioElement.loop = true;
    currentAudioElement.preload = 'none';
    currentAudioElement.onerror = () => setCurrentPlaybackStatus('error');
    currentAudioReference.current = currentAudioElement;
    const synchronizePageVisibility = () => { if (document.hidden) currentAudioElement.pause(); else resumeMusicPlayback(); };
    document.addEventListener('pointerdown', resumeMusicPlayback);
    document.addEventListener('keydown', resumeMusicPlayback);
    document.addEventListener('visibilitychange', synchronizePageVisibility);
    return () => {
      document.removeEventListener('pointerdown', resumeMusicPlayback);
      document.removeEventListener('keydown', resumeMusicPlayback);
      document.removeEventListener('visibilitychange', synchronizePageVisibility);
      currentAudioElement.onerror = null;
      currentAudioElement.pause();
      currentAudioElement.removeAttribute('src');
      currentAudioElement.load();
      currentAudioReference.current = null;
      currentSourceReference.current = '';
    };
  }, []);
  useEffect(() => {
    const currentAudioElement = currentAudioReference.current;
    if (!currentAudioElement) return;
    currentAudioElement.volume = (currentMusicPreference?.volume ?? 0) / 100;
    if (currentSourceReference.current !== currentTrackUrl) {
      currentAudioElement.pause();
      currentPlayPending.current = false;
      currentSourceReference.current = currentTrackUrl;
      if (currentTrackUrl) currentAudioElement.src = currentTrackUrl;
      else currentAudioElement.removeAttribute('src');
      currentAudioElement.load();
      setCurrentPlaybackStatus('idle');
    }
    if (currentAudioElement.volume === 0) currentAudioElement.pause();
    else resumeMusicPlayback();
  }, [currentTrackUrl, currentMusicPreference?.volume]);
  const updateMusicPreference = (nextMusicPreference: MapMusicPreference) => {
    setCurrentMusicPreference(nextMusicPreference);
    try { localStorage.setItem(MUSIC_PREFERENCE_STORAGE, JSON.stringify(nextMusicPreference)); setCurrentStorageFailure(false); }
    catch { setCurrentStorageFailure(true); }
  };
  return {currentMusicPreference, currentPlaybackStatus, currentStorageFailure, currentTrackUrl, updateMusicPreference, resumeMusicPlayback};
}
export function MapMusicSettingsControl({currentMusicController}: {currentMusicController: ReturnType<typeof useMapBackgroundMusic>}) {
  const {t: translateMusicLabel} = useTranslation();
  const {currentMusicPreference, currentPlaybackStatus, currentStorageFailure, currentTrackUrl, updateMusicPreference, resumeMusicPlayback} = currentMusicController;
  return <section><h2>{translateMusicLabel('music.title')}</h2>
    {!currentMusicPreference ? <><p role="alert">{translateMusicLabel('music.invalid')}</p><button onClick={() => updateMusicPreference(DEFAULT_MUSIC_PREFERENCE)}>{translateMusicLabel('music.reset')}</button></> : <>
      <label>{translateMusicLabel('music.variant')}<select value={currentMusicPreference.variant} onChange={currentSelectEvent => updateMusicPreference({...currentMusicPreference, variant: currentSelectEvent.currentTarget.value as MapMusicPreference['variant']})}>
        <option value="instrumental">{translateMusicLabel('music.instrumental')}</option><option value="vocal">{translateMusicLabel('music.vocal')}</option>
      </select></label>
      <label>{translateMusicLabel('music.volume', {volume: currentMusicPreference.volume})}<input type="range" min="0" max="100" step="1" value={currentMusicPreference.volume} onInput={currentVolumeEvent => updateMusicPreference({...currentMusicPreference, volume: Number(currentVolumeEvent.currentTarget.value)})}/></label>
      <p>{translateMusicLabel('music.help')}</p>
      {!currentTrackUrl && <p>{translateMusicLabel('music.unassigned')}</p>}
      {currentPlaybackStatus === 'blocked' && <button onClick={resumeMusicPlayback}>{translateMusicLabel('music.play')}</button>}
      {currentPlaybackStatus === 'error' && <p role="alert">{translateMusicLabel('music.error')}</p>}
    </>}
    {currentStorageFailure && <p role="alert">{translateMusicLabel('music.storage')}</p>}
  </section>;
}
