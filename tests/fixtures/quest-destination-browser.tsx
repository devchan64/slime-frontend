import {render} from 'preact';
import {MainEventJournal} from '../../src/ui/MainEventJournal';
import {WorldMapPanel} from '../../src/ui/WorldMapPanel';
import type {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentAssertionLabels:string[]=[];
const currentRequestPaths:string[]=[];
const currentJournalNpc={id:'receiver',name:'서린',cityId:'reedhaven',facilityId:'reedhaven-market'};
const currentFixtureClient={tokens:{user_id:'owner'},state:{generation:1,me:{id:'hero'}},async request(currentRequestPath:string,currentRequestBody?:unknown){
 if(currentRequestBody)throw new Error('목적지 조회는 명령을 보내면 안 됩니다.');currentRequestPaths.push(currentRequestPath);
 if(currentRequestPath==='/v1/maps/world')return {version:2,maps:[
  {id:'iseulon',name:'이슬온',nameTranslations:{ko:'이슬온',en:'Iseulon'},safeTown:true,column:0,row:0,connections:[{target:'reedhaven',direction:'east'}]},
  {id:'reedhaven',name:'갈대나루',nameTranslations:{ko:'갈대나루',en:'Reedhaven'},safeTown:true,column:1,row:0,connections:[{target:'iseulon',direction:'west'}]},
 ]};
 return {serverTime:30,characterVersion:2,entries:[{eventId:'second',title:'물길 너머의 생활',acceptedAt:10,completedAt:null,moneyP:5,status:'ACCEPTED',materialsSufficient:false,giver:currentJournalNpc,receiver:currentJournalNpc,items:[{itemId:'protein-jelly',required:2,owned:0,nameTranslations:{ko:'단백질젤리',en:'Protein jelly'}}]}]};
}};
const waitRenderCycle=()=>new Promise(currentWaitResolver=>setTimeout(currentWaitResolver,120));
function verifyDestinationCondition(currentConditionValue:unknown,currentAssertionLabel:string){if(!currentConditionValue)throw new Error(currentAssertionLabel);currentAssertionLabels.push(currentAssertionLabel);}
function showDestinationCity(currentCityIdentifier:string){render(<WorldMapPanel gameSessionClient={currentFixtureClient as unknown as Client} currentMapIdentifier="iseulon" initialSelectedMapIdentifier={currentCityIdentifier}/>,document.getElementById('root')!);}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 render(<MainEventJournal gameSessionClient={currentFixtureClient as unknown as Client} actionsAreDisabled={false} onShowDestinationCity={showDestinationCity}/>,document.getElementById('root')!);
 await waitRenderCycle();await waitRenderCycle();
 const currentDestinationButton=[...document.querySelectorAll('button')].find(currentButtonElement=>currentButtonElement.textContent===t('journal.showDestination'));
 verifyDestinationCondition(currentDestinationButton&&!currentDestinationButton.disabled,'진행 의뢰 목적지 버튼');currentDestinationButton!.click();await waitRenderCycle();await waitRenderCycle();
 const currentSelectedNode=document.querySelector('.world-map-node[aria-pressed="true"]');
 verifyDestinationCondition(currentSelectedNode?.textContent?.includes(location.hash==='#en'?'Reedhaven':'갈대나루'),'전달 도시가 선택됨');
 verifyDestinationCondition(document.querySelector('.world-map-node.is-current')?.textContent?.includes(location.hash==='#en'?'Iseulon':'이슬온'),'실제 현재 도시는 유지');
 verifyDestinationCondition(currentRequestPaths.length===2&&currentRequestPaths[1]==='/v1/maps/world','의뢰와 월드맵 조회만 실행');
 render(null,document.getElementById('root')!);showDestinationCity('unpublished');await waitRenderCycle();await waitRenderCycle();
 verifyDestinationCondition(document.body.textContent?.includes(t('journal.destinationUnavailable')),'미공개 목적지 안내');
 verifyDestinationCondition(!document.querySelector('.world-map-node[aria-pressed="true"]'),'미공개 도시를 다른 도시로 대체하지 않음');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionLabels});
}catch(currentFailureError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailureError),assertions:currentAssertionLabels});}})();
