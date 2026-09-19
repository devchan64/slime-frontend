import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles} = await build({entryPoints:['src/client/userActivity.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {watchUserActivity}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('실제 입력만 전송하고 연속 입력을 병합하며 정리 후 전송하지 않는다',()=>{
 const listeners=new Map(),timers=new Map();let now=0,count=0,id=0;
 const target={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const stop=watchUserActivity(target,()=>count++,()=>now,(fn,delay)=>{timers.set(++id,{fn,delay});return id;},id=>timers.delete(id));
 assert.equal(listeners.has('mousemove'),false);
 listeners.get('pointerdown')({isTrusted:false});assert.equal(count,0);
 listeners.get('pointerdown')({isTrusted:true});assert.equal(count,1);
 now=1000;listeners.get('keydown')({isTrusted:true});listeners.get('input')({isTrusted:true});
 assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,4000);
 const pending=[...timers.values()][0].fn;now=5000;timers.clear();pending();assert.equal(count,2);
 now=6000;listeners.get('input')({isTrusted:true});const late=[...timers.values()][0].fn;
 stop();late();assert.equal(count,2);assert.equal(timers.size,0);assert.equal(listeners.size,0);
});

const bundled=await build({entryPoints:['src/client/api.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':'{}'},plugins:[{name:'locale-test',setup(b){b.onResolve({filter:/^\.\.\/i18n$/},()=>({path:'locale',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const getLocale=()=>"ko";'}));}}]});
const {Client,ApiError}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
test('유휴 오류는 입력 감시·연결·생존 타이머를 정리하고 자동 재접속하지 않는다',async()=>{
 const originals=Object.fromEntries(['WebSocket','document','location','setInterval','clearInterval','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
 const intervals=new Set(),timeouts=new Set(),listeners=new Map(),statuses=[];let id=0,ws;
 class Socket {static OPEN=1;readyState=1;sent=[];constructor(){ws=this;}send(data){this.sent.push(JSON.parse(data));}close(){this.onclose?.();}}
 try {
  Object.assign(globalThis,{WebSocket:Socket,document:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},location:{href:'http://localhost/'},setInterval:()=>{intervals.add(++id);return id;},clearInterval:id=>intervals.delete(id),setTimeout:()=>{timeouts.add(++id);return id;},clearTimeout:id=>timeouts.delete(id)});
  const client=new Client();client.stopped=false;client.request=async()=>({ticket:'test'});client.accept=()=>{};client.onStatus=(ready,msg)=>statuses.push([ready,msg]);
  await client.connect();ws.onopen();ws.onmessage({data:JSON.stringify({type:'snapshot',state:{}})});
  assert.equal(intervals.size,1);assert.equal(listeners.size,3);
  listeners.get('pointerdown')({isTrusted:true});assert.deepEqual(ws.sent.at(-1),{type:'activity'});
  ws.onmessage({data:JSON.stringify({type:'error',code:'IDLE_DISCONNECTED',message:'유휴 종료',messages:{ko:'유휴 종료',en:'Idle'}})});
  assert.equal(intervals.size,0);assert.equal(listeners.size,0);assert.equal(timeouts.size,0);assert.equal(client.stopped,true);
  assert.equal(statuses.at(-1)[1].code,'IDLE_DISCONNECTED');
  await client.connect();assert.equal(timeouts.size,0);
 } finally {for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('재접속은 설치된 cursor를 요청하고 복구 승인 후 연속 이벤트만 적용한다',async()=>{
 const keys=['WebSocket','document','location','setInterval','clearInterval','setTimeout','clearTimeout'];
 const originals=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 let ws,id=0;const intervals=new Set(),listeners=new Map(),applied=[];
 class Socket {static OPEN=1;readyState=1;sent=[];closed=false;constructor(){ws=this;}send(data){this.sent.push(JSON.parse(data));}close(){this.closed=true;this.onclose?.();}}
 try {
  Object.assign(globalThis,{WebSocket:Socket,document:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},location:{href:'http://localhost/'},setInterval:()=>{intervals.add(++id);return id;},clearInterval:id=>intervals.delete(id),setTimeout:()=>++id,clearTimeout:()=>{}});
  const state=cursor=>({protocolVersion:1,generation:3,epoch:4,cursor,location:{id:'map:meadow'}});
  const client=new Client();client.stopped=false;client.state=state(8);client.request=async()=>({ticket:'test',resumeSupported:true});client.onState=s=>applied.push(s.cursor);
  await client.connect();ws.onopen();
  assert.deepEqual(ws.sent[0],{ticket:'test',protocolVersion:1,resume:{generation:3,epoch:4,cursor:8}});
  ws.onmessage({data:JSON.stringify({type:'resumed',generation:3,epoch:4,cursor:8})});
  assert.equal(intervals.size,1);assert.equal(listeners.size,3);assert.deepEqual(applied,[]);
  ws.onmessage({data:JSON.stringify({type:'state',state:state(9)})});assert.deepEqual(applied,[9]);
  ws.onmessage({data:JSON.stringify({type:'state',state:state(11)})});assert.equal(ws.closed,true);assert.equal(client.state.cursor,9);
  await client.connect();ws.onopen();assert.equal(ws.sent[0].resume.cursor,9);
  ws.onmessage({data:JSON.stringify({type:'snapshot',state:state(11)})});assert.equal(client.state.cursor,11);
  client.disconnect();assert.equal(intervals.size,0);
  const old=new Client();old.stopped=false;old.state=state(8);old.request=async()=>({ticket:'old'});
  await old.connect();ws.onopen();assert.deepEqual(ws.sent[0],{ticket:'old',protocolVersion:1});
  ws.onmessage({data:JSON.stringify({type:'resumed',generation:3,epoch:4,cursor:8})});assert.equal(ws.closed,true);
  old.disconnect();
 } finally {for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('마지막 이벤트 유실은 heartbeat head로 발견하고 정상 지연·옛 head·종료는 재연결하지 않는다',async()=>{
 const keys=['WebSocket','document','location','setInterval','clearInterval','setTimeout','clearTimeout'];
 const originals=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const timers=new Map();let id=0,ws;
 class Socket {static OPEN=1;readyState=1;closed=false;constructor(){ws=this;}send(){}close(){this.closed=true;this.onclose?.();}}
 try {
  Object.assign(globalThis,{WebSocket:Socket,document:{addEventListener(){},removeEventListener(){}},location:{href:'http://localhost/'},setInterval:()=>++id,clearInterval:()=>{},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
  const state=(epoch,cursor)=>({protocolVersion:1,generation:3,epoch,cursor,location:{id:'map:meadow'}});
  const client=new Client();client.stopped=false;client.state=state(4,8);client.request=async()=>({ticket:'test'});
  const frame=msg=>ws.onmessage({data:JSON.stringify(msg)});
  await client.connect();ws.onopen();frame({type:'snapshot',state:state(4,8)});
  frame({type:'heartbeat',epoch:4,cursor:9});assert.equal(timers.size,1);
  assert.equal([...timers.values()][0].delay,5000);
  frame({type:'heartbeat',epoch:4,cursor:9});assert.equal(timers.size,1);
  frame({type:'state',state:state(4,9)});assert.equal(timers.size,0);assert.equal(ws.closed,false);
  frame({type:'heartbeat',epoch:3,cursor:999});assert.equal(timers.size,0);
  frame({type:'heartbeat',epoch:4,cursor:8});assert.equal(timers.size,0);
  frame({type:'heartbeat',epoch:4,cursor:10});
  const lost=[...timers.values()][0];timers.clear();lost.fn();assert.equal(ws.closed,true);
  assert.equal(client.state.cursor,9);assert.equal(timers.size,1); // 마지막 적용 순번으로 재연결 예약
  client.disconnect();timers.clear();client.stopped=false;
  await client.connect();ws.onopen();frame({type:'heartbeat',epoch:5,cursor:0});
  assert.equal(timers.size,1);client.accept(state(5,0));assert.equal(timers.size,0);
  frame({type:'heartbeat',epoch:5,cursor:1});const late=[...timers.values()][0].fn;
  client.disconnect();assert.equal(timers.size,0);late();assert.equal(timers.size,0);
 } finally {for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('ACK는 적용한 서버 상태만 묶어 확인하고 HTTP의 더 큰 cursor나 종료 후 콜백은 보내지 않는다',async()=>{
 const keys=['WebSocket','document','location','setInterval','clearInterval','setTimeout','clearTimeout'];
 const originals=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let id=0,ws;const timers=new Map();
 class Socket {static OPEN=1;readyState=1;sent=[];constructor(){ws=this;}send(data){this.sent.push(JSON.parse(data));}close(){this.onclose?.();}}
 try {
  Object.assign(globalThis,{WebSocket:Socket,document:{addEventListener(){},removeEventListener(){}},location:{href:'http://localhost/'},setInterval:()=>++id,clearInterval:()=>{},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
  const state=cursor=>({protocolVersion:1,generation:3,epoch:4,cursor,location:{id:'map:meadow'}});
  const client=new Client();client.stopped=false;client.state=state(8);client.request=async()=>({ticket:'test',resumeSupported:true,ackSupported:true});
  const frame=msg=>ws.onmessage({data:JSON.stringify(msg)});
  await client.connect();ws.onopen();frame({type:'resumed',generation:3,epoch:4,cursor:8});
  frame({type:'state',state:state(9)});frame({type:'state',state:state(10)});
  assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,250);
  client.accept(state(15)); // HTTP 응답의 순번은 소켓 전송 확인으로 부풀리지 않는다.
  const ack=[...timers.values()][0].fn;timers.clear();ack();
  assert.deepEqual(ws.sent.at(-1),{type:'ack',epoch:4,cursor:10});
  frame({type:'state',state:state(11)});
  const late=[...timers.values()][0].fn;const before=ws.sent.length;
  client.disconnect();assert.equal(timers.size,0);late();assert.equal(ws.sent.length,before);
 } finally {for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('늦은 티켓 응답·실패가 재로그인한 새 연결을 교체하거나 종료하지 않는다',async()=>{
 const keys=['WebSocket','document','location','setInterval','clearInterval','setTimeout','clearTimeout'];
 const originals=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));const sockets=[],requests=[];let id=0;
 class Socket {static OPEN=1;readyState=1;closed=false;sent=[];constructor(){sockets.push(this);}send(data){this.sent.push(JSON.parse(data));}close(){this.closed=true;this.onclose?.();}}
 try {
  Object.assign(globalThis,{WebSocket:Socket,document:{addEventListener(){},removeEventListener(){}},location:{href:'http://localhost/'},setInterval:()=>++id,clearInterval:()=>{},setTimeout:()=>++id,clearTimeout:()=>{}});
  const client=new Client();client.stopped=false;
  client.request=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
  const old=client.connect();client.disconnect();client.stopped=false;const current=client.connect();
  requests[1].resolve({ticket:'new'});await current;const active=sockets.at(-1);active.onopen();
  requests[0].resolve({ticket:'old'});await old;
  assert.equal(sockets.length,1);assert.equal(client.socket,active);assert.equal(active.closed,false);
  const failed=client.connect();client.disconnect();client.stopped=false;const newest=client.connect();
  requests[3].resolve({ticket:'latest'});await newest;const latest=sockets.at(-1);
  requests[2].reject(new ApiError('SESSION_EXPIRED','이전 세션 종료',401));await failed;
  assert.equal(client.socket,latest);assert.equal(latest.closed,false);assert.equal(client.stopped,false);
  client.disconnect();
 } finally {for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});


test('이전 세션의 늦은 HTTP 유휴 오류는 새 로그인 연결을 끊지 않는다',async()=>{
 const previous=globalThis.fetch;let resolve;
 try {
  globalThis.fetch=()=>new Promise(done=>resolve=done);
  const client=new Client();client.stopped=false;
  const old=client.request('/v1/realtime/tickets',{});
  client.disconnect();client.stopped=false;
  resolve(new Response(JSON.stringify({code:'IDLE_DISCONNECTED',message:'유휴 종료',messages:{ko:'유휴 종료',en:'Idle'}}),
    {status:409,headers:{'Content-Type':'application/json'}}));
  await assert.rejects(old,error=>error.code==='IDLE_DISCONNECTED');
  assert.equal(client.stopped,false);
  client.disconnect();
 } finally {globalThis.fetch=previous;}
});

test('이전 세션에서 진행 중인 토큰 갱신의 성공·실패는 새 세션을 변경하지 않는다',async()=>{
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
 const timers=new Map();let id=0;
 try {
  globalThis.setTimeout=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};globalThis.clearTimeout=key=>timers.delete(key);
  for(const fail of [false,true]){
   const client=new Client();client.stopped=false;client.tokens={access_token:'old',refresh_token:'old-refresh'};
   let resolve,reject;client.request=()=>new Promise((yes,no)=>{resolve=yes;reject=no;});
   client.scheduleRefresh();const callback=[...timers.values()][0].fn;timers.clear();const pending=callback();
   client.disconnect();client.stopped=false;const current={access_token:'new',refresh_token:'new-refresh'};client.tokens=current;
   client.scheduleRefresh();const scheduled=[...timers.keys()];
   if(fail)reject(new ApiError('SESSION_EXPIRED','이전 세션 만료',401));else resolve({access_token:'stale',refresh_token:'stale-refresh'});
   await pending;
   assert.equal(client.tokens,current);assert.equal(client.stopped,false);assert.deepEqual([...timers.keys()],scheduled);
   client.disconnect();assert.equal(timers.size,0);
  }
 } finally {globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});

test('정상 토큰 갱신은 한 번 재예약하고 만료와 종료된 타이머는 정리한다',async()=>{
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
 const timers=new Map();let id=0,calls=0;
 try {
  globalThis.setTimeout=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};globalThis.clearTimeout=key=>timers.delete(key);
  const client=new Client();client.stopped=false;client.tokens={access_token:'old',refresh_token:'refresh'};
  client.request=async()=>{calls++;return {access_token:'updated',refresh_token:'next'};};
  client.scheduleRefresh();let callback=[...timers.values()][0].fn;assert.equal([...timers.values()][0].delay,720000);timers.clear();
  await callback();assert.equal(calls,1);assert.equal(client.tokens.access_token,'updated');assert.equal(timers.size,1);
  callback=[...timers.values()][0].fn;client.disconnect();await callback();assert.equal(calls,1);assert.equal(timers.size,0);
  client.stopped=false;client.request=async()=>{throw new ApiError('SESSION_EXPIRED','세션 만료',401);};
  client.scheduleRefresh();callback=[...timers.values()][0].fn;timers.clear();await callback();
  assert.equal(client.stopped,true);assert.equal(timers.size,0);
 } finally {globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});

test('겹친 로그인과 늦은 초기 스냅샷은 마지막 로그인만 설치한다',async()=>{
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 for(const stage of ['login','snapshot']){
  const client=new Client(),requests=[],installed=[];let connected=0;
  client.request=path=>new Promise((resolve,reject)=>requests.push({path,resolve,reject}));
  client.scheduleRefresh=()=>{};client.connect=async()=>{connected++;};client.onState=s=>installed.push(s);
  const old=client.login('old','test');
  if(stage==='snapshot'){requests[0].resolve({access_token:'old'});await tick();}
  const oldRequest=requests.at(-1);
  const current=client.login('new','test');const newLogin=requests.at(-1);
  newLogin.resolve({access_token:'new'});await tick();
  const newState={generation:2,me:{id:'new'}};requests.at(-1).resolve(newState);
  assert.equal(await current,true);
  oldRequest.resolve(stage==='login'?{access_token:'old'}:{generation:1,me:{id:'old'}});
  assert.equal(await old,false);
  assert.equal(client.tokens.access_token,'new');assert.equal(client.state,newState);
  assert.deepEqual(installed,[newState]);assert.equal(connected,1);client.disconnect();
 }
});

test('늦은 로그아웃 결과는 새 세션을 지우지 않고 현재 로그아웃만 완료한다',async()=>{
 const client=new Client();client.tokens={access_token:'old'};client.state={generation:1};client.stopped=false;
 let finish;client.request=()=>new Promise(resolve=>finish=resolve);
 const old=client.logout();client.disconnect();client.stopped=false;
 const state={generation:2};client.state=state;client.tokens={access_token:'new'};
 finish({ok:true});assert.equal(await old,false);
 assert.equal(client.state,state);assert.equal(client.tokens.access_token,'new');assert.equal(client.stopped,false);
 client.request=async()=>({ok:true});assert.equal(await client.logout(),true);
 assert.equal(client.tokens,null);assert.equal(client.state,null);assert.equal(client.stopped,true);
});

test('세션이 바뀌면 대기 중 인증 전환의 추가 조회를 중단한다',async()=>{
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;let wake,calls=0;
 try {
  globalThis.setTimeout=fn=>{wake=fn;return 1;};globalThis.clearTimeout=()=>{};
  const client=new Client();client.stopped=false;client.request=async()=>{calls++;return {pending:true,operationId:'old',receipt:'test-receipt'};};
  const pending=client.logout();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
  client.disconnect();client.stopped=false;client.state={generation:2};wake();
  assert.equal(await pending,false);assert.equal(calls,1);assert.equal(client.state.generation,2);client.disconnect();
 } finally {globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
