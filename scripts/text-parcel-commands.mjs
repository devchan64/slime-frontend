import {formatParcelListing,validateParcelAttachments,validateParcelReceipt} from '../src/client/parcel-validation.mjs';
export {formatParcelListing} from '../src/client/parcel-validation.mjs';
const PARCEL_IDENTIFIER_PATTERN=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const PARCEL_FACILITY_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
function captureParcelListingContext(currentTextClient){
 const currentGameState=currentTextClient.state;
 return JSON.stringify([currentTextClient.tokens?.user_id,currentGameState?.me.id,currentGameState?.generation,
  currentGameState?.epoch,currentGameState?.location?.id,currentGameState?.map?.id,
  currentGameState?.me.position?.column,currentGameState?.me.position?.row,currentGameState?.me.mode,currentGameState?.me.battleId]);
}
export async function executeParcelCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentFacilityIdentifier,currentParcelIdentifier]=currentCommandArguments;
 if(!['list','claim'].includes(currentActionName)||!PARCEL_FACILITY_PATTERN.test(currentFacilityIdentifier??'')||currentCommandArguments.length<2||currentCommandArguments.length>3||(currentActionName==='claim'&&!currentParcelIdentifier)||(currentParcelIdentifier&&!PARCEL_IDENTIFIER_PATTERN.test(currentParcelIdentifier)))throw new Error('parcels list 길드ID [다음커서] / parcels claim 길드ID 소포ID로 입력하세요.');
 const currentGameState=currentTextClient.state;
 const currentGuildEntry=currentGameState?.map?.buildings?.find(currentBuildingEntry=>currentBuildingEntry.facilityKind==='guild'&&currentBuildingEntry.facilityId===currentFacilityIdentifier);
 if(!currentGuildEntry||currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation||currentGameState.me.position?.column!==currentGuildEntry.entrance?.column||currentGameState.me.position?.row!==currentGuildEntry.entrance?.row)throw new Error('전투·조우를 종료하고 해당 길드회관 입구로 이동하세요.');
 const currentEndpointPrefix='/v1/game/guilds/'+currentFacilityIdentifier+'/parcels';
 const currentListingContext=captureParcelListingContext(currentTextClient);
 if(currentActionName==='list'){
  currentTextClient.parcelListingReceiptContext=null;
  const currentListingRecord=await currentTextClient.request(currentEndpointPrefix+'?includeNames=true'+(currentParcelIdentifier?'&after='+currentParcelIdentifier:''));
  const currentListingText=formatParcelListing(currentListingRecord,'ko');
  if(captureParcelListingContext(currentTextClient)!==currentListingContext)throw new Error('소포 조회 중 캐릭터·세션·위치가 바뀌었습니다. 다시 조회하세요.');
  currentTextClient.parcelListingReceiptContext={context:currentListingContext,entries:structuredClone(currentListingRecord.entries)};
  return currentListingText;
 }
 const currentExpectedAttachments=currentTextClient.parcelListingReceiptContext?.context===currentListingContext
  ?currentTextClient.parcelListingReceiptContext.entries.find(currentParcelEntry=>currentParcelEntry.parcelId===currentParcelIdentifier)?.attachments:undefined;
 const currentCharacterIdentifier=currentGameState.me.id;
 return currentTextClient.command(currentEndpointPrefix+'/'+currentParcelIdentifier+'/claim',{},currentCommandResult=>'소포 수령 완료: '+currentCommandResult.receipt.parcelId+' · '+validateParcelAttachments(currentCommandResult.receipt.attachments).join(', '),{
  includeRequestIdentifier:false,
  validateCommandResponse(currentCommandResult){
   validateParcelReceipt(currentCommandResult?.receipt,currentParcelIdentifier,currentCharacterIdentifier,currentExpectedAttachments);
  }
 });
}
