import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {captureFacilitySessionContext,matchesFacilitySessionContext} from '../client/facilitySessionContext';
import {parseSkillCardInventory,validateSkillCardCommandResponse,type SkillCardInventoryResponse,type SkillCardCommandIdentity,type SkillCardRequestPayload,type StoredSkillCardEntry} from '../client/skill-card-validation.mjs';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

type PendingSkillCardCommand={path:string;payload:SkillCardRequestPayload;identity:SkillCardCommandIdentity;grantsSkill:string};

export function SkillCardPanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier?:string;actionsAreDisabled:boolean}){
 const {t:translateCardText,locale:currentCardLocale}=useTranslation();
 const [currentCardInventory,setCurrentCardInventory]=useState<SkillCardInventoryResponse|null>(null);
 const [currentCardNotice,setCurrentCardNotice]=useState<Notice>('');
 const [currentRequestPending,setCurrentRequestPending]=useState(false);
 const [currentUncertainRequest,setCurrentUncertainRequest]=useState(false);
 const [currentSelectedCard,setCurrentSelectedCard]=useState<StoredSkillCardEntry|null>(null);
 const currentActiveReference=useRef(false);
 const currentPendingReference=useRef(false);
 const currentCommandReference=useRef<PendingSkillCardCommand|null>(null);
 const currentSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,character:gameSessionClient.state?.me.id,generation:gameSessionClient.state?.generation,epoch:gameSessionClient.state?.epoch});
 const currentFacilityReference=useRef(currentFacilityIdentifier?captureFacilitySessionContext(gameSessionClient):null);
 function matchesCardSessionContext(){
  return currentActiveReference.current&&gameSessionClient.tokens?.user_id===currentSessionReference.current.owner
   &&gameSessionClient.state?.me.id===currentSessionReference.current.character&&gameSessionClient.state?.generation===currentSessionReference.current.generation
   &&gameSessionClient.state?.epoch===currentSessionReference.current.epoch
   &&(!currentFacilityIdentifier||(currentFacilityReference.current!==null&&matchesFacilitySessionContext(gameSessionClient,currentFacilityReference.current)));
 }
 function allowsCardMutationRequest(){return !actionsAreDisabled&&matchesCardSessionContext()&&gameSessionClient.state?.me.mode==='FIELD'
  &&!gameSessionClient.state.me.battleId&&!gameSessionClient.state.battle&&!gameSessionClient.state.reservation;}
 async function loadCurrentCardInventory(){
  if(currentPendingReference.current||currentCommandReference.current||!matchesCardSessionContext())return;
  currentPendingReference.current=true;setCurrentRequestPending(true);setCurrentCardNotice('');setCurrentSelectedCard(null);
  try{
   const currentCatalogPath=currentFacilityIdentifier?`/v1/game/bookshops/${encodeURIComponent(currentFacilityIdentifier)}/skill-cards`:'/v1/accounts/me/skill-cards';
   const currentReceivedInventory=parseSkillCardInventory(await gameSessionClient.request(currentCatalogPath));
   if(matchesCardSessionContext()){setCurrentCardInventory(currentReceivedInventory);return true;}
  }catch(currentRequestError){if(matchesCardSessionContext())setCurrentCardNotice(currentRequestError as Error);}
  finally{currentPendingReference.current=false;if(matchesCardSessionContext())setCurrentRequestPending(false);}
 }
 async function executeCurrentCardRequest(currentNewCommand?:PendingSkillCardCommand){
  if(currentPendingReference.current||!allowsCardMutationRequest())return;
  if(currentNewCommand&&currentCommandReference.current)return;
  const currentPendingCommand=currentCommandReference.current??currentNewCommand;
  const currentRequestState=gameSessionClient.state;
  if(!currentPendingCommand||!currentRequestState)return;
  currentCommandReference.current=currentPendingCommand;currentPendingReference.current=true;setCurrentRequestPending(true);setCurrentCardNotice('');
  let currentCommandCompleted=false;
  try{
   const currentCommandResponse=await gameSessionClient.request(currentPendingCommand.path,currentPendingCommand.payload);
   if(!matchesCardSessionContext())return;
   validateSkillCardCommandResponse(currentCommandResponse,{characterId:currentRequestState.me.id,generation:currentRequestState.generation,
    expectedVersion:currentPendingCommand.payload.expectedVersion,requestId:currentPendingCommand.payload.requestId,command:currentPendingCommand.identity,grantsSkill:currentPendingCommand.grantsSkill});
   gameSessionClient.accept(currentCommandResponse.state);
   setCurrentCardInventory(null);
   currentCommandReference.current=null;setCurrentUncertainRequest(false);setCurrentSelectedCard(null);currentCommandCompleted=true;
  }catch(currentRequestError){if(matchesCardSessionContext()){
   const currentOutcomeUncertain=!(currentRequestError instanceof ApiError)||currentRequestError.status>=500;
   setCurrentUncertainRequest(currentOutcomeUncertain);
   if(!currentOutcomeUncertain){currentCommandReference.current=null;setCurrentCardInventory(null);setCurrentSelectedCard(null);}
   setCurrentCardNotice(currentRequestError as Error);
  }}finally{currentPendingReference.current=false;if(matchesCardSessionContext())setCurrentRequestPending(false);}
  if(currentCommandCompleted&&matchesCardSessionContext()){
   const currentInventoryLoaded=await loadCurrentCardInventory();
   if(currentInventoryLoaded&&matchesCardSessionContext())setCurrentCardNotice({key:currentPendingCommand.identity.kind==='purchase'?'cards.purchased':'cards.used'});
  }
 }
 useEffect(()=>{currentActiveReference.current=true;void loadCurrentCardInventory();return()=>{currentActiveReference.current=false;};},[]);
 const currentCharacterState=gameSessionClient.state;
 const currentCardActionBlocked=currentCharacterState?.me.mode!=='FIELD'||!!currentCharacterState.me.battleId||!!currentCharacterState.battle||!!currentCharacterState.reservation;
 const currentActionsDisabled=!allowsCardMutationRequest()||currentRequestPending||currentUncertainRequest;
 return <section class="bag-panel" aria-label={translateCardText(currentFacilityIdentifier?'cards.shop':'cards.storage')}>
  <h3>{translateCardText(currentFacilityIdentifier?'cards.shop':'cards.storage')}</h3><p>{translateCardText('cards.policy')}</p>
  {currentCardActionBlocked&&<p>{translateCardText('cards.fieldRequired')}</p>}
  {!currentCardActionBlocked&&actionsAreDisabled&&<p>{translateCardText('cards.waitForConnection')}</p>}
  <button class="secondary compact" disabled={currentRequestPending||currentUncertainRequest} onClick={()=>void loadCurrentCardInventory()}>{translateCardText('cards.refresh')}</button>
  {currentCardInventory&&<ul class="bag-items">{currentFacilityIdentifier?currentCardInventory.catalog?.map(currentCardEntry=><li key={currentCardEntry.cardId}>
   <strong>{currentCardEntry.nameTranslations[currentCardLocale]}</strong><p>{translateCardText('cards.literacy',{level:currentCardEntry.literacyRequired})}</p>
   {!currentCardEntry.learned&&!currentCardEntry.owned&&(gameSessionClient.state?.me.coins??0)<currentCardEntry.priceP&&<p>{translateCardText('cards.insufficientFunds')}</p>}
   {currentCardEntry.learned?<span>{translateCardText('cards.learned')}</span>:currentCardEntry.owned?<span>{translateCardText('cards.owned')}</span>:
    <button disabled={currentActionsDisabled||(gameSessionClient.state?.me.coins??0)<currentCardEntry.priceP} onClick={()=>void executeCurrentCardRequest({
     path:`/v1/game/bookshops/${encodeURIComponent(currentFacilityIdentifier)}/skill-card-purchases`,grantsSkill:currentCardEntry.grantsSkill,
     identity:{kind:'purchase',cardId:currentCardEntry.cardId,facilityId:currentFacilityIdentifier,definitionVersion:currentCardEntry.definitionVersion,priceP:currentCardEntry.priceP},
     payload:{requestId:crypto.randomUUID(),expectedVersion:currentCardInventory.characterVersion,cardId:currentCardEntry.cardId,definitionVersion:currentCardEntry.definitionVersion,priceP:currentCardEntry.priceP}
    })}>{translateCardText('cards.buy',{price:currentCardEntry.priceP})}</button>}
  </li>):currentCardInventory.cards.map(currentCardEntry=><li key={currentCardEntry.cardId}>
   <strong>{currentCardEntry.nameTranslations[currentCardLocale]}</strong><p>{translateCardText('cards.requirement',{required:currentCardEntry.literacyRequired,current:currentCardEntry.currentLiteracy})}</p>
   <p>{translateCardText('cards.indefinite')}</p>
   {currentCardEntry.learned?<span>{translateCardText('cards.learned')}</span>:<button disabled={currentActionsDisabled||currentCardEntry.currentLiteracy<currentCardEntry.literacyRequired} onClick={()=>setCurrentSelectedCard(currentCardEntry)}>{translateCardText('cards.use')}</button>}
  </li>)}</ul>}
  {currentCardInventory&&!currentFacilityIdentifier&&!currentCardInventory.cards.length&&<p>{translateCardText('cards.empty')}</p>}
  {currentSelectedCard&&currentCardInventory&&<div role="group" aria-label={translateCardText('cards.confirmTitle')}>
   <p>{translateCardText('cards.confirm',{name:currentSelectedCard.nameTranslations[currentCardLocale]})}</p>
   <button disabled={currentActionsDisabled} onClick={()=>void executeCurrentCardRequest({
    path:`/v1/accounts/me/skill-cards/${encodeURIComponent(currentSelectedCard.cardId)}/use`,grantsSkill:currentSelectedCard.grantsSkill,
    identity:{kind:'use',cardId:currentSelectedCard.cardId},payload:{requestId:crypto.randomUUID(),expectedVersion:Math.max(currentCardInventory.characterVersion,gameSessionClient.state?.me.version??0)}
   })}>{translateCardText('cards.confirmUse')}</button>
   <button class="secondary" disabled={currentRequestPending||currentUncertainRequest} onClick={()=>setCurrentSelectedCard(null)}>{translateCardText('cards.cancel')}</button>
  </div>}
  {currentUncertainRequest&&<><p>{translateCardText('cards.uncertain')}</p><button disabled={currentRequestPending||!allowsCardMutationRequest()} onClick={()=>void executeCurrentCardRequest()}>{translateCardText('cards.retry')}</button></>}
  {currentRequestPending&&<p role="status">{translateCardText('cards.pending')}</p>}
  {currentCardNotice&&<p role="status">{noticeText(currentCardNotice,currentCardLocale,translateCardText)}</p>}
 </section>;
}
