import {render} from 'preact';
import {CostumeInventoryPanel} from '../../src/ui/CostumeInventoryPanel';
import {Client} from '../../src/client/api';
import {t,setLocale} from '../../src/i18n';
const currentGameClient=new Client();
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
const currentOriginalFetch=window.fetch.bind(window);
const currentRecordedPurchases:string[]=[];

let currentResponseDiscarded=false;
function assertBrowserCondition(currentCondition:unknown,currentMessage:string){if(!currentCondition)throw new Error(currentMessage);}
function renderCostumeInventoryPanel(){render(<CostumeInventoryPanel gameSessionClient={currentGameClient} actionsAreDisabled={false}/>,document.getElementById('root')!);}
async function waitCostumeCondition(currentPredicate:()=>boolean,currentDescription:string){
 const currentDeadlineTime=performance.now()+10000;
 while(performance.now()<currentDeadlineTime){if(currentPredicate())return;await currentWaitRender();}
 throw new Error(currentDescription+' '+document.body.textContent);
}
async function clickCostumeButton(currentTranslationKey:string){
 await waitCostumeCondition(()=>[...document.querySelectorAll('button')].some(currentButton=>currentButton.textContent===t(currentTranslationKey)&&!currentButton.disabled),'버튼 대기 '+currentTranslationKey);
 [...document.querySelectorAll('button')].find(currentButton=>currentButton.textContent===t(currentTranslationKey))!.click();
 await currentWaitRender();
}
window.fetch=async(currentInput,currentOptions)=>{
 const currentResponse=await currentOriginalFetch(currentInput,currentOptions);
 if(String(currentInput).endsWith('/v1/characters/me/costume')){
  currentRecordedPurchases.push(String(currentOptions?.body));
  if(currentResponse.ok&&!currentResponseDiscarded){currentResponseDiscarded=true;await currentResponse.arrayBuffer();throw new TypeError('실제 착용 응답 유실 검사');}
 }
 return currentResponse;
};
(async()=>{try{
 const currentTestContext=await (await fetch('/test-context')).json();
 setLocale('ko');currentGameClient.tokens=currentTestContext.tokens;
 currentGameClient.onState=()=>renderCostumeInventoryPanel();
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 const currentOriginalVersion=currentGameClient.state!.me.version;
 await currentWaitRender();await currentWaitRender();
 await clickCostumeButton('wardrobe.refresh');
 await waitCostumeCondition(()=>document.body.textContent!.includes(t('wardrobe.empty')),'기본 디자인과 빈 소유 목록 표시');
 await clickCostumeButton('wardrobe.default');
 await waitCostumeCondition(()=>document.body.textContent!.includes(t('wardrobe.uncertain')),'응답 유실 후 미확정 안내');
 await clickCostumeButton('wardrobe.retry');
 await waitCostumeCondition(()=>document.body.textContent!.includes(t('wardrobe.equipped')),'실제 착용 완료 표시');
 assertBrowserCondition(currentRecordedPurchases.length===2&&currentRecordedPurchases[0]===currentRecordedPurchases[1],'동일 요청으로 재시도');
 currentGameClient.accept(await currentGameClient.request('/v1/game/state'));
 assertBrowserCondition(currentGameClient.state!.me.coins===10,'착용으로 잔고 불변');
 assertBrowserCondition(currentGameClient.state!.me.costumeAppearance?.designId==='default'&&currentGameClient.state!.me.costumeAppearance?.designVersion===1,'실제 착용 디자인 반영');
 assertBrowserCondition(currentGameClient.state!.me.version===currentOriginalVersion+1,'캐릭터 버전 단일 증가');
 await clickCostumeButton('wardrobe.refresh');
 await waitCostumeCondition(()=>document.body.textContent!.includes(t('wardrobe.empty')),'착용 후 획득 목록 불변');
 await fetch('/test-result',{method:'POST',body:'PASS: 실제 GUI 코스튬 착용·응답 유실·동일 요청 재시도·단일 변경'});
}catch(currentError){await fetch('/test-result',{method:'POST',body:'FAIL: '+String(currentError)});}})();
