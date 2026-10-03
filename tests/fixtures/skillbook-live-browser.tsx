import {render} from 'preact';
import {SkillCardPanel} from '../../src/ui/SkillCardPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentOriginalFetch=window.fetch.bind(window);
const currentPurchaseRequests:string[]=[];
const currentUsageRequests:string[]=[];
const currentRenderPause=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
let currentBookshopVisible=true;
function assertBrowserCondition(currentConditionValue:unknown,currentMessageText:string){if(!currentConditionValue)throw new Error(currentMessageText);}
function renderSkillCardPanel(){render(<SkillCardPanel gameSessionClient={currentGameClient} currentFacilityIdentifier={currentBookshopVisible?'iseulon-bookshop':undefined} actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function waitBrowserCondition(currentPredicateCheck:()=>boolean,currentMessageText:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(currentPredicateCheck())return;await currentRenderPause();}
 throw new Error(currentMessageText+' '+document.body.textContent);
}
async function clickSkillCardButton(currentButtonText:string,currentTargetSelector='button'){
 await waitBrowserCondition(()=>[...document.querySelectorAll<HTMLButtonElement>(currentTargetSelector)].some(currentButtonEntry=>currentButtonEntry.textContent===currentButtonText&&!currentButtonEntry.disabled),'카드 버튼 대기 '+currentButtonText);
 [...document.querySelectorAll<HTMLButtonElement>(currentTargetSelector)].find(currentButtonEntry=>currentButtonEntry.textContent===currentButtonText&&!currentButtonEntry.disabled)!.click();
 await currentRenderPause();
}
window.fetch=async(currentRequestInput,currentRequestOptions)=>{
 const currentResponseValue=await currentOriginalFetch(currentRequestInput,currentRequestOptions);
 const currentRequestPath=String(currentRequestInput);
 if(currentRequestOptions?.method==='POST'&&(currentRequestPath.endsWith('/skill-card-purchases')||currentRequestPath.endsWith('/use'))){
  const currentRecordedRequests=currentRequestPath.endsWith('/skill-card-purchases')?currentPurchaseRequests:currentUsageRequests;
  currentRecordedRequests.push(String(currentRequestOptions.body));
  if(currentRecordedRequests.length===1&&currentResponseValue.ok){await currentResponseValue.arrayBuffer();throw new TypeError('실제 카드 완료 응답 유실');}
 }
 return currentResponseValue;
};
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();
 setLocale('ko');currentGameClient.tokens=currentTestContext.tokens;
 currentGameClient.onState=renderSkillCardPanel;
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 const currentOriginalVersion=currentGameClient.state!.me.version;
 await waitBrowserCondition(()=>[...document.querySelectorAll('li')].some(currentCardRow=>currentCardRow.textContent?.includes('몬스터 해부 스킬카드')),'몬스터 해부 카드 목록');
 const currentDissectionRow=[...document.querySelectorAll('li')].find(currentCardRow=>currentCardRow.textContent?.includes('몬스터 해부 스킬카드'))!;
 (currentDissectionRow.querySelector('button') as HTMLButtonElement).click();
 await waitBrowserCondition(()=>currentPurchaseRequests.length===1&&document.body.textContent!.includes('실제 카드 완료 응답 유실'),'구매 응답 유실 표시');
 await clickSkillCardButton(t('cards.retry'));
 await waitBrowserCondition(()=>document.body.textContent!.includes(t('cards.purchased')),'구매 완료 표시');
 assertBrowserCondition(!('monster_dissection' in currentGameClient.state!.me.skills),'구매만으로 습득하지 않음');
 render(null,document.getElementById('root')!);currentBookshopVisible=false;renderSkillCardPanel();
 await clickSkillCardButton(t('cards.use'));
 await clickSkillCardButton(t('cards.confirmUse'));
 await waitBrowserCondition(()=>currentUsageRequests.length===1&&document.body.textContent!.includes('실제 카드 완료 응답 유실'),'사용 응답 유실 표시');
 await clickSkillCardButton(t('cards.retry'));
 await waitBrowserCondition(()=>document.body.textContent!.includes(t('cards.used'))&&document.body.textContent!.includes(t('cards.empty')),'사용 완료 및 빈 보관함');
 assertBrowserCondition(currentPurchaseRequests.length===2&&currentPurchaseRequests[0]===currentPurchaseRequests[1],'구매 원본 요청 유지');
 assertBrowserCondition(currentUsageRequests.length===2&&currentUsageRequests[0]===currentUsageRequests[1],'사용 원본 요청 유지');
 assertBrowserCondition(Object.keys(JSON.parse(currentUsageRequests[0])).sort().join(',')==='expectedVersion,requestId','사용 요청 계약');
 assertBrowserCondition(currentGameClient.state!.me.version===currentOriginalVersion+3,'최초 이관·구매·사용 단일 반영');
 assertBrowserCondition(currentGameClient.state!.me.coins===400&&currentGameClient.state!.me.skills.monster_dissection===0,'100 P 단일 결제와 레벨 0 습득');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 GUI 카드 구매·사용 응답 유실 복구와 보관함 소비 검증'});
}catch(currentTestError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentTestError)});}})();
