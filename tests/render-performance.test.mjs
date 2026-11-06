import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {build} from 'esbuild';
const currentBuildResult=await build({entryPoints:['src/game/renderPerformance.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const currentPerformanceModule=await import('data:text/javascript;base64,'+Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64'));
test('실측 프레임 간격으로 FPS·p95·긴 프레임을 계산하며 빈 표본은 미측정이다',()=>{
 assert.equal(currentPerformanceModule.summarizePerformanceFrames([]),null);
 const currentSummaryValue=currentPerformanceModule.summarizePerformanceFrames([10,20,70].map((currentFrameInterval,currentFrameIndex)=>({timestamp:currentFrameIndex,interval:currentFrameInterval,cpu:2,changed:currentFrameIndex===1})));
 assert.equal(currentSummaryValue.fps,30);assert.equal(currentSummaryValue.p95,70);assert.equal(currentSummaryValue.longFrames,1);assert.equal(currentSummaryValue.changes,1);assert.equal(currentSummaryValue.cpuAverage,2);
});
test('끄기·숨김·맵 전환·파괴는 관측을 해제하거나 표본을 초기화한다',()=>{
 const currentOriginalGlobals=Object.fromEntries(['document','localStorage','performance','setInterval','clearInterval'].map(currentGlobalName=>[currentGlobalName,Object.getOwnPropertyDescriptor(globalThis,currentGlobalName)]));
 const currentDocumentTarget=new EventTarget();currentDocumentTarget.hidden=false;
 let currentTimestampValue=0;let currentStoredValue=null;let currentFrameName='a';let currentMapIdentity='map:a';
 const currentTimerCallbacks=new Map();let currentTimerIdentifier=0;
 Object.defineProperty(globalThis,'document',{configurable:true,value:currentDocumentTarget});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>currentStoredValue,setItem:(_,currentNextValue)=>{currentStoredValue=currentNextValue;}}});
 Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>currentTimestampValue}});
 globalThis.setInterval=currentCallbackValue=>{currentTimerCallbacks.set(++currentTimerIdentifier,currentCallbackValue);return currentTimerIdentifier;};
 globalThis.clearInterval=currentTimerValue=>currentTimerCallbacks.delete(currentTimerValue);
 const currentGameEmitter=new EventEmitter();
 const currentSceneStub={readPerformanceActor:()=>({identity:currentMapIdentity,frame:currentFrameName}),readRenderPerformance:()=>({mapId:currentMapIdentity})};
 function advancePerformanceFrame(){currentTimestampValue+=14;currentGameEmitter.emit('prestep');currentTimestampValue+=2;currentGameEmitter.emit('postrender');}
 try{
  currentPerformanceModule.initializePerformanceSettings();currentPerformanceModule.attachRenderPerformance({events:currentGameEmitter},currentSceneStub);
  assert.equal(currentGameEmitter.listenerCount('postrender'),0);
  currentPerformanceModule.savePerformanceSettings(true);assert.equal(currentGameEmitter.listenerCount('postrender'),1);
  advancePerformanceFrame();currentFrameName='b';advancePerformanceFrame();for(const currentTimerCallback of currentTimerCallbacks.values())currentTimerCallback();
  assert.equal(currentPerformanceModule.readPerformanceReport().fps,62.5);
  currentDocumentTarget.hidden=true;currentDocumentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(currentGameEmitter.listenerCount('postrender'),0);assert.equal(currentTimerCallbacks.size,0);assert.equal(currentPerformanceModule.readPerformanceReport(),null);
  currentDocumentTarget.hidden=false;currentDocumentTarget.dispatchEvent(new Event('visibilitychange'));advancePerformanceFrame();advancePerformanceFrame();
  currentMapIdentity='map:b';advancePerformanceFrame();assert.equal(currentPerformanceModule.readPerformanceReport(),null);
  currentPerformanceModule.savePerformanceSettings(false);assert.equal(currentTimerCallbacks.size,0);assert.equal(currentGameEmitter.listenerCount('prestep'),0);
  currentStoredValue='broken';assert.throws(()=>currentPerformanceModule.initializePerformanceSettings());assert.equal(currentPerformanceModule.readPerformanceEnabled(),false);
  const currentWorkingStorage=globalThis.localStorage;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem(){throw Error('storage denied');}}});
  assert.throws(()=>currentPerformanceModule.savePerformanceSettings(true));assert.equal(currentPerformanceModule.readPerformanceEnabled(),false);Object.defineProperty(globalThis,'localStorage',{configurable:true,value:currentWorkingStorage});
  currentPerformanceModule.savePerformanceSettings(true);currentGameEmitter.emit('destroy');assert.equal(currentGameEmitter.listenerCount('postrender'),0);assert.equal(currentTimerCallbacks.size,0);
 }finally{currentGameEmitter.emit('destroy');for(const [currentGlobalName,currentGlobalDescriptor] of Object.entries(currentOriginalGlobals)){if(currentGlobalDescriptor)Object.defineProperty(globalThis,currentGlobalName,currentGlobalDescriptor);else delete globalThis[currentGlobalName];}}
});
