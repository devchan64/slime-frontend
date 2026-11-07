import {readMapViewportStatus,subscribeMapViewportStatus} from '../game/mapViewportRendering';
import {useEffect,useState} from 'preact/hooks';
import {useTranslation} from '../i18n';
import {initializePerformanceSettings,readPerformanceEnabled,readPerformanceReport,savePerformanceSettings,subscribePerformanceSettings,subscribePerformanceReports} from '../game/renderPerformance';
export function useRenderPerformanceSettings(){
 const [currentDisplayEnabled,setCurrentDisplayEnabled]=useState(readPerformanceEnabled);
 const [currentStorageFailed,setCurrentStorageFailed]=useState(false);
 useEffect(()=>{const currentUnsubscribeSettings=subscribePerformanceSettings(()=>setCurrentDisplayEnabled(readPerformanceEnabled()));try{initializePerformanceSettings();}catch{setCurrentStorageFailed(true);}return currentUnsubscribeSettings;},[]);
 function changePerformanceSettings(currentNextEnabled:boolean){try{savePerformanceSettings(currentNextEnabled);setCurrentStorageFailed(false);}catch{setCurrentStorageFailed(true);}}
 return {currentDisplayEnabled,currentStorageFailed,changePerformanceSettings};
}
export function RenderPerformanceSettings(currentSettingsProps:ReturnType<typeof useRenderPerformanceSettings>){
 const {t:translatePerformanceText}=useTranslation();
 return <section><label class="render-performance-setting"><input type="checkbox" checked={currentSettingsProps.currentDisplayEnabled} onChange={currentInputEvent=>currentSettingsProps.changePerformanceSettings(currentInputEvent.currentTarget.checked)}/>{translatePerformanceText('app.renderPerformanceTitle')}</label><p>{translatePerformanceText('app.renderPerformanceStorage')}</p>{currentSettingsProps.currentStorageFailed&&<p role="alert">{translatePerformanceText('app.renderPerformanceStorageError')}</p>}</section>;
}
export function RenderPerformanceOverlay({currentLoadingActive,currentMovementRequested}:{currentLoadingActive:boolean;currentMovementRequested:boolean}){
 const {t:translatePerformanceText}=useTranslation();
 const [currentViewportStatus,setCurrentViewportStatus]=useState(readMapViewportStatus);
 const [currentDocumentHidden,setCurrentDocumentHidden]=useState(document.hidden);
 useEffect(()=>subscribeMapViewportStatus(()=>setCurrentViewportStatus(readMapViewportStatus())),[]);
 useEffect(()=>{const updateDocumentVisibility=()=>setCurrentDocumentHidden(document.hidden);document.addEventListener('visibilitychange',updateDocumentVisibility);return()=>document.removeEventListener('visibilitychange',updateDocumentVisibility);},[]);
 const [currentReportValue,setCurrentReportValue]=useState(readPerformanceReport);
 useEffect(()=>subscribePerformanceReports(()=>setCurrentReportValue(readPerformanceReport())),[]);
 const formatPerformanceValue=(currentMetricValue:number|null|undefined)=>currentMetricValue==null?'—':currentMetricValue.toFixed(1);
 return <aside class="render-performance-panel" aria-label={translatePerformanceText('app.renderPerformanceTitle')}>
  <strong>{translatePerformanceText('app.renderPerformanceTitle')}</strong>
  {currentDocumentHidden?<p>{translatePerformanceText('app.renderPerformanceTabHidden')}</p>:currentViewportStatus==='suspended'?<p>{translatePerformanceText('app.mapRenderingSuspended')}</p>:!currentReportValue?<p>{translatePerformanceText('app.renderPerformanceCollecting')}</p>:<>
   <p>FPS {formatPerformanceValue(currentReportValue.fps)} · {translatePerformanceText('app.renderPerformanceFrames',{count:currentReportValue.samples,seconds:formatPerformanceValue(currentReportValue.seconds)})}</p>
   <p>{translatePerformanceText('app.renderPerformanceIntervals')} {formatPerformanceValue(currentReportValue.average)} / {formatPerformanceValue(currentReportValue.p95)} / {formatPerformanceValue(currentReportValue.maximum)} ms</p>
   <details><summary>{translatePerformanceText('app.renderPerformanceDetails')}</summary>
    <p>{translatePerformanceText('app.renderPerformanceCpu')} {formatPerformanceValue(currentReportValue.cpuAverage)} / {formatPerformanceValue(currentReportValue.cpuP95)} ms</p>
    <p>{translatePerformanceText('app.renderPerformanceLongFrames',{count:currentReportValue.longFrames})}</p>
    <p>{translatePerformanceText('app.renderPerformanceObjects',{total:currentReportValue.scene.objects??'—',visible:currentReportValue.scene.visible??'—'})}</p>
    <p>{translatePerformanceText('app.renderPerformancePhase')}: {translatePerformanceText(currentLoadingActive?'app.loading':currentMovementRequested?'app.renderPerformanceRequested':currentReportValue.scene.moving?'app.renderPerformanceMoving':'app.renderPerformanceIdle')}</p>
    <p>{translatePerformanceText('app.renderPerformanceAnimation',{fps:currentReportValue.scene.animationFps??'—',changes:currentReportValue.changes,elapsed:formatPerformanceValue(currentReportValue.lastChangeMs)})}</p>
    <p class="render-performance-frame">{currentReportValue.scene.frame??translatePerformanceText('app.renderPerformanceActorMissing')}</p>
    <p>{currentReportValue.scene.mapId} · {currentReportValue.scene.renderer} · {currentReportValue.scene.width}×{currentReportValue.scene.height} · DPR {currentReportValue.scene.dpr} · Zoom {formatPerformanceValue(currentReportValue.scene.zoom)}</p>
    <p>{translatePerformanceText('app.renderPerformanceUpdated')}: {new Date(currentReportValue.updatedAt).toLocaleTimeString()}</p>
    <p>{translatePerformanceText('app.renderPerformanceLimit')}</p>
   </details>
  </>}
 </aside>;
}
