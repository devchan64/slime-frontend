import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseSkillbookInventory,type SkillbookInventoryResponse,type SkillbookCatalogEntry} from '../client/skillbooks';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

export function SkillbookPanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier?:string;actionsAreDisabled:boolean}){
  const {t:translateBookText,locale:currentBookLocale}=useTranslation();
  const [currentBookInventory,setCurrentBookInventory]=useState<SkillbookInventoryResponse|null>(null);
  const [currentBookNotice,setCurrentBookNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const activePanelReference=useRef(false);
  const pendingRequestReference=useRef(false);
  const originalPurchaseRequests=useRef<Record<string,Record<string,unknown>>>({});
  const originalSessionReference=useRef({character:gameSessionClient.state?.me.id,generation:gameSessionClient.state?.generation});
  const currentCatalogPath=currentFacilityIdentifier?`/v1/game/bookshops/${encodeURIComponent(currentFacilityIdentifier)}/catalog`:'/v1/game/skillbooks';
  function currentBookSessionMatches(){return activePanelReference.current&&gameSessionClient.state?.me.id===originalSessionReference.current.character
    &&gameSessionClient.state?.generation===originalSessionReference.current.generation;}
  async function loadCurrentBooks(){
    const receivedBookInventory=parseSkillbookInventory(await gameSessionClient.request(currentCatalogPath));
    if(currentBookSessionMatches()){setCurrentBookInventory(receivedBookInventory);originalPurchaseRequests.current={};}
  }
  async function runCurrentBookRequest(currentRequestAction:()=>Promise<void>){
    if(pendingRequestReference.current||!currentBookSessionMatches())return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentBookNotice('');
    try{await currentRequestAction();}catch(currentRequestError){if(currentBookSessionMatches())setCurrentBookNotice(currentRequestError as Error);}
    finally{pendingRequestReference.current=false;if(currentBookSessionMatches())setCurrentRequestPending(false);}
  }
  useEffect(()=>{activePanelReference.current=true;void runCurrentBookRequest(loadCurrentBooks);return()=>{activePanelReference.current=false;};},[gameSessionClient,currentFacilityIdentifier]);
  async function purchaseCurrentBook(currentBookEntry:Omit<SkillbookCatalogEntry,'owned'>){
    if(actionsAreDisabled||!currentBookInventory||!currentFacilityIdentifier)return;
    await runCurrentBookRequest(async()=>{
      const currentOriginalRequest=originalPurchaseRequests.current[currentBookEntry.definitionId]??={
        requestId:crypto.randomUUID(),expectedVersion:currentBookInventory.characterVersion,definitionId:currentBookEntry.definitionId,
        definitionVersion:currentBookEntry.definitionVersion,priceP:currentBookEntry.priceP};
      const currentPurchaseResponse=await gameSessionClient.request(`/v1/game/bookshops/${encodeURIComponent(currentFacilityIdentifier)}/purchases`,currentOriginalRequest);
      if(!currentBookSessionMatches())return;
      gameSessionClient.accept(currentPurchaseResponse.state);
      await loadCurrentBooks();
    });
  }
  async function readCurrentBook(currentBookIdentifier:string){
    if(actionsAreDisabled||!currentBookInventory)return;
    await runCurrentBookRequest(async()=>{
      const currentReadResponse=await gameSessionClient.request(`/v1/game/skillbooks/${encodeURIComponent(currentBookIdentifier)}/read`,{expectedVersion:currentBookInventory.characterVersion});
      if(!currentBookSessionMatches())return;
      gameSessionClient.accept(currentReadResponse.state);
      await loadCurrentBooks();
      if(currentBookSessionMatches())setCurrentBookNotice(translateBookText('books.readComplete'));
    });
  }
  const currentPlayerRecord=gameSessionClient.state?.me;
  const currentActionsDisabled=actionsAreDisabled||currentRequestPending||currentPlayerRecord?.mode!=='FIELD'||!!currentPlayerRecord.battleId;
  return <section class="bag-panel" aria-label={translateBookText(currentFacilityIdentifier?'books.shop':'books.library')}>
    <h3>{translateBookText(currentFacilityIdentifier?'books.shop':'books.library')}</h3>
    <p>{translateBookText('books.policy')}</p>
    <button class="secondary compact" disabled={currentRequestPending} onClick={()=>void runCurrentBookRequest(loadCurrentBooks)}>{translateBookText('books.refresh')}</button>
    {currentRequestPending&&<p role="status">{translateBookText('books.pending')}</p>}
    {currentBookNotice&&<p role="status">{noticeText(currentBookNotice,currentBookLocale,translateBookText)}</p>}
    {currentBookInventory&&<ul class="bag-items">{(currentBookInventory.catalog??currentBookInventory.books).map(currentBookEntry=>{
      const currentOwnedBook=currentBookInventory.books.find(currentOwnedEntry=>currentOwnedEntry.definitionId===currentBookEntry.definitionId);
      return <li key={currentBookEntry.definitionId}><strong>{currentBookEntry.nameTranslations[currentBookLocale]}</strong>
        <p>{translateBookText('books.literacy',{level:currentBookEntry.literacyRequired})}</p>
        {currentOwnedBook?<><span>{translateBookText('books.owned')}</span><button class="secondary compact"
          disabled={currentActionsDisabled||(currentPlayerRecord?.skills.literacy??0)<currentBookEntry.literacyRequired}
          onClick={()=>void readCurrentBook(currentBookEntry.definitionId)}>{translateBookText(currentOwnedBook.firstReadAt===null?'books.read':'books.reread')}</button></>
          :<button class="compact" disabled={currentActionsDisabled||(currentPlayerRecord?.coins??0)<currentBookEntry.priceP}
            onClick={()=>void purchaseCurrentBook(currentBookEntry)}>{translateBookText('books.buy',{price:currentBookEntry.priceP})}</button>}
      </li>;
    })}</ul>}
    {currentBookInventory&&!currentFacilityIdentifier&&!currentBookInventory.books.length&&<p>{translateBookText('books.empty')}</p>}
  </section>;
}
