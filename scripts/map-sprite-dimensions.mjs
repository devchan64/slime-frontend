const PNG_SIGNATURE_BYTES = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_HEADER_LENGTH = 24;
export const MAXIMUM_MAP_SPRITE_SOURCE_SIZE = 512;
export const TREE_BILLBOARD_SOURCE_SIZE = 256;
export const VEGETATION_BILLBOARD_SOURCE_SIZE = 128;

export function readPngSourceDimensions(currentImageBytes) {
  if (!Buffer.isBuffer(currentImageBytes) || currentImageBytes.length < PNG_HEADER_LENGTH) throw new Error('PNG 원본 헤더가 없습니다.');
  if (!PNG_SIGNATURE_BYTES.every((currentByteValue, currentByteIndex) => currentImageBytes[currentByteIndex] === currentByteValue)) throw new Error('PNG 원본 형식이 아닙니다.');
  if (currentImageBytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('PNG IHDR 헤더가 없습니다.');
  const currentImageWidth = currentImageBytes.readUInt32BE(16);
  const currentImageHeight = currentImageBytes.readUInt32BE(20);
  if (currentImageWidth === 0 || currentImageHeight === 0) throw new Error('PNG 원본 크기가 올바르지 않습니다.');
  return { width: currentImageWidth, height: currentImageHeight };
}

export function createBillboardCategoryMap(currentCatalogRecord) {
  if (!currentCatalogRecord || !Array.isArray(currentCatalogRecord.billboards) || !currentCatalogRecord.families || typeof currentCatalogRecord.families !== 'object') throw new Error('빌보드 카탈로그 계약 오류');
  const resolvedCategoryRecords = new Map();
  for (const currentBillboardRecord of currentCatalogRecord.billboards) {
    if (!currentBillboardRecord || typeof currentBillboardRecord.texture_key !== 'string' || typeof currentBillboardRecord.family !== 'string') throw new Error('빌보드 항목 계약 오류');
    const currentFamilyRecord = currentCatalogRecord.families[currentBillboardRecord.family];
    if (!currentFamilyRecord || typeof currentFamilyRecord.category !== 'string') throw new Error(`빌보드 계열 분류가 없습니다: ${currentBillboardRecord.family}`);
    if (resolvedCategoryRecords.has(currentBillboardRecord.texture_key)) throw new Error(`빌보드 texture_key 중복: ${currentBillboardRecord.texture_key}`);
    resolvedCategoryRecords.set(currentBillboardRecord.texture_key, currentFamilyRecord.category);
  }
  return resolvedCategoryRecords;
}

export function validateMapSpriteDimensions(currentAssetRecord, currentImageDimensions, currentBillboardCategory, currentAnimationMetadata) {
  if (!currentAssetRecord || typeof currentAssetRecord.path !== 'string') throw new Error('스프라이트 등록 항목 계약 오류');
  if (currentAnimationMetadata !== undefined) {
    if (currentAnimationMetadata?.sheet?.width !== currentImageDimensions.width || currentAnimationMetadata?.sheet?.height !== currentImageDimensions.height) throw new Error(`애니메이션 시트 크기 불일치: ${currentAssetRecord.path}`);
    if (!Array.isArray(currentAnimationMetadata.frames) || currentAnimationMetadata.frames.length === 0) throw new Error(`애니메이션 프레임 누락: ${currentAssetRecord.path}`);
    for (const currentFrameRecord of currentAnimationMetadata.frames) {
      const currentFrameRectangle = currentFrameRecord?.rect;
      if (!currentFrameRectangle || !['x', 'y', 'width', 'height'].every(currentFieldName => Number.isInteger(currentFrameRectangle[currentFieldName])) || currentFrameRectangle.x < 0 || currentFrameRectangle.y < 0 || currentFrameRectangle.width <= 0 || currentFrameRectangle.height <= 0 || currentFrameRectangle.x + currentFrameRectangle.width > currentImageDimensions.width || currentFrameRectangle.y + currentFrameRectangle.height > currentImageDimensions.height) throw new Error(`애니메이션 프레임 영역 오류: ${currentAssetRecord.path}`);
      validateMapSpriteDimensions(currentAssetRecord, currentFrameRectangle, currentBillboardCategory);
    }
    return;
  }
  const { width: currentImageWidth, height: currentImageHeight } = currentImageDimensions;
  if (!Number.isInteger(currentImageWidth) || !Number.isInteger(currentImageHeight)) throw new Error(`스프라이트 PNG 크기 계약 오류: ${currentAssetRecord.path}`);
  if (currentImageWidth > MAXIMUM_MAP_SPRITE_SOURCE_SIZE || currentImageHeight > MAXIMUM_MAP_SPRITE_SOURCE_SIZE) throw new Error(`맵 빌보드·건물 원본은 ${MAXIMUM_MAP_SPRITE_SOURCE_SIZE}px를 초과할 수 없습니다: ${currentAssetRecord.path} (${currentImageWidth}×${currentImageHeight})`);
  if (currentAssetRecord.path.startsWith('assets/billboards/') && currentBillboardCategory === 'tree' && (currentImageWidth !== TREE_BILLBOARD_SOURCE_SIZE || currentImageHeight !== TREE_BILLBOARD_SOURCE_SIZE)) throw new Error(`나무 빌보드 원본은 ${TREE_BILLBOARD_SOURCE_SIZE}×${TREE_BILLBOARD_SOURCE_SIZE}px여야 합니다: ${currentAssetRecord.path} (${currentImageWidth}×${currentImageHeight})`);
  if (currentAssetRecord.path.startsWith('assets/billboards/') && currentBillboardCategory === 'vegetation' && (currentImageWidth !== VEGETATION_BILLBOARD_SOURCE_SIZE || currentImageHeight !== VEGETATION_BILLBOARD_SOURCE_SIZE)) throw new Error(`식생 빌보드 원본은 ${VEGETATION_BILLBOARD_SOURCE_SIZE}×${VEGETATION_BILLBOARD_SOURCE_SIZE}px여야 합니다: ${currentAssetRecord.path} (${currentImageWidth}×${currentImageHeight})`);
}
