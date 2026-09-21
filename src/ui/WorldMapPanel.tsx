import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {useTranslation} from '../i18n';
import {MapKindIcon} from './MapKindIcon';
import {noticeText,type Notice} from '../client/notice';
import {parseWorldMapCatalog,type WorldMapNode} from '../client/worldMap';

const WORLD_MAP_CELL_WIDTH=180;
const WORLD_MAP_CELL_HEIGHT=110;
const WORLD_MAP_NODE_WIDTH=150;
const WORLD_MAP_NODE_HEIGHT=78;
export function WorldMapPanel({gameSessionClient,currentMapIdentifier}:{gameSessionClient:Client;currentMapIdentifier:string}) {
  const {t:translateWorldText,locale:currentWorldLocale}=useTranslation();
  const worldScrollContainer=useRef<HTMLDivElement>(null);
  const [worldMapNodes,setWorldMapNodes]=useState<WorldMapNode[]>([]);
  const [selectedMapIdentifier,setSelectedMapIdentifier]=useState(currentMapIdentifier);
  const [worldRequestNotice,setWorldRequestNotice]=useState<Notice>('');
  const [worldRequestAttempt,setWorldRequestAttempt]=useState(0);
  useEffect(()=>{
    let worldRequestActive=true;
    setWorldRequestNotice('');setWorldMapNodes([]);
    void gameSessionClient.request('/v1/maps/world').then(receivedWorldCatalog=>{
      const parsedWorldNodes=parseWorldMapCatalog(receivedWorldCatalog);
      if(worldRequestActive)setWorldMapNodes(parsedWorldNodes);
    }).catch(currentRequestError=>{if(worldRequestActive)setWorldRequestNotice(currentRequestError as Error);});
    return ()=>{worldRequestActive=false;};
  },[gameSessionClient,worldRequestAttempt]);
  const minimumMapColumn=Math.min(...worldMapNodes.map(currentWorldNode=>currentWorldNode.column));
  const minimumMapRow=Math.min(...worldMapNodes.map(currentWorldNode=>currentWorldNode.row));
  const worldCanvasWidth=(Math.max(...worldMapNodes.map(currentWorldNode=>currentWorldNode.column))-minimumMapColumn+1)*WORLD_MAP_CELL_WIDTH;
  const worldCanvasHeight=(Math.max(...worldMapNodes.map(currentWorldNode=>currentWorldNode.row))-minimumMapRow+1)*WORLD_MAP_CELL_HEIGHT;
  const selectedWorldNode=worldMapNodes.find(currentWorldNode=>currentWorldNode.id===selectedMapIdentifier);
  const worldNodeCenter=(currentWorldNode:WorldMapNode)=>({x:(currentWorldNode.column-minimumMapColumn+0.5)*WORLD_MAP_CELL_WIDTH,y:(currentWorldNode.row-minimumMapRow+0.5)*WORLD_MAP_CELL_HEIGHT});
  const focusWorldMapRegion=(targetMapIdentifier:string)=>{
    const targetWorldNode=worldMapNodes.find(currentWorldNode=>currentWorldNode.id===targetMapIdentifier);
    const currentScrollContainer=worldScrollContainer.current;
    if(!targetWorldNode||!currentScrollContainer)return;
    const targetNodeCenter=worldNodeCenter(targetWorldNode);
    currentScrollContainer.scrollTo({left:Math.max(0,targetNodeCenter.x-currentScrollContainer.clientWidth/2),
      top:Math.max(0,targetNodeCenter.y-currentScrollContainer.clientHeight/2),behavior:'auto'});
  };
  useEffect(()=>setSelectedMapIdentifier(currentMapIdentifier),[currentMapIdentifier]);
  useEffect(()=>focusWorldMapRegion(selectedMapIdentifier),[worldMapNodes,selectedMapIdentifier]);
  const selectWorldMapRegion=(targetMapIdentifier:string)=>{
    setSelectedMapIdentifier(targetMapIdentifier);
    // 같은 지역이 선택돼 있어도 수동 스크롤 후 다시 찾아갈 수 있다.
    focusWorldMapRegion(targetMapIdentifier);
  };
  return <section class="world-map-panel">
    <p>{translateWorldText('app.worldMapHelp')}</p>
    <div class="world-map-legend"><span><MapKindIcon targetMapSafeTown={true}/>{translateWorldText('app.mapTown')}</span><span><MapKindIcon targetMapSafeTown={false}/>{translateWorldText('app.mapField')}</span></div>
    {worldRequestNotice ? <div role="alert"><p>{noticeText(worldRequestNotice,currentWorldLocale,translateWorldText)}</p><button onClick={()=>setWorldRequestAttempt(worldRequestAttempt+1)}>{translateWorldText('app.worldMapRetry')}</button></div> : !worldMapNodes.length ? <p role="status">{translateWorldText('app.worldMapLoading')}</p> : <>
      <button class="secondary" onClick={()=>selectWorldMapRegion(currentMapIdentifier)}>{translateWorldText('app.worldMapCurrent')}</button>
      <div ref={worldScrollContainer} class="world-map-scroll" tabIndex={0} aria-label={translateWorldText('app.worldMap')}>
        <div class="world-map-canvas" style={{width:worldCanvasWidth,height:worldCanvasHeight}}>
          <svg width={worldCanvasWidth} height={worldCanvasHeight} aria-hidden="true">{worldMapNodes.flatMap(currentWorldNode=>currentWorldNode.connections.filter(currentMapLink=>currentWorldNode.id<currentMapLink.target).map(currentMapLink=>{
            const sourceNodeCenter=worldNodeCenter(currentWorldNode),targetNodeCenter=worldNodeCenter(worldMapNodes.find(targetWorldNode=>targetWorldNode.id===currentMapLink.target)!);
            return <line x1={sourceNodeCenter.x} y1={sourceNodeCenter.y} x2={targetNodeCenter.x} y2={targetNodeCenter.y}/>;
          }))}</svg>
          {worldMapNodes.map(currentWorldNode=>{const currentNodeCenter=worldNodeCenter(currentWorldNode);return <button key={currentWorldNode.id} class={`world-map-node ${currentWorldNode.id===currentMapIdentifier?'is-current':''}`} aria-pressed={currentWorldNode.id===selectedMapIdentifier} onClick={()=>selectWorldMapRegion(currentWorldNode.id)} style={{left:currentNodeCenter.x-WORLD_MAP_NODE_WIDTH/2,top:currentNodeCenter.y-WORLD_MAP_NODE_HEIGHT/2,width:WORLD_MAP_NODE_WIDTH,height:WORLD_MAP_NODE_HEIGHT}}>
            <span><MapKindIcon targetMapSafeTown={currentWorldNode.safeTown}/>{currentWorldNode.nameTranslations[currentWorldLocale]}</span>
            {currentWorldNode.id===currentMapIdentifier && <small>{translateWorldText('app.worldMapCurrent')}</small>}
          </button>;})}
        </div>
      </div>
      {selectedWorldNode && <div aria-live="polite"><h3>{selectedWorldNode.nameTranslations[currentWorldLocale]}</h3><p>{translateWorldText('app.worldMapConnections')}</p><div class="world-map-connections">{selectedWorldNode.connections.map(currentMapLink=>{const targetWorldNode=worldMapNodes.find(currentWorldNode=>currentWorldNode.id===currentMapLink.target)!;return <button class="secondary" key={currentMapLink.target} onClick={()=>selectWorldMapRegion(currentMapLink.target)}><MapKindIcon targetMapSafeTown={targetWorldNode.safeTown}/>{targetWorldNode.nameTranslations[currentWorldLocale]}</button>;})}</div></div>}
    </>}
  </section>;
}
