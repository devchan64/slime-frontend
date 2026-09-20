import type { ActionCutinEvent } from './actionCutins';
import { parseDocument } from 'yaml';
import actionCutinCatalogSource from '../assets/cutins.yaml?raw';

// 기본 이미지는 코스튬·헤어·얼굴 세 그룹을 합성한 정식 기본 조합이다.
// 새 조합은 전용 합성 산출물을 등록해야 하며 다른 외형으로 대체하지 않는다.
const REGISTERED_ACTION_CUTIN_IMAGES: Record<string, string> = {
  'default-punch': new URL('../assets/characters/default/cutins/default-punch-v1.png', import.meta.url).href,
  slime: new URL('../assets/monsters/slime-v2.png', import.meta.url).href,
  beast: new URL('../assets/monsters/beast-v2.png', import.meta.url).href,
  giant: new URL('../assets/monsters/giant-v2.png', import.meta.url).href,
};
export function parseActionCutinCatalog(actionCutinYamlSource: string): Map<string, string> {
  const parsedCatalogDocument = parseDocument(actionCutinYamlSource, { uniqueKeys: true });
  if (parsedCatalogDocument.errors.length) throw new Error(`액션 컷인 YAML 오류: ${parsedCatalogDocument.errors[0].message}`);
  const parsedCatalogRecords: unknown = parsedCatalogDocument.toJS({ maxAliasCount: 0 });
  if (!Array.isArray(parsedCatalogRecords) || !parsedCatalogRecords.length) throw new Error('액션 컷인 에셋 목록이 필요합니다.');
  const validatedAssetCatalog = new Map<string, string>();
  for (const catalogEntryRecord of parsedCatalogRecords) {
    if (!catalogEntryRecord || typeof catalogEntryRecord !== 'object' || Array.isArray(catalogEntryRecord)) throw new Error('액션 컷인 항목은 객체여야 합니다.');
    const requiredEntryKeys = catalogEntryRecord.kind === 'character' ? ['kind', 'costume', 'hair', 'face', 'asset']
      : catalogEntryRecord.kind === 'monster' ? ['kind', 'group', 'asset'] : [];
    if (!requiredEntryKeys.length || Object.keys(catalogEntryRecord).length !== requiredEntryKeys.length
      || requiredEntryKeys.some(requiredEntryKey => typeof catalogEntryRecord[requiredEntryKey] !== 'string'
        || !/^[a-z0-9-]+$/.test(catalogEntryRecord[requiredEntryKey]))) throw new Error('액션 컷인 항목의 필드 또는 ID가 잘못되었습니다.');
    if (!Object.hasOwn(REGISTERED_ACTION_CUTIN_IMAGES, catalogEntryRecord.asset)) throw new Error('액션 컷인 이미지가 등록되지 않았습니다.');
    const appearanceLookupKey = catalogEntryRecord.kind === 'character'
      ? `character/${catalogEntryRecord.costume}/${catalogEntryRecord.hair}/${catalogEntryRecord.face}` : `monster/${catalogEntryRecord.group}`;
    if (validatedAssetCatalog.has(appearanceLookupKey)) throw new Error('액션 컷인 에셋 그룹이 중복되었습니다.');
    validatedAssetCatalog.set(appearanceLookupKey, REGISTERED_ACTION_CUTIN_IMAGES[catalogEntryRecord.asset]);
  }
  return validatedAssetCatalog;
}
const VALIDATED_ACTION_CUTIN_CATALOG = parseActionCutinCatalog(actionCutinCatalogSource);
export function resolveActionCutinAsset(actionCutinAppearanceRecord: ActionCutinEvent['appearance']): string {
  if (!['character', 'monster'].includes(actionCutinAppearanceRecord.kind)) throw new Error('지원하지 않는 액션 컷인 외형 종류입니다.');
  const appearanceLookupKey = actionCutinAppearanceRecord.kind === 'character'
    ? ['character', actionCutinAppearanceRecord.groups.costume, actionCutinAppearanceRecord.groups.hair, actionCutinAppearanceRecord.groups.face].join('/')
    : `monster/${actionCutinAppearanceRecord.group}`;
  const selectedAssetUrl = VALIDATED_ACTION_CUTIN_CATALOG.get(appearanceLookupKey);
  if (typeof selectedAssetUrl !== 'string') throw new Error('등록되지 않은 액션 컷인 에셋 그룹 조합입니다.');
  return selectedAssetUrl;
}
