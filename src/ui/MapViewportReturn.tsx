import {useEffect,useRef,useState} from 'preact/hooks';
import type {RefObject} from 'preact';
import {readMapViewportStatus,subscribeMapViewportStatus} from '../game/mapViewportRendering';
import {useTranslation} from '../i18n';

export function MapViewportReturn({currentMapReference}:{currentMapReference:RefObject<HTMLDivElement>}){
  const {t:translateMapMessage}=useTranslation();
  const [currentViewportStatus,setCurrentViewportStatus]=useState(readMapViewportStatus);
  useEffect(()=>subscribeMapViewportStatus(()=>setCurrentViewportStatus(readMapViewportStatus())),[]);
  const pendingMapFocus=useRef(false);
  useEffect(()=>{if(currentViewportStatus==='active'&&pendingMapFocus.current){pendingMapFocus.current=false;currentMapReference.current?.focus({preventScroll:true});}},[currentViewportStatus]);
  const mapOutsideViewport=currentViewportStatus==='suspended';
  return mapOutsideViewport?<aside class="map-viewport-notice" aria-label={translateMapMessage('app.mapRenderingSuspended')}><p role="status">{translateMapMessage('app.mapRenderingSuspended')}</p><button class="map-viewport-return secondary" onClick={()=>{
    pendingMapFocus.current=true;
    currentMapReference.current?.scrollIntoView({block:'center',behavior:'instant'});
  }}>{translateMapMessage('app.returnToMap')}</button></aside>:null;
}
