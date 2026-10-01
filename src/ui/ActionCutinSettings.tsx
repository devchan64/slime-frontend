import {useTranslation} from '../i18n';
import {ACTION_CUTIN_DEFAULT_SECONDS, ACTION_CUTIN_DURATION_OPTIONS, parseActionCutinDuration,
  type ActionCutinDuration, type ActionCutinSettingState} from './actionCutins';

type CutinSettingsProperties = {
  currentSettingState: ActionCutinSettingState;
  updateSettingDuration: (nextDurationSeconds: ActionCutinDuration) => void;
};
export function ActionCutinSettingNotice({currentSettingState, updateSettingDuration}: CutinSettingsProperties) {
  const {t} = useTranslation();
  if (!currentSettingState.errorKind) return null;
  return <section class="notice" role="alert">
    <p>{t(currentSettingState.errorKind === 'read' ? 'cutins.settingReadFailed' : 'cutins.settingWriteFailed')}</p>
    <button class="secondary" onClick={() => updateSettingDuration(ACTION_CUTIN_DEFAULT_SECONDS)}>{t('cutins.restoreDefault')}</button>
  </section>;
}
export function ActionCutinSettingsControl({currentSettingState, updateSettingDuration}: CutinSettingsProperties) {
  const {t} = useTranslation();
  return <><label class="action-cutin-setting">{t('cutins.show')}
    <select value={currentSettingState.durationSeconds ?? ''}
      onChange={currentSelectEvent => updateSettingDuration(parseActionCutinDuration(currentSelectEvent.currentTarget.value))}>
      {currentSettingState.durationSeconds === null && <option value="" disabled>{t('cutins.settingUnavailable')}</option>}
      {ACTION_CUTIN_DURATION_OPTIONS.map(currentDurationSeconds => <option key={currentDurationSeconds} value={currentDurationSeconds}>
        {currentDurationSeconds === 0 ? t('cutins.off') : t('cutins.seconds', {seconds: currentDurationSeconds})}
      </option>)}
    </select>
  </label><p>{t('cutins.help')}</p></>;
}
