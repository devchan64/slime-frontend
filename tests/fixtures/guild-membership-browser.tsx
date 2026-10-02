import {render} from 'preact';
import {CharacterSettings} from '../../src/ui/CharacterSettings';
import {setLocale,t} from '../../src/i18n';
import type {State} from '../../src/client/types';
const currentAssertionsList:string[]=[];
function assertMembershipCondition(currentCondition:unknown,currentDescription:string){
 if(!currentCondition)throw new Error(currentDescription);
 currentAssertionsList.push(currentDescription);
}
const currentCharacterRecord={id:'hero',name:'모험가',mode:'LOBBY',coins:27,cp:10,sp:0,
 attributes:{body:1,intelligence:1,spirit:1},skills:{physical_activity:1,literacy:1,speaking:1},
 citizenshipSummary:{records:[]},guildMembership:{guildId:'adventurers-guild',characterId:'hero',certificateStatus:'ISSUED'}} as unknown as State['me'];
const currentWaitRender=()=>new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,80));
async function renderMembershipCharacter(){
 render(<CharacterSettings me={currentCharacterRecord} disabled={false} expanded command={()=>{throw new Error('표시 검사 중 명령 실행');}}/>,document.getElementById('root')!);
 await currentWaitRender();
}
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');
 await renderMembershipCharacter();
 assertMembershipCondition(document.body.textContent!.includes(t('character.guildMembership')),'기본 길드 소속 표시');
 assertMembershipCondition(document.body.textContent!.includes(t('character.guildCertificateIssued')),'기발급 자격증 표시');
 assertMembershipCondition(document.body.textContent!.includes('27P'),'폰 잔액 P 단위 표시');
 assertMembershipCondition(document.body.textContent!.includes(t('character.coins')),'폰 잔액 이름 표시');
 assertMembershipCondition(document.body.textContent!.includes(t('citizenship.empty')),'시민권 미보유와 길드 소속 구분');
 delete currentCharacterRecord.guildMembership;
 await renderMembershipCharacter();
 assertMembershipCondition(!document.body.textContent!.includes(t('character.guildCertificateIssued')),'구형 응답에서 자격증 상태 추측 금지');
 assertMembershipCondition(document.body.textContent!.includes('27P'),'구형 응답 폰 잔액 유지');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:currentAssertionsList});
}catch(currentError){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(currentError),assertions:currentAssertionsList});}})();
