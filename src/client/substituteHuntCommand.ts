import type {Client} from './api';
import {ApiError} from './response';
import {parseSubstituteHuntReceipt,type SubstituteHuntReceipt} from './substituteHunt';
type PendingHuntCommand={requestId:string;expectedVersion:number;encounterId:string};
const SESSION_HUNT_COMMANDS=new WeakMap<Client,SubstituteHuntCommand>();
export function currentHuntSessionIdentity(currentGameClient:Client){return JSON.stringify([currentGameClient.tokens?.user_id,currentGameClient.state?.generation,currentGameClient.state?.epoch,currentGameClient.state?.me.id]);}
export class SubstituteHuntCommand {
 pendingHuntRequest:PendingHuntCommand|null=null;
 completedHuntReceipt:SubstituteHuntReceipt|null=null;
 activeHuntPromise:Promise<SubstituteHuntReceipt>|null=null;
 readonly originalSessionIdentity:string;
 constructor(private currentGameClient:Client){this.originalSessionIdentity=currentHuntSessionIdentity(currentGameClient);}
 async executeHuntCommand(currentEncounterIdentifier:string,currentCharacterVersion:number):Promise<SubstituteHuntReceipt>{
  if(currentHuntSessionIdentity(this.currentGameClient)!==this.originalSessionIdentity)throw new Error('대체 사냥 세션이 변경되었습니다.');
  if(this.activeHuntPromise)return this.activeHuntPromise;
  if(this.pendingHuntRequest&&this.pendingHuntRequest.encounterId!==currentEncounterIdentifier)throw new Error('이전 대체 사냥 결과를 먼저 확인하세요.');
  this.pendingHuntRequest??={requestId:crypto.randomUUID(),expectedVersion:currentCharacterVersion,encounterId:currentEncounterIdentifier};
  this.activeHuntPromise=this.submitHuntRequest();
  try{return await this.activeHuntPromise;}finally{this.activeHuntPromise=null;}
 }
 private async submitHuntRequest():Promise<SubstituteHuntReceipt>{
  const currentOriginalRequest=this.pendingHuntRequest!;
  try{
   if(!this.completedHuntReceipt)this.completedHuntReceipt=parseSubstituteHuntReceipt(await this.currentGameClient.request('/v1/game/substitute-hunts',currentOriginalRequest),currentOriginalRequest.requestId,currentOriginalRequest.encounterId);
   const currentUpdatedState=await this.currentGameClient.request('/v1/game/state');
   if(currentHuntSessionIdentity(this.currentGameClient)!==this.originalSessionIdentity||currentUpdatedState.me?.id!==this.currentGameClient.state?.me.id||currentUpdatedState.generation!==this.currentGameClient.state?.generation||currentUpdatedState.epoch!==this.currentGameClient.state?.epoch)throw new Error('대체 사냥 응답의 세션이 다릅니다.');
   if(!Number.isSafeInteger(currentUpdatedState.me?.version)||currentUpdatedState.me.version<this.completedHuntReceipt.substituteHunt.characterVersion)throw new Error('대체 사냥 이후의 최신 상태가 필요합니다.');
   this.currentGameClient.accept(currentUpdatedState);
   const currentCompletedReceipt=this.completedHuntReceipt;
   this.pendingHuntRequest=null;this.completedHuntReceipt=null;
   return currentCompletedReceipt;
  }catch(currentRequestError){
   if(!this.completedHuntReceipt&&currentRequestError instanceof ApiError&&currentRequestError.status<500){this.pendingHuntRequest=null;}
   throw currentRequestError;
  }
 }
}
export function getSubstituteHuntCommand(currentGameClient:Client){
 let currentCommandController=SESSION_HUNT_COMMANDS.get(currentGameClient);
 if(!currentCommandController||currentCommandController.originalSessionIdentity!==currentHuntSessionIdentity(currentGameClient)){
  currentCommandController=new SubstituteHuntCommand(currentGameClient);SESSION_HUNT_COMMANDS.set(currentGameClient,currentCommandController);
 }
 return currentCommandController;
}
