const WORKSHOP_UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireWorkshopCondition(currentConditionResult){
  if(!currentConditionResult)throw new Error('공방 응답 형식이 올바르지 않습니다.');
}
function isWorkshopWholeNumber(currentNumberValue){return Number.isSafeInteger(currentNumberValue)&&Number(currentNumberValue)>=0;}
function validateWorkshopQuote(currentQuoteValue,currentContractKind){
  requireWorkshopCondition(currentQuoteValue&&isWorkshopWholeNumber(currentQuoteValue.costP)&&isWorkshopWholeNumber(currentQuoteValue.durationSeconds)&&currentQuoteValue.durationSeconds>0);
  if(currentQuoteValue.productionResult!==undefined){
    const currentProductionResult=currentQuoteValue.productionResult;
    requireWorkshopCondition(['craft','consumable'].includes(currentContractKind)&&currentProductionResult&&currentProductionResult.productId===currentQuoteValue.definitionId
      &&currentProductionResult.usage===(currentContractKind==='craft'?'equipment':'consumable')&&[1,2].includes(currentProductionResult.itemLevel)&&currentProductionResult.levelPolicyVersion===1
      &&isWorkshopWholeNumber(currentProductionResult.performanceVersion)&&currentProductionResult.performanceVersion>0
      &&isWorkshopWholeNumber(currentProductionResult.quality?.numerator)&&isWorkshopWholeNumber(currentProductionResult.quality?.denominator)
      &&currentProductionResult.quality.denominator>0&&currentProductionResult.quality.numerator>=currentProductionResult.quality.denominator
      &&currentProductionResult.quality.numerator<=3*currentProductionResult.quality.denominator
      &&currentProductionResult.itemLevel===(BigInt(currentProductionResult.quality.numerator)*2n>=BigInt(currentProductionResult.quality.denominator)*3n?2:1)
      &&(currentContractKind==='craft'
        ? isWorkshopWholeNumber(currentProductionResult.performance?.attack_flat_bonus)&&isWorkshopWholeNumber(currentProductionResult.performance?.defense_flat_bonus)
          &&isWorkshopWholeNumber(currentProductionResult.performance?.maximum_durability_value)&&currentProductionResult.performance.maximum_durability_value>0
        : currentQuoteValue.definitionSnapshot?.effect==='restore_hp'&&isWorkshopWholeNumber(currentProductionResult.performance?.restoration_hp_value)
          &&currentProductionResult.performance.restoration_hp_value>0&&Object.keys(currentProductionResult.performance).length===1));
  }
  if(currentContractKind==='consumable')requireWorkshopCondition(Number.isSafeInteger(currentQuoteValue.quantity)&&currentQuoteValue.quantity>0&&currentQuoteValue.quantity<=1000
    &&Number.isSafeInteger(currentQuoteValue.unitDurationSeconds)&&currentQuoteValue.unitDurationSeconds>0
    &&Number.isSafeInteger(currentQuoteValue.unitCostP)&&currentQuoteValue.unitCostP>0
    &&currentQuoteValue.durationSeconds===currentQuoteValue.quantity*currentQuoteValue.unitDurationSeconds
    &&(currentQuoteValue.baseCostP??currentQuoteValue.costP)===currentQuoteValue.quantity*currentQuoteValue.unitCostP);
  if(['baseCostP','missingMaterialValueP','missingMaterialCostP','materialPricing','materialAllocation'].some(currentFieldName=>currentFieldName in currentQuoteValue)){
    const currentPricingPolicy=currentQuoteValue.materialPricing;
    requireWorkshopCondition(currentContractKind!=='repair'&&isWorkshopWholeNumber(currentQuoteValue.baseCostP)
      &&isWorkshopWholeNumber(currentQuoteValue.missingMaterialValueP)&&isWorkshopWholeNumber(currentQuoteValue.missingMaterialCostP)
      &&currentQuoteValue.costP===currentQuoteValue.baseCostP+currentQuoteValue.missingMaterialCostP
      &&currentPricingPolicy?.priceSource==='guild_purchase'&&currentPricingPolicy.rounding==='ceil'
      &&isWorkshopWholeNumber(currentPricingPolicy.version)&&currentPricingPolicy.version>0
      &&isWorkshopWholeNumber(currentPricingPolicy.guildPriceVersion)&&currentPricingPolicy.guildPriceVersion>0
      &&isWorkshopWholeNumber(currentPricingPolicy.numerator)&&currentPricingPolicy.numerator>0
      &&isWorkshopWholeNumber(currentPricingPolicy.denominator)&&currentPricingPolicy.denominator>0
      &&currentQuoteValue.missingMaterialCostP===Math.ceil(currentQuoteValue.missingMaterialValueP*currentPricingPolicy.numerator/currentPricingPolicy.denominator)
      &&Array.isArray(currentQuoteValue.materialAllocation));
    const currentMaterialIdentifiers=new Set();
    let currentMissingValue=0;
    for(const currentMaterialEntry of currentQuoteValue.materialAllocation){
      requireWorkshopCondition(currentMaterialEntry&&typeof currentMaterialEntry.materialId==='string'&&currentMaterialEntry.materialId.trim()
        &&!currentMaterialIdentifiers.has(currentMaterialEntry.materialId)
        &&isWorkshopWholeNumber(currentMaterialEntry.quantity)&&currentMaterialEntry.quantity>0
        &&isWorkshopWholeNumber(currentMaterialEntry.ownedQuantity)&&isWorkshopWholeNumber(currentMaterialEntry.consumedQuantity)
        &&isWorkshopWholeNumber(currentMaterialEntry.missingQuantity)&&isWorkshopWholeNumber(currentMaterialEntry.unitPriceP)&&currentMaterialEntry.unitPriceP>0
        &&currentMaterialEntry.consumedQuantity===Math.min(currentMaterialEntry.quantity,currentMaterialEntry.ownedQuantity)
        &&currentMaterialEntry.missingQuantity===currentMaterialEntry.quantity-currentMaterialEntry.consumedQuantity);
      currentMaterialIdentifiers.add(currentMaterialEntry.materialId);
      currentMissingValue+=currentMaterialEntry.missingQuantity*currentMaterialEntry.unitPriceP;
    }
    requireWorkshopCondition(Number.isSafeInteger(currentMissingValue)&&currentMissingValue===currentQuoteValue.missingMaterialValueP);
  }
  if(currentContractKind!=='repair')requireWorkshopCondition(typeof currentQuoteValue.definitionSnapshot?.name==='string'&&typeof currentQuoteValue.definitionSnapshot?.englishName==='string');
  else for(const currentDurabilitySnapshot of [currentQuoteValue.before,currentQuoteValue.after])
    requireWorkshopCondition(currentDurabilitySnapshot&&isWorkshopWholeNumber(currentDurabilitySnapshot.currentDurability)&&isWorkshopWholeNumber(currentDurabilitySnapshot.maxDurability)
      &&currentDurabilitySnapshot.currentDurability<=currentDurabilitySnapshot.maxDurability);
}
export function parseWorkshopQuote(currentResponseValue,currentContractKind,currentRequestedSelection){
  requireWorkshopCondition(currentResponseValue&&isWorkshopWholeNumber(currentResponseValue.characterVersion)&&typeof currentResponseValue.quoteToken==='string'&&/^[0-9a-f]{64}$/.test(currentResponseValue.quoteToken));
  if(currentResponseValue.ownedCoins!==undefined)requireWorkshopCondition(isWorkshopWholeNumber(currentResponseValue.ownedCoins));
  validateWorkshopQuote(currentResponseValue.quote,currentContractKind);
  if(currentContractKind==='repair')requireWorkshopCondition(isWorkshopWholeNumber(currentResponseValue.quote.instanceVersion)&&currentResponseValue.quote.instanceVersion>0);
  if(currentRequestedSelection!==undefined){
    requireWorkshopCondition(typeof currentRequestedSelection.targetId==='string'&&currentRequestedSelection.targetId.length>0
      &&(currentContractKind==='repair'?currentResponseValue.quote.instanceId:currentResponseValue.quote.definitionId)===currentRequestedSelection.targetId);
    if(currentRequestedSelection.materialInputs!==undefined)requireWorkshopCondition(['craft','consumable'].includes(currentContractKind)&&matchesWorkshopMaterials(currentRequestedSelection.materialInputs,currentContractKind==='craft'?currentResponseValue.quote.selectedMaterials:currentResponseValue.quote.requiredMaterials)&&matchesWorkshopMaterials(currentRequestedSelection.materialInputs,currentResponseValue.materials));
    if(currentContractKind==='consumable')requireWorkshopCondition(Number.isSafeInteger(currentRequestedSelection.quantity)&&currentRequestedSelection.quantity>=1
      &&currentRequestedSelection.quantity<=1000&&currentResponseValue.quote.quantity===currentRequestedSelection.quantity);
  }

  requireWorkshopCondition(Array.isArray(currentResponseValue.materials));
  const seenMaterialIdentifiers=new Set();
  for(const currentMaterialRecord of currentResponseValue.materials){requireWorkshopCondition(currentMaterialRecord&&isWorkshopWholeNumber(currentMaterialRecord.quantity)&&currentMaterialRecord.quantity>0
    &&(currentMaterialRecord.ownedQuantity===undefined||isWorkshopWholeNumber(currentMaterialRecord.ownedQuantity))
    &&typeof currentMaterialRecord.nameTranslations?.ko==='string'&&typeof currentMaterialRecord.nameTranslations?.en==='string');
    if(['materialId','consumedQuantity','missingQuantity'].some(currentFieldName=>currentFieldName in currentMaterialRecord)){
      requireWorkshopCondition(typeof currentMaterialRecord.materialId==='string'&&currentMaterialRecord.materialId.trim()
        &&!seenMaterialIdentifiers.has(currentMaterialRecord.materialId)&&isWorkshopWholeNumber(currentMaterialRecord.ownedQuantity)
        &&isWorkshopWholeNumber(currentMaterialRecord.consumedQuantity)&&isWorkshopWholeNumber(currentMaterialRecord.missingQuantity)
        &&currentMaterialRecord.consumedQuantity===Math.min(currentMaterialRecord.quantity,currentMaterialRecord.ownedQuantity)
        &&currentMaterialRecord.missingQuantity===currentMaterialRecord.quantity-currentMaterialRecord.consumedQuantity);
      seenMaterialIdentifiers.add(currentMaterialRecord.materialId);
    }
  }
  if(currentResponseValue.quote.materialAllocation!==undefined){
    const currentQuotedAllocations=currentResponseValue.quote.materialAllocation;
    requireWorkshopCondition(currentResponseValue.materials.length===currentQuotedAllocations.length);
    const currentAllocationLookup=new Map(currentQuotedAllocations.map(currentMaterialEntry=>[currentMaterialEntry.materialId,currentMaterialEntry]));
    for(const currentDisplayedMaterial of currentResponseValue.materials){
      const currentQuotedMaterial=currentAllocationLookup.get(currentDisplayedMaterial.materialId);
      requireWorkshopCondition(currentQuotedMaterial&&['quantity','ownedQuantity','consumedQuantity','missingQuantity'].every(currentFieldName=>currentDisplayedMaterial[currentFieldName]===currentQuotedMaterial[currentFieldName]));
    }
  }
  return currentResponseValue;
}
export function parseWorkshopContracts(currentResponseValue,currentContractKind){
  requireWorkshopCondition(currentResponseValue&&isWorkshopWholeNumber(currentResponseValue.characterVersion)&&Number.isFinite(currentResponseValue.serverTime)
    &&(currentResponseValue.nextCursor===null||typeof currentResponseValue.nextCursor==='string'&&WORKSHOP_UUID_PATTERN.test(currentResponseValue.nextCursor))&&Array.isArray(currentResponseValue.entries));
  const currentContractIdentifiers=new Set();
  for(const currentContractRecord of currentResponseValue.entries){
    requireWorkshopCondition(currentContractRecord&&typeof currentContractRecord.contractId==='string'&&WORKSHOP_UUID_PATTERN.test(currentContractRecord.contractId)
      &&!currentContractIdentifiers.has(currentContractRecord.contractId)&&currentContractRecord.kind===currentContractKind
      &&Number.isFinite(currentContractRecord.startedAt)&&Number.isFinite(currentContractRecord.readyAt)&&currentContractRecord.readyAt>currentContractRecord.startedAt
      &&(currentContractRecord.claimedAt===null||Number.isFinite(currentContractRecord.claimedAt)));
    currentContractIdentifiers.add(currentContractRecord.contractId);
    requireWorkshopCondition(currentContractRecord.status===(currentContractRecord.claimedAt!==null?'CLAIMED':currentResponseValue.serverTime>=currentContractRecord.readyAt?'READY':'IN_PROGRESS'));
    validateWorkshopQuote(currentContractRecord.quote,currentContractKind);
  }
  return currentResponseValue;
}
export function parseWorkshopCatalog(currentResponseValue){
  requireWorkshopCondition(currentResponseValue&&Array.isArray(currentResponseValue.items));
  const currentCatalogIdentifiers=new Set();
  for(const currentCatalogItem of currentResponseValue.items){
    requireWorkshopCondition(currentCatalogItem&&[currentCatalogItem.id,currentCatalogItem.name,currentCatalogItem.englishName].every(currentTextValue=>typeof currentTextValue==='string'&&!!currentTextValue.trim())&&!currentCatalogIdentifiers.has(currentCatalogItem.id));
    const currentMaterialSelections=[];
    if(currentCatalogItem.materialSelection!==undefined)currentMaterialSelections.push(currentCatalogItem.materialSelection);
    if(currentCatalogItem.materialSlots!==undefined){
      requireWorkshopCondition(currentCatalogItem.materialSelection===undefined&&Array.isArray(currentCatalogItem.materialSlots)&&currentCatalogItem.materialSlots.length>0);
      const currentSeenSlots=new Set();
      for(const currentMaterialSlot of currentCatalogItem.materialSlots){
        requireWorkshopCondition(currentMaterialSlot&&typeof currentMaterialSlot.slotId==='string'&&!!currentMaterialSlot.slotId.trim()&&!currentSeenSlots.has(currentMaterialSlot.slotId));
        currentSeenSlots.add(currentMaterialSlot.slotId);currentMaterialSelections.push(currentMaterialSlot);
      }
    }
    const currentAllSlotMaterials=new Set();
    for(const currentMaterialSelection of currentMaterialSelections){
      requireWorkshopCondition(currentMaterialSelection&&isWorkshopWholeNumber(currentMaterialSelection.requiredQuantity)&&currentMaterialSelection.requiredQuantity>0&&Array.isArray(currentMaterialSelection.choices)&&currentMaterialSelection.choices.length>0);
      const currentSeenMaterials=new Set();
      for(const currentMaterialChoice of currentMaterialSelection.choices){
        requireWorkshopCondition(currentMaterialChoice&&typeof currentMaterialChoice.materialId==='string'&&!!currentMaterialChoice.materialId.trim()&&!currentSeenMaterials.has(currentMaterialChoice.materialId)
          &&['low','medium','high'].includes(currentMaterialChoice.grade)&&isWorkshopWholeNumber(currentMaterialChoice.ownedQuantity)
          &&['ko','en'].every(currentLanguageCode=>typeof currentMaterialChoice.nameTranslations?.[currentLanguageCode]==='string'&&!!currentMaterialChoice.nameTranslations[currentLanguageCode].trim()));
        requireWorkshopCondition(!currentAllSlotMaterials.has(currentMaterialChoice.materialId));
        currentAllSlotMaterials.add(currentMaterialChoice.materialId);
        currentSeenMaterials.add(currentMaterialChoice.materialId);
      }
      requireWorkshopCondition(currentSeenMaterials.has(currentMaterialSelection.defaultMaterialId));
    }
    currentCatalogIdentifiers.add(currentCatalogItem.id);
  }
  return currentResponseValue.items;
}



export function matchesWorkshopMaterials(currentExpectedMaterials,currentActualMaterials){
 if(!Array.isArray(currentExpectedMaterials)||!Array.isArray(currentActualMaterials)||!currentExpectedMaterials.length||currentExpectedMaterials.length!==currentActualMaterials.length)return false;
 const currentExpectedMap=new Map(),currentSeenIdentifiers=new Set();
 for(const currentMaterialEntry of currentExpectedMaterials){
  if(!currentMaterialEntry||typeof currentMaterialEntry.materialId!=='string'||!currentMaterialEntry.materialId.trim()||!isWorkshopWholeNumber(currentMaterialEntry.quantity)||currentMaterialEntry.quantity<1||currentExpectedMap.has(currentMaterialEntry.materialId))return false;
  currentExpectedMap.set(currentMaterialEntry.materialId,currentMaterialEntry.quantity);
 }
 return currentActualMaterials.every(currentMaterialEntry=>{
  if(!currentMaterialEntry||currentSeenIdentifiers.has(currentMaterialEntry.materialId)||currentExpectedMap.get(currentMaterialEntry.materialId)!==currentMaterialEntry.quantity)return false;
  currentSeenIdentifiers.add(currentMaterialEntry.materialId);return true;
 });
}
