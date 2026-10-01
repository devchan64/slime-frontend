export type JournalNpcIdentity = {
    id: string;
    name: string;
    cityId: string;
    facilityId: string;
};
export type JournalMaterialItem = {
    itemId: string;
    required: number;
    owned: number;
    nameTranslations: {
        ko: string;
        en: string;
    };
};
export type MainJournalEntry = {
    eventId: string;
    title: string;
    acceptedAt: number;
    completedAt: number | null;
    moneyP: number;
    status: 'ACCEPTED' | 'COMPLETED';
    materialsSufficient: boolean;
    giver: JournalNpcIdentity;
    receiver: JournalNpcIdentity;
    items: JournalMaterialItem[];
};
export type MainJournalPage = {
    serverTime: number;
    characterVersion: number;
    entries: MainJournalEntry[];
    acceptedCount?: number;
    maximumAcceptedCount?: number;
};
export declare function parseMainEventJournal(currentResponseValue: unknown): MainJournalPage;
