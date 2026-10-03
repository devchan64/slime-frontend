import {AutomaticBattlePatternPanel} from '../../src/ui/AutomaticBattlePatternPanel';
import {render} from 'preact';
import {useState} from 'preact/hooks';
import {BattlePanel} from '../../src/ui/BattlePanel';
import {t,setLocale} from '../../src/i18n';
const current_commands_sent=[];
const current_assertion_labels=[];
const verify_current_condition=(current_condition_result,current_assertion_label)=>{if(!current_condition_result)throw Error(current_assertion_label);current_assertion_labels.push(current_assertion_label);};
const wait_render_cycle=()=>new Promise(current_wait_resolver=>setTimeout(current_wait_resolver,80));
const click_matching_button=async(current_button_text)=>{
 const current_button_deadline=performance.now()+3000;
 let current_button_element;
 do{
  current_button_element=[...document.querySelectorAll('button')].find(current_button_entry=>current_button_entry.textContent.trim()===current_button_text);
  if(current_button_element&&!current_button_element.disabled)break;
  await wait_render_cycle();
 }while(performance.now()<current_button_deadline);
 verify_current_condition(current_button_element&&!current_button_element.disabled,'버튼 사용 가능: '+current_button_text);
 current_button_element.click();await wait_render_cycle();
};
const current_base_unit={attack:12,defense:4,speed:3,move:3,range:[1,1],guard:false,hp:10,maxHp:30,ap:16,maxAp:16};
let current_battle_state={id:'skill-ui',rulesVersion:'1.4.0',status:'ACTIVE',round:1,turnId:1,version:1,index:0,order:['me'],log:[],moved:false,acted:false,
 field:{columns:5,rows:5,cells:[],blocked:[]},tactics:{canAct:true,moves:[],attacks:[],skillActions:[
 {actionId:'healing_mend',skillId:'healing_magic',name:'상처 봉합',apCost:7,targets:[{targetId:'me',damage:0,healing:16},{targetId:'friend',damage:0,healing:12}]},
 {actionId:'fire_lance',skillId:'fire_magic',name:'화염 창',apCost:7,targets:[{targetId:'enemy',damage:32}]},
 {actionId:'hunting_draining_bite',skillId:'hunting',name:'포식의 일격',apCost:10,targets:[{targetId:'enemy',damage:22,drainHealing:5}]}]},
 units:[{...current_base_unit,id:'me',name:'시전자',side:'ally',position:{column:1,row:1}},{...current_base_unit,id:'friend',name:'부상 아군',side:'ally',hp:0,healthDepleted:false,position:{column:1,row:2}},{...current_base_unit,id:'enemy',name:'적 표적',side:'enemy',position:{column:2,row:1}}]};
