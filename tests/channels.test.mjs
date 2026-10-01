import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/client/channels.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {normalizeChannelAddress,parseChannelListing,compareChannelAddresses,channelMovementRestriction,channelTargetRestriction}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
const currentChannelRecord={id:'channel-one',address:'a1',mapDefinitionId:'meadow',status:'OPEN',onlineUsers:2,reservedSeats:3,capacity:30};
const currentGameState={channel:{id:'meadow',address:'a2',mapDefinitionId:'meadow'},map:{id:'meadow'},me:{mode:'FIELD',battleId:null,partyId:null,hp:10,fp:1},battle:null,reservation:null};

test('채널 주소는 대소문자·선행 0을 통일하고 큰 행 번호를 보존한다',()=>{
  for(const [currentAddressInput,currentExpectedAddress] of [['A1','a1'],['AA0022','aa22'],['Ba234','ba234'],['Z900719925474099312345','z900719925474099312345']])assert.equal(normalizeChannelAddress(currentAddressInput),currentExpectedAddress);
  for(const currentAddressInput of ['','a0','0a','a1\n',' a1','a 1','a-1','가1','ａ1','a١','a1b','a'.repeat(100)+'1'])assert.throws(()=>normalizeChannelAddress(currentAddressInput));
});

test('채널 목록은 중복·추가 필드·비정규 주소·불완전 인원 정보를 거절한다',()=>{
  assert.deepEqual(parseChannelListing([currentChannelRecord]),[currentChannelRecord]);
  for(const currentInvalidPatch of [{id:1},{address:'A1'},{address:'a01'},{address:'a1\n'},{mapDefinitionId:''},{status:'UNKNOWN'},{extra:1},{onlineUsers:4},{reservedSeats:-1},{capacity:1},{capacity:true},{capacity:Infinity},{reservedSeats:1.5}])assert.throws(()=>parseChannelListing([{...currentChannelRecord,...currentInvalidPatch}]));
  for(const currentInvalidValue of [null,{},[null],[currentChannelRecord,currentChannelRecord],[currentChannelRecord,{...currentChannelRecord,id:'two'}]])assert.throws(()=>parseChannelListing(currentInvalidValue));
  const {onlineUsers,reservedSeats,capacity,...currentLegacyRecord}=currentChannelRecord;
  assert.deepEqual(parseChannelListing([currentLegacyRecord]),[currentLegacyRecord]);
  assert.throws(()=>parseChannelListing([{...currentLegacyRecord,capacity:30}]));
});

test('2차원 주소 순서는 z 다음 aa이며 숫자는 문자열 순서로 정렬하지 않는다',()=>{
  const currentSortedAddresses=['aa22','a10','ba234','a2','z1'].map(currentAddressText=>({...currentChannelRecord,address:currentAddressText})).sort(compareChannelAddresses).map(currentChannelEntry=>currentChannelEntry.address);
  assert.deepEqual(currentSortedAddresses,['a2','a10','z1','aa22','ba234']);
});

test('파티·전투·회복·FP 조건과 대상 만석·다른 맵·입장 중지를 구분한다',()=>{
  assert.equal(channelMovementRestriction(currentGameState),null);
  for(const [currentCharacterPatch,currentExpectedReason] of [[{partyId:'party'},'channels.leaveParty'],[{battleId:'battle'},'channels.fieldRequired'],[{mode:'AWAY'},'channels.fieldRequired'],[{hp:0},'channels.recoveryRequired'],[{healthRecoveryPending:true},'channels.recoveryRequired'],[{fp:-1},'channels.fpRequired']])assert.equal(channelMovementRestriction({...currentGameState,me:{...currentGameState.me,...currentCharacterPatch}}),currentExpectedReason);
  assert.equal(channelMovementRestriction({...currentGameState,channel:undefined}),'channels.stateRequired');
  assert.equal(channelTargetRestriction(currentGameState,currentChannelRecord),null);
  for(const [currentEntryPatch,currentExpectedReason] of [[{reservedSeats:30},'channels.full'],[{status:'DRAINING'},'channels.closed'],[{mapDefinitionId:'iseulon'},'channels.differentMap'],[{id:'meadow'},'channels.alreadyHere']])assert.equal(channelTargetRestriction(currentGameState,{...currentChannelRecord,...currentEntryPatch}),currentExpectedReason);
  assert.equal(channelTargetRestriction(currentGameState,{id:'legacy',address:'z1',mapDefinitionId:'meadow',status:'OPEN'}),null);
});
