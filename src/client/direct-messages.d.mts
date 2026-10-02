export type DirectMessageEntry={messageId:string;senderId:string;recipientId:string;text:string;sentAt:number;expiresAt:number};
export type DirectMessagePeer={characterId:string;name:string};
export type DirectMessageHistory={serverTime:number;peer:DirectMessagePeer;blocked:boolean;entries:DirectMessageEntry[];nextCursor:string|null};
export type DirectMessageConversations={serverTime:number;entries:(DirectMessagePeer&{latestMessageId:string;sentAt:number})[];nextCursor:string|null};
export type DirectMessageBlocks={entries:DirectMessagePeer[];nextCursor:string|null};
export type PendingDirectMessage={readonly payload:Readonly<{requestId:string;recipientId:string;text:string}>;readonly expiresAt:number};
export class DirectMessageClientError extends Error {messageKey:string;constructor(currentErrorKey:string);}
export function retainUnexpiredDirectMessages(currentMessageEntries:DirectMessageEntry[],currentServerTimestamp:number):DirectMessageEntry[];
export class DirectMessageClient {
  constructor(currentRequestFunction:(currentRequestPath:string,currentRequestBody?:unknown,currentRequestMethod?:'GET'|'POST'|'PUT')=>Promise<unknown>,currentSessionFunction:()=>{characterId:string;generation:number}|null,currentClockFunction?:()=>number);
  disposeDirectMessages():void;
  readDirectMessageTime():number;
  readPendingDirectMessage():PendingDirectMessage|null;
  sendDirectMessageText(currentPeerIdentifier:string,currentMessageText:string):Promise<{messageId:string;sentAt:number}>;
  retryPendingDirectMessage():Promise<{messageId:string;sentAt:number}>;
  listDirectMessageConversations(currentBeforeSequence?:string|null):Promise<DirectMessageConversations>;
  readDirectMessageHistory(currentPeerIdentifier:string,currentBeforeSequence?:string|null):Promise<DirectMessageHistory>;
  readDirectMessageNotice():Promise<{serverTime:number;count:number;latestMessageId:string|null}>;
  acknowledgeDirectMessages(currentMessageIdentifiers:string[]):Promise<{messageIds:string[]}>;
  setDirectMessageBlock(currentPeerIdentifier:string,currentBlockedValue:boolean):Promise<{characterId:string;blocked:boolean}>;
  listDirectMessageBlocks(currentAfterIdentifier?:string|null):Promise<DirectMessageBlocks>;
}
