import { CellAnimation } from './cellAnimation';

export type CellAsset = Readonly<{ assetId: string; version: string; filename: string; hash: string; attribution: string; animation: CellAnimation }>;
/** 배포 파이프라인에서 전달한 공개 단일 에셋 항목만 허용한다. */
export function readCellAsset(value: unknown): CellAsset {
  const keys = ['assetId','version','assetType','files','hashes','licenseId','attribution','compatibleSchemaVersion','animation'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value,key)))
    throw new Error('셀 에셋 manifest 필드가 올바르지 않습니다.');
  const item = value as Record<string, unknown>;
  for (const key of ['assetId','version'])
    if (typeof item[key] !== 'string' || item[key].trim() !== item[key] || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(item[key])) throw new Error('셀 에셋 관리 ID/버전이 올바르지 않습니다.');
  if (item.compatibleSchemaVersion !== 2 || item.assetType !== 'SPRITE_SHEET' || item.licenseId !== 'CC-BY-4.0')
    throw new Error('지원하지 않는 셀 에셋 형식 또는 라이선스입니다.');
  if (!Array.isArray(item.files) || item.files.length !== 1 || typeof item.files[0] !== 'string' || !/^[a-f0-9]{64}\.png$/.test(item.files[0]))
    throw new Error('셀 에셋에는 해시 파일명의 PNG 하나가 필요합니다.');
  const filename = item.files[0], hash = filename.slice(0,-4);
  if (!item.hashes || typeof item.hashes !== 'object' || Array.isArray(item.hashes)
      || Object.keys(item.hashes).length !== 1 || (item.hashes as Record<string,unknown>)[filename] !== hash)
    throw new Error('셀 에셋의 파일명과 해시가 다릅니다.');
  if (typeof item.attribution !== 'string' || !item.attribution.trim()) throw new Error('셀 에셋의 저작자 고지가 필요합니다.');
  return Object.freeze({ assetId: item.assetId as string, version: item.version as string,
    filename, hash, attribution: item.attribution, animation: new CellAnimation(item.animation) });
}

/** 원본 버퍼 변경에 영향받지 않는 검증된 Blob을 텍스처 로더에 전달한다. */
export async function verifyCellSheet(asset: CellAsset, bytes: ArrayBuffer): Promise<Blob> {
  const snapshot = bytes.slice(0);
  const digest = await crypto.subtle.digest('SHA-256', snapshot);
  const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  if (actual !== asset.hash) throw new Error('셀 이미지의 SHA-256이 공개 manifest와 다릅니다.');
  return new Blob([snapshot], { type: 'image/png' });
}
