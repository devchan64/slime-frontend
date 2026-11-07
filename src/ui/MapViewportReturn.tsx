import {useEffect,useState} from 'preact/hooks';
import type {RefObject} from 'preact';
import {useTranslation} from '../i18n';

export function MapViewportReturn({currentMapReference}:{currentMapReference:RefObject<HTMLDivElement>}){
  const {t:translateMapMessage}=useTranslation();
  const [mapOutsideViewport,setMapOutsideViewport]=useState(false);
  useEffect(()=>{
    const currentMapElement=currentMapReference.current;
    if(!currentMapElement)return;
    const currentVisibilityObserver=new IntersectionObserver(currentViewportEntries=>{
      const currentMapEntry=currentViewportEntries.find(currentViewportEntry=>currentViewportEntry.target===currentMapElement);
      if(currentMapEntry)setMapOutsideViewport(!currentMapEntry.isIntersecting||currentMapEntry.intersectionRatio<1);
    },{threshold:1});
    currentVisibilityObserver.observe(currentMapElement);
    return ()=>currentVisibilityObserver.disconnect();
  },[currentMapReference]);
  return mapOutsideViewport?<button class="map-viewport-return secondary" onClick={()=>{
    currentMapReference.current?.scrollIntoView({block:'center',behavior:'instant'});
    currentMapReference.current?.focus({preventScroll:true});
  }}>{translateMapMessage('app.returnToMap')}</button>:null;
}
