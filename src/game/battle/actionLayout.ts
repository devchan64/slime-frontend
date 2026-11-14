type PresentationLayoutActor={side:'ally'|'enemy';minimumOffsetX:number;maximumOffsetX:number};
const PRESENTATION_EDGE_MARGIN_RATIO=0.08;
const PRESENTATION_SIDE_CENTER_RATIO={ally:0.26,enemy:0.74} as const;
/** 몸체의 실제 앵커 상대 경계를 사용하며 같은 진영 지원은 해당 화면 절반에 모은다. */
export function calculatePresentationActorLayout(currentViewportWidth:number,currentActorBounds:PresentationLayoutActor[],currentContactGap:number){
  if(!Number.isFinite(currentViewportWidth)||currentViewportWidth<=0||!Number.isFinite(currentContactGap)||currentContactGap<0||currentActorBounds.length<1||currentActorBounds.length>2)throw Error('전투 연출 배치 입력 오류');
  for(const currentActorBound of currentActorBounds)if(!['ally','enemy'].includes(currentActorBound.side)||!Number.isFinite(currentActorBound.minimumOffsetX)||!Number.isFinite(currentActorBound.maximumOffsetX)||currentActorBound.maximumOffsetX<=currentActorBound.minimumOffsetX)throw Error('전투 연출 몸체 경계 오류');
  const currentActorWidths=currentActorBounds.map(currentActorBound=>currentActorBound.maximumOffsetX-currentActorBound.minimumOffsetX);
  const currentAvailableHalfWidth=currentViewportWidth*(0.5-PRESENTATION_EDGE_MARGIN_RATIO);
  const currentSameSide=currentActorBounds.every(currentActorBound=>currentActorBound.side===currentActorBounds[0].side);
  const currentCommonScale=Math.min(1,currentSameSide?currentAvailableHalfWidth/(currentActorWidths.reduce((currentTotalWidth,currentActorWidth)=>currentTotalWidth+currentActorWidth,0)+currentContactGap*(currentActorBounds.length-1)):
    currentAvailableHalfWidth/(Math.max(...currentActorWidths)+currentContactGap/2));
  const currentScaledGap=currentContactGap*currentCommonScale;
  if(currentSameSide){
    const currentGroupWidth=currentActorWidths.reduce((currentTotalWidth,currentActorWidth)=>currentTotalWidth+currentActorWidth,0)*currentCommonScale+currentScaledGap*(currentActorBounds.length-1);
    let currentBodyLeftEdge=currentViewportWidth*PRESENTATION_SIDE_CENTER_RATIO[currentActorBounds[0].side]-currentGroupWidth/2;
    return {scale:currentCommonScale,positions:currentActorBounds.map((currentActorBound,currentActorIndex)=>{
      const currentAnchorPosition=currentBodyLeftEdge-currentActorBound.minimumOffsetX*currentCommonScale;
      currentBodyLeftEdge+=currentActorWidths[currentActorIndex]*currentCommonScale+currentScaledGap;
      return currentAnchorPosition;
    })};
  }
  // 두 몸체와 간격을 하나의 영역으로 중앙 정렬하여 크기가 달라도 바깥 여백을 맞춘다.
  const currentGroupWidth=(currentActorWidths[0]+currentActorWidths[1])*currentCommonScale+currentScaledGap;
  const currentGroupLeftEdge=(currentViewportWidth-currentGroupWidth)/2;
  const currentAllyActorIndex=currentActorBounds.findIndex(currentActorBound=>currentActorBound.side==='ally');
  const currentAllyBodyWidth=currentActorWidths[currentAllyActorIndex]*currentCommonScale;
  return {scale:currentCommonScale,positions:currentActorBounds.map(currentActorBound=>
    currentGroupLeftEdge+(currentActorBound.side==='ally'?0:currentAllyBodyWidth+currentScaledGap)
      -currentActorBound.minimumOffsetX*currentCommonScale)};
}

/** 원본 시선과 원하는 화면 시선이 다를 때만 반전한다. */
export function shouldMirrorPresentationActor(currentArtworkDirection:'down_left'|'down_right',currentFacesRight:boolean):boolean {
  return (currentArtworkDirection==='down_right')!==currentFacesRight;
}