const current_character_data={skills:{healing_magic:7,fire_magic:7,hunting:7},battleSkillLoadout:['healing_magic','fire_magic','hunting'],skillDefinitions:Object.fromEntries([['healing_magic','회복마법'],['fire_magic','화염마법'],['hunting','사냥기술']].map(([current_skill_identifier,current_skill_name])=>[current_skill_identifier,{id:current_skill_identifier,name:current_skill_name,description:current_skill_name}]))};
function CurrentReviewPanel(){const [selectedTargetPosition,setSelectedTargetPosition]=useState(null);return <BattlePanel me={current_character_data} battle={current_battle_state} actor="me" selected={selectedTargetPosition} disabled={false} select={setSelectedTargetPosition} execute={(...current_command_arguments)=>current_commands_sent.push(current_command_arguments)}/>;}
const refresh_review_panel=()=>render(<CurrentReviewPanel/>,document.getElementById('root'));
(async()=>{try{
 setLocale(location.hash==='#en'?'en':'ko');refresh_review_panel();await wait_render_cycle();
 await click_matching_button(t('battle.skills'));await click_matching_button('1. 회복마법 · Lv. 7');await click_matching_button('상처 봉합 · 7 AP');
 verify_current_condition(!document.querySelector('[aria-haspopup="dialog"].compact'),'다중 대상 자동 확정 없음');
 const current_healing_button=[...document.querySelectorAll('.attack-candidates button')].find(current_button_entry=>current_button_entry.textContent.includes('부상 아군'));
 verify_current_condition(!current_healing_button.disabled,'표시 HP 0인 소수 생존 아군 회복 선택 가능');
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
 current_battle_state={...current_battle_state,version:4,turnId:3,apRecoveryPolicyVersion:2,
  units:current_battle_state.units.map(currentUnitRecord=>currentUnitRecord.side==='ally'?{...currentUnitRecord,ap:0,maxAp:0}:currentUnitRecord),
  tactics:{canAct:true,moves:[],attacks:[],skillActions:[]}};
 refresh_review_panel();await wait_render_cycle();
 verify_current_condition(document.querySelector('.battle-action-points')?.textContent.includes('0 / 0'),'과중량 AP 0/0 표시');
 verify_current_condition(document.body.textContent.includes(t('battle.apRecovery',{count:0})),'최대 AP 0의 회복량 0 안내');
 for(const currentActionLabel of ['battle.move','battle.attack'])verify_current_condition([...document.querySelectorAll('button')].find(currentButtonElement=>currentButtonElement.textContent===t(currentActionLabel))?.disabled,'AP 0 행동 비활성: '+currentActionLabel);
 await click_matching_button(t('battle.endTurn'));
 verify_current_condition(document.querySelector('dialog[open]')?.textContent.includes(t('battle.guardEndDisabledDetail')),'AP 0 턴 종료 확인 가능');
 verify_current_condition([...document.querySelectorAll('dialog[open] button')].find(currentButtonElement=>currentButtonElement.textContent.includes(t('battle.guardEndTurn')))?.disabled,'AP 1 방어 종료 비활성');
 await click_matching_button(t('battle.cancel'));
 verify_current_condition(current_commands_sent.length===1,'과중량 확인 취소는 명령 미전송');
 const currentPatternCommands = [];
 const currentPatternCharacter = {...current_character_data,automaticPattern:undefined,skillDefinitions:{...current_character_data.skillDefinitions,healing_magic:{...current_character_data.skillDefinitions.healing_magic,actions:[{actionId:'healing_mend',name:'상처 봉합',requiredLevel:1}]}}};
 const renderPatternEditor = () => render(<AutomaticBattlePatternPanel currentCharacterState={currentPatternCharacter} currentActionsDisabled={false}
  submitPatternCommand={(currentCommandPath,currentCommandBody,currentSuccessHandler)=>{
   currentPatternCommands.push({path:currentCommandPath,body:currentCommandBody});
   currentPatternCharacter.automaticPattern=currentCommandBody.pattern??undefined;
   currentSuccessHandler(); renderPatternEditor();
  }}/>,document.getElementById('root'));
 render(null,document.getElementById('root'));renderPatternEditor();await wait_render_cycle();
 await click_matching_button(t('battle.patternAddRule'));
 const currentConditionSelect = document.querySelector('select');
 currentConditionSelect.value='SELF_HP';currentConditionSelect.dispatchEvent(new Event('change',{bubbles:true}));await wait_render_cycle();
 const currentThresholdInput = document.querySelector('input[type="number"]');
 currentThresholdInput.value='0';currentThresholdInput.dispatchEvent(new Event('input',{bubbles:true}));await wait_render_cycle();
 verify_current_condition([...document.querySelectorAll('button')].find(currentButtonEntry=>currentButtonEntry.textContent===t('battle.patternSave')).disabled,'범위 밖 HP 저장 차단');
 currentThresholdInput.value='50';currentThresholdInput.dispatchEvent(new Event('input',{bubbles:true}));await wait_render_cycle();
 const currentActionSelect = document.querySelectorAll('select')[1];
 currentActionSelect.value='SKILL';currentActionSelect.dispatchEvent(new Event('change',{bubbles:true}));await wait_render_cycle();
 verify_current_condition(document.querySelectorAll('select')[2].value==='healing_mend','습득·슬롯 스킬 액션 선택');
 await click_matching_button(t('battle.patternAddRule'));
 await click_matching_button(t('battle.patternMoveDown'));
 await click_matching_button(t('battle.patternSave'));
 verify_current_condition(currentPatternCommands[0].path==='/v1/characters/me/automatic-pattern','패턴 저장 API');
 verify_current_condition(currentPatternCommands[0].body.pattern.rules[1].condition==='SELF_HP'&&currentPatternCommands[0].body.pattern.rules[1].hpPercent===50,'HP 조건과 순서 저장');
 verify_current_condition(currentPatternCommands[0].body.pattern.rules[1].action==='SKILL'&&currentPatternCommands[0].body.pattern.rules[1].actionId==='healing_mend','선택한 스킬 액션 저장');
 verify_current_condition(currentPatternCommands[0].body.pattern.rules.at(-1).action==='END_TURN','마지막 종료 규칙 유지');
 await click_matching_button(t('battle.patternDelete'));
 verify_current_condition(currentPatternCommands[1].body.pattern===null,'패턴 삭제 계약');
 verify_current_condition(document.querySelectorAll('select').length===0,'삭제 후 고정 종료 규칙만 표시');
 verify_current_condition(document.documentElement.scrollWidth<=innerWidth,'패턴 편집기가 모바일 화면 안에 표시');
 document.body.dataset.result=JSON.stringify({status:'PASS' ,assertions:current_assertion_labels,commands:current_commands_sent});
}catch(current_failure_error){document.body.dataset.result=JSON.stringify({status:'FAIL',error:String(current_failure_error),stack:current_failure_error.stack,assertions:current_assertion_labels});}})();