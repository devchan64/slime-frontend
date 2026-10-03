import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import type {State} from '../client/types';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {CHANNEL_ADDRESS_MAX_LENGTH,normalizeChannelAddress,parseChannelListing,compareChannelAddresses,channelMovementRestriction,channelTargetRestriction,type ChannelListingEntry,type ChannelJoinTarget} from '../client/channels';
import {useTranslation} from '../i18n';
import './channelPanel.css';

const CHANNEL_LIST_PAGE_SIZE = 10;

export function ChannelPanel({gameSessionClient,currentGameState,actionsAreDisabled,onChannelTransferChange}:{gameSessionClient:Client;currentGameState:State;actionsAreDisabled:boolean;onChannelTransferChange:(currentTransferPending:boolean)=>void}) {
  const {t:translateChannelText,locale:currentDisplayLocale}=useTranslation();
  const [currentChannelEntries,setCurrentChannelEntries]=useState<ChannelListingEntry[]|null>(null);
  const [currentChannelPage,setCurrentChannelPage]=useState(0);
  const [currentAddressInput,setCurrentAddressInput]=useState('');
  const [currentChannelNotice,setCurrentChannelNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const [currentResultUncertain,setCurrentResultUncertain]=useState(false);
  const activePanelReference=useRef(false);
  const pendingRequestReference=useRef(false);
  const initialSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,character:currentGameState.me.id,
    generation:currentGameState.generation,epoch:currentGameState.epoch,location:currentGameState.location.id});
  function channelSessionMatches(){
    const currentClientState=gameSessionClient.state;
    return activePanelReference.current && gameSessionClient.tokens?.user_id===initialSessionReference.current.owner
      && currentClientState?.me.id===initialSessionReference.current.character && currentClientState.generation===initialSessionReference.current.generation
      && currentClientState.epoch===initialSessionReference.current.epoch && currentClientState.location.id===initialSessionReference.current.location;
  }
  async function refreshChannelListing(){
    if(pendingRequestReference.current || !channelSessionMatches())return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentChannelNotice('');
    try {
      if(currentResultUncertain || !gameSessionClient.state?.channel){
        const currentRecoveredState=await gameSessionClient.request('/v1/game/state');
        if(!channelSessionMatches())return;
        gameSessionClient.accept(currentRecoveredState);
        if(!channelSessionMatches())return;
      }
      const currentReceivedEntries=parseChannelListing(await gameSessionClient.request('/v1/channels'));
      if(!channelSessionMatches())return;
      const receivedMapChannelCount=currentReceivedEntries.filter(currentChannelEntry=>currentChannelEntry.mapDefinitionId===currentGameState.map.id).length;
      const receivedLastPageIndex=Math.max(0,Math.ceil(receivedMapChannelCount/CHANNEL_LIST_PAGE_SIZE)-1);
      setCurrentChannelEntries(currentReceivedEntries);
      setCurrentChannelPage(previousChannelPage=>Math.min(previousChannelPage,receivedLastPageIndex));
      setCurrentResultUncertain(false);
    }catch(currentRequestError){if(channelSessionMatches())setCurrentChannelNotice(currentRequestError as Error);}
    finally {pendingRequestReference.current=false;if(activePanelReference.current)setCurrentRequestPending(false);}
  }
  async function joinSelectedChannel(currentJoinTarget:ChannelJoinTarget){
    if(actionsAreDisabled || pendingRequestReference.current || currentResultUncertain || !channelSessionMatches())return;
    const currentClientState=gameSessionClient.state!;
    const currentSelectedEntry=currentChannelEntries?.find(currentChannelEntry=>'channelId' in currentJoinTarget
      ? currentChannelEntry.id===currentJoinTarget.channelId : currentChannelEntry.address===currentJoinTarget.address);
    const currentRestrictionKey=channelMovementRestriction(currentClientState) || (currentSelectedEntry && channelTargetRestriction(currentClientState,currentSelectedEntry));
    if(currentRestrictionKey){setCurrentChannelNotice({key:currentRestrictionKey});return;}
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentChannelNotice('');onChannelTransferChange(true);
    try {await gameSessionClient.command('/v1/channels/joins',currentJoinTarget);}
    catch(currentRequestError){
      if(channelSessionMatches()){
        setCurrentChannelNotice(currentRequestError as Error);
        setCurrentResultUncertain(!(currentRequestError instanceof ApiError) || currentRequestError.status>=500);
      }
    }finally {
      pendingRequestReference.current=false;onChannelTransferChange(false);
      if(activePanelReference.current)setCurrentRequestPending(false);
    }
  }
  useEffect(()=>{activePanelReference.current=true;void refreshChannelListing();return()=>{activePanelReference.current=false;};},[]);
  const currentMapChannels=(currentChannelEntries??[]).filter(currentChannelEntry=>currentChannelEntry.mapDefinitionId===currentGameState.map.id).sort(compareChannelAddresses);
  const currentChannelPageCount=Math.max(1,Math.ceil(currentMapChannels.length/CHANNEL_LIST_PAGE_SIZE));
  const displayedChannelPageIndex=Math.min(currentChannelPage,currentChannelPageCount-1);
  const currentMovementReason=channelMovementRestriction(currentGameState);
  let currentNormalizedAddress='';
  let currentAddressReason:string|null=null;
  if(currentAddressInput){
    try{currentNormalizedAddress=normalizeChannelAddress(currentAddressInput);}
    catch{currentAddressReason='channels.invalidAddress';}
  }
  const currentAddressEntry=currentChannelEntries?.find(currentChannelEntry=>currentChannelEntry.address===currentNormalizedAddress);
  currentAddressReason ||= currentAddressEntry ? channelTargetRestriction(currentGameState,currentAddressEntry) : null;
  const currentJoinDisabled=actionsAreDisabled || currentRequestPending || currentResultUncertain || !!currentMovementReason;
  return <section class="channel-panel" aria-label={translateChannelText('channels.title')}>
    <p>{currentGameState.channel ? translateChannelText('channels.current',{address:currentGameState.channel.address}) : translateChannelText('channels.stateRequired')}</p>
    <p>{translateChannelText('channels.help')}</p>
    <button class="secondary compact" disabled={currentRequestPending} onClick={()=>void refreshChannelListing()}>{translateChannelText(currentResultUncertain?'channels.checkState':'channels.refresh')}</button>
    {currentMovementReason && <p role="status">{translateChannelText(currentMovementReason)}</p>}
    {actionsAreDisabled && !currentRequestPending && <p role="status">{translateChannelText('channels.waitAction')}</p>}
    <form onSubmit={currentSubmitEvent=>{currentSubmitEvent.preventDefault();if(currentNormalizedAddress && !currentJoinDisabled && !currentAddressReason)void joinSelectedChannel({address:currentNormalizedAddress});}}>
      <label htmlFor="channel-address-input">{translateChannelText('channels.address')}</label>
      <div class="channel-address-controls"><input id="channel-address-input" type="text" value={currentAddressInput} maxLength={CHANNEL_ADDRESS_MAX_LENGTH} autoComplete="off" autoCapitalize="none" spellcheck={false}
        placeholder="aa22" aria-describedby="channel-address-help" disabled={currentRequestPending} onInput={currentInputEvent=>setCurrentAddressInput(currentInputEvent.currentTarget.value)}/>
        <button disabled={currentJoinDisabled || !currentNormalizedAddress || !!currentAddressReason}>{translateChannelText('channels.joinAddress')}</button></div>
      <small id="channel-address-help">{translateChannelText('channels.addressHelp')}</small>
      {currentAddressReason && <p role="status">{translateChannelText(currentAddressReason)}</p>}
    </form>
    <h3>{translateChannelText('channels.sameMap')}</h3>
    <p>{translateChannelText('channels.populationHelp')}</p>
    {currentChannelPageCount>1 && <nav class="record-page-navigation" aria-label={translateChannelText('channels.pagination')}>
      <button class="secondary" disabled={currentRequestPending||displayedChannelPageIndex===0} onClick={()=>setCurrentChannelPage(displayedChannelPageIndex-1)}>{translateChannelText('channels.previousPage')}</button>
      <span role="status">{translateChannelText('channels.pageNumber',{page:displayedChannelPageIndex+1,total:currentChannelPageCount})}</span>
      <button class="secondary" disabled={currentRequestPending||displayedChannelPageIndex+1>=currentChannelPageCount} onClick={()=>setCurrentChannelPage(displayedChannelPageIndex+1)}>{translateChannelText('channels.nextPage')}</button>
    </nav>}
    {currentChannelEntries && <ul class="channel-list">{currentMapChannels.slice(displayedChannelPageIndex*CHANNEL_LIST_PAGE_SIZE,(displayedChannelPageIndex+1)*CHANNEL_LIST_PAGE_SIZE).map(currentChannelEntry=>{
      const currentTargetReason=channelTargetRestriction(currentGameState,currentChannelEntry);
      return <li key={currentChannelEntry.id} class="channel-list-entry" data-channel-address={currentChannelEntry.address}>
        <div><strong>{currentChannelEntry.address}</strong>
          <small>{currentChannelEntry.capacity!==undefined ? translateChannelText('channels.population',{used:currentChannelEntry.reservedSeats!,capacity:currentChannelEntry.capacity,online:currentChannelEntry.onlineUsers!}) : translateChannelText('channels.populationUnavailable')}</small>
          <small>{translateChannelText('channels.identifier',{id:currentChannelEntry.id})}</small>
          {currentTargetReason && <small>{translateChannelText(currentTargetReason)}</small>}</div>
        <button class="secondary compact" disabled={currentJoinDisabled || !!currentTargetReason} title={currentMovementReason ? translateChannelText(currentMovementReason) : currentTargetReason ? translateChannelText(currentTargetReason) : undefined}
          onClick={()=>void joinSelectedChannel({channelId:currentChannelEntry.id})}>{translateChannelText('channels.join')}</button>
      </li>;
    })}</ul>}
    {currentRequestPending && <p role="status">{translateChannelText('channels.pending')}</p>}
    {currentResultUncertain && <p role="status">{translateChannelText('channels.uncertain')}</p>}
    {currentChannelNotice && <p role="alert">{noticeText(currentChannelNotice,currentDisplayLocale,translateChannelText)}</p>}
  </section>;
}
