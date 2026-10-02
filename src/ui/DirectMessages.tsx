import {useEffect,useMemo,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import type {State} from '../client/types';
import {DirectMessageClient,DirectMessageClientError,retainUnexpiredDirectMessages,type DirectMessageHistory,type DirectMessageConversations,type DirectMessageBlocks,type PendingDirectMessage} from '../client/direct-messages.mjs';
import {noticeText} from '../client/notice';
import {useTranslation} from '../i18n';
import {WorldDrawer} from './WorldDrawer';
const DIRECT_MESSAGE_NOTICE_INTERVAL=30000;
const DIRECT_MESSAGE_EXPIRY_INTERVAL=1000;

export function DirectMessages({currentGameClient,currentGameState}:{currentGameClient:Client;currentGameState:State}){
  const {t:translateMessageText,locale:currentDisplayLocale}=useTranslation();
  const currentMessageClient=useMemo(()=>new DirectMessageClient(
    (currentRequestPath,currentRequestBody,currentRequestMethod)=>currentGameClient.request(currentRequestPath,currentRequestBody,currentRequestMethod),
    ()=>currentGameClient.tokens&&currentGameClient.state?{characterId:currentGameClient.state.me.id,generation:currentGameClient.state.generation}:null
  ),[currentGameClient,currentGameState.me.id,currentGameState.generation]);
  const currentComponentAlive=useRef(true);
  const [currentPanelOpen,setCurrentPanelOpen]=useState(false);
  const [currentRequestBusy,setCurrentRequestBusy]=useState(false);
  const [currentPeerInput,setCurrentPeerInput]=useState('');
  const [currentHistoryPage,setCurrentHistoryPage]=useState<DirectMessageHistory|null>(null);
  const [currentConversationPage,setCurrentConversationPage]=useState<DirectMessageConversations|null>(null);
  const [currentBlockPage,setCurrentBlockPage]=useState<DirectMessageBlocks|null>(null);
  const [currentPeerDrafts,setCurrentPeerDrafts]=useState<Record<string,string>>(()=>Object.create(null));
  const [currentPendingSend,setCurrentPendingSend]=useState<PendingDirectMessage|null>(null);
  const [currentErrorValue,setCurrentErrorValue]=useState<Error|null>(null);
  const [currentSendConfirmed,setCurrentSendConfirmed]=useState(false);
  const [currentNoticeCount,setCurrentNoticeCount]=useState<number|null>(null);
  const [currentNoticeFailed,setCurrentNoticeFailed]=useState(false);
  const currentSelectedPeer=currentHistoryPage?.peer.characterId;
  useEffect(()=>{
    currentComponentAlive.current=true;
    let currentNoticeTimer:ReturnType<typeof setTimeout>;
    let currentPreviousPending:PendingDirectMessage|null=null;
    async function refreshDirectMessageNotice(){
      try{
        const currentNoticeResponse=await currentMessageClient.readDirectMessageNotice();
        if(currentComponentAlive.current){setCurrentNoticeCount(currentNoticeResponse.count);setCurrentNoticeFailed(false);}
      }catch{
        if(currentComponentAlive.current){setCurrentNoticeCount(null);setCurrentNoticeFailed(true);}
      }finally{
        if(currentComponentAlive.current)currentNoticeTimer=setTimeout(refreshDirectMessageNotice,DIRECT_MESSAGE_NOTICE_INTERVAL);
      }
    }
    void refreshDirectMessageNotice();
    const currentExpiryTimer=setInterval(()=>{
      setCurrentHistoryPage(currentStoredHistory=>{
        if(!currentStoredHistory)return null;
        const currentRetainedEntries=retainUnexpiredDirectMessages(currentStoredHistory.entries,currentMessageClient.readDirectMessageTime());
        return currentRetainedEntries.length===currentStoredHistory.entries.length?currentStoredHistory:{...currentStoredHistory,entries:currentRetainedEntries};
      });
      try{
        const currentRetainedPending=currentMessageClient.readPendingDirectMessage();
        if(currentPreviousPending&&!currentRetainedPending&&currentPreviousPending.expiresAt<=currentMessageClient.readDirectMessageTime()){
          const currentExpiredTarget=currentPreviousPending.payload.recipientId;
          setCurrentPeerDrafts(currentStoredDrafts=>({...currentStoredDrafts,[currentExpiredTarget]:''}));
          setCurrentErrorValue(new DirectMessageClientError('noPendingSend'));
        }
        currentPreviousPending=currentRetainedPending;setCurrentPendingSend(currentRetainedPending);
      }catch{setCurrentHistoryPage(null);setCurrentPeerDrafts(Object.create(null));setCurrentPendingSend(null);}
    },DIRECT_MESSAGE_EXPIRY_INTERVAL);
    return ()=>{currentComponentAlive.current=false;clearTimeout(currentNoticeTimer);clearInterval(currentExpiryTimer);currentMessageClient.disposeDirectMessages();};
  },[currentMessageClient]);
  async function runDirectMessageAction(currentActionFunction:()=>Promise<void>){
    if(currentRequestBusy)return;
    setCurrentRequestBusy(true);setCurrentErrorValue(null);setCurrentSendConfirmed(false);
    try{await currentActionFunction();}
    catch(currentRequestError){if(currentComponentAlive.current)setCurrentErrorValue(currentRequestError instanceof Error?currentRequestError:new Error(String(currentRequestError)));}
    finally{if(currentComponentAlive.current){setCurrentRequestBusy(false);try{setCurrentPendingSend(currentMessageClient.readPendingDirectMessage());}catch{setCurrentPendingSend(null);}}}
  }
  async function loadDirectMessageHistory(currentPeerIdentifier:string,currentBeforeSequence:string|null=null){
    const currentReceivedHistory=await currentMessageClient.readDirectMessageHistory(currentPeerIdentifier,currentBeforeSequence);
    if(!currentComponentAlive.current)return;
    setCurrentHistoryPage(currentReceivedHistory);setCurrentPeerInput(currentPeerIdentifier);
    const currentReceivedIdentifiers=currentReceivedHistory.entries.filter(currentMessageEntry=>currentMessageEntry.recipientId===currentGameState.me.id).map(currentMessageEntry=>currentMessageEntry.messageId);
    if(currentReceivedIdentifiers.length)await currentMessageClient.acknowledgeDirectMessages(currentReceivedIdentifiers);
    const currentNoticeResponse=await currentMessageClient.readDirectMessageNotice();
    if(currentComponentAlive.current){setCurrentNoticeCount(currentNoticeResponse.count);setCurrentNoticeFailed(false);}
  }
  async function loadDirectMessageConversations(currentBeforeSequence:string|null=null){
    const currentReceivedPage=await currentMessageClient.listDirectMessageConversations(currentBeforeSequence);
    if(currentComponentAlive.current)setCurrentConversationPage(currentReceivedPage);
  }
  async function loadDirectMessageBlocks(currentAfterIdentifier:string|null=null){
    const currentReceivedPage=await currentMessageClient.listDirectMessageBlocks(currentAfterIdentifier);
    if(currentComponentAlive.current)setCurrentBlockPage(currentReceivedPage);
  }
  async function submitDirectMessageDraft(currentRetryRequested:boolean){
    const currentSendTarget=currentRetryRequested?currentPendingSend?.payload.recipientId:currentSelectedPeer;
    if(!currentSendTarget)return;
    if(currentRetryRequested)await currentMessageClient.retryPendingDirectMessage();
    else await currentMessageClient.sendDirectMessageText(currentSendTarget,currentPeerDrafts[currentSendTarget]??'');
    if(!currentComponentAlive.current)return;
    setCurrentPeerDrafts(currentStoredDrafts=>({...currentStoredDrafts,[currentSendTarget]:''}));
    setCurrentPendingSend(null);setCurrentSendConfirmed(true);
    if(currentSendTarget===currentSelectedPeer)await loadDirectMessageHistory(currentSendTarget);
  }
  return <>
    <button class="secondary compact" aria-label={translateMessageText('directmessages.open')} title={translateMessageText(currentNoticeFailed?'directmessages.noticeFailed':'directmessages.open')} onClick={()=>{setCurrentPanelOpen(true);void runDirectMessageAction(()=>loadDirectMessageConversations());}}>
      <span aria-hidden="true">✉</span> {currentNoticeCount===null?'—':currentNoticeCount>99?'99+':currentNoticeCount}
    </button>
    {currentPanelOpen&&<WorldDrawer title={translateMessageText('directmessages.open')} onClose={()=>{setCurrentPanelOpen(false);setCurrentHistoryPage(null);}}>
      <p class="muted">{translateMessageText('directmessages.retention')}</p>
      {currentNoticeFailed&&<p role="status">{translateMessageText('directmessages.noticeFailed')}</p>}
      {currentErrorValue&&<p role="alert">{currentErrorValue instanceof DirectMessageClientError?translateMessageText('directmessages.'+currentErrorValue.messageKey):noticeText(currentErrorValue,currentDisplayLocale,translateMessageText)}</p>}
      {currentSendConfirmed&&<p role="status">{translateMessageText('directmessages.saved')}</p>}
      {currentPendingSend&&<div role="status"><p>{translateMessageText('directmessages.pending',{recipient:currentPendingSend.payload.recipientId})}</p>
        <button disabled={currentRequestBusy} onClick={()=>void runDirectMessageAction(()=>submitDirectMessageDraft(true))}>{translateMessageText('directmessages.retry')}</button></div>}
      <fieldset disabled={currentRequestBusy}>
        <legend>{translateMessageText('directmessages.recipient')}</legend>
        <label>{translateMessageText('directmessages.characterId')}<input value={currentPeerInput} maxLength={200} onInput={currentInputEvent=>setCurrentPeerInput(currentInputEvent.currentTarget.value)}/></label>
        <button onClick={()=>void runDirectMessageAction(()=>loadDirectMessageHistory(currentPeerInput.trim()))}>{translateMessageText('directmessages.select')}</button>
        <label>{translateMessageText('directmessages.nearby')}<select value="" onChange={currentSelectEvent=>{const currentPeerIdentifier=currentSelectEvent.currentTarget.value;if(currentPeerIdentifier)void runDirectMessageAction(()=>loadDirectMessageHistory(currentPeerIdentifier));}}>
          <option value="">{translateMessageText('directmessages.select')}</option>
          {currentGameState.members.filter(currentMapMember=>currentMapMember.id!==currentGameState.me.id).map(currentMapMember=><option key={currentMapMember.id} value={currentMapMember.id}>{currentMapMember.name} [{currentMapMember.id}]</option>)}
        </select></label>
        <button onClick={()=>void runDirectMessageAction(()=>loadDirectMessageConversations())}>{translateMessageText('directmessages.conversations')}</button>
        <button onClick={()=>void runDirectMessageAction(()=>loadDirectMessageBlocks())}>{translateMessageText('directmessages.blocks')}</button>
        {currentConversationPage&&<ul>{currentConversationPage.entries.map(currentConversationEntry=><li key={currentConversationEntry.characterId}><button onClick={()=>void runDirectMessageAction(()=>loadDirectMessageHistory(currentConversationEntry.characterId))}>{currentConversationEntry.name} [{currentConversationEntry.characterId}]</button></li>)}</ul>}
        {currentConversationPage?.nextCursor&&<button onClick={()=>void runDirectMessageAction(()=>loadDirectMessageConversations(currentConversationPage.nextCursor))}>{translateMessageText('directmessages.next')}</button>}
        {currentBlockPage&&<ul>{currentBlockPage.entries.map(currentBlockedPeer=><li key={currentBlockedPeer.characterId}><button onClick={()=>void runDirectMessageAction(()=>loadDirectMessageHistory(currentBlockedPeer.characterId))}>{currentBlockedPeer.name} [{currentBlockedPeer.characterId}]</button></li>)}</ul>}
        {currentBlockPage?.nextCursor&&<button onClick={()=>void runDirectMessageAction(()=>loadDirectMessageBlocks(currentBlockPage.nextCursor))}>{translateMessageText('directmessages.next')}</button>}
      </fieldset>
      {currentHistoryPage&&<section aria-label={translateMessageText('directmessages.history')}>
        <h3>{currentHistoryPage.peer.name} [{currentSelectedPeer}]</h3>
        <button disabled={currentRequestBusy} onClick={()=>void runDirectMessageAction(()=>loadDirectMessageHistory(currentSelectedPeer!))}>{translateMessageText('directmessages.refresh')}</button>
        <button disabled={currentRequestBusy} onClick={()=>void runDirectMessageAction(async()=>{await currentMessageClient.setDirectMessageBlock(currentSelectedPeer!,!currentHistoryPage.blocked);await loadDirectMessageHistory(currentSelectedPeer!);})}>{translateMessageText(currentHistoryPage.blocked?'directmessages.unblock':'directmessages.block')}</button>
        <ol class="direct-message-history">{currentHistoryPage.entries.map(currentMessageEntry=><li key={currentMessageEntry.messageId}>
          <strong>{currentMessageEntry.senderId===currentGameState.me.id?translateMessageText('directmessages.self'):currentHistoryPage.peer.name}</strong>
          <time dateTime={new Date(currentMessageEntry.sentAt*1000).toISOString()}> {new Date(currentMessageEntry.sentAt*1000).toLocaleString(currentDisplayLocale)}</time>
          <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{currentMessageEntry.text}</p>
        </li>)}</ol>
        {!currentHistoryPage.entries.length&&<p>{translateMessageText('directmessages.empty')}</p>}
        {currentHistoryPage.nextCursor&&<button disabled={currentRequestBusy} onClick={()=>void runDirectMessageAction(()=>loadDirectMessageHistory(currentSelectedPeer!,currentHistoryPage.nextCursor))}>{translateMessageText('directmessages.older')}</button>}
        <form onSubmit={currentSubmitEvent=>{currentSubmitEvent.preventDefault();void runDirectMessageAction(()=>submitDirectMessageDraft(false));}}>
          <label>{translateMessageText('directmessages.body')}<textarea value={currentPeerDrafts[currentSelectedPeer!]??''} disabled={currentRequestBusy||!!currentPendingSend} onInput={currentInputEvent=>{const currentDraftValue=currentInputEvent.currentTarget.value;setCurrentPeerDrafts(currentStoredDrafts=>({...currentStoredDrafts,[currentSelectedPeer!]:currentDraftValue}));}}/></label>
          <button disabled={currentRequestBusy||!!currentPendingSend||!(currentPeerDrafts[currentSelectedPeer!]??'').trim()}>{translateMessageText('directmessages.send')}</button>
        </form>
      </section>}
    </WorldDrawer>}
  </>;
}
