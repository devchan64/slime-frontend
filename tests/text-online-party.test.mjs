import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const TEST_PARTY_INVITATION='11111111-1111-4111-8111-111111111111';
function createPartyTestClient(){
 const currentTextClient=new TextClient('http://localhost',{sleep:async()=>{}});
 currentTextClient.tokens={user_id:'owner',access_token:'token'};
 currentTextClient.accept({protocolVersion:1,generation:1,epoch:1,cursor:0,me:{id:'owner',version:1,mode:'FIELD',position:{column:1,row:1},citizenshipSummary:{records:[{cityId:'iseulon',status:'VALID'}]}},
  map:{id:'iseulon',buildings:[{facilityKind:'guild',entrance:{column:1,row:1}}]},party:null,invitations:[],members:[{id:'guest',name:'손님',mode:'FIELD',partyCpEligible:true}]});
 return currentTextClient;
}
function createPartyCommandResponse(currentTextClient,currentPartyRecord){return {state:{...currentTextClient.state,cursor:currentTextClient.state.cursor+1,me:{...currentTextClient.state.me,version:currentTextClient.state.me.version+1},party:currentPartyRecord}};}
test('신규 온라인 파티 명령은 전송하지 않고 기존 기록 정리만 허용한다',async()=>{
 const currentTextClient=createPartyTestClient();const currentCommandRequests=[];
 currentTextClient.request=async(currentPath,currentBody)=>{currentCommandRequests.push(currentBody);return createPartyCommandResponse(currentTextClient,null);};
 for(const currentCommand of ['party create','party invite guest','party accept '+TEST_PARTY_INVITATION])await assert.rejects(currentTextClient.execute(currentCommand),/제공하지 않습니다/);
 assert.equal(currentCommandRequests.length,0);
 currentTextClient.state.party={id:'old-party',leader:'owner',members:['owner']};
 await currentTextClient.execute('party disband');
 assert.equal(currentCommandRequests[0].action,'DISBAND');assert.equal(currentTextClient.state.party,null);
});
