import Phaser from 'phaser';
import {drawFieldCellObjects,FIELD_RENDER_METRICS,resolveFieldSurfaceDepth,buildLayeredTraversal,projectLayeredPosition} from '../../packages/field-renderer/field-renderer.mjs';
const currentMapSurface={columns:7,rows:7,elevations:Array.from({length:7},()=>[3,3,0,0,0,3,3]),blocked:[],bridges:[{id:'upper-crossing',start:{column:1,row:3},end:{column:5,row:3},elevation:3,material:'timber'}]};
const currentTraversalGraph=buildLayeredTraversal(currentMapSurface);
const currentRenderOptions={...FIELD_RENDER_METRICS,originX:500,originY:160};
const currentActorPositions=[{column:1,row:3,surfaceId:'ground'},{column:3,row:2,surfaceId:'ground'}];
const currentActorColors=[0xffd474,0x77ddff];
let currentActorIndex=0,currentActorGraphics=[];
function displayLayeredActors(currentMessageText='이동할 캐릭터를 선택하세요'){
 currentActorPositions.forEach((currentActorPosition,currentPositionIndex)=>{const currentScreenPoint=projectLayeredPosition(currentActorPosition,currentTraversalGraph,currentRenderOptions);currentActorGraphics[currentPositionIndex].clear().fillStyle(currentActorColors[currentPositionIndex],1).fillCircle(currentScreenPoint.x,currentScreenPoint.y-12,9).fillEllipse(currentScreenPoint.x,currentScreenPoint.y-2,16,7).setDepth(resolveFieldSurfaceDepth(currentActorPosition,currentMapSurface)+(currentActorPosition.surfaceId==='ground'?.12:2));});
 document.querySelector('#status').textContent=`${currentMessageText} · 선택 ${currentActorIndex===0?'노랑':'파랑'} · `+currentActorPositions.map((currentActorPosition,currentPositionIndex)=>`${currentPositionIndex===0?'노랑':'파랑'} (${currentActorPosition.column},${currentActorPosition.row}) ${currentActorPosition.surfaceId} 높이 ${currentTraversalGraph.readSurfaceElevation(currentActorPosition)}`).join(' / ');
}
function moveLayeredActor(currentColumnOffset,currentRowOffset){
 const currentActorPosition=currentActorPositions[currentActorIndex];
 const currentNextPosition=currentTraversalGraph.listSurfaceNeighbors(currentActorPosition).find(currentCellPosition=>currentCellPosition.column===currentActorPosition.column+currentColumnOffset&&currentCellPosition.row===currentActorPosition.row+currentRowOffset);
 if(!currentNextPosition)return displayLayeredActors('이동 차단: 난간·높이 차·연결 없음');
 currentActorPositions[currentActorIndex]=currentNextPosition;displayLayeredActors('이동 성공');
}
new Phaser.Game({type:Phaser.WEBGL,width:1000,height:700,backgroundColor:'#18222d',parent:'map',scene:{create(){
 for(const [currentTextureName,currentTextureColor] of [['ground',0x719474],['valley',0x6c9c88],['wall',0x746b60]]){const currentTextureGraphics=this.make.graphics({x:0,y:0});currentTextureGraphics.fillStyle(currentTextureColor,1).fillRect(0,0,128,128);currentTextureGraphics.lineStyle(1,0xffffff,.1);for(let currentLineOffset=0;currentLineOffset<128;currentLineOffset+=16)currentTextureGraphics.lineBetween(0,currentLineOffset,128,currentLineOffset);currentTextureGraphics.generateTexture(currentTextureName,128,128);currentTextureGraphics.destroy();}
 for(let currentRowIndex=0;currentRowIndex<7;currentRowIndex++)for(let currentColumnIndex=0;currentColumnIndex<7;currentColumnIndex++){const currentCellPosition={column:currentColumnIndex,row:currentRowIndex};drawFieldCellObjects(this,currentCellPosition,currentMapSurface,currentRenderOptions,{ground:currentColumnIndex>=2&&currentColumnIndex<=4?'valley':'ground',cliff:'wall',tread:'ground'},resolveFieldSurfaceDepth(currentCellPosition,currentMapSurface));}
 currentActorGraphics=currentActorPositions.map(()=>this.add.graphics());displayLayeredActors();
 document.querySelector('#upper').onclick=()=>{currentActorIndex=0;displayLayeredActors('노랑 선택');};document.querySelector('#lower').onclick=()=>{currentActorIndex=1;displayLayeredActors('파랑 선택');};
 document.querySelector('#east').onclick=()=>moveLayeredActor(1,0);document.querySelector('#west').onclick=()=>moveLayeredActor(-1,0);document.querySelector('#north').onclick=()=>moveLayeredActor(0,-1);document.querySelector('#south').onclick=()=>moveLayeredActor(0,1);
 document.querySelector('#export').onclick=()=>this.game.renderer.snapshot(currentImageRecord=>{const currentDownloadLink=document.createElement('a');currentDownloadLink.href=currentImageRecord.src;currentDownloadLink.download='layered-movement-system.png';currentDownloadLink.click();});
 document.querySelector('#ready').textContent='공용 다층 이동 그래프 · 상판 고도 3 / 하부 고도 0 · 실제 맵과 분리된 검증 화면';
}}});
