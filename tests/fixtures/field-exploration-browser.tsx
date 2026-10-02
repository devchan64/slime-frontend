import {render} from 'preact';
import {FieldExploration} from '../../src/ui/FieldExploration';
import {setLocale,t} from '../../src/i18n';
const currentRootElement=document.getElementById('root')!;
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,120));
const currentAssertions:string[]=[];
function assertExplorationBrowser(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);currentAssertions.push(currentMessage);}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 const currentGameState:any={generation:1,epoch:1,map:{id:'meadow'},location:{id:'map:meadow'},me:{id:'hero',mode:'FIELD',fp:10,position:{column:6,row:3},skills:{literacy:2},exploration:{fpCost:2,literacyRequired:2,options:{mineral:{skillId:'mineral_exploration',range:2,successPercent:50},treasure:{skillId:'treasure_exploration',range:0,successPercent:0}}}}};
 const currentGameClient:any={state:currentGameState};
 let currentCommandCount=0;
 const submitExplorationCommand=async(currentCommandPath:string,currentCommandBody:any,currentResultHandler:(currentResult:any)=>void)=>{
  assertExplorationBrowser(currentCommandPath==='/v1/game/skills/explore','탐색 API');
  assertExplorationBrowser(currentCommandBody.resourceKind==='mineral'&&currentCommandBody.position.column===6,'종류·좌표');
  currentCommandCount++;
  currentResultHandler({exploration:{mapId:'meadow',resourceKind:'mineral',position:{column:6,row:3},succeeded:true,fpCost:2,nextAttemptAt:86401,reward:{kind:'material',itemId:'iron-ore',quantity:1}}});
 };
 const renderExplorationPanel=()=>render(<FieldExploration currentGameState={currentGameState} currentTargetPosition={{column:6,row:3}} currentGameClient={currentGameClient} currentActionsDisabled={false} submitExplorationCommand={submitExplorationCommand}/>,currentRootElement);
 renderExplorationPanel();await currentWaitRender();
 const currentButtons=[...document.querySelectorAll('button')];
 assertExplorationBrowser(!currentButtons[0].disabled&&currentButtons[1].disabled,'미습득 종류 차단');
 assertExplorationBrowser(document.body.textContent!.includes(t('field.exploreHelp',{cost:2})),'비용 안내');
 currentButtons[0].click();await currentWaitRender();
 assertExplorationBrowser(currentCommandCount===1,'단일 명령');
 assertExplorationBrowser(document.body.textContent!.includes(t('field.exploreSuccess')),'보상 수집 안내');
 currentGameState.me.fp=1;renderExplorationPanel();await currentWaitRender();
 assertExplorationBrowser([...document.querySelectorAll('button')].every(currentButton=>currentButton.disabled),'FP 부족 차단');
 currentGameState.me.fp=10;currentGameState.reservation={id:'encounter'};renderExplorationPanel();await currentWaitRender();
 assertExplorationBrowser([...document.querySelectorAll('button')].every(currentButton=>currentButton.disabled),'조우 중 차단');
 assertExplorationBrowser(document.documentElement.scrollWidth<=window.innerWidth,'모바일 폭');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertions});
}catch(currentFailure){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentFailure),assertions:currentAssertions});}})();
