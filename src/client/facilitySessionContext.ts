import type {Client} from './api';
import {createPositionIdentity} from './positionIdentity';

type FacilitySessionClient = Pick<Client,'tokens'|'state'>;

export function captureFacilitySessionContext(currentSessionClient:FacilitySessionClient){
  return {owner:currentSessionClient.tokens?.user_id,generation:currentSessionClient.state?.generation,
    epoch:currentSessionClient.state?.epoch,character:currentSessionClient.state?.me.id,
    location:currentSessionClient.state?.location?.id,map:currentSessionClient.state?.map.id,
    position:createPositionIdentity(currentSessionClient.state?.me.position)};
}

export function matchesFacilitySessionContext(currentSessionClient:FacilitySessionClient,
  currentOriginalContext:ReturnType<typeof captureFacilitySessionContext>){
  const currentGameState=currentSessionClient.state;
  if(!currentGameState||currentGameState.me.mode!=='FIELD'||currentGameState.me.battleId
    ||currentGameState.battle||currentGameState.reservation)return false;
  const currentSessionContext=captureFacilitySessionContext(currentSessionClient);
  return currentSessionContext.owner===currentOriginalContext.owner
    &&currentSessionContext.generation===currentOriginalContext.generation
    &&currentSessionContext.epoch===currentOriginalContext.epoch
    &&currentSessionContext.character===currentOriginalContext.character
    &&currentSessionContext.location===currentOriginalContext.location
    &&currentSessionContext.map===currentOriginalContext.map
    &&currentSessionContext.position===currentOriginalContext.position;
}
