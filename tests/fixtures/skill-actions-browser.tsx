import {render} from 'preact';
import {useState} from 'preact/hooks';
import {BattlePanel} from '../../src/ui/BattlePanel';
import {t,setLocale} from '../../src/i18n';
const current_commands_sent=[];
const current_assertion_labels=[];
const verify_current_condition=(current_condition_result,current_assertion_label)=>{if(!current_condition_result)throw Error(current_assertion_label);current_assertion_labels.push(current_assertion_label);};
const wait_render_cycle=()=>new Promise(current_wait_resolver=>setTimeout(current_wait_resolver,80));
const click_matching_button=async(current_button_text)=>{const current_button_element=[...document.querySelectorAll('button')].find(current_button_entry=>current_button_entry.textContent.trim()===current_button_text);verify_current_condition(current_button_element&&!current_button_element.disabled,'버튼 사용 가능: '+current_button_text);current_button_element.click();await wait_render_cycle();};
const current_base_unit={attack:12,defense:4,speed:3,move:3,range:[1,1],guard:false,hp:10,maxHp:30,ap:16,maxAp:16};
let current_battle_state={id:'skill-ui',rulesVersion:'1.4.0',status:'ACTIVE',round:1,turnId:1,version:1,index:0,order:['me'],log:[],moved:false,acted:false,
 field:{columns:5,rows:5,cells:[],blocked:[]},tactics:{canAct:true,moves:[],attacks:[],skillActions:[
 {actionId:'healing_mend',skillId:'healing_magic',name:'상처 봉합',apCost:7,targets:[{targetId:'me',damage:0,healing:16},{targetId:'friend',damage:0,healing:12}]},
 {actionId:'fire_lance',skillId:'fire_magic',name:'화염 창',apCost:7,targets:[{targetId:'enemy',damage:32}]},
 {actionId:'hunting_draining_bite',skillId:'hunting',name:'포식의 일격',apCost:10,targets:[{targetId:'enemy',damage:22,drainHealing:5}]}]},
 units:[{...current_base_unit,id:'me',name:'시전자',side:'ally',position:{column:1,row:1}},{...current_base_unit,id:'friend',name:'부상 아군',side:'ally',position:{column:1,row:2}},{...current_base_unit,id:'enemy',name:'적 표적',side:'enemy',position:{column:2,row:1}}]};
const current_character_data={skills:{healing_magic:7,fire_magic:7,hunting:7},battleSkillLoadout:['healing_magic','fire_magic','hunting'],skillDefinitions:Object.fromEntries([['healing_magic','회복마법'],['fire_magic','화염마법'],['hunting','사냥기술']].map(([current_skill_identifier,current_skill_name])=>[current_skill_identifier,{id:current_skill_identifier,name:current_skill_name,description:current_skill_name}]))};
function CurrentReviewPanel(){const [selectedTargetPosition,setSelectedTargetPosition]=useState(null);return <BattlePanel me={current_character_data} battle={current_battle_state} actor="me" selected={selectedTargetPosition} disabled={false} select={setSelectedTargetPosition} execute={(...current_command_arguments)=>current_commands_sent.push(current_command_arguments)}/>;}
const refresh_review_panel=()=>render(<CurrentReviewPanel/>,document.getElementById('root'));
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');refresh_review_panel();await wait_render_cycle();
 await click_matching_button(t('battle.skills'));await click_matching_button('1. 회복마법 · Lv. 7');await click_matching_button('상처 봉합 · 7 AP');
 verify_current_condition(!document.querySelector('[aria-haspopup="dialog"].compact'),'다중 대상 자동 확정 없음');
 const current_healing_button=[...document.querySelectorAll('.attack-candidates button')].find(current_button_entry=>current_button_entry.textContent.includes('부상 아군'));
 verify_current_condition(current_healing_button.textContent.includes(t('battle.expectedHealing',{healing:12})),'회복 예상값 표시');current_healing_button.click();await wait_render_cycle();
 verify_current_condition(current_commands_sent.length===0,'대상 선택만으로 전송하지 않음');await click_matching_button(t('battle.useSkillAction'));
 verify_current_condition(document.querySelector('dialog[open]')?.textContent.includes(t('battle.expectedHealing',{healing:12})),'회복 확인창');
 const current_dialog_bounds=document.querySelector('dialog[open]').getBoundingClientRect();
 verify_current_condition(current_dialog_bounds.left>=0&&current_dialog_bounds.right<=innerWidth,'확인창이 화면 폭 안에 표시');
 await click_matching_button(t('battle.confirm'));verify_current_condition(JSON.stringify(current_commands_sent[0])===JSON.stringify(['SKILL','friend','healing_mend']),'회복 명령 계약');
 await click_matching_button('2. 화염마법 · Lv. 7');await click_matching_button('화염 창 · 7 AP');
 verify_current_condition(document.querySelector('.attack-candidates button[aria-pressed="true"]')?.textContent.includes('적 표적'),'단일 공격 대상 자동 선택');
 await click_matching_button(t('battle.useSkillAction'));verify_current_condition(document.querySelector('dialog[open]')?.textContent.includes(t('battle.expectedDamage',{damage:32})),'공격 예상값 확인');
 await click_matching_button(t('battle.cancel'));verify_current_condition(current_commands_sent.length===1,'취소 시 미전송');
 await click_matching_button('3. 사냥기술 · Lv. 7');await click_matching_button('포식의 일격 · 10 AP');await click_matching_button(t('battle.useSkillAction'));
 verify_current_condition(document.querySelector('dialog[open]')?.textContent.includes(t('battle.expectedDrain',{healing:5})),'포식 회복 확인');
 current_battle_state={...current_battle_state,version:2,turnId:2};refresh_review_panel();await wait_render_cycle();
 verify_current_condition(!document.querySelector('dialog[open]'),'턴 갱신 후 확인창 제거');
 current_battle_state={...current_battle_state,version:3,tactics:{...current_battle_state.tactics,skillActions:current_battle_state.tactics.skillActions.map(current_action_entry=>({...current_action_entry,targets:[]}))}};refresh_review_panel();await wait_render_cycle();
 await click_matching_button(t('battle.skills'));await click_matching_button('1. 회복마법 · Lv. 7');
 verify_current_condition([...document.querySelectorAll('button')].find(current_button_entry=>current_button_entry.textContent==='상처 봉합 · 7 AP')?.disabled,'대상 없는 액션 비활성');
 verify_current_condition(document.body.textContent.includes(t('battle.skillUnavailable')),'불가 사유 표시');
 document.body.dataset.result=JSON.stringify({status:'PASS',assertions:current_assertion_labels,commands:current_commands_sent});
}catch(current_failure_error){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(current_failure_error),stack:current_failure_error.stack,assertions:current_assertion_labels});}})();