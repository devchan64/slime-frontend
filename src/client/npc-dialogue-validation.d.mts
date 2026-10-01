import { type JournalMaterialItem, type JournalNpcIdentity } from './mainEventJournal';
export declare const NPC_BLOCK_REASON_CODES: readonly ["GIVER_REQUIRED", "RECEIVER_REQUIRED", "PREREQUISITE_REQUIRED", "QUEST_LIMIT_REACHED", "MATERIALS_REQUIRED", "CITIZENSHIP_REQUIRED"];
export type NpcQuestEntry = {
    eventId: string;
    title: string;
    status: 'AVAILABLE' | 'LOCKED' | 'ACCEPTED' | 'COMPLETED';
    dialogue: string;
    items: JournalMaterialItem[];
    moneyP: number;
    action: 'accept' | 'complete' | null;
    canExecute: boolean;
    blockedReasons: string[];
    giverNpcId: string;
    receiverNpcId: string;
};
export type NpcDialoguePage = {
    serverTime: number;
    characterVersion: number;
    npc: JournalNpcIdentity;
    entries: NpcQuestEntry[];
    acceptedCount: number;
    maximumAcceptedCount: number;
};
export declare function parseNpcDialogue(currentResponseValue: any): NpcDialoguePage;
