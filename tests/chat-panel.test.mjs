import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const {outputFiles}=await build({entryPoints:['src/ui/ChatPanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'chat-panel-hooks',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/^preact\/hooks$/},()=>({path:'preact/hooks',namespace:'chat-panel-hooks'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'chat-panel-hooks'},()=>({loader:'js',contents:`
    export const useRef=()=>globalThis.chatPanelHarness.chatLinesReference;
    export const useEffect=callback=>globalThis.chatPanelHarness.effectCallbacks.push(callback);
  `}));
}}]});
const {ChatPanel}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

function findChatLinesNode(currentNode) {
  if (Array.isArray(currentNode)) return currentNode.map(findChatLinesNode).find(Boolean);
  if (!currentNode || typeof currentNode !== 'object') return undefined;
  if (currentNode.props?.class === 'chat-lines') return currentNode;
  return findChatLinesNode(currentNode.props?.children);
}

test('대화 패널은 최신 메시지가 반영되면 마지막 대화로 스크롤한다',()=>{
  const previousHarness=globalThis.chatPanelHarness;
  const chatLinesElement={scrollTop:0,scrollHeight:840};
  globalThis.chatPanelHarness={chatLinesReference:{current:null},effectCallbacks:[]};
  try {
    const renderedChatPanel=ChatPanel({title:'채널 대화',messages:[
      {id:'message-one',name:'첫 사용자',text:'먼저 보낸 대화'},
      {id:'message-two',name:'둘째 사용자',text:'가장 최근 대화'},
    ],value:'',disabled:false,onChange:()=>{},onSubmit:()=>{}});
    const chatLinesNode=findChatLinesNode(renderedChatPanel);
    assert.ok(chatLinesNode);
    chatLinesNode.ref.current=chatLinesElement;
    globalThis.chatPanelHarness.effectCallbacks.forEach(currentEffectCallback=>currentEffectCallback());
    assert.equal(chatLinesElement.scrollTop,840);
  } finally {
    globalThis.chatPanelHarness=previousHarness;
  }
});
