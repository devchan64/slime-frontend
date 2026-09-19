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

test('세션 변경 뒤 이전 게임 명령을 재전송하거나 늦은 결과를 적용하지 않는다',async()=>{
 for(const result of ['success','network','conflict']){
  const client=new Client();client.state={me:{id:'old',version:2}};
  const calls=[];let resolve,reject;
  client.request=(path,body)=>{calls.push({path,body});return new Promise((yes,no)=>{resolve=yes;reject=no;});};
  let applied=0;client.accept=()=>applied++;
  const pending=client.command('/v1/game/moves',{position:{column:1,row:1}});
  client.disconnect();client.state={me:{id:'new',version:2}};
  if(result==='success')resolve({state:{me:{id:'old'}}});
  else reject(result==='network'?new Error('연결 유실'):new ApiError('VERSION_CONFLICT','갱신 필요',409));
  await assert.rejects(pending,error=>error.key==='network.sessionChanged');
  assert.equal(calls.length,1);assert.equal(applied,0);assert.equal(client.state.me.id,'new');
 }
});

test('동일 세션 재시도는 같은 요청 ID를 쓰고 충돌 조회 중 세션 변경도 거절한다',async()=>{
 const client=new Client();client.state={me:{id:'a',version:2}};let calls=[],applied=[];
 client.accept=s=>applied.push(s);client.request=async(path,body)=>{calls.push(body);if(calls.length===1)throw new Error('연결 유실');return {state:{me:{id:'a'}}};};
 await client.command('/v1/game/moves',{position:{column:1,row:1}});
 assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.equal(applied.length,1);
 let finish;client.request=async path=>{if(path==='/v1/game/state')return new Promise(resolve=>finish=resolve);throw new ApiError('VERSION_CONFLICT','갱신 필요',409);};
 const pending=client.command('/v1/game/moves',{position:{column:2,row:1}});
 await new Promise(resolve=>setImmediate(resolve));client.disconnect();finish({me:{id:'a'}});
 await assert.rejects(pending,error=>error.key==='network.sessionChanged');assert.equal(applied.length,1);
});

test('로그아웃으로 발생한 소켓 세션 만료가 HTTP 완료 처리를 취소하지 않는다',async()=>{
 const oldSocket=globalThis.WebSocket,oldLocation=globalThis.location;
 let socket,complete;
 class Socket {constructor(){socket=this;}close(){this.closed=true;this.onclose?.();}}
 try {
  globalThis.WebSocket=Socket;globalThis.location={href:'http://localhost/'};
  const client=new Client();client.stopped=false;client.tokens={access_token:'current'};client.state={generation:1};
  client.request=async()=>({ticket:'test'});await client.connect();
  client.request=()=>new Promise(resolve=>complete=resolve);
  const pending=client.logout();
  // 서버의 Game 세대 종료가 HTTP 로그아웃 응답보다 먼저 소켓으로 전달되는 순서다.
  socket.onmessage({data:JSON.stringify({type:'error',code:'SESSION_EXPIRED',message:'종료된 세션',messages:{ko:'종료된 세션',en:'Session expired'}})});
  complete({ok:true});
  assert.equal(await pending,true);
  assert.equal(socket.closed,true);assert.equal(client.stopped,true);
  assert.equal(client.tokens,null);assert.equal(client.state,null);
 } finally {
  if(oldSocket===undefined)delete globalThis.WebSocket;else globalThis.WebSocket=oldSocket;
  if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;
 }
});

