import {formatParcelListing,validateParcelAttachments,validateParcelReceipt} from '../src/client/parcel-validation.mjs';
export {formatParcelListing} from '../src/client/parcel-validation.mjs';
const PARCEL_IDENTIFIER_PATTERN=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const PARCEL_FACILITY_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
export async function executeParcelCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentFacilityIdentifier,currentParcelIdentifier]=currentCommandArguments;
 if(!['list','claim'].includes(currentActionName)||!PARCEL_FACILITY_PATTERN.test(currentFacilityIdentifier??'')||currentCommandArguments.length<2||currentCommandArguments.length>3||(currentActionName==='claim'&&!currentParcelIdentifier)||(currentParcelIdentifier&&!PARCEL_IDENTIFIER_PATTERN.test(currentParcelIdentifier)))throw new Error('parcels list 길드ID [다음커서] / parcels claim 길드ID 소포ID로 입력하세요.');
 const currentGameState=currentTextClient.state;
 const currentGuildEntry=currentGameState?.map?.buildings?.find(currentBuildingEntry=>currentBuildingEntry.facilityKind==='guild'&&currentBuildingEntry.facilityId===currentFacilityIdentifier);
 if(!currentGuildEntry||currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation||currentGameState.me.position?.column!==currentGuildEntry.entrance?.column||currentGameState.me.position?.row!==currentGuildEntry.entrance?.row)throw new Error('전투·조우를 종료하고 해당 길드회관 입구로 이동하세요.');
 const currentEndpointPrefix='/v1/game/guilds/'+currentFacilityIdentifier+'/parcels';
 if(currentActionName==='list')return formatParcelListing(await currentTextClient.request(currentEndpointPrefix+'?includeNames=true'+(currentParcelIdentifier?'&after='+currentParcelIdentifier:'')),'ko');
 const currentCharacterIdentifier=currentGameState.me.id;
 return currentTextClient.command(currentEndpointPrefix+'/'+currentParcelIdentifier+'/claim',{},currentCommandResult=>'소포 수령 완료: '+currentCommandResult.receipt.parcelId+' · '+validateParcelAttachments(currentCommandResult.receipt.attachments).join(', '),{
  includeRequestIdentifier:false,
  validateCommandResponse(currentCommandResult){
   validateParcelReceipt(currentCommandResult?.receipt,currentParcelIdentifier,currentCharacterIdentifier);
  }
 });
}
