import newMonsterMetadata4 from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/crystal-bat-idle-v1.animation.json';
import newMonsterMetadata3 from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ember-hedgehog-idle-v1.animation.json';
import newMonsterMetadata2 from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/sand-scorpion-idle-v1.animation.json';
import newMonsterMetadata1 from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/mist-frog-idle-v1.animation.json';
import newMonsterMetadata0 from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/moss-turtle-idle-v1.animation.json';
import giantCutinMetadata from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/giant-idle-v1.animation.json';
import beastCutinMetadata from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/beast-idle-v2.animation.json';
import slimeCutinMetadata from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/slime-idle-v2.animation.json';
import boarCutinMetadata from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ridge-boar-idle-v1.animation.json';
import crabCutinMetadata from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/stone-crab-idle-v1.animation.json';
import crawlerCutinMetadata from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/reed-crawler-idle-v1.animation.json';
import mothCutinMetadata from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/lantern-moth-idle-v1.animation.json';
import rabbitCutinMetadata from '../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/field-rabbit-idle-v1.animation.json';
import characterIdleMetadata from '../../../slime-assets/assets/characters/default/animations/idle-v6/down-left-8frames-v1/idle-v6.animation.json';
import type { ActionCutinEvent } from './actionCutins';
import { parseDocument } from 'yaml';
import actionCutinCatalogSource from '../../../slime-assets/assets/ui/cutins.yaml?raw';

// 기본 이미지는 코스튬·헤어·얼굴 세 그룹을 합성한 정식 기본 조합이다.
// 새 조합은 전용 합성 산출물을 등록해야 하며 다른 외형으로 대체하지 않는다.
const REGISTERED_ACTION_CUTIN_IMAGES: Record<string, string> = {
  'crystal-bat': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/crystal-bat-idle-v1.png', import.meta.url).href,
  'ember-hedgehog': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ember-hedgehog-idle-v1.png', import.meta.url).href,
  'sand-scorpion': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/sand-scorpion-idle-v1.png', import.meta.url).href,
  'mist-frog': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/mist-frog-idle-v1.png', import.meta.url).href,
  'moss-turtle': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/moss-turtle-idle-v1.png', import.meta.url).href,
  'ridge-boar': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ridge-boar-idle-v1.png', import.meta.url).href,
  'stone-crab': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/stone-crab-idle-v1.png', import.meta.url).href,
  'field-rabbit': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/field-rabbit-idle-v1.png', import.meta.url).href,
  'lantern-moth': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/lantern-moth-idle-v1.png', import.meta.url).href,
  'reed-crawler': new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/reed-crawler-idle-v1.png', import.meta.url).href,
  'default-punch': new URL('../../../slime-assets/assets/characters/default/battle-cutins/default-punch-v1.png', import.meta.url).href,
  slime: new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/slime-idle-v2.png', import.meta.url).href,
  beast: new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/beast-idle-v2.png', import.meta.url).href,
  giant: new URL('../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/giant-idle-v1.png', import.meta.url).href,
};
const DEFAULT_CHARACTER_IDLE_IMAGE = new URL('../../../slime-assets/assets/characters/default/animations/idle-v6/down-left-8frames-v1/idle-v6.png', import.meta.url).href;
type ActionCutinActorRole = 'attacker' | 'target';
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
export function resolveActionCutinAsset(actionCutinAppearanceRecord: ActionCutinEvent['appearance'], actionCutinActorRole: ActionCutinActorRole): string {
  if (!['character', 'monster'].includes(actionCutinAppearanceRecord.kind)) throw new Error('지원하지 않는 액션 컷인 외형 종류입니다.');
  const appearanceLookupKey = actionCutinAppearanceRecord.kind === 'character'
    ? ['character', actionCutinAppearanceRecord.groups.costume, actionCutinAppearanceRecord.groups.hair, actionCutinAppearanceRecord.groups.face].join('/')
    : `monster/${actionCutinAppearanceRecord.group}`;
  const selectedAssetUrl = VALIDATED_ACTION_CUTIN_CATALOG.get(appearanceLookupKey);
  if (typeof selectedAssetUrl !== 'string') throw new Error('등록되지 않은 액션 컷인 에셋 그룹 조합입니다.');
  if (actionCutinAppearanceRecord.kind === 'character' && actionCutinActorRole === 'target') return DEFAULT_CHARACTER_IDLE_IMAGE;
  return selectedAssetUrl;
}


// 전용 몬스터 컷인 완성 전에는 대기 애니메이션의 전방 좌측 첫 프레임을 사용한다.
const REGISTERED_CUTIN_SHEETS: Record<string, typeof rabbitCutinMetadata> = {
  slime: slimeCutinMetadata, beast: beastCutinMetadata, giant: giantCutinMetadata,
  'moss-turtle': newMonsterMetadata0,
  'mist-frog': newMonsterMetadata1,
  'sand-scorpion': newMonsterMetadata2,
  'ember-hedgehog': newMonsterMetadata3,
  'crystal-bat': newMonsterMetadata4,
  'ridge-boar': boarCutinMetadata,
  'stone-crab': crabCutinMetadata,
  'field-rabbit': rabbitCutinMetadata, 'lantern-moth': mothCutinMetadata, 'reed-crawler': crawlerCutinMetadata,
};
export function resolveActionCutinFrame(actionCutinAppearance: ActionCutinEvent['appearance'], actionCutinActorRole: ActionCutinActorRole) {
  if (actionCutinAppearance.kind === 'character' && actionCutinActorRole === 'target') {
    const selectedIdleFrame = characterIdleMetadata.frames.find(currentIdleFrame => currentIdleFrame.frameId === 'down_left.0');
    if (!selectedIdleFrame) throw new Error('캐릭터 피격 컷인의 대기 첫 프레임이 없습니다.');
    return {rect: selectedIdleFrame.rect, sheet: characterIdleMetadata.sheet};
  }
  if (actionCutinAppearance.kind !== 'monster' || !Object.hasOwn(REGISTERED_CUTIN_SHEETS, actionCutinAppearance.group)) return null;
  const currentSheetMetadata = REGISTERED_CUTIN_SHEETS[actionCutinAppearance.group];
  const selectedSheetFrame = currentSheetMetadata.frames.find(currentSheetFrame => currentSheetFrame.frameId === 'down_left.0');
  if (!selectedSheetFrame) throw new Error('몬스터 컷인의 정면 프레임이 없습니다.');
  return {rect: selectedSheetFrame.rect, sheet: currentSheetMetadata.sheet};
}