const resumeBundle=await build({entryPoints:['src/client/browserResume.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {watchBrowserResume}=await import(`data:text/javascript;base64,${Buffer.from(resumeBundle.outputFiles[0].text).toString('base64')}`);
test('탭 복귀·온라인·페이지 캐시 복원만 재검증하고 이벤트 감시를 정리한다',()=>{
 const page=new EventTarget(),browser=new EventTarget();page.visibilityState='visible';let calls=0;
 const stop=watchBrowserResume(page,browser,()=>calls++);
 page.dispatchEvent(new Event('visibilitychange'));browser.dispatchEvent(new Event('pageshow'));assert.equal(calls,0);
 page.visibilityState='hidden';page.dispatchEvent(new Event('visibilitychange'));browser.dispatchEvent(new Event('online'));assert.equal(calls,0);
 page.visibilityState='visible';page.dispatchEvent(new Event('visibilitychange'));page.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,1);
 browser.dispatchEvent(new Event('online'));assert.equal(calls,2);
 const restored=new Event('pageshow');restored.persisted=true;browser.dispatchEvent(restored);assert.equal(calls,3);
 stop();browser.dispatchEvent(restored);browser.dispatchEvent(new Event('online'));assert.equal(calls,3);
});

test('복귀 검증은 진행 중 토큰 갱신을 공유하고 서버 복구 승인까지 입력을 잠근다',async()=>{
 const keys=['WebSocket','document','location','setInterval','clearInterval','setTimeout','clearTimeout'];
 const originals=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 let ws,finish,id=0;const timers=new Map(),statuses=[],requests=[];
 class Socket {static OPEN=1;readyState=1;sent=[];constructor(){ws=this;}send(data){this.sent.push(JSON.parse(data));}close(){this.closed=true;this.onclose?.();}}
 try {
  Object.assign(globalThis,{WebSocket:Socket,document:new EventTarget(),location:{href:'http://localhost/'},setInterval:()=>++id,clearInterval:()=>{},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
  const client=new Client();client.stopped=false;client.tokens={access_token:'old',refresh_token:'refresh'};
  client.state={protocolVersion:1,generation:2,epoch:3,cursor:4,location:{id:'map:meadow'}};
  client.onStatus=(ready)=>statuses.push(ready);
  client.request=async path=>{requests.push(path);if(path==='/v1/auth/refresh')return new Promise(resolve=>finish=resolve);return {ticket:'test',resumeSupported:true};};
  await client.connect();ws.onopen();ws.onmessage({data:JSON.stringify({type:'snapshot',state:client.state})});
  const old=ws;client.scheduleRefresh();const timer=[...timers.values()].find(t=>t.delay===720000);const refresh=timer.fn();
  const resume=client.resumeSession();assert.equal(client.resumeSession(),resume);
  assert.equal(old.closed,true);assert.equal(statuses.at(-1),false);
  old.onmessage({data:JSON.stringify({type:'state',state:{...client.state,cursor:99}})});assert.equal(client.state.cursor,4);
  finish({access_token:'new',refresh_token:'next'});await refresh;await resume;
  assert.equal(requests.filter(path=>path==='/v1/auth/refresh').length,1);
  assert.equal(statuses.at(-1),false);ws.onopen();
  assert.deepEqual(ws.sent,[{ticket:'test',protocolVersion:1,resume:{generation:2,epoch:3,cursor:4}}]);
  ws.onmessage({data:JSON.stringify({type:'resumed',generation:2,epoch:3,cursor:4})});assert.equal(statuses.at(-1),true);
  assert.equal(ws.sent.some(frame=>frame.type==='activity'),false);
  client.disconnect();const count=requests.length;await client.resumeSession();assert.equal(requests.length,count);
 } finally {for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('복귀 중 세션 교체·갱신 만료는 이전 연결을 재개하지 않는다',async()=>{
 for(const fail of [false,true]){
  const client=new Client();client.stopped=false;client.tokens={access_token:'old',refresh_token:'refresh'};
  let finish,connects=0;const statuses=[];
  client.connect=async()=>{connects++;};client.onStatus=(ready,message)=>statuses.push([ready,message]);
  client.request=()=>new Promise((resolve,reject)=>finish=fail?reject:resolve);
  const pending=client.resumeSession();
  if(!fail){client.disconnect();client.stopped=false;client.tokens={access_token:'new',refresh_token:'new-refresh'};}
  finish(fail?new ApiError('SESSION_EXPIRED','세션 만료',401):{access_token:'late',refresh_token:'late-refresh'});
  await pending;assert.equal(connects,0);
  if(fail){assert.equal(client.stopped,true);assert.equal(statuses.at(-1)[1].code,'SESSION_EXPIRED');}
  else {assert.equal(client.tokens.access_token,'new');assert.equal(client.stopped,false);}
  client.disconnect();
 }
});

test('응답 없는 소켓은 close 통지 없이도 30초에 해제하고 마지막 순번으로 복구한다',async()=>{
 const keys=['WebSocket','document','location','performance','setInterval','clearInterval','setTimeout','clearTimeout'];
 const originals=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 let ws,id=0,now=0;const intervals=new Map(),timers=new Map(),statuses=[];
 // 네트워크가 먹통이면 close() 이후에도 onclose가 오지 않을 수 있다.
 class Socket {static OPEN=1;readyState=1;sent=[];constructor(){ws=this;}send(data){this.sent.push(JSON.parse(data));}close(){this.closed=true;}}
 try {
  Object.assign(globalThis,{WebSocket:Socket,document:new EventTarget(),location:{href:'http://localhost/'},performance:{now:()=>now},setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:key=>intervals.delete(key),setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
  const client=new Client();client.stopped=false;client.state={protocolVersion:1,generation:3,epoch:4,cursor:8,location:{id:'map:meadow'}};
  client.request=async()=>({ticket:'test',resumeSupported:true});client.onStatus=ready=>statuses.push(ready);
  await client.connect();ws.onopen();ws.onmessage({data:JSON.stringify({type:'resumed',generation:3,epoch:4,cursor:8})});
  const old=ws,check=[...intervals.values()][0];
  now=10000;check();assert.deepEqual(old.sent.at(-1),{type:'heartbeat'});assert.equal(old.closed,undefined);
  now=20000;old.onmessage({data:JSON.stringify({type:'heartbeat',epoch:4,cursor:8})});
  now=49999;check();assert.equal(old.closed,undefined);
  now=50000;check();assert.equal(old.closed,true);assert.equal(statuses.at(-1),false);assert.equal(intervals.size,0);assert.equal(timers.size,1);
  const retry=[...timers.values()][0].fn;timers.clear();await retry();
  const next=ws;assert.notEqual(next,old);next.onopen();assert.equal(next.sent[0].resume.cursor,8);
  old.onclose();check();assert.equal(next.closed,undefined);assert.equal(timers.size,0);
  next.onmessage({data:JSON.stringify({type:'resumed',generation:3,epoch:4,cursor:8})});assert.equal(statuses.at(-1),true);
  client.disconnect();assert.equal(intervals.size,0);assert.equal(timers.size,0);
 } finally {for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('소켓 연결·초기 승인 대기에도 기한을 적용하며 종료 후 늦은 점검은 무효다',async()=>{
 const keys=['WebSocket','location','performance','setInterval','clearInterval','setTimeout','clearTimeout'];
 const originals=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 let ws,now=0,id=0;const intervals=new Map(),timers=new Map();
 class Socket {static OPEN=1;readyState=0;sent=[];constructor(){ws=this;}send(data){this.sent.push(JSON.parse(data));}close(){this.closed=true;}}
 try {
  Object.assign(globalThis,{WebSocket:Socket,location:{href:'http://localhost/'},performance:{now:()=>now},setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:key=>intervals.delete(key),setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});
  for(const open of [false,true]){
   now=0;const client=new Client();client.stopped=false;client.request=async()=>({ticket:'test'});
   await client.connect();const check=[...intervals.values()][0];
   if(open){ws.readyState=1;ws.onopen();}
   now=20000;check();assert.equal(ws.sent.some(frame=>frame.type==='heartbeat'),false);
   // 초기 승인 없는 heartbeat만으로 준비 대기를 무기한 연장하지 않는다.
   if(open)ws.onmessage({data:JSON.stringify({type:'heartbeat',epoch:0,cursor:0})});
   now=30000;check();assert.equal(ws.closed,true);assert.equal(timers.size,1);
   client.disconnect();assert.equal(timers.size,0);check();assert.equal(timers.size,0);
  }
 } finally {for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
