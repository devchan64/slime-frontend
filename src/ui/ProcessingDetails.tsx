import type {RefiningContractEntry} from '../client/refining';
import {useTranslation} from '../i18n';

/** 서버가 기록한 가공 분류만 표시하며 이전 계약의 분류를 추측하지 않는다. */
export function ProcessingDetails({currentProcessingQuote}:{currentProcessingQuote:RefiningContractEntry['quote']}) {
  const {t:translateProcessingText}=useTranslation();
  const currentDetailLabels:string[]=[];
  if(currentProcessingQuote.processingMethod) currentDetailLabels.push(translateProcessingText(currentProcessingQuote.processingMethod==='smelting'?'workshop.processingMethodSmelting':'workshop.processingMethodRefining'));
  if(currentProcessingQuote.outputMaterial.materialKind) currentDetailLabels.push(translateProcessingText(currentProcessingQuote.outputMaterial.materialKind==='essence'?'workshop.processingKindEssence':'workshop.processingKindMaterial'));
  return currentDetailLabels.length?<p>{currentDetailLabels.join(' · ')}</p>:null;
}
