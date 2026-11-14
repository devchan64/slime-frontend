const BATTLE_PRESENTATION_STORAGE_KEY='slime.battle-action-presentation.v1';
const battleSettingsListeners=new Set<()=>void>();
let currentPresentationEnabled=true;
let currentPresentationBusy=false;
let currentStorageFailure=false;
let currentSettingsInitialized=false;
export function readBattleActionSettings(){return {enabled:currentPresentationEnabled,busy:currentPresentationBusy,storageFailed:currentStorageFailure};}
export function subscribeBattleActionSettings(currentChangeListener:()=>void){battleSettingsListeners.add(currentChangeListener);return ()=>{battleSettingsListeners.delete(currentChangeListener);};}
function publishBattleActionSettings(){battleSettingsListeners.forEach(currentChangeListener=>currentChangeListener());}
export function initializeBattleActionSettings(){
  if(currentSettingsInitialized)return;currentSettingsInitialized=true;
  try{const currentStoredValue=localStorage.getItem(BATTLE_PRESENTATION_STORAGE_KEY);if(currentStoredValue!==null&&!['on','off'].includes(currentStoredValue))throw Error('잘못된 전투 연출 설정');currentPresentationEnabled=currentStoredValue!=='off';}catch{currentStorageFailure=true;}
  publishBattleActionSettings();
}
export function saveBattleActionSettings(currentNextEnabled:boolean){
  currentPresentationEnabled=currentNextEnabled;
  try{localStorage.setItem(BATTLE_PRESENTATION_STORAGE_KEY,currentNextEnabled?'on':'off');currentStorageFailure=false;}catch{currentStorageFailure=true;}
  publishBattleActionSettings();
}
export function publishBattleActionBusy(currentNextBusy:boolean){if(currentPresentationBusy===currentNextBusy)return;currentPresentationBusy=currentNextBusy;publishBattleActionSettings();}
const battleSkipListeners=new Set<()=>void>();
export function subscribeBattleActionSkip(currentSkipListener:()=>void){battleSkipListeners.add(currentSkipListener);return ()=>{battleSkipListeners.delete(currentSkipListener);};}
export function skipPendingBattleActions(){battleSkipListeners.forEach(currentSkipListener=>currentSkipListener());}
