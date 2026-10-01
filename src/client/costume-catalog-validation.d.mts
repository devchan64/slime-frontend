export type CostumeCatalogEntry = {
    costumeId: string;
    version: number;
    designId: string;
    designVersion: number;
    nameTranslations: Record<'ko' | 'en', string>;
    descriptionTranslations: Record<'ko' | 'en', string>;
};
export type CostumeCatalogPage = {
    version: 1;
    defaultCostumeId: string;
    entries: CostumeCatalogEntry[];
};
export declare function parseCostumeCatalog(currentResponseValue: unknown): CostumeCatalogPage;
