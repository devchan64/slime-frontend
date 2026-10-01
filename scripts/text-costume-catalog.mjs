import {parseCostumeInventory} from '../src/client/costume-inventory-validation.mjs';
import {parseCostumeCatalog} from '../src/client/costume-catalog-validation.mjs';
function sanitizeCostumeText(currentTextValue){return currentTextValue.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
export async function executeCostumeReadCommand(currentTextClient,currentCommandArguments){
 if(currentCommandArguments.length===1&&currentCommandArguments[0]==='owned')return readOwnedCostumeInventory(currentTextClient);
 if(currentCommandArguments.length)throw new Error('costumes 또는 costumes owned로 조회하세요. 교체는 게임 메뉴에서 진행하세요.');
 const currentCatalogPage=parseCostumeCatalog(await currentTextClient.request('/v2/costumes'));
 return '코스튬 카탈로그 · 전체 디자인 · 외형 전용\n'+currentCatalogPage.entries.map(currentCostumeEntry=>[
  sanitizeCostumeText(currentCostumeEntry.nameTranslations.ko)+' ['+currentCostumeEntry.costumeId+'] · 정의 v'+currentCostumeEntry.version+(currentCostumeEntry.costumeId===currentCatalogPage.defaultCostumeId?' · 기본 디자인':''),
  '표준 가치 '+currentCostumeEntry.valueP+'p',
  '디자인 '+currentCostumeEntry.designId+' v'+currentCostumeEntry.designVersion,
  sanitizeCostumeText(currentCostumeEntry.descriptionTranslations.ko),
 ].join('\n')).join('\n\n');
}

async function readOwnedCostumeInventory(currentTextClient){
 const currentOwnerIdentifier=currentTextClient.tokens?.user_id;
 const currentCharacterIdentifier=currentTextClient.state?.me.id;
 const currentSessionGeneration=currentTextClient.state?.generation;
 if(!currentOwnerIdentifier||!currentCharacterIdentifier||!Number.isSafeInteger(currentSessionGeneration))throw new Error('로그인한 캐릭터 상태를 먼저 조회하세요.');
 const currentInventoryPage=parseCostumeInventory(await currentTextClient.request('/v1/characters/me/costumes'));
 if(currentTextClient.tokens?.user_id!==currentOwnerIdentifier||currentTextClient.state?.me.id!==currentCharacterIdentifier||currentTextClient.state?.generation!==currentSessionGeneration)throw new Error('조회 중 캐릭터 또는 세션이 변경되었습니다. 다시 조회하세요.');
 if(!currentInventoryPage.entries.length)return '보유 코스튬 없음 · 기본 디자인 '+currentInventoryPage.defaultCostumeId+' 사용 가능';
 return '보유 코스튬 · 교체는 게임 메뉴에서 진행하세요.\n'+currentInventoryPage.entries.map(currentOwnedEntry=>[
  sanitizeCostumeText(currentOwnedEntry.nameTranslations.ko)+' ['+currentOwnedEntry.costumeId+'] · 정의 v'+currentOwnedEntry.version,
  '획득 '+(currentOwnedEntry.source==='parcel'?'소포':'상점')+' · '+new Date(currentOwnedEntry.acquiredAt*1000).toISOString(),
  '표준 가치 '+currentOwnedEntry.valueP+'p · 디자인 '+currentOwnedEntry.designId+' v'+currentOwnedEntry.designVersion,
  sanitizeCostumeText(currentOwnedEntry.descriptionTranslations.ko),
 ].join('\n')).join('\n\n');
}
