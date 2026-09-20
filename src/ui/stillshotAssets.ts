import type { BattleStillshotEvent } from './battleStillshots';
import { parseDocument } from 'yaml';
import stillshotCatalogSource from '../assets/stillshots.yaml?raw';

// 기본 이미지는 코스튬·헤어·얼굴 세 그룹을 합성한 정식 기본 조합이다.
// 새 조합은 전용 합성 산출물을 등록해야 하며 다른 외형으로 대체하지 않는다.
const REGISTERED_STILLSHOT_IMAGES: Record<string, string> = {
  'default-character': new URL('../assets/characters/default-v1.png', import.meta.url).href,
  slime: new URL('../assets/monsters/slime-v2.png', import.meta.url).href,
  beast: new URL('../assets/monsters/beast-v2.png', import.meta.url).href,
  giant: new URL('../assets/monsters/giant-v2.png', import.meta.url).href,
};
export function parseStillshotCatalog(stillshotYamlSource: string): Map<string, string> {
  const parsedCatalogDocument = parseDocument(stillshotYamlSource, { uniqueKeys: true });
  if (parsedCatalogDocument.errors.length) throw new Error(`스틸샷 YAML 오류: ${parsedCatalogDocument.errors[0].message}`);
  const parsedCatalogRecords: unknown = parsedCatalogDocument.toJS({ maxAliasCount: 0 });
  if (!Array.isArray(parsedCatalogRecords) || !parsedCatalogRecords.length) throw new Error('스틸샷 에셋 목록이 필요합니다.');
  const validatedAssetCatalog = new Map<string, string>();
  for (const catalogEntryRecord of parsedCatalogRecords) {
    if (!catalogEntryRecord || typeof catalogEntryRecord !== 'object' || Array.isArray(catalogEntryRecord)) throw new Error('스틸샷 항목은 객체여야 합니다.');
    const requiredEntryKeys = catalogEntryRecord.kind === 'character' ? ['kind', 'costume', 'hair', 'face', 'asset']
      : catalogEntryRecord.kind === 'monster' ? ['kind', 'group', 'asset'] : [];
    if (!requiredEntryKeys.length || Object.keys(catalogEntryRecord).length !== requiredEntryKeys.length
      || requiredEntryKeys.some(requiredEntryKey => typeof catalogEntryRecord[requiredEntryKey] !== 'string'
        || !/^[a-z0-9-]+$/.test(catalogEntryRecord[requiredEntryKey]))) throw new Error('스틸샷 항목의 필드 또는 ID가 잘못되었습니다.');
    if (!Object.hasOwn(REGISTERED_STILLSHOT_IMAGES, catalogEntryRecord.asset)) throw new Error('스틸샷 이미지가 등록되지 않았습니다.');
    const appearanceLookupKey = catalogEntryRecord.kind === 'character'
      ? `character/${catalogEntryRecord.costume}/${catalogEntryRecord.hair}/${catalogEntryRecord.face}` : `monster/${catalogEntryRecord.group}`;
    if (validatedAssetCatalog.has(appearanceLookupKey)) throw new Error('스틸샷 에셋 그룹이 중복되었습니다.');
    validatedAssetCatalog.set(appearanceLookupKey, REGISTERED_STILLSHOT_IMAGES[catalogEntryRecord.asset]);
  }
  return validatedAssetCatalog;
}
const VALIDATED_STILLSHOT_CATALOG = parseStillshotCatalog(stillshotCatalogSource);
export function resolveStillshotAsset(stillshotAppearanceRecord: BattleStillshotEvent['appearance']): string {
  if (!['character', 'monster'].includes(stillshotAppearanceRecord.kind)) throw new Error('지원하지 않는 스틸샷 외형 종류입니다.');
  const appearanceLookupKey = stillshotAppearanceRecord.kind === 'character'
    ? ['character', stillshotAppearanceRecord.groups.costume, stillshotAppearanceRecord.groups.hair, stillshotAppearanceRecord.groups.face].join('/')
    : `monster/${stillshotAppearanceRecord.group}`;
  const selectedAssetUrl = VALIDATED_STILLSHOT_CATALOG.get(appearanceLookupKey);
  if (typeof selectedAssetUrl !== 'string') throw new Error('등록되지 않은 스틸샷 에셋 그룹 조합입니다.');
  return selectedAssetUrl;
}
