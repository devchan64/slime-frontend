import {render} from 'preact';
import {useState} from 'preact/hooks';
import {ActionCutinSettingNotice, ActionCutinSettingsControl} from '../../src/ui/ActionCutinSettings';
import {loadActionCutinPreference, saveActionCutinPreference, ACTION_CUTIN_SETTING_KEY, type ActionCutinDuration} from '../../src/ui/actionCutins';
import {t,setLocale} from '../../src/i18n';
const currentAssertionsList:string[]=[];
const wait_for_render=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,120));
function assert_browser_condition(currentConditionValue:unknown,currentMessageText:string){if(!currentConditionValue)throw new Error(currentMessageText);currentAssertionsList.push(currentMessageText);}
function CutinSettingsHarness(){
 const [currentSettingState,setCurrentSettingState]=useState(()=>loadActionCutinPreference(()=>localStorage));
 const updateSettingDuration=(currentDurationValue:ActionCutinDuration)=>setCurrentSettingState(saveActionCutinPreference(()=>localStorage,currentSettingState,currentDurationValue));
 return <main class="card"><ActionCutinSettingNotice currentSettingState={currentSettingState} updateSettingDuration={updateSettingDuration}/><ActionCutinSettingsControl currentSettingState={currentSettingState} updateSettingDuration={updateSettingDuration}/></main>;
}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 localStorage.setItem(ACTION_CUTIN_SETTING_KEY,'broken');
 render(<CutinSettingsHarness/>,document.getElementById('root')!);await wait_for_render();
 assert_browser_condition(document.querySelector('[role="alert"]')?.textContent?.includes(t('cutins.settingReadFailed')),'손상 설정 오류 안내');
 assert_browser_condition(document.querySelector('select')!.value==='','미확인 설정 표시');
 assert_browser_condition(localStorage.getItem(ACTION_CUTIN_SETTING_KEY)==='broken','복구 전 손상값 보존');
 document.querySelector('button')!.click();await wait_for_render();
 assert_browser_condition(!document.querySelector('[role="alert"]'),'수동 복구 후 오류 해제');
 assert_browser_condition(document.querySelector('select')!.value==='3','복구 화면 3초');
 assert_browser_condition(localStorage.getItem(ACTION_CUTIN_SETTING_KEY)==='3','복구 저장값 3초');
 const original_storage_set=Storage.prototype.setItem;
 Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};
 const current_duration_select=document.querySelector('select')!;current_duration_select.value='0';current_duration_select.dispatchEvent(new Event('change',{bubbles:true}));await wait_for_render();
 assert_browser_condition(document.querySelector('[role="alert"]')?.textContent?.includes(t('cutins.settingWriteFailed')),'저장 실패 안내');
 assert_browser_condition(document.querySelector('select')!.value==='3','저장 실패 후 이전 화면값 유지');
 assert_browser_condition(localStorage.getItem(ACTION_CUTIN_SETTING_KEY)==='3','저장 실패 후 이전 저장값 유지');
 Storage.prototype.setItem=original_storage_set;
 document.querySelector('button')!.click();await wait_for_render();
 assert_browser_condition(!document.querySelector('[role="alert"]'),'재시도 복구 성공');
 render(null,document.getElementById('root')!);render(<CutinSettingsHarness/>,document.getElementById('root')!);await wait_for_render();
 assert_browser_condition(document.querySelector('select')!.value==='3','재마운트 저장값 일치');
 assert_browser_condition(document.documentElement.scrollWidth<=window.innerWidth,'모바일 가로 넘침 없음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentTestError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentTestError),assertions:currentAssertionsList});}})();
