import type {State} from './types';
import {LocalizedError} from './notice';

export const CHANNEL_ADDRESS_MAX_LENGTH = 100;
const CHANNEL_IDENTIFIER_MAX_LENGTH = 100;
const CHANNEL_ADDRESS_INPUT_PATTERN = /^([A-Za-z]+)([0-9]+)$/;
const CHANNEL_IDENTIFIER_TEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const CHANNEL_LIST_REQUIRED_FIELDS = ['id','address','mapDefinitionId','status'];
const CHANNEL_POPULATION_FIELD_NAMES = ['onlineUsers','reservedSeats','capacity'];
export type ChannelIdentity = {id:string;address:string;mapDefinitionId:string};
export type ChannelListingEntry = ChannelIdentity & {status:'OPEN'|'DRAINING'|'CLOSED';onlineUsers?:number;reservedSeats?:number;capacity?:number};
export type ChannelJoinTarget = {channelId:string}|{address:string};

export function normalizeChannelAddress(currentAddressInput:string):string {
  const currentAddressMatch=CHANNEL_ADDRESS_INPUT_PATTERN.exec(currentAddressInput);
  if(currentAddressInput.length>CHANNEL_ADDRESS_MAX_LENGTH || !currentAddressMatch || currentAddressMatch[0]!==currentAddressInput)
    throw new LocalizedError('channels.invalidAddress');
  const currentRowDigits=currentAddressMatch[2].replace(/^0+/,'');
  if(!currentRowDigits)throw new LocalizedError('channels.invalidAddress');
  return currentAddressMatch[1].toLowerCase()+currentRowDigits;
}

export function parseChannelListing(currentListingValue:unknown):ChannelListingEntry[] {
  if(!Array.isArray(currentListingValue))throw new LocalizedError('channels.invalidList');
  const currentChannelIdentifiers=new Set<string>();
  const currentChannelAddresses=new Set<string>();
  return currentListingValue.map(currentEntryValue=>{
    if(!currentEntryValue || typeof currentEntryValue!=='object' || Array.isArray(currentEntryValue))throw new LocalizedError('channels.invalidList');
    const currentChannelRecord=currentEntryValue as Record<string,unknown>;
    const currentKnownFields=[...CHANNEL_LIST_REQUIRED_FIELDS,...CHANNEL_POPULATION_FIELD_NAMES];
    if(Object.keys(currentChannelRecord).some(currentFieldName=>!currentKnownFields.includes(currentFieldName))
      || CHANNEL_LIST_REQUIRED_FIELDS.some(currentFieldName=>typeof currentChannelRecord[currentFieldName]!=='string'))throw new LocalizedError('channels.invalidList');
    for(const currentIdentifierField of ['id','mapDefinitionId']){
      const currentIdentifierValue=currentChannelRecord[currentIdentifierField] as string;
      if(!currentIdentifierValue || currentIdentifierValue.length>CHANNEL_IDENTIFIER_MAX_LENGTH || CHANNEL_IDENTIFIER_TEXT_PATTERN.exec(currentIdentifierValue)?.[0]!==currentIdentifierValue)
        throw new LocalizedError('channels.invalidList');
    }
    try {if(normalizeChannelAddress(currentChannelRecord.address as string)!==currentChannelRecord.address)throw new Error();}
    catch {throw new LocalizedError('channels.invalidList');}
    if(!['OPEN','DRAINING','CLOSED'].includes(currentChannelRecord.status as string)
      || currentChannelIdentifiers.has(currentChannelRecord.id as string) || currentChannelAddresses.has(currentChannelRecord.address as string))throw new LocalizedError('channels.invalidList');
    const currentPopulationFields=CHANNEL_POPULATION_FIELD_NAMES.filter(currentFieldName=>currentFieldName in currentChannelRecord);
    // 직전 v1 목록의 인원 필드 미제공을 구분한다. 없는 인원을 0으로 표시하지 않는다.
    if(currentPopulationFields.length!==0 && currentPopulationFields.length!==CHANNEL_POPULATION_FIELD_NAMES.length)throw new LocalizedError('channels.invalidList');
    if(currentPopulationFields.some(currentFieldName=>!Number.isSafeInteger(currentChannelRecord[currentFieldName]) || (currentChannelRecord[currentFieldName] as number)<0)
      || (currentPopulationFields.length && ((currentChannelRecord.capacity as number)<2 || (currentChannelRecord.onlineUsers as number)>(currentChannelRecord.reservedSeats as number))))throw new LocalizedError('channels.invalidList');
    currentChannelIdentifiers.add(currentChannelRecord.id as string);
    currentChannelAddresses.add(currentChannelRecord.address as string);
    return {...currentChannelRecord} as ChannelListingEntry;
  });
}

export function compareChannelAddresses(currentFirstEntry:ChannelListingEntry,currentSecondEntry:ChannelListingEntry):number {
  const currentFirstParts=CHANNEL_ADDRESS_INPUT_PATTERN.exec(currentFirstEntry.address)!;
  const currentSecondParts=CHANNEL_ADDRESS_INPUT_PATTERN.exec(currentSecondEntry.address)!;
  return currentFirstParts[1].length-currentSecondParts[1].length
    || (currentFirstParts[1]<currentSecondParts[1]?-1:currentFirstParts[1]>currentSecondParts[1]?1:0)
    || (BigInt(currentFirstParts[2])<BigInt(currentSecondParts[2])?-1:BigInt(currentFirstParts[2])>BigInt(currentSecondParts[2])?1:0);
}

export function channelMovementRestriction(currentGameState:State|null):string|null {
  if(!currentGameState?.channel)return 'channels.stateRequired';
  if(currentGameState.me.mode!=='FIELD' || currentGameState.me.battleId || currentGameState.battle || currentGameState.reservation)return 'channels.fieldRequired';
  if(currentGameState.me.partyId)return 'channels.leaveParty';
  if(currentGameState.me.healthRecoveryPending || currentGameState.me.hp===0)return 'channels.recoveryRequired';
  if((currentGameState.me.fp??0)<0)return 'channels.fpRequired';
  return null;
}

export function channelTargetRestriction(currentGameState:State,currentChannelEntry:ChannelListingEntry):string|null {
  if(currentChannelEntry.mapDefinitionId!==currentGameState.map.id)return 'channels.differentMap';
  if(currentChannelEntry.id===currentGameState.channel?.id)return 'channels.alreadyHere';
  if(currentChannelEntry.status!=='OPEN')return 'channels.closed';
  if(currentChannelEntry.reservedSeats!==undefined && currentChannelEntry.capacity!==undefined && currentChannelEntry.reservedSeats>=currentChannelEntry.capacity)return 'channels.full';
  return null;
}
