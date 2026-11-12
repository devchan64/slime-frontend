/** 저장한 머리 기준이 있으면 해당 프레임의 배치 앵커와의 거리로 높이를 계산한다. */
export function resolveCharacterBodyHeight(sourceMetadataValue: unknown, animationMetadataValue: unknown): number {
  if (!sourceMetadataValue || typeof sourceMetadataValue !== 'object' || Array.isArray(sourceMetadataValue)) throw new Error('캐릭터 출처 메타데이터가 올바르지 않습니다.');
  const sourceMetadataRecord = sourceMetadataValue as Record<string, unknown>;
  if (!Object.hasOwn(sourceMetadataRecord, 'bodyReference')) {
    const legacyBodyHeight = sourceMetadataRecord.referenceBodyHeight;
    if (typeof legacyBodyHeight !== 'number' || !Number.isFinite(legacyBodyHeight) || legacyBodyHeight <= 0) throw new Error('캐릭터 기준 신체 높이가 올바르지 않습니다.');
    return legacyBodyHeight;
  }
  const bodyReferenceValue = sourceMetadataRecord.bodyReference;
  if (!bodyReferenceValue || typeof bodyReferenceValue !== 'object' || Array.isArray(bodyReferenceValue)) throw new Error('머리 기준 형식이 올바르지 않습니다.');
  const bodyReferenceRecord = bodyReferenceValue as Record<string, unknown>;
  if (Object.keys(bodyReferenceRecord).sort().join(',') !== 'frameId,headY' || typeof bodyReferenceRecord.frameId !== 'string' || !bodyReferenceRecord.frameId || typeof bodyReferenceRecord.headY !== 'number' || !Number.isFinite(bodyReferenceRecord.headY)) throw new Error('머리 기준 프레임 또는 Y가 올바르지 않습니다.');
  if (!animationMetadataValue || typeof animationMetadataValue !== 'object' || Array.isArray(animationMetadataValue)) throw new Error('캐릭터 애니메이션 메타데이터가 올바르지 않습니다.');
  const animationFrameRecords = (animationMetadataValue as {frames?: unknown}).frames;
  if (!Array.isArray(animationFrameRecords)) throw new Error('캐릭터 프레임 목록이 올바르지 않습니다.');
  const matchingFrameRecords = animationFrameRecords.filter(currentFrameRecord => currentFrameRecord?.frameId === bodyReferenceRecord.frameId);
  if (matchingFrameRecords.length !== 1) throw new Error('머리 기준 프레임을 정확히 하나 찾을 수 없습니다.');
  const referenceFrameRecord = matchingFrameRecords[0];
  const anchorPositionY = referenceFrameRecord?.anchor?.y;
  const framePixelHeight = referenceFrameRecord?.rect?.height;
  if (typeof anchorPositionY !== 'number' || !Number.isFinite(anchorPositionY) || typeof framePixelHeight !== 'number' || !Number.isFinite(framePixelHeight) || bodyReferenceRecord.headY < 0 || bodyReferenceRecord.headY >= anchorPositionY || anchorPositionY >= framePixelHeight) throw new Error('머리 기준과 배치 앵커의 높이가 올바르지 않습니다.');
  return anchorPositionY - bodyReferenceRecord.headY;
}
