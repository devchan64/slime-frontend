import type Phaser from 'phaser';
import type {MainScene} from './scenes/MainScene';
export const PERFORMANCE_WINDOW_MS = 5000;
export const PERFORMANCE_REFRESH_MS = 500;
const PERFORMANCE_SAMPLE_LIMIT = 2000;
const PERFORMANCE_LONG_FRAME_MS = 50;
const PERFORMANCE_STORAGE_KEY = 'slime.render-performance.v1';
type FrameObservation = {timestamp:number;interval:number;cpu:number;changed:boolean};
export type PerformanceReport = {fps:number;average:number;p95:number;maximum:number;cpuAverage:number;cpuP95:number;longFrames:number;samples:number;seconds:number;changes:number;lastChangeMs:number|null;scene:ReturnType<MainScene['readRenderPerformance']>;updatedAt:number};
let currentDisplayEnabled = false;
let currentReportValue:PerformanceReport|null = null;
const currentSettingListeners = new Set<()=>void>();
const currentReportListeners = new Set<()=>void>();
export function readPerformanceEnabled(){return currentDisplayEnabled;}
export function readPerformanceReport(){return currentReportValue;}
export function subscribePerformanceSettings(currentChangeCallback:()=>void){currentSettingListeners.add(currentChangeCallback);return ()=>{currentSettingListeners.delete(currentChangeCallback);};}
export function subscribePerformanceReports(currentChangeCallback:()=>void){currentReportListeners.add(currentChangeCallback);return ()=>{currentReportListeners.delete(currentChangeCallback);};}
function publishPerformanceReport(currentNextReport:PerformanceReport|null){currentReportValue=currentNextReport;currentReportListeners.forEach(currentChangeCallback=>currentChangeCallback());}
function applyPerformanceEnabled(currentNextEnabled:boolean){currentDisplayEnabled=currentNextEnabled;currentSettingListeners.forEach(currentChangeCallback=>currentChangeCallback());}
export function initializePerformanceSettings(){
 try{const currentStoredValue=localStorage.getItem(PERFORMANCE_STORAGE_KEY);if(currentStoredValue!==null&&!['true','false'].includes(currentStoredValue))throw Error('잘못된 성능 표시 설정');applyPerformanceEnabled(currentStoredValue==='true');}
 catch(currentStorageError){applyPerformanceEnabled(false);throw currentStorageError;}
}
export function savePerformanceSettings(currentNextEnabled:boolean){
 try{localStorage.setItem(PERFORMANCE_STORAGE_KEY,String(currentNextEnabled));applyPerformanceEnabled(currentNextEnabled);}
 catch(currentStorageError){applyPerformanceEnabled(false);throw currentStorageError;}
}
export function summarizePerformanceFrames(currentFrameSamples:FrameObservation[]){
 const currentIntervalValues=currentFrameSamples.map(currentFrameSample=>currentFrameSample.interval).sort((currentLeftValue,currentRightValue)=>currentLeftValue-currentRightValue);
 const currentCpuValues=currentFrameSamples.map(currentFrameSample=>currentFrameSample.cpu).sort((currentLeftValue,currentRightValue)=>currentLeftValue-currentRightValue);
 const currentTotalDuration=currentIntervalValues.reduce((currentTotalValue,currentIntervalValue)=>currentTotalValue+currentIntervalValue,0);
 const currentSampleCount=currentFrameSamples.length;
 if(!currentSampleCount||currentTotalDuration<=0)return null;
 return {fps:currentSampleCount*1000/currentTotalDuration,average:currentTotalDuration/currentSampleCount,p95:currentIntervalValues[Math.ceil(currentSampleCount*.95)-1],maximum:currentIntervalValues[currentSampleCount-1],cpuAverage:currentCpuValues.reduce((currentTotalValue,currentCpuValue)=>currentTotalValue+currentCpuValue,0)/currentSampleCount,cpuP95:currentCpuValues[Math.ceil(currentSampleCount*.95)-1],longFrames:currentIntervalValues.filter(currentIntervalValue=>currentIntervalValue>PERFORMANCE_LONG_FRAME_MS).length,samples:currentSampleCount,seconds:currentTotalDuration/1000,changes:currentFrameSamples.filter(currentFrameSample=>currentFrameSample.changed).length};
}
/** 기존 게임 루프에 연결하며 표시를 끄면 수집을 해제한다. */
export function attachRenderPerformance(currentGameInstance:Phaser.Game,currentMapScene:MainScene){
 let currentFrameSamples:FrameObservation[]=[];
 let currentFrameStart:number|null=null;
 let currentPreviousFinish:number|null=null;
 let currentPreviousFrame:string|null=null;
 let currentLastChange:number|null=null;
 let currentSceneIdentity='';
 let currentRefreshTimer:ReturnType<typeof setInterval>|null=null;
 function resetPerformanceSamples(){currentFrameSamples=[];currentFrameStart=null;currentPreviousFinish=null;currentPreviousFrame=null;currentLastChange=null;publishPerformanceReport(null);}
 function observePerformanceStart(){if(!document.hidden)currentFrameStart=performance.now();}
 function observePerformanceFinish(currentFrameRenderer:unknown){
  if(currentFrameRenderer===null){if(currentPreviousFinish!==null)resetPerformanceSamples();return;}
  if(document.hidden||currentFrameStart===null)return;
  const currentFinishTime=performance.now();
  const currentActorRecord=currentMapScene.readPerformanceActor();
  if(currentActorRecord.identity!==currentSceneIdentity){currentSceneIdentity=currentActorRecord.identity;resetPerformanceSamples();currentPreviousFinish=currentFinishTime;return;}
  const currentFrameChanged=currentPreviousFrame!==null&&currentActorRecord.frame!==null&&currentActorRecord.frame!==currentPreviousFrame;
  if(currentFrameChanged)currentLastChange=currentFinishTime;
  if(currentPreviousFinish!==null){currentFrameSamples.push({timestamp:currentFinishTime,interval:currentFinishTime-currentPreviousFinish,cpu:currentFinishTime-currentFrameStart,changed:currentFrameChanged});}
  currentPreviousFinish=currentFinishTime;currentPreviousFrame=currentActorRecord.frame;
  while(currentFrameSamples.length&&(currentFrameSamples[0].timestamp<currentFinishTime-PERFORMANCE_WINDOW_MS||currentFrameSamples.length>PERFORMANCE_SAMPLE_LIMIT))currentFrameSamples.shift();
 }
 function publishPerformanceSamples(){
  if(document.hidden)return;
  const currentTimestampValue=performance.now();
  currentFrameSamples=currentFrameSamples.filter(currentFrameSample=>currentFrameSample.timestamp>=currentTimestampValue-PERFORMANCE_WINDOW_MS);
  const currentSummaryValue=summarizePerformanceFrames(currentFrameSamples);
  publishPerformanceReport(currentSummaryValue?{...currentSummaryValue,lastChangeMs:currentLastChange===null?null:currentTimestampValue-currentLastChange,scene:currentMapScene.readRenderPerformance(),updatedAt:Date.now()}:null);
 }
 function stopPerformanceCollection(){
  currentGameInstance.events.off('prestep',observePerformanceStart);currentGameInstance.events.off('postrender',observePerformanceFinish);
  if(currentRefreshTimer!==null)clearInterval(currentRefreshTimer);currentRefreshTimer=null;
  document.removeEventListener('visibilitychange',restartPerformanceCollection);resetPerformanceSamples();
 }
 function restartPerformanceCollection(){
  stopPerformanceCollection();
  if(!currentDisplayEnabled)return;
  document.addEventListener('visibilitychange',restartPerformanceCollection);
  if(document.hidden)return;
  currentGameInstance.events.on('prestep',observePerformanceStart);currentGameInstance.events.on('postrender',observePerformanceFinish);
  currentRefreshTimer=setInterval(publishPerformanceSamples,PERFORMANCE_REFRESH_MS);
 }
 const currentUnsubscribeSettings=subscribePerformanceSettings(restartPerformanceCollection);
 restartPerformanceCollection();
 currentGameInstance.events.once('destroy',()=>{currentUnsubscribeSettings();stopPerformanceCollection();});
}
