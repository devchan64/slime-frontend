export type ParcelAttachment={kind:'money';amountP:number}|{kind:'costume';costumeId:string}|{kind:'item';category:string;itemId:string;quantity:number};
export type ParcelEntry={parcelId:string;sentAt:number;expiresAt:number;attachments:ParcelAttachment[];attachmentNames?:({ko:string;en:string}|null)[]};
export type ParcelListing={serverTime:number;characterVersion:number;nextCursor:string|null;entries:ParcelEntry[]};
export function validateParcelListing(currentListingRecord:unknown):ParcelListing;
export function validateParcelAttachments(currentAttachmentEntries:unknown):string[];
export function formatParcelListing(currentListingRecord:unknown,currentNameLocale?:'ko'|'en'|null):string;
export function validateParcelReceipt(currentReceiptRecord:unknown,currentParcelIdentifier:string,currentCharacterIdentifier:string,currentExpectedAttachments?:ParcelAttachment[]):{parcelId:string;characterId:string;facilityId:string;claimedAt:number;attachments:ParcelAttachment[]};

export function validateNamedParcelListing(currentListingRecord:unknown):ParcelListing;
