import {useEffect,useState} from 'preact/hooks';
import {useTranslation} from '../i18n';
import {initializeBattleActionSettings,readBattleActionSettings,saveBattleActionSettings,subscribeBattleActionSettings,skipPendingBattleActions} from '../game/battle/actionSettings';
export function useBattleActionSettings(){
  const [currentActionSettings,setCurrentActionSettings]=useState(readBattleActionSettings);
  useEffect(()=>{const currentSettingsCleanup=subscribeBattleActionSettings(()=>setCurrentActionSettings(readBattleActionSettings()));initializeBattleActionSettings();setCurrentActionSettings(readBattleActionSettings());return currentSettingsCleanup;},[]);
  return currentActionSettings;
}
export function BattleActionSettings(){
  const {t:translateActionSetting}=useTranslation();const currentActionSettings=useBattleActionSettings();
  return <section><label class="render-performance-setting"><input type="checkbox" checked={currentActionSettings.enabled} onChange={currentInputEvent=>saveBattleActionSettings(currentInputEvent.currentTarget.checked)}/>{translateActionSetting('app.battleActionPresentation')}</label><p>{translateActionSetting('app.battleActionStorage')}</p>{currentActionSettings.storageFailed&&<p role="alert">{translateActionSetting('app.battleActionStorageError')}</p>}</section>;
}
export function BattleActionPlaybackControls(){
  const {t:translateActionSetting}=useTranslation();const currentActionSettings=useBattleActionSettings();
  return <div class="field-support-actions"><BattleActionSettings/>{currentActionSettings.busy&&<button class="secondary" onClick={skipPendingBattleActions}>{translateActionSetting('app.battleActionSkip')}</button>}</div>;
}
