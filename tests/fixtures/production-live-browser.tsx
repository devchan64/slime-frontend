import {render} from 'preact';
import {WorkshopPanel} from '../../src/ui/WorkshopPanel';
import {EquipmentPanel} from '../../src/ui/EquipmentPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentOriginalFetch=globalThis.fetch.bind(globalThis);
const currentCreatedRequests:any[]=[];
let currentQuotedCost=0;
let currentEquipmentVisible=false;
const waitProductionRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,100));
function assertProductionCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);}
function renderProductionPanel(){render(currentEquipmentVisible?<EquipmentPanel gameSessionClient={currentGameClient} actionsAreDisabled={false} characterStateVersion={currentGameClient.state!.me.version}/>:<WorkshopPanel gameSessionClient={currentGameClient} currentFacilityIdentifier="iseulon-workshop" actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function waitProductionText(currentExpectedText:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(document.body.textContent!.includes(currentExpectedText))return;await waitProductionRender();}
 throw new Error('화면 대기 시간 초과: '+currentExpectedText+' '+document.body.textContent);
}
async function clickProductionButton(currentLocaleKey:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){
  const currentButton=[...document.querySelectorAll('button')].find(currentElement=>currentElement.textContent===t(currentLocaleKey)&&!currentElement.disabled);
  if(currentButton){currentButton.click();await waitProductionRender();return;}
  await waitProductionRender();
 }
 throw new Error('버튼 대기 시간 초과: '+currentLocaleKey+' '+document.body.textContent);
}
(async()=>{try{
 const currentContext=await (await currentOriginalFetch('/test-context')).json();setLocale('ko');currentGameClient.tokens=currentContext.tokens;
 currentGameClient.onState=renderProductionPanel;
 globalThis.fetch=async(currentInput,currentOptions)=>{
  const currentResponse=await currentOriginalFetch(currentInput,currentOptions);
  const currentPath=String(currentInput);
  if(currentPath.endsWith('/production-quote')&&currentResponse.ok)currentQuotedCost=(await currentResponse.clone().json()).quote.costP;
  if(currentPath.endsWith('/contracts')&&currentOptions?.method==='POST'){
   assertProductionCondition(currentResponse.ok,'실제 제작 생성 성공');
   currentCreatedRequests.push(JSON.parse(String(currentOptions.body)));
   if(currentCreatedRequests.length===1)throw new TypeError('제작 성공 응답 유실 검사');
  }
  return currentResponse;
 };
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 const currentInitialVersion=currentGameClient.state!.me.version,currentInitialCoins=currentGameClient.state!.me.coins;
 await waitProductionRender();await clickProductionButton('workshop.title');await waitProductionText('가죽 조끼');
 const currentItemSelect=document.querySelector('select')!;currentItemSelect.value='leather-vest';currentItemSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitProductionRender();
 const currentMaterialInputs=[...document.querySelectorAll<HTMLInputElement>('fieldset input')];
 assertProductionCondition(currentMaterialInputs.length===3,'등록된 가죽 3개 등급 표시');
 for(const currentInputIndex of [0,1]){currentMaterialInputs[currentInputIndex].value='2';currentMaterialInputs[currentInputIndex].dispatchEvent(new Event('input',{bubbles:true}));await waitProductionRender();}
 await clickProductionButton('workshop.quote');await waitProductionText('Lv.2');
 await clickProductionButton('workshop.confirm');await waitProductionText(t('workshop.uncertain'));
 assertProductionCondition(currentGameClient.state!.me.version===currentInitialVersion,'유실 직후 추정 상태 반영 없음');
 await clickProductionButton('workshop.confirm');await waitProductionText(t('workshop.inprogress'));
 assertProductionCondition(currentCreatedRequests.length===1,'저장 영수증으로 복구하고 제작 재전송 없음');
 assertProductionCondition(currentGameClient.state!.me.coins===currentInitialCoins-currentQuotedCost,'제작 비용 단일 차감');
 assertProductionCondition(Object.keys(currentGameClient.state!.me.refinedMaterials).length===0,'혼합 가죽 단일 소비');
 const currentCompletionResponse=await currentOriginalFetch('/test-complete-contract',{method:'POST'});assertProductionCondition(currentCompletionResponse.ok,'테스트 계약 완료 준비');
 await clickProductionButton('journal.refresh');await clickProductionButton('workshop.claim');await waitProductionText(t('workshop.claimed'));
 assertProductionCondition(currentGameClient.state!.me.version===currentInitialVersion+2,'제작과 수령 각각 한 번 처리');
 currentEquipmentVisible=true;renderProductionPanel();await waitProductionText('소지 장비 무게');
 const currentBodySlot=[...document.querySelectorAll<HTMLButtonElement>('.equipment-slots button')].find(currentButton=>currentButton.querySelector('strong')?.textContent==='몸통');
 assertProductionCondition(currentBodySlot,'몸통 슬롯 표시');currentBodySlot!.click();await waitProductionText('가죽 조끼 · Lv.2');
 setLocale('en');await waitProductionRender();await waitProductionText('Leather Vest · Lv.2');
 const currentInventory=await currentGameClient.request('/v1/game/equipment');
 assertProductionCondition(currentInventory.items.length===1&&currentInventory.items[0].itemLevel===2&&currentInventory.items[0].statBonus.defenseFlat===2&&currentInventory.items[0].maxDurability===72,'실제 레벨 2 성능 개체 한 개');
 await currentOriginalFetch('/test-result',{method:'POST',body:'PASS: 실제 혼합 제작 GUI·서버 견적·응답 복구·단일 소비·수령·장비 레벨 표시'});
}catch(currentError){await currentOriginalFetch('/test-result',{method:'POST',body:'FAIL: '+String(currentError)});}})();
