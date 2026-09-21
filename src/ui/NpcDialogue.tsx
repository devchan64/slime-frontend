import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseNpcDialogue,type NpcDialoguePage,type NpcQuestEntry} from '../client/npcDialogue';
import {noticeText,type Notice} from '../client/notice';
import {getLocale,useTranslation} from '../i18n';

export function NpcDialogue({gameSessionClient,currentNpcIdentifier,currentNpcName,actionsAreDisabled,currentCharacterVersion}:{
  gameSessionClient:Client;currentNpcIdentifier:string;currentNpcName:string;actionsAreDisabled:boolean;currentCharacterVersion:number}){
  const {t:translateDialogueText,locale:currentDialogueLocale}=useTranslation();
  const [currentDialoguePage,setCurrentDialoguePage]=useState<NpcDialoguePage|null>(null);
  const [currentDialogueNotice,setCurrentDialogueNotice]=useState<Notice>('');
  const [dialogueRequestPending,setDialogueRequestPending]=useState(false);
  const [dialoguePanelOpened,setDialoguePanelOpened]=useState(false);
  const activeDialogueReference=useRef(false);
  const pendingDialogueReference=useRef(false);
  const initialSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,
    character:gameSessionClient.state?.me.id,location:gameSessionClient.state?.location.id,position:JSON.stringify(gameSessionClient.state?.me.position)});
  function dialogueSessionMatches(){
    return activeDialogueReference.current&&gameSessionClient.tokens?.user_id===initialSessionReference.current.owner
      &&gameSessionClient.state?.generation===initialSessionReference.current.generation&&gameSessionClient.state?.me.id===initialSessionReference.current.character
      &&gameSessionClient.state?.location.id===initialSessionReference.current.location&&gameSessionClient.state?.me.mode==='FIELD'
      &&JSON.stringify(gameSessionClient.state?.me.position)===initialSessionReference.current.position;
  }
  async function loadNpcDialogue(){
    if(pendingDialogueReference.current||!dialogueSessionMatches())return;
    const requestedDialogueLocale=getLocale();
    const requestedCharacterVersion=gameSessionClient.state?.me.version;
    pendingDialogueReference.current=true;setDialogueRequestPending(true);setCurrentDialogueNotice('');
    try{
      const receivedDialoguePage=parseNpcDialogue(await gameSessionClient.request(`/v1/game/npcs/${encodeURIComponent(currentNpcIdentifier)}/main-events?language=${requestedDialogueLocale}`));
      if(receivedDialoguePage.npc.id!==currentNpcIdentifier)throw new Error('대화 NPC가 요청과 다릅니다.');
      if(dialogueSessionMatches()&&requestedDialogueLocale===getLocale())setCurrentDialoguePage(receivedDialoguePage);
    }catch(currentRequestError){if(dialogueSessionMatches())setCurrentDialogueNotice(currentRequestError as Error);}
    finally{pendingDialogueReference.current=false;if(dialogueSessionMatches()){setDialogueRequestPending(false);if(requestedDialogueLocale!==getLocale()||requestedCharacterVersion!==gameSessionClient.state?.me.version)void loadNpcDialogue();}}
  }
  async function executeNpcQuest(currentQuestEntry:NpcQuestEntry){
    if(actionsAreDisabled||pendingDialogueReference.current||!currentDialoguePage||!currentQuestEntry.canExecute||!dialogueSessionMatches())return;
    pendingDialogueReference.current=true;setDialogueRequestPending(true);setCurrentDialogueNotice('');
    let questActionSucceeded=false;
    try{
      const currentActionResponse=await gameSessionClient.request(`/v1/game/main-events/${encodeURIComponent(currentQuestEntry.eventId)}/${currentQuestEntry.action}`,
        {npcId:currentNpcIdentifier,expectedVersion:currentDialoguePage.characterVersion});
      if(dialogueSessionMatches()){gameSessionClient.accept(currentActionResponse.state);questActionSucceeded=true;}
    }catch(currentRequestError){if(dialogueSessionMatches())setCurrentDialogueNotice(currentRequestError as Error);}
    finally{pendingDialogueReference.current=false;if(dialogueSessionMatches()){setDialogueRequestPending(false);setCurrentDialoguePage(null);}}
    // 명령 실패도 자동 재실행하지 않는다. 명시적인 새로고침으로 현재 조건을 다시 확인한다.
    if(questActionSucceeded)await loadNpcDialogue();
  }
  useEffect(()=>{activeDialogueReference.current=true;return()=>{activeDialogueReference.current=false;};},[]);
  useEffect(()=>{if(dialoguePanelOpened&&!pendingDialogueReference.current)void loadNpcDialogue();},[dialoguePanelOpened,currentCharacterVersion,currentDialogueLocale]);
  return <section class="npc-dialogue">
    <button class="secondary compact" disabled={actionsAreDisabled||dialogueRequestPending} aria-expanded={dialoguePanelOpened}
      onClick={()=>setDialoguePanelOpened(!dialoguePanelOpened)}>{translateDialogueText('npc.talk',{name:currentNpcName})}</button>
    {dialoguePanelOpened&&<div>
      <div class="npc-dialogue-heading"><h3>{currentDialoguePage?.npc.name??translateDialogueText('npc.title')}</h3>
        <button class="secondary compact" disabled={actionsAreDisabled||dialogueRequestPending} onClick={()=>void loadNpcDialogue()}>{translateDialogueText('journal.refresh')}</button></div>
      {currentDialogueNotice&&<p role="alert">{noticeText(currentDialogueNotice,currentDialogueLocale,translateDialogueText)}</p>}
      {dialogueRequestPending&&<p role="status">{translateDialogueText('npc.pending')}</p>}
      {!dialogueRequestPending&&!currentDialoguePage&&<p>{translateDialogueText('npc.reload')}</p>}
      {currentDialoguePage&&<p>{translateDialogueText('npc.capacity',{count:currentDialoguePage.acceptedCount,max:currentDialoguePage.maximumAcceptedCount})}</p>}
      {currentDialoguePage&&!currentDialoguePage.entries.length&&<p>{translateDialogueText('npc.empty')}</p>}
      <ul class="npc-quest-list">{currentDialoguePage?.entries.map(currentQuestEntry=><li key={currentQuestEntry.eventId}>
        <strong>{currentQuestEntry.title}</strong><small>{translateDialogueText(`npc.${currentQuestEntry.status.toLowerCase()}`)}</small>
        <p>{currentQuestEntry.dialogue}</p>
        {currentQuestEntry.items.map(currentMaterialItem=><p key={currentMaterialItem.itemId}>{translateDialogueText('journal.material',{
          name:currentMaterialItem.nameTranslations[currentDialogueLocale],owned:currentMaterialItem.owned,required:currentMaterialItem.required})}</p>)}
        <p>{translateDialogueText(currentQuestEntry.status==='COMPLETED'?'journal.paid':'journal.reward',{amount:currentQuestEntry.moneyP})}</p>
        {currentQuestEntry.blockedReasons.map(currentReasonCode=><p class="is-warning" key={currentReasonCode}>{translateDialogueText(`npc.${currentReasonCode.toLowerCase().replaceAll('_','')}`)}</p>)}
        {currentQuestEntry.action&&<button class="compact" disabled={actionsAreDisabled||dialogueRequestPending||!currentQuestEntry.canExecute||currentDialoguePage.characterVersion!==currentCharacterVersion}
          onClick={()=>void executeNpcQuest(currentQuestEntry)}>{translateDialogueText(`npc.${currentQuestEntry.action}`)}</button>}
      </li>)}</ul>
    </div>}
  </section>;
}
