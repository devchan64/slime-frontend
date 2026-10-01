import test from 'node:test';
import assert from 'node:assert/strict';
import {readPartyCreationIssue} from '../src/ui/partyCreationAccess.mjs';
function createGuildEntryState(){return {me:{mode:'FIELD',position:{column:2,row:3},citizenshipSummary:{records:[{cityId:'city',status:'VALID'}]}},map:{id:'city',buildings:[{facilityKind:'guild',entrance:{column:2,row:3}}]},battle:null,reservation:null};}
test('길드 출입구와 현지 시민권이 있어야 생성 메뉴를 활성화한다',()=>{
 assert.equal(readPartyCreationIssue(createGuildEntryState()),null);
 for(const currentInvalidState of [null,{...createGuildEntryState(),battle:{}},{...createGuildEntryState(),reservation:{}}])assert.equal(readPartyCreationIssue(currentInvalidState),'app.partyCreationFieldRequired');
 const currentGameState=createGuildEntryState();currentGameState.me.mode='LOBBY';
 assert.equal(readPartyCreationIssue(currentGameState),'app.partyCreationFieldRequired');
 currentGameState.me.mode='FIELD';currentGameState.me.position.column=1;
 assert.equal(readPartyCreationIssue(currentGameState),'app.partyCreationGuildRequired');
 currentGameState.me.position.column=2;currentGameState.map.buildings[0].facilityKind='workshop';
 assert.equal(readPartyCreationIssue(currentGameState),'app.partyCreationGuildRequired');
});
test('만료·다른 도시·누락된 시민권으로 생성 버튼을 열지 않는다',()=>{
 for(const currentCitizenshipRecords of [[],[{cityId:'city',status:'EXPIRED'}],[{cityId:'city',status:'PENDING'}],[{cityId:'other',status:'VALID'}]]){
  const currentGameState=createGuildEntryState();currentGameState.me.citizenshipSummary.records=currentCitizenshipRecords;
  assert.equal(readPartyCreationIssue(currentGameState),'app.partyCreationCitizenshipRequired');
 }
 const currentGameState=createGuildEntryState();delete currentGameState.me.citizenshipSummary;
 assert.equal(readPartyCreationIssue(currentGameState),'app.partyCreationCitizenshipRequired');
});
