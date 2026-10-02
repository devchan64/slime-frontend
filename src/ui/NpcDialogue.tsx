import {parseTimedEventPage,validateTimedEventAction,type TimedEventPage,type TimedEventEntry} from '../client/timed-event-validation.mjs';
import {createPositionIdentity} from '../client/positionIdentity';
import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseNpcDialogue,type NpcDialoguePage,type NpcQuestEntry} from '../client/npcDialogue';
import {noticeText,type Notice} from '../client/notice';
import {getLocale,useTranslation} from '../i18n';

export function NpcDialogue({gameSessionClient,currentNpcIdentifier,currentNpcName,actionsAreDisabled,currentCharacterVersion,currentQuestCategory='main'}:{
  gameSessionClient:Client;currentNpcIdentifier:string;currentNpcName:string;actionsAreDisabled:boolean;currentCharacterVersion:number;currentQuestCategory?:'main'|'timed'}){
  const {t:translateDialogueText,locale:currentDialogueLocale}=useTranslation();
  const [currentDialoguePage,setCurrentDialoguePage]=useState<NpcDialoguePage|TimedEventPage|null>(null);
  const [currentDialogueNotice,setCurrentDialogueNotice]=useState<Notice>('');
  const [dialogueRequestPending,setDialogueRequestPending]=useState(false);
  const [dialoguePanelOpened,setDialoguePanelOpened]=useState(false);
  const [pendingDeliveryEntry,setPendingDeliveryEntry]=useState<NpcQuestEntry|TimedEventEntry|null>(null);
  const confirmedDeliveryReference=useRef<NpcQuestEntry|TimedEventEntry|null>(null);
  const activeDialogueReference=useRef(false);
  const pendingDialogueReference=useRef(false);
  const initialSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,epoch:gameSessionClient.state?.epoch,
    character:gameSessionClient.state?.me.id,location:gameSessionClient.state?.location.id,position:createPositionIdentity(gameSessionClient.state?.me.position)});
  function dialogueSessionMatches(){
    return activeDialogueReference.current&&gameSessionClient.tokens?.user_id===initialSessionReference.current.owner
      &&gameSessionClient.state?.generation===initialSessionReference.current.generation&&gameSessionClient.state?.me.id===initialSessionReference.current.character
      &&gameSessionClient.state?.epoch===initialSessionReference.current.epoch
      &&gameSessionClient.state?.location.id===initialSessionReference.current.location&&gameSessionClient.state?.me.mode==='FIELD'
      &&createPositionIdentity(gameSessionClient.state?.me.position)===initialSessionReference.current.position;
  }
  async function loadNpcDialogue(retainedDialogueNotice:Notice='',refreshCharacterState=false,currentPageOffset=0){
    if(pendingDialogueReference.current||!dialogueSessionMatches())return;
    clearDeliveryConfirmation();
    const requestedDialogueLocale=getLocale();
    const requestedCharacterVersion=gameSessionClient.state?.me.version;
    pendingDialogueReference.current=true;setDialogueRequestPending(true);setCurrentDialogueNotice(retainedDialogueNotice);
    try{
      if(refreshCharacterState){
        const refreshedCharacterState=await gameSessionClient.request('/v1/game/state');
        if(!dialogueSessionMatches())return;
        gameSessionClient.accept(refreshedCharacterState);
        if(!dialogueSessionMatches())return;
      }
      const receivedDialoguePage=currentQuestCategory==='timed'?parseTimedEventPage(await gameSessionClient.request(`/v1/game/npcs/${encodeURIComponent(currentNpcIdentifier)}/timed-events?language=${requestedDialogueLocale}&offset=${currentPageOffset}`)):parseNpcDialogue(await gameSessionClient.request(`/v1/game/npcs/${encodeURIComponent(currentNpcIdentifier)}/main-events?language=${requestedDialogueLocale}&includeDestination=true`));
      if(receivedDialoguePage.npc?.id!==currentNpcIdentifier)throw new Error('대화 NPC가 요청과 다릅니다.');
      if(dialogueSessionMatches()&&requestedDialogueLocale===getLocale())setCurrentDialoguePage(receivedDialoguePage);
    }catch(currentRequestError){if(dialogueSessionMatches())setCurrentDialogueNotice(currentRequestError as Error);}
    finally{pendingDialogueReference.current=false;if(dialogueSessionMatches()){setDialogueRequestPending(false);if(requestedDialogueLocale!==getLocale()||requestedCharacterVersion!==gameSessionClient.state?.me.version)void loadNpcDialogue(retainedDialogueNotice);}}
  }
  function clearDeliveryConfirmation(){
    confirmedDeliveryReference.current=null;setPendingDeliveryEntry(null);
  }
  function selectDeliveryEntry(currentQuestEntry:NpcQuestEntry|TimedEventEntry){
    if(actionsAreDisabled||pendingDialogueReference.current||!dialogueSessionMatches()||!currentQuestEntry.canExecute
      ||currentDialoguePage?.characterVersion!==gameSessionClient.state?.me.version)return;
    confirmedDeliveryReference.current=currentQuestEntry;setPendingDeliveryEntry(currentQuestEntry);
  }
  async function executeNpcQuest(currentQuestEntry:NpcQuestEntry|TimedEventEntry){
    if(actionsAreDisabled||pendingDialogueReference.current||!currentDialoguePage||!currentQuestEntry.canExecute||!dialogueSessionMatches()
      ||currentDialoguePage.characterVersion!==gameSessionClient.state?.me.version
      ||!currentDialoguePage.entries.some(currentListedEntry=>currentListedEntry===currentQuestEntry)
      ||(currentQuestEntry.action==='complete'&&confirmedDeliveryReference.current!==currentQuestEntry))return;
    clearDeliveryConfirmation();
    pendingDialogueReference.current=true;setDialogueRequestPending(true);setCurrentDialogueNotice('');
    const currentOriginalState=gameSessionClient.state;
    let questActionSucceeded=false;
    let failedQuestNotice:Notice='';
    try{
      const currentActionResponse=await gameSessionClient.request(`/v1/game/${currentQuestCategory==='timed'?'timed-events':'main-events'}/${encodeURIComponent('offerId' in currentQuestEntry?currentQuestEntry.offerId:currentQuestEntry.eventId)}/${currentQuestEntry.action}`,
        {npcId:currentNpcIdentifier,expectedVersion:currentDialoguePage.characterVersion});
      if('offerId' in currentQuestEntry)validateTimedEventAction(currentActionResponse,currentQuestEntry,currentQuestEntry.action!,currentOriginalState);
      if(dialogueSessionMatches()){gameSessionClient.accept(currentActionResponse.state);questActionSucceeded=true;}
    }catch(currentRequestError){if(dialogueSessionMatches()){failedQuestNotice=currentRequestError as Error;setCurrentDialogueNotice(failedQuestNotice);}}
    finally{pendingDialogueReference.current=false;if(dialogueSessionMatches()){setDialogueRequestPending(false);setCurrentDialoguePage(null);}}
    // 실패 후에는 상태와 대화만 재조회하며 재료 전달 명령을 다시 실행하지 않는다.
    if(questActionSucceeded)await loadNpcDialogue();
    else if(failedQuestNotice&&dialogueSessionMatches())await loadNpcDialogue(failedQuestNotice,true);
  }
  useEffect(()=>{activeDialogueReference.current=true;return()=>{activeDialogueReference.current=false;};},[]);
  useEffect(()=>{if(dialoguePanelOpened&&!pendingDialogueReference.current)void loadNpcDialogue(currentDialogueNotice);},[dialoguePanelOpened,currentCharacterVersion,currentDialogueLocale]);
  return <section class="npc-dialogue">
    <button class="secondary compact" disabled={actionsAreDisabled||dialogueRequestPending} aria-expanded={dialoguePanelOpened}
      onClick={()=>{clearDeliveryConfirmation();setDialoguePanelOpened(!dialoguePanelOpened);}}>{translateDialogueText(currentQuestCategory==='timed'?'timedquests.talk':'npc.talk',{name:currentNpcName})}</button>
    {dialoguePanelOpened&&<div>
      <div class="npc-dialogue-heading"><h3>{currentDialoguePage?.npc?.name??translateDialogueText('npc.title')}</h3>
        <button class="secondary compact" disabled={actionsAreDisabled||dialogueRequestPending} onClick={()=>void loadNpcDialogue('',true)}>{translateDialogueText('journal.refresh')}</button></div>
      {currentDialogueNotice&&<p role="alert">{noticeText(currentDialogueNotice,currentDialogueLocale,translateDialogueText)}</p>}
      {dialogueRequestPending&&<p role="status">{translateDialogueText('npc.pending')}</p>}
      {!dialogueRequestPending&&!currentDialoguePage&&<p>{translateDialogueText('npc.reload')}</p>}
      {currentDialoguePage&&<p>{translateDialogueText('npc.capacity',{count:currentDialoguePage.acceptedCount,max:currentDialoguePage.maximumAcceptedCount})}</p>}
      {currentDialoguePage&&!currentDialoguePage.entries.length&&<p>{translateDialogueText(currentQuestCategory==='timed'?'timedquests.empty':'npc.empty')}</p>}
      <ul class="npc-quest-list">{currentDialoguePage?.entries.map(currentQuestEntry=><li key={'offerId' in currentQuestEntry?currentQuestEntry.offerId:currentQuestEntry.eventId}>
        <strong>{currentQuestEntry.title}</strong><small>{translateDialogueText(currentQuestEntry.status==='EXPIRED'?'timedquests.expired':`npc.${currentQuestEntry.status.toLowerCase()}`)}</small>
        <p>{currentQuestEntry.dialogue}</p>
        {'deliveryDeadline' in currentQuestEntry&&<><p>{translateDialogueText('timedquests.destination',{name:currentQuestEntry.destination.name})}</p><p>{translateDialogueText(currentQuestEntry.acceptedAt===null?'timedquests.acceptBefore':'timedquests.deliverBefore',{time:new Date((currentQuestEntry.acceptedAt===null?currentQuestEntry.acceptanceEndsAt:currentQuestEntry.deliveryDeadline)*1000).toLocaleString(currentDialogueLocale)})}</p>{currentQuestEntry.acceptedAt===null&&<p>{currentQuestEntry.type==='random'?translateDialogueText('timedquests.randomDeadline'):translateDialogueText('timedquests.seasonDeadline',{time:new Date(currentQuestEntry.deliveryDeadline*1000).toLocaleString(currentDialogueLocale)})}</p>}</>}
        {currentQuestEntry.destination&&'cityNameTranslations' in currentQuestEntry.destination&&<p>{translateDialogueText('npc.destination',{city:currentQuestEntry.destination.cityNameTranslations[currentDialogueLocale],name:currentQuestEntry.destination.name})}</p>}
        {currentQuestEntry.destination&&'cityNameTranslations' in currentQuestEntry.destination&&currentQuestEntry.status!=='COMPLETED'&&<p>{translateDialogueText('npc.destinationCitizenship',{city:currentQuestEntry.destination.cityNameTranslations[currentDialogueLocale]})}</p>}
        {currentQuestEntry.items.map(currentMaterialItem=><p key={currentMaterialItem.itemId}>{translateDialogueText('journal.material',{
          name:currentMaterialItem.nameTranslations[currentDialogueLocale],owned:currentMaterialItem.owned,required:currentMaterialItem.required})}</p>)}
        <p>{translateDialogueText(currentQuestEntry.status==='COMPLETED'?'journal.paid':'journal.reward',{amount:currentQuestEntry.moneyP})}</p>
        {currentQuestEntry.blockedReasons.map(currentReasonCode=><p class="is-warning" key={currentReasonCode}>{translateDialogueText(`npc.${currentReasonCode.toLowerCase().replaceAll('_','')}`)}</p>)}
        {currentQuestEntry.action&&<button class="compact" disabled={actionsAreDisabled||dialogueRequestPending||!currentQuestEntry.canExecute||currentDialoguePage.characterVersion!==currentCharacterVersion}
          onClick={()=>currentQuestEntry.action==='complete'?selectDeliveryEntry(currentQuestEntry):void executeNpcQuest(currentQuestEntry)}>{translateDialogueText(`npc.${currentQuestEntry.action}`)}</button>}
      </li>)}</ul>
      {currentDialoguePage&&'nextOffset' in currentDialoguePage&&currentDialoguePage.nextOffset!==null&&<button disabled={actionsAreDisabled||dialogueRequestPending} onClick={()=>void loadNpcDialogue('',false,(currentDialoguePage as TimedEventPage).nextOffset!)}>{translateDialogueText('timedquests.next')}</button>}
      {pendingDeliveryEntry&&currentDialoguePage?.characterVersion===currentCharacterVersion&&<section aria-label={translateDialogueText('npc.deliveryReview')}>
        <h4>{translateDialogueText('npc.deliveryReview')}: {pendingDeliveryEntry.title}</h4>
        <p>{translateDialogueText('npc.deliveryCharacter',{name:gameSessionClient.state?.me.name??''})}</p>
        {pendingDeliveryEntry.items.map(currentMaterialItem=><p key={currentMaterialItem.itemId}>{translateDialogueText('npc.deliveryMaterial',{
          name:currentMaterialItem.nameTranslations[currentDialogueLocale],quantity:currentMaterialItem.required})}</p>)}
        <p>{translateDialogueText('journal.reward',{amount:pendingDeliveryEntry.moneyP})}</p>
        <button disabled={actionsAreDisabled||dialogueRequestPending} onClick={()=>void executeNpcQuest(pendingDeliveryEntry)}>{translateDialogueText('npc.deliveryConfirm')}</button>
        <button class="secondary" disabled={dialogueRequestPending} onClick={clearDeliveryConfirmation}>{translateDialogueText('npc.deliveryCancel')}</button>
      </section>}
      {currentQuestCategory==='main'&&<NpcDialogue gameSessionClient={gameSessionClient} currentNpcIdentifier={currentNpcIdentifier} currentNpcName={currentNpcName} actionsAreDisabled={actionsAreDisabled||dialogueRequestPending} currentCharacterVersion={currentCharacterVersion} currentQuestCategory="timed"/>}
    </div>}
  </section>;
}
