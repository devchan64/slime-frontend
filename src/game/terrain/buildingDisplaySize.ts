/** 기본 점유 크기에 건물별 픽셀 보정을 더한다. */
export function calculateBuildingDisplaySize(currentBaseWidth:number,currentImageWidth:number,currentImageHeight:number,currentWidthAdjustment=0,currentHeightAdjustment=0) {
 if(![currentBaseWidth,currentImageWidth,currentImageHeight,currentWidthAdjustment,currentHeightAdjustment].every(Number.isFinite)||currentBaseWidth<=0||currentImageWidth<=0||currentImageHeight<=0)throw Error('건물 표시 크기 입력 오류');
 const currentAdjustedWidth=currentBaseWidth+currentWidthAdjustment;
 const currentAdjustedHeight=currentBaseWidth*currentImageHeight/currentImageWidth+currentHeightAdjustment;
 if(currentAdjustedWidth<=0||currentAdjustedHeight<=0)throw Error('건물 표시 크기는 양수여야 합니다.');
 return {width:currentAdjustedWidth,height:currentAdjustedHeight};
}
