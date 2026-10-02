import type {NpcQuestEntry,NpcDialoguePage} from './npc-dialogue-validation.mjs';
export type TimedEventEntry=Omit<NpcQuestEntry,'status'|'destination'>&{
 offerId:string;type:'random'|'season';periodId:string;status:NpcQuestEntry['status']|'EXPIRED';
 acceptanceEndsAt:number;deliveryDeadline:number;acceptedAt:number|null;completedAt:number|null;
 destination:NonNullable<NpcQuestEntry['destination']>;
};
export type TimedEventPage=Omit<NpcDialoguePage,'entries'|'npc'>&{entries:TimedEventEntry[];npc:NpcDialoguePage['npc']|null;nextOffset:number|null};
export declare function parseTimedEventPage(currentResponseValue:unknown):TimedEventPage;
export declare function validateTimedEventAction(currentActionResponse:any,currentRequestedEntry:TimedEventEntry,currentActionName:string,currentOriginalState:any):void;
