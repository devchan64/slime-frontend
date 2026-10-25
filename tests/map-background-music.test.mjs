import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const currentHookRuntime = {slots: [], cursor: 0, effects: [], listeners: new Map()};
globalThis.currentHookRuntime = currentHookRuntime;
const currentBuildResult = await build({entryPoints:['src/ui/MapBackgroundMusic.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'music-browser-contract',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/^(preact\/hooks|\.\.\/i18n|.*map-bgm.yaml)$/}, currentModuleRecord=>({path:currentModuleRecord.path,namespace:'music-test'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'music-test'}, currentModuleRecord=>({contents:currentModuleRecord.path==='preact/hooks'?`
    const runtime=globalThis.currentHookRuntime;
    export function useRef(value){const index=runtime.cursor++;return runtime.slots[index]??=( {current:value} );}
    export function useState(value){const index=runtime.cursor++;if(!(index in runtime.slots))runtime.slots[index]=typeof value==='function'?value():value;return [runtime.slots[index],value=>{runtime.slots[index]=value;}];}
    export function useEffect(callback,deps){const index=runtime.cursor++;const previous=runtime.slots[index];if(!previous||deps.some((value,offset)=>value!==previous[offset])){runtime.slots[index]=deps;runtime.effects.push(callback);}}
  `:currentModuleRecord.path==='../i18n'?'export const useTranslation=()=>({t:key=>key});':'export default {"wind-hills":{instrumental:"/mr.mp3",vocal:"/vocal.mp3"},meadow:{instrumental:"/meadow.mp3"}};',loader:'js'}));
}}]});
const {useMapBackgroundMusic} = await import('data:text/javascript;base64,'+Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64'));
test('맵·버전 변경, 음량, 무음 맵, 자동재생 제한 및 정리를 검증한다', async()=>{
  let currentAudioElement, currentSavedPreference;
  globalThis.localStorage={getItem:()=>null,setItem:(_currentStorageKey,currentStorageValue)=>{currentSavedPreference=currentStorageValue;}};
  globalThis.document={hidden:false,addEventListener:(currentEventName,currentEventHandler)=>currentHookRuntime.listeners.set(currentEventName,currentEventHandler),removeEventListener:currentEventName=>currentHookRuntime.listeners.delete(currentEventName)};
  globalThis.Audio=class {paused=true;volume=1;currentTime=0;error=null;src='';playCount=0;blockPlayback=true;
    constructor(){currentAudioElement=this;}
    play(){this.playCount++;if(this.blockPlayback)return Promise.reject(new DOMException('blocked','NotAllowedError'));this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
    load(){this.currentTime=0;}
    removeAttribute(){this.src='';}
  };
  const currentCleanupCallbacks=[];
  const renderCurrentMusic=async(currentMapIdentifier)=>{currentHookRuntime.cursor=0;const currentController=useMapBackgroundMusic(currentMapIdentifier);for(const currentEffectCallback of currentHookRuntime.effects.splice(0)){const currentCleanupCallback=currentEffectCallback();if(currentCleanupCallback)currentCleanupCallbacks.push(currentCleanupCallback);}await new Promise(currentResolveCallback=>setImmediate(currentResolveCallback));return currentController;};
  await renderCurrentMusic('wind-hills');
  let currentMusicController=await renderCurrentMusic('wind-hills');
  assert.equal(currentMusicController.currentPlaybackStatus,'blocked');
  currentAudioElement.blockPlayback=false;
  currentHookRuntime.listeners.get('pointerdown')();
  await new Promise(currentResolveCallback=>setImmediate(currentResolveCallback));
  assert.equal(currentAudioElement.paused,false);
  assert.equal(currentAudioElement.src,'/mr.mp3');
  currentAudioElement.currentTime=12;
  currentMusicController.updateMusicPreference({volume:25,variant:'instrumental'});
  currentMusicController=await renderCurrentMusic('wind-hills');
  assert.equal(currentAudioElement.volume,0.25);
  assert.equal(currentAudioElement.currentTime,12);
  currentMusicController.updateMusicPreference({volume:25,variant:'vocal'});
  currentMusicController=await renderCurrentMusic('wind-hills');
  assert.equal(currentAudioElement.src,'/vocal.mp3');
  assert.equal(currentAudioElement.currentTime,0);
  await renderCurrentMusic('meadow');
  assert.equal(currentAudioElement.src,'');
  assert.equal(currentAudioElement.paused,true);
  await renderCurrentMusic('unknown');
  assert.equal(currentAudioElement.src,'');
  currentMusicController.updateMusicPreference({volume:0,variant:'instrumental'});
  currentMusicController=await renderCurrentMusic('wind-hills');
  assert.equal(currentAudioElement.paused,true);
  currentMusicController.updateMusicPreference({volume:50,variant:'instrumental'});
  await renderCurrentMusic('wind-hills');
  document.hidden=true;currentHookRuntime.listeners.get('visibilitychange')();
  assert.equal(currentAudioElement.paused,true);
  document.hidden=false;currentHookRuntime.listeners.get('visibilitychange')();
  assert.equal(currentAudioElement.paused,false);
  assert.deepEqual(JSON.parse(currentSavedPreference),{volume:50,variant:'instrumental'});
  for(const currentCleanupCallback of currentCleanupCallbacks)currentCleanupCallback();
  assert.equal(currentAudioElement.src,'');
  assert.equal(currentAudioElement.paused,true);
  assert.equal(currentHookRuntime.listeners.size,0);
});
