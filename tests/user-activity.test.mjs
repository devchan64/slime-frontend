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
const {Client}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
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
