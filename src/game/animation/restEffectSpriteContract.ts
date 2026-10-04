/**
 * 필드 휴식 효과 스프라이트의 공용 규격이다.
 * 원본 시트·메타데이터·재생기는 이 값과 다른 크기를 허용하지 않는다.
 */
export const FIELD_REST_EFFECT_SPRITE_CONTRACT = Object.freeze({
  frameWidthPixels: 64,
  frameHeightPixels: 64,
  frameColumnCount: 4,
  frameRowCount: 4,
  frameTotalCount: 16,
  sheetWidthPixels: 256,
  sheetHeightPixels: 256,
});

export function validateFieldRestEffectSheetDimensions(sheetWidthPixels: number, sheetHeightPixels: number) {
  const currentContract = FIELD_REST_EFFECT_SPRITE_CONTRACT;
  if (sheetWidthPixels !== currentContract.sheetWidthPixels || sheetHeightPixels !== currentContract.sheetHeightPixels) {
    throw new Error(`휴식 효과 시트는 ${currentContract.sheetWidthPixels}x${currentContract.sheetHeightPixels}px여야 합니다.`);
  }
}
