import {enumerateBridgeCells} from '../field-surface/terrain-bridges.mjs';
import {projectSurfaceVertex,rotateSurfacePosition} from '../field-surface/field-surface.mjs';
const BRIDGE_HALF_WIDTH=.42;
const BRIDGE_RAIL_HEIGHT=2.4;
const BRIDGE_FRONT_RAIL_DEPTH=40;
const BRIDGE_REAR_RAIL_DEPTH=2;
const BRIDGE_APPROACH_LENGTH=.75;
const BRIDGE_APPROACH_WIDTH=.49;
const BRIDGE_CONTACT_OVERLAP=0;
const BRIDGE_APPROACH_LIFT=.025;
const BRIDGE_ARCH_CORNICE_HEIGHT=.45;
const BRIDGE_PIER_FOOTING_DEPTH=.20;
const BRIDGE_THRESHOLD_LENGTH=.25;
const BRIDGE_THRESHOLD_LIFT=.015;
const BRIDGE_ARCH_BANK_INSET=.08;
const BRIDGE_CONTACT_WING_LENGTH=.25;
const BRIDGE_RAIL_HALF_POST=.05;
const BRIDGE_VAULT_CELL_SEGMENTS=4;
const BRIDGE_ARCH_REAR_LAYER=.8;
const BRIDGE_ARCH_INNER_LAYER=.85;
const BRIDGE_ARCH_FRONT_LAYER=.9;
const BRIDGE_ARCH_TEXTURE_INSET=.02;
const BRIDGE_ARCH_SOURCE_HEIGHT=304;
const BRIDGE_ARCH_VISIBLE_HEIGHT=291;
// 등록된 아치 텍스처의 투명 개구부 경계. 양끝 외곽 투명 여백은 제외한다.
const BRIDGE_SHARED_ARCH_PROFILE=Object.freeze([1,1,.966,.7323,.6115,.5309,.4745,.4503,.4423,.4503,.4826,.5309,.6115,.7323,.966,1,1]);
function resolveBridgeArchRatio(currentSpanFraction){
 const currentProfileOffset=(BRIDGE_ARCH_TEXTURE_INSET+Math.max(0,Math.min(1,currentSpanFraction))*(1-2*BRIDGE_ARCH_TEXTURE_INSET))*(BRIDGE_SHARED_ARCH_PROFILE.length-1);
 const currentProfileIndex=Math.min(BRIDGE_SHARED_ARCH_PROFILE.length-2,Math.floor(currentProfileOffset));
 const currentProfileBlend=currentProfileOffset-currentProfileIndex;
 return Math.min(1,(BRIDGE_SHARED_ARCH_PROFILE[currentProfileIndex]*(1-currentProfileBlend)+BRIDGE_SHARED_ARCH_PROFILE[currentProfileIndex+1]*currentProfileBlend)*BRIDGE_ARCH_SOURCE_HEIGHT/BRIDGE_ARCH_VISIBLE_HEIGHT);
}
const BRIDGE_CONNECTION_ATLAS=Object.freeze({textureKey:'bridge-connection-details-v1',size:1254,threshold:[0,313],abutment:[317,624],bearing:[628,925],splice:[934,1253],vault:[317,624]});
const BRIDGE_ATLAS_PROFILES=Object.freeze({
 timber:{textureKey:'bridge-timber-components-v2',size:1254,deck:[17,307],beam:[326,617],rail:[640,892],cornice:[908,1236],abutment:[908,1236],threshold:[17,307],vault:[908,1236],thickness:4},
 stone:{textureKey:'bridge-stone-components-v1',size:1254,deck:[17,307],beam:[326,617],rail:[640,892],cornice:[908,1236],abutment:[908,1236],threshold:[17,307],thickness:4},
});
export function resolveBridgeTextureKey(currentMaterialName){
 const currentAtlasProfile=BRIDGE_ATLAS_PROFILES[currentMaterialName];
 if(!currentAtlasProfile)throw Error('지원하지 않는 교량 재질');
 return currentAtlasProfile.textureKey;
}
export function resolveBridgeTextureKeys(currentMaterialName){
 return [resolveBridgeTextureKey(currentMaterialName),BRIDGE_CONNECTION_ATLAS.textureKey];
}
/** 지면과 통행 고도를 유지하고 분할 스프라이트를 보행면·측면·난간에 투영한다. */
export function buildBridgeCellGeometry(currentCellPosition,currentMapSurface,currentRenderOptions){
 const currentBridgeRecord=currentMapSurface.bridges?.find(currentBridgeCandidate=>enumerateBridgeCells(currentBridgeCandidate).some(currentBridgeCell=>currentBridgeCell.column===currentCellPosition.column&&currentBridgeCell.row===currentCellPosition.row));
 if(!currentBridgeRecord)return [];
 const currentAtlasProfile=BRIDGE_ATLAS_PROFILES[currentBridgeRecord.material];
 if(!currentAtlasProfile)throw Error('지원하지 않는 교량 재질');
 const currentBridgeCells=enumerateBridgeCells(currentBridgeRecord);
 const currentCellIndex=currentBridgeCells.findIndex(currentBridgeCell=>currentBridgeCell.column===currentCellPosition.column&&currentBridgeCell.row===currentCellPosition.row);
 const currentAlongColumn=Math.sign(currentBridgeRecord.end.column-currentBridgeRecord.start.column),currentAlongRow=Math.sign(currentBridgeRecord.end.row-currentBridgeRecord.start.row);
 const currentAcrossView=rotateSurfacePosition({column:-currentAlongRow,row:currentAlongColumn},currentRenderOptions.rotation??0);
 const projectBridgeVertex=(currentAlongOffset,currentAcrossOffset,currentHeightOffset)=>projectSurfaceVertex({column:currentCellPosition.column+currentAlongColumn*currentAlongOffset-currentAlongRow*currentAcrossOffset,row:currentCellPosition.row+currentAlongRow*currentAlongOffset+currentAlongColumn*currentAcrossOffset,height:(currentBridgeRecord.elevation+currentHeightOffset)*currentRenderOptions.elevationHeight},currentRenderOptions);
 const currentStructuralCells=currentBridgeCells.slice(1,-1);
 const currentStructuralAnchor=currentStructuralCells.reduce((currentFrontCell,currentCandidateCell)=>{
  const currentFrontView=rotateSurfacePosition(currentFrontCell,currentRenderOptions.rotation??0);
  const currentCandidateView=rotateSurfacePosition(currentCandidateCell,currentRenderOptions.rotation??0);
  return currentCandidateView.column+currentCandidateView.row>currentFrontView.column+currentFrontView.row?currentCandidateCell:currentFrontCell;
 });
 const currentArchDepthStart=Math.max(currentAtlasProfile.thickness,currentBridgeRecord.elevation-currentMapSurface.elevations[currentStructuralCells[0].row][currentStructuralCells[0].column]+BRIDGE_PIER_FOOTING_DEPTH);
 const currentArchDepthEnd=Math.max(currentAtlasProfile.thickness,currentBridgeRecord.elevation-currentMapSurface.elevations[currentStructuralCells.at(-1).row][currentStructuralCells.at(-1).column]+BRIDGE_PIER_FOOTING_DEPTH);
 const resolveBridgeSpanDepth=currentSpanFraction=>currentArchDepthStart+(currentArchDepthEnd-currentArchDepthStart)*currentSpanFraction;
 const currentBridgeFaces=[];
 const appendBridgePanel=(currentPanelPart,currentPanelPoints,currentDepthOffset=0,currentStartU=0,currentEndU=1)=>{
  const currentPanelAtlas=currentPanelPart==='vault'&&currentBridgeRecord.material==='timber'?currentAtlasProfile:currentPanelPart in BRIDGE_CONNECTION_ATLAS?BRIDGE_CONNECTION_ATLAS:currentAtlasProfile;
  const [currentTopPixel,currentBottomPixel]=currentPanelAtlas[currentPanelPart];
  currentBridgeFaces.push({kind:'bridge',part:currentPanelPart,top:currentPanelPart==='deck'||currentPanelPart==='threshold'||currentPanelPart==='bearing',textureKey:currentPanelAtlas.textureKey,depthOffset:currentDepthOffset,points:currentPanelPoints,uvCorners:[currentStartU,currentTopPixel/currentPanelAtlas.size,currentEndU,currentTopPixel/currentPanelAtlas.size,currentEndU,currentBottomPixel/currentPanelAtlas.size,currentStartU,currentBottomPixel/currentPanelAtlas.size]});
 };
 if(currentCellIndex===0||currentCellIndex===currentBridgeCells.length-1){
  const currentContactDirection=currentCellIndex===0?1:-1;
  const currentContactOffset=currentContactDirection*(.5+BRIDGE_CONTACT_OVERLAP);
  const currentInnerOffset=currentContactDirection*(.5-BRIDGE_APPROACH_LENGTH);
  const currentGroundElevation=currentMapSurface.elevations[currentCellPosition.row][currentCellPosition.column];
  const currentInnerHeight=currentGroundElevation-currentBridgeRecord.elevation+BRIDGE_APPROACH_LIFT;
  const currentThresholdOffset=currentInnerOffset-currentContactDirection*BRIDGE_THRESHOLD_LENGTH;
  const currentAdjacentCell=currentBridgeCells[currentCellIndex===0?1:currentBridgeCells.length-2];
  const currentFoundationHeight=currentMapSurface.elevations[currentAdjacentCell.row][currentAdjacentCell.column]-currentBridgeRecord.elevation-BRIDGE_PIER_FOOTING_DEPTH;
  const currentBankTopHeight=-BRIDGE_ARCH_BANK_INSET;
  const currentInnerBankHeight=currentInnerHeight-BRIDGE_ARCH_BANK_INSET;
  const currentWingInnerOffset=currentContactOffset-currentContactDirection*BRIDGE_CONTACT_WING_LENGTH;
  // 진입 문턱은 길 위에 낮게 놓고 구조 기초는 보 밑에서 시작한다.
  appendBridgePanel('threshold',[projectBridgeVertex(currentThresholdOffset,-BRIDGE_APPROACH_WIDTH,currentInnerHeight+BRIDGE_THRESHOLD_LIFT),projectBridgeVertex(currentInnerOffset,-BRIDGE_APPROACH_WIDTH,currentInnerHeight+BRIDGE_THRESHOLD_LIFT),projectBridgeVertex(currentInnerOffset,BRIDGE_APPROACH_WIDTH,currentInnerHeight+BRIDGE_THRESHOLD_LIFT),projectBridgeVertex(currentThresholdOffset,BRIDGE_APPROACH_WIDTH,currentInnerHeight+BRIDGE_THRESHOLD_LIFT)],1);
  // 흙이 섞인 가장자리는 육지 쪽, 다듬은 포장은 다리 쪽으로 배치한다.
  currentBridgeFaces[currentBridgeFaces.length-1].uvCorners=[0,0,0,313/1254,1,313/1254,1,0];
  // 육지 쪽 폭을 넓히고 기존 진입 고도 차이를 연속 경사면으로 연결한다.
  appendBridgePanel('deck',[projectBridgeVertex(currentInnerOffset,-BRIDGE_APPROACH_WIDTH,currentInnerHeight),projectBridgeVertex(currentContactOffset,-BRIDGE_HALF_WIDTH,0),projectBridgeVertex(currentContactOffset,BRIDGE_HALF_WIDTH,0),projectBridgeVertex(currentInnerOffset,BRIDGE_APPROACH_WIDTH,currentInnerHeight)],1,0,BRIDGE_APPROACH_LENGTH);
  // 수면 방향의 전면과 양쪽 날개벽으로 교대를 지형 안에 정착시킨다.
  const currentContactView=rotateSurfacePosition({column:currentAlongColumn*currentContactDirection,row:currentAlongRow*currentContactDirection},currentRenderOptions.rotation??0);
  if(currentContactView.column+currentContactView.row>0)
  appendBridgePanel('abutment',[projectBridgeVertex(currentContactOffset,-BRIDGE_HALF_WIDTH,currentBankTopHeight),projectBridgeVertex(currentContactOffset,BRIDGE_HALF_WIDTH,currentBankTopHeight),projectBridgeVertex(currentContactOffset,BRIDGE_HALF_WIDTH,currentFoundationHeight),projectBridgeVertex(currentContactOffset,-BRIDGE_HALF_WIDTH,currentFoundationHeight)]);
  for(const currentSideDirection of [-1,1]){
   const currentAcrossOffset=currentSideDirection*BRIDGE_HALF_WIDTH;
   const currentInnerAcross=currentSideDirection*BRIDGE_APPROACH_WIDTH;
   const currentFrontFacing=currentAcrossOffset*(currentAcrossView.column+currentAcrossView.row)>0;
   // 육지 내부의 날개벽은 지형 위로 투영하지 않는다. 노출된 높이만 남긴다.
   const currentWingBottomHeight=Math.max(currentFoundationHeight,currentGroundElevation-currentBridgeRecord.elevation);
   if(Math.max(currentInnerBankHeight,currentBankTopHeight)>currentWingBottomHeight){
    appendBridgePanel('abutment',[projectBridgeVertex(currentWingInnerOffset,currentInnerAcross,Math.max(currentInnerBankHeight,currentWingBottomHeight)),projectBridgeVertex(currentContactOffset,currentAcrossOffset,Math.max(currentBankTopHeight,currentWingBottomHeight)),projectBridgeVertex(currentContactOffset,currentAcrossOffset,currentWingBottomHeight),projectBridgeVertex(currentWingInnerOffset,currentInnerAcross,currentWingBottomHeight)]);
   }
   appendBridgePanel('rail',[projectBridgeVertex(currentInnerOffset,currentInnerAcross,currentInnerHeight+BRIDGE_RAIL_HEIGHT),projectBridgeVertex(currentContactOffset,currentAcrossOffset,BRIDGE_RAIL_HEIGHT),projectBridgeVertex(currentContactOffset,currentAcrossOffset,0),projectBridgeVertex(currentInnerOffset,currentInnerAcross,currentInnerHeight)],currentFrontFacing?BRIDGE_FRONT_RAIL_DEPTH:BRIDGE_REAR_RAIL_DEPTH,0,1-BRIDGE_RAIL_HALF_POST);
  }
  // 양안 교대가 보를 받치므로 별도 돌출 받침기둥은 중복 배치하지 않는다.
  {
   for(const [currentPanelIndex,currentPanelFace] of currentBridgeFaces.entries()){
    Object.assign(currentPanelFace,{depthAnchor:currentStructuralAnchor,structureLayer:currentPanelFace.depthOffset+currentPanelIndex/(currentBridgeFaces.length+1)});
   }
  }
  return currentBridgeFaces;
 }
 {
  // 중앙 셀에서 양쪽 아치를 한 장씩 만든다. 타일 경계의 UV 절단과 깊이 교차를 제거한다.
  if(currentCellIndex===Math.ceil((currentBridgeCells.length-2)/2)){
   const currentSpanStart=.5-currentCellIndex;
   const currentSpanEnd=currentBridgeCells.length-1.5-currentCellIndex;
   for(const currentAcrossOffset of [-BRIDGE_HALF_WIDTH,BRIDGE_HALF_WIDTH]){
    const currentFrontFacing=currentAcrossOffset*(currentAcrossView.column+currentAcrossView.row)>0;
    appendBridgePanel('beam',[projectBridgeVertex(currentSpanStart,currentAcrossOffset,0),projectBridgeVertex(currentSpanEnd,currentAcrossOffset,0),projectBridgeVertex(currentSpanEnd,currentAcrossOffset,-currentArchDepthEnd),projectBridgeVertex(currentSpanStart,currentAcrossOffset,-currentArchDepthStart)],0,BRIDGE_ARCH_TEXTURE_INSET,1-BRIDGE_ARCH_TEXTURE_INSET);
    Object.assign(currentBridgeFaces.at(-1),{depthAnchor:currentStructuralAnchor,structureLayer:currentFrontFacing?BRIDGE_ARCH_FRONT_LAYER:BRIDGE_ARCH_REAR_LAYER});
   }
  }
 }
 {
  // 양쪽 아치 개구부 사이를 분할 곡면으로 연결한다. 전면 아치보다 뒤에 그린다.
  const currentBridgeSpan=currentBridgeCells.length-2;
  for(let currentSegmentIndex=0;currentSegmentIndex<BRIDGE_VAULT_CELL_SEGMENTS;currentSegmentIndex++){
   const currentStartAlong=-.5+currentSegmentIndex/BRIDGE_VAULT_CELL_SEGMENTS;
   const currentEndAlong=-.5+(currentSegmentIndex+1)/BRIDGE_VAULT_CELL_SEGMENTS;
   const currentStartRatio=(currentCellIndex-1+currentSegmentIndex/BRIDGE_VAULT_CELL_SEGMENTS)/currentBridgeSpan;
   const currentEndRatio=(currentCellIndex-1+(currentSegmentIndex+1)/BRIDGE_VAULT_CELL_SEGMENTS)/currentBridgeSpan;
   const currentStartHeight=-resolveBridgeSpanDepth(currentStartRatio)*resolveBridgeArchRatio(currentStartRatio);
   const currentEndHeight=-resolveBridgeSpanDepth(currentEndRatio)*resolveBridgeArchRatio(currentEndRatio);
   appendBridgePanel('vault',[projectBridgeVertex(currentStartAlong,-BRIDGE_HALF_WIDTH,currentStartHeight),projectBridgeVertex(currentEndAlong,-BRIDGE_HALF_WIDTH,currentEndHeight),projectBridgeVertex(currentEndAlong,BRIDGE_HALF_WIDTH,currentEndHeight),projectBridgeVertex(currentStartAlong,BRIDGE_HALF_WIDTH,currentStartHeight)],0,currentStartRatio,currentEndRatio);
   Object.assign(currentBridgeFaces.at(-1),{depthAnchor:currentStructuralAnchor,structureLayer:BRIDGE_ARCH_INNER_LAYER});
  }
  // 상판 아래 돌림띠도 재질 프로필의 목재·석재를 사용한다.
  for(const currentAcrossOffset of [-BRIDGE_HALF_WIDTH,BRIDGE_HALF_WIDTH]){
   appendBridgePanel('cornice',[projectBridgeVertex(-.5,currentAcrossOffset,0),projectBridgeVertex(.5,currentAcrossOffset,0),projectBridgeVertex(.5,currentAcrossOffset,-BRIDGE_ARCH_CORNICE_HEIGHT),projectBridgeVertex(-.5,currentAcrossOffset,-BRIDGE_ARCH_CORNICE_HEIGHT)],1);
  }
 }
 appendBridgePanel('deck',[projectBridgeVertex(-.5,-BRIDGE_HALF_WIDTH,0),projectBridgeVertex(.5,-BRIDGE_HALF_WIDTH,0),projectBridgeVertex(.5,BRIDGE_HALF_WIDTH,0),projectBridgeVertex(-.5,BRIDGE_HALF_WIDTH,0)],1);
 for(const currentAcrossOffset of [-BRIDGE_HALF_WIDTH,BRIDGE_HALF_WIDTH]){
  const currentFrontFacing=currentAcrossOffset*(currentAcrossView.column+currentAcrossView.row)>0;
  appendBridgePanel('rail',[projectBridgeVertex(-.5,currentAcrossOffset,BRIDGE_RAIL_HEIGHT),projectBridgeVertex(.5,currentAcrossOffset,BRIDGE_RAIL_HEIGHT),projectBridgeVertex(.5,currentAcrossOffset,0),projectBridgeVertex(-.5,currentAcrossOffset,0)],currentFrontFacing?BRIDGE_FRONT_RAIL_DEPTH:BRIDGE_REAR_RAIL_DEPTH,BRIDGE_RAIL_HALF_POST,1-BRIDGE_RAIL_HALF_POST);
 }
 return currentBridgeFaces;
}
