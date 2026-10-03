import {render} from 'preact';
import {WorkshopPanel} from '../../src/ui/WorkshopPanel';
import {BagPanel} from '../../src/ui/BagPanel';
import {EquipmentPanel} from '../../src/ui/EquipmentPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentOriginalFetch=globalThis.fetch.bind(globalThis);
const currentCreatedRequests:any[]=[];
let currentQuotedCost=0;
let currentEquipmentVisible=false;
let currentBagVisible=false;
const waitProductionRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,100));
function assertProductionCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);}
function renderProductionPanel(){render(currentBagVisible?<BagPanel me={currentGameClient.state!.me} gameSessionClient={currentGameClient} actionsAreDisabled={false} submitConsumableUse={currentItemIdentifier=>currentGameClient.command('/v1/game/consumables/use',{itemId:currentItemIdentifier})}/>:currentEquipmentVisible?<EquipmentPanel gameSessionClient={currentGameClient} actionsAreDisabled={false} characterStateVersion={currentGameClient.state!.me.version}/>:<WorkshopPanel gameSessionClient={currentGameClient} currentFacilityIdentifier="iseulon-workshop" actionsAreDisabled={false}/>,document.getElementById('root')!);}
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
   if(currentCreatedRequests.length===1||currentCreatedRequests.at(-1).kind==='material')throw new TypeError('제작 성공 응답 유실 검사');
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
 setLocale('ko');currentEquipmentVisible=false;renderProductionPanel();await waitProductionRender();
 await clickProductionButton('workshop.title');await clickProductionButton('workshop.consumable');await waitProductionText('젤 곡물식');
 const currentFoodSelect=document.querySelector('select')!;currentFoodSelect.value='gel-ration';currentFoodSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitProductionRender();
 assertProductionCondition(document.querySelectorAll('fieldset').length===2,'실제 소모품 두 슬롯 표시');
 const currentBeforeFoodCoins=currentGameClient.state!.me.coins;
 await clickProductionButton('workshop.quote');await waitProductionText('Lv.1');
 await clickProductionButton('workshop.confirm');await waitProductionText(t('workshop.inprogress'));
 assertProductionCondition(currentGameClient.state!.me.coins===currentBeforeFoodCoins-currentQuotedCost,'소모품 비용 단일 차감');
 const currentFoodCompletion=await currentOriginalFetch('/test-complete-consumable',{method:'POST'});assertProductionCondition(currentFoodCompletion.ok,'테스트 소모품 완료 준비');
 await clickProductionButton('journal.refresh');await clickProductionButton('workshop.claim');await waitProductionText(t('workshop.claimed'));
 currentBagVisible=true;renderProductionPanel();await waitProductionText('젤 곡물식 · Lv.1');
 const currentBeforeFoodHealth=currentGameClient.state!.me.hp!;
 const currentFoodUseButton=[...document.querySelectorAll<HTMLButtonElement>('button')].find(currentButton=>currentButton.textContent?.includes('HP')&&currentButton.textContent.includes('3'));
 assertProductionCondition(currentFoodUseButton&&!currentFoodUseButton.disabled,'생산 회복 사용 버튼 활성');currentFoodUseButton!.click();
 const currentFoodUseDeadline=performance.now()+10000;
 while(currentGameClient.state!.me.hp===currentBeforeFoodHealth&&performance.now()<currentFoodUseDeadline)await waitProductionRender();
 assertProductionCondition(currentGameClient.state!.me.hp===currentBeforeFoodHealth+3,'실제 생산 회복량 적용');
 await waitProductionRender();assertProductionCondition(!document.body.textContent!.includes('젤 곡물식 · Lv.1'),'소진한 배치 가방에서 제거');
 currentBagVisible=false;renderProductionPanel();await waitProductionRender();
 await clickProductionButton('workshop.title');await clickProductionButton('workshop.material');await waitProductionText('표준 가죽끈');
 const currentMaterialSelect=document.querySelector('select')!;currentMaterialSelect.value='leather-cord';currentMaterialSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitProductionRender();
 const currentMaterialQuantity=document.querySelector<HTMLInputElement>('input[max="1000"]')!;currentMaterialQuantity.value='4';currentMaterialQuantity.dispatchEvent(new Event('input',{bubbles:true}));await waitProductionRender();
 const currentBatchInputs=[...document.querySelectorAll<HTMLInputElement>('fieldset input')];
 for(const [currentInputIndex,currentInputQuantity] of [[0,3],[1,1]]){currentBatchInputs[currentInputIndex].value=String(currentInputQuantity);currentBatchInputs[currentInputIndex].dispatchEvent(new Event('input',{bubbles:true}));await waitProductionRender();}
 const currentBeforeMaterialCoins=currentGameClient.state!.me.coins;
 await clickProductionButton('workshop.quote');await waitProductionText('Lv.1');
 await clickProductionButton('workshop.confirm');await waitProductionText(t('workshop.uncertain'));
 await clickProductionButton('workshop.confirm');await waitProductionText(t('workshop.inprogress'));
 assertProductionCondition(currentCreatedRequests.filter(currentRequestEntry=>currentRequestEntry.kind==='material').length===1,'중간재 원장 조회 복구로 중복 생성 방지');
 assertProductionCondition(currentGameClient.state!.me.coins===currentBeforeMaterialCoins-currentQuotedCost,'중간재 비용 한 번 차감');
 const currentMaterialCompletion=await currentOriginalFetch('/test-complete-material',{method:'POST'});assertProductionCondition(currentMaterialCompletion.ok,'테스트 중간재 완료 준비');
 await clickProductionButton('journal.refresh');await clickProductionButton('workshop.claim');await waitProductionText(t('workshop.claimed'));
 currentBagVisible=true;renderProductionPanel();await waitProductionText('표준 가죽끈 · Lv.1');
 const currentMaterialInventory=await currentGameClient.request('/v1/game/equipment');
 const currentMaterialEntry=currentMaterialInventory.bag.items.find((currentItemEntry:any)=>currentItemEntry.definitionId==='leather-cord');
 assertProductionCondition(currentMaterialEntry?.quantity===4&&currentMaterialEntry.itemLevel===1&&!currentMaterialEntry.useAction,'중간재 4개와 레벨 표시·직접 사용 없음');
 currentBagVisible=false;renderProductionPanel();await waitProductionRender();
 await clickProductionButton('workshop.title');await waitProductionText('목제 원방패');
 const currentShieldSelect=document.querySelector('select')!;currentShieldSelect.value='round-shield';currentShieldSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitProductionRender();
 const currentShieldBatchInput=document.querySelectorAll('fieldset')[1].querySelector('input')!;
 currentShieldBatchInput.value='1';currentShieldBatchInput.dispatchEvent(new Event('input',{bubbles:true}));await waitProductionRender();
 const currentBeforeShieldCoins=currentGameClient.state!.me.coins;
 await clickProductionButton('workshop.quote');await waitProductionText('Lv.1');
 await clickProductionButton('workshop.confirm');await waitProductionText(t('workshop.inprogress'));
 assertProductionCondition(currentCreatedRequests.at(-1).batchInputs[0].batchId===currentMaterialEntry.batchId,'방금 수령한 중간재 배치로 장비 제작');
 assertProductionCondition(currentGameClient.state!.me.coins===currentBeforeShieldCoins-currentQuotedCost,'장비 제작비와 부족 목재 대금 단일 차감');
 const currentShieldCompletion=await currentOriginalFetch('/test-complete-contract',{method:'POST'});assertProductionCondition(currentShieldCompletion.ok,'테스트 장비 완료 준비');
 await clickProductionButton('journal.refresh');await clickProductionButton('workshop.claim');await waitProductionText(t('workshop.claimed'));
 const currentFinalInventory=await currentGameClient.request('/v1/game/equipment');
 const currentFinalShield=currentFinalInventory.items.find((currentItemEntry:any)=>currentItemEntry.definitionId==='round-shield');
 assertProductionCondition(currentFinalShield?.definitionVersion===3&&currentFinalShield.itemLevel===1,'전환 레시피 완제품 수령');
 assertProductionCondition(currentFinalInventory.bag.items.find((currentItemEntry:any)=>currentItemEntry.batchId===currentMaterialEntry.batchId)?.quantity===3,'중간재 배치 4개 중 1개만 소비');
 for(const [currentProductIdentifier,currentRequestedQuantity] of [['clean-bandage',2],['cooling-wrap',1]] as const){
  await clickProductionButton('workshop.consumable');
  const currentClothSelect=document.querySelector('select')!;currentClothSelect.value=currentProductIdentifier;currentClothSelect.dispatchEvent(new Event('change',{bubbles:true}));await waitProductionRender();
  const currentClothQuantity=document.querySelector<HTMLInputElement>('input[max="1000"]')!;currentClothQuantity.value=String(currentRequestedQuantity);currentClothQuantity.dispatchEvent(new Event('input',{bubbles:true}));await waitProductionRender();
  const currentClothInputs=[...document.querySelectorAll<HTMLInputElement>('fieldset input')];
  assertProductionCondition(currentClothInputs.length===2,'정제수와 보유 직물 배치만 선택');
  currentClothInputs[0].value='2';currentClothInputs[0].dispatchEvent(new Event('input',{bubbles:true}));await waitProductionRender();
  currentClothInputs[1].value=String(currentRequestedQuantity);currentClothInputs[1].dispatchEvent(new Event('input',{bubbles:true}));await waitProductionRender();
  await clickProductionButton('workshop.quote');await waitProductionText('Lv.2');
  assertProductionCondition(currentQuotedCost===(currentProductIdentifier==='clean-bandage'?currentRequestedQuantity:2),'기존 제작료 유지');
  await clickProductionButton('workshop.confirm');await waitProductionText(t('workshop.inprogress'));
  assertProductionCondition(currentCreatedRequests.at(-1).batchInputs[0].quantity===currentRequestedQuantity,'주문량에 비례한 직물 선택');
  const currentClothCompletion=await currentOriginalFetch('/test-complete-consumable',{method:'POST'});assertProductionCondition(currentClothCompletion.ok,'직물 소모품 완료 준비');
  await clickProductionButton('journal.refresh');await clickProductionButton('workshop.claim');await waitProductionText(t('workshop.claimed'));
  const currentClothInventory=await currentGameClient.request('/v1/game/equipment');
  const currentClothProduct=currentClothInventory.bag.items.find((currentItemEntry:any)=>currentItemEntry.definitionId===currentProductIdentifier);
  assertProductionCondition(currentClothProduct?.quantity===currentRequestedQuantity&&currentClothProduct.itemLevel===2,'직물 품질을 보존한 소모품 수령');
 }
 await currentOriginalFetch('/test-result',{method:'POST',body:'PASS: 실제 중간재 생산·수령→장비 배치 선택·제작·수령과 기존 제작 여정'});
}catch(currentError){await currentOriginalFetch('/test-result',{method:'POST',body:'FAIL: '+String(currentError)});}})();
