import {parseCostumeCatalog} from '../src/client/costume-catalog-validation.mjs';
function sanitizeCostumeText(currentTextValue){return currentTextValue.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
export async function readCostumeCatalog(currentTextClient,currentCommandArguments){
 if(currentCommandArguments.length)throw new Error('costumes로 코스튬 카탈로그를 조회하세요.');
 const currentCatalogPage=parseCostumeCatalog(await currentTextClient.request('/v2/costumes'));
 return '코스튬 카탈로그 · 전체 디자인 · 외형 전용\n'+currentCatalogPage.entries.map(currentCostumeEntry=>[
  sanitizeCostumeText(currentCostumeEntry.nameTranslations.ko)+' ['+currentCostumeEntry.costumeId+'] · 정의 v'+currentCostumeEntry.version+(currentCostumeEntry.costumeId===currentCatalogPage.defaultCostumeId?' · 기본 디자인':''),
  '표준 가치 '+currentCostumeEntry.valueP+'p',
  '디자인 '+currentCostumeEntry.designId+' v'+currentCostumeEntry.designVersion,
  sanitizeCostumeText(currentCostumeEntry.descriptionTranslations.ko),
 ].join('\n')).join('\n\n');
}
