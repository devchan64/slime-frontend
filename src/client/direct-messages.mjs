// 개인 본문은 이 인스턴스의 메모리에만 보관한다. 공개 상태·영구 저장소와 분리한다.
const DIRECT_MESSAGE_API_ROOT='/v1/direct-messages';
const DIRECT_MESSAGE_TEXT_LIMIT=1000;
const DIRECT_MESSAGE_MAX_SEQUENCE=9223372036854775807n;
export class DirectMessageClientError extends Error {
  constructor(currentErrorKey){super(currentErrorKey);this.messageKey=currentErrorKey;}
}
function requireDirectMessageValue(currentValidValue,currentErrorKey='invalidResponse'){
  if(!currentValidValue)throw new DirectMessageClientError(currentErrorKey);
}
function isDirectMessageIdentifier(currentIdentifierValue){return typeof currentIdentifierValue==='string'&&currentIdentifierValue.length>0&&currentIdentifierValue.length<=200;}
function isDirectMessageSequence(currentSequenceValue){return typeof currentSequenceValue==='string'&&/^[1-9][0-9]{0,18}$/.test(currentSequenceValue)&&BigInt(currentSequenceValue)<=DIRECT_MESSAGE_MAX_SEQUENCE;}
function isDirectMessageTimestamp(currentTimestampValue){return Number.isFinite(currentTimestampValue)&&currentTimestampValue>0;}
function validateDirectMessagePage(currentResponseValue){
  requireDirectMessageValue(Array.isArray(currentResponseValue?.entries)&&currentResponseValue.entries.length<=50);
  requireDirectMessageValue(currentResponseValue.nextCursor===null||isDirectMessageSequence(currentResponseValue.nextCursor));
}
export function retainUnexpiredDirectMessages(currentMessageEntries,currentServerTimestamp){
  return currentMessageEntries.filter(currentMessageEntry=>currentMessageEntry.expiresAt>currentServerTimestamp);
}
export class DirectMessageClient {
  constructor(currentRequestFunction,currentSessionFunction,currentClockFunction=()=>performance.now()){
    this.currentRequestFunction=currentRequestFunction;this.currentSessionFunction=currentSessionFunction;
    this.currentSessionIdentity=currentSessionFunction();this.currentClockFunction=currentClockFunction;
    requireDirectMessageValue(isDirectMessageIdentifier(this.currentSessionIdentity?.characterId)&&Number.isSafeInteger(this.currentSessionIdentity?.generation),'sessionChanged');
    this.currentPendingRequest=null;this.currentSendActive=false;this.currentClientDisposed=false;this.currentServerAnchor=null;
  }
  disposeDirectMessages(){this.currentClientDisposed=true;this.currentPendingRequest=null;this.currentServerAnchor=null;}
  requireDirectMessageSession(){
    const currentSessionIdentity=this.currentSessionFunction();
    if(this.currentClientDisposed||currentSessionIdentity?.characterId!==this.currentSessionIdentity.characterId||currentSessionIdentity?.generation!==this.currentSessionIdentity.generation){
      this.disposeDirectMessages();throw new DirectMessageClientError('sessionChanged');
    }
  }
  readDirectMessageTime(){
    return this.currentServerAnchor?this.currentServerAnchor.timestamp+(this.currentClockFunction()-this.currentServerAnchor.receivedAt)/1000:0;
  }
  acceptDirectMessageTime(currentServerTimestamp,currentRequestStarted){
    requireDirectMessageValue(isDirectMessageTimestamp(currentServerTimestamp));
    this.currentServerAnchor={timestamp:Math.max(this.readDirectMessageTime(),currentServerTimestamp+(this.currentClockFunction()-currentRequestStarted)/1000),receivedAt:this.currentClockFunction()};
  }
  async requestDirectMessageData(currentRequestPath,currentRequestBody,currentRequestMethod){
    this.requireDirectMessageSession();
    const currentRequestStarted=this.currentClockFunction();
    const currentResponseValue=await this.currentRequestFunction(DIRECT_MESSAGE_API_ROOT+currentRequestPath,currentRequestBody,currentRequestMethod);
    this.requireDirectMessageSession();
    requireDirectMessageValue(currentResponseValue&&typeof currentResponseValue==='object');
    if('serverTime' in currentResponseValue)this.acceptDirectMessageTime(currentResponseValue.serverTime,currentRequestStarted);
    return currentResponseValue;
  }
  readPendingDirectMessage(){
    this.requireDirectMessageSession();
    if(this.currentPendingRequest&&this.currentPendingRequest.expiresAt<=this.readDirectMessageTime())this.currentPendingRequest=null;
    return this.currentPendingRequest;
  }
  async sendDirectMessageText(currentPeerIdentifier,currentMessageText){
    this.requireDirectMessageSession();
    requireDirectMessageValue(!this.currentSendActive&&!this.readPendingDirectMessage(),'pendingSend');
    requireDirectMessageValue(isDirectMessageIdentifier(currentPeerIdentifier)&&currentPeerIdentifier!==this.currentSessionIdentity.characterId,'invalidRecipient');
    requireDirectMessageValue(typeof currentMessageText==='string'&&currentMessageText.trim().length>0&&Array.from(currentMessageText).length<=DIRECT_MESSAGE_TEXT_LIMIT,'invalidText');
    this.currentSendActive=true;
    try{
      const currentRequestStarted=this.currentClockFunction();
      const currentRequestTicket=await this.requestDirectMessageData('/request-id');
      requireDirectMessageValue(currentRequestTicket.characterId===this.currentSessionIdentity.characterId&&typeof currentRequestTicket.requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(currentRequestTicket.requestId));
      const currentIssuedTimestamp=parseInt(currentRequestTicket.requestId.replaceAll('-','').slice(0,12),16)/1000;
      requireDirectMessageValue(currentRequestTicket.firstSendBefore===currentIssuedTimestamp+60&&currentRequestTicket.expiresAt===currentIssuedTimestamp+30*86400);
      this.acceptDirectMessageTime(currentIssuedTimestamp,currentRequestStarted);
      requireDirectMessageValue(this.readDirectMessageTime()<currentRequestTicket.firstSendBefore,'requestExpired');
      this.currentPendingRequest=Object.freeze({payload:Object.freeze({requestId:currentRequestTicket.requestId,recipientId:currentPeerIdentifier,text:currentMessageText}),expiresAt:currentRequestTicket.expiresAt});
      return await this.submitPendingDirectMessage();
    }finally{this.currentSendActive=false;}
  }
  async retryPendingDirectMessage(){
    requireDirectMessageValue(!this.currentSendActive,'pendingSend');
    requireDirectMessageValue(this.readPendingDirectMessage(),'noPendingSend');
    this.currentSendActive=true;
    try{return await this.submitPendingDirectMessage();}finally{this.currentSendActive=false;}
  }
  async submitPendingDirectMessage(){
    const currentPendingRequest=this.readPendingDirectMessage();
    requireDirectMessageValue(currentPendingRequest,'noPendingSend');
    try{
      const currentSendReceipt=await this.requestDirectMessageData('/messages',currentPendingRequest.payload);
      requireDirectMessageValue(isDirectMessageSequence(currentSendReceipt.messageId)&&isDirectMessageTimestamp(currentSendReceipt.sentAt));
      this.currentPendingRequest=null;
      return currentSendReceipt;
    }catch(currentRequestError){
      // 명시적인 서버 거절만 해제한다. 통신·응답 해석 실패는 원래 ID로 재확인한다.
      if(['DIRECT_MESSAGE_REJECTED','DIRECT_MESSAGE_RATE_LIMIT','DIRECT_MESSAGE_EXPIRED'].includes(currentRequestError.code))this.currentPendingRequest=null;
      throw currentRequestError;
    }
  }
  async listDirectMessageConversations(currentBeforeSequence=null){
    requireDirectMessageValue(currentBeforeSequence===null||isDirectMessageSequence(currentBeforeSequence));
    const currentConversationPage=await this.requestDirectMessageData('/conversations'+(currentBeforeSequence?'?before='+currentBeforeSequence:''));
    validateDirectMessagePage(currentConversationPage);
    requireDirectMessageValue(isDirectMessageTimestamp(currentConversationPage.serverTime));
    const currentPeerIdentifiers=new Set();
    for(const currentConversationEntry of currentConversationPage.entries){
      requireDirectMessageValue(isDirectMessageIdentifier(currentConversationEntry.characterId)&&currentConversationEntry.characterId!==this.currentSessionIdentity.characterId&&typeof currentConversationEntry.name==='string'&&isDirectMessageSequence(currentConversationEntry.latestMessageId)&&isDirectMessageTimestamp(currentConversationEntry.sentAt)&&!currentPeerIdentifiers.has(currentConversationEntry.characterId));
      currentPeerIdentifiers.add(currentConversationEntry.characterId);
    }
    return currentConversationPage;
  }
  async readDirectMessageHistory(currentPeerIdentifier,currentBeforeSequence=null){
    requireDirectMessageValue(isDirectMessageIdentifier(currentPeerIdentifier)&&currentPeerIdentifier!==this.currentSessionIdentity.characterId,'invalidRecipient');
    requireDirectMessageValue(currentBeforeSequence===null||isDirectMessageSequence(currentBeforeSequence));
    const currentHistoryPage=await this.requestDirectMessageData('/conversations/'+encodeURIComponent(currentPeerIdentifier)+'/messages'+(currentBeforeSequence?'?before='+currentBeforeSequence:''));
    validateDirectMessagePage(currentHistoryPage);
    requireDirectMessageValue(isDirectMessageTimestamp(currentHistoryPage.serverTime)&&currentHistoryPage.peer?.characterId===currentPeerIdentifier&&typeof currentHistoryPage.peer.name==='string'&&typeof currentHistoryPage.blocked==='boolean');
    let currentPreviousSequence=0n;
    for(const currentMessageEntry of currentHistoryPage.entries){
      requireDirectMessageValue(isDirectMessageSequence(currentMessageEntry.messageId)&&BigInt(currentMessageEntry.messageId)>currentPreviousSequence
        &&(currentBeforeSequence===null||BigInt(currentMessageEntry.messageId)<BigInt(currentBeforeSequence))
        &&((currentMessageEntry.senderId===this.currentSessionIdentity.characterId&&currentMessageEntry.recipientId===currentPeerIdentifier)||(currentMessageEntry.recipientId===this.currentSessionIdentity.characterId&&currentMessageEntry.senderId===currentPeerIdentifier))
        &&typeof currentMessageEntry.text==='string'&&Array.from(currentMessageEntry.text).length>0&&Array.from(currentMessageEntry.text).length<=DIRECT_MESSAGE_TEXT_LIMIT
        &&isDirectMessageTimestamp(currentMessageEntry.sentAt)&&isDirectMessageTimestamp(currentMessageEntry.expiresAt)&&currentMessageEntry.expiresAt>currentMessageEntry.sentAt);
      currentPreviousSequence=BigInt(currentMessageEntry.messageId);
    }
    return {...currentHistoryPage,entries:retainUnexpiredDirectMessages(currentHistoryPage.entries,this.readDirectMessageTime())};
  }
  async readDirectMessageNotice(){
    const currentNoticeValue=await this.requestDirectMessageData('/notifications');
    requireDirectMessageValue(isDirectMessageTimestamp(currentNoticeValue.serverTime)&&Number.isSafeInteger(currentNoticeValue.count)&&currentNoticeValue.count>=0&&(currentNoticeValue.count===0?currentNoticeValue.latestMessageId===null:isDirectMessageSequence(currentNoticeValue.latestMessageId)));
    return currentNoticeValue;
  }
  async acknowledgeDirectMessages(currentMessageIdentifiers){
    requireDirectMessageValue(Array.isArray(currentMessageIdentifiers)&&currentMessageIdentifiers.length>0&&currentMessageIdentifiers.length<=100&&currentMessageIdentifiers.every(isDirectMessageSequence)&&new Set(currentMessageIdentifiers).size===currentMessageIdentifiers.length);
    const currentReceiptValue=await this.requestDirectMessageData('/acknowledgements',{messageIds:currentMessageIdentifiers});
    requireDirectMessageValue(Array.isArray(currentReceiptValue.messageIds)&&currentReceiptValue.messageIds.every(currentMessageIdentifier=>currentMessageIdentifiers.includes(currentMessageIdentifier))&&new Set(currentReceiptValue.messageIds).size===currentReceiptValue.messageIds.length);
    return currentReceiptValue;
  }
  async setDirectMessageBlock(currentPeerIdentifier,currentBlockedValue){
    requireDirectMessageValue(isDirectMessageIdentifier(currentPeerIdentifier)&&currentPeerIdentifier!==this.currentSessionIdentity.characterId,'invalidRecipient');
    requireDirectMessageValue(typeof currentBlockedValue==='boolean');
    const currentBlockReceipt=await this.requestDirectMessageData('/blocks/'+encodeURIComponent(currentPeerIdentifier),{blocked:currentBlockedValue},'PUT');
    requireDirectMessageValue(currentBlockReceipt.characterId===currentPeerIdentifier&&currentBlockReceipt.blocked===currentBlockedValue);
    return currentBlockReceipt;
  }
  async listDirectMessageBlocks(currentAfterIdentifier=null){
    requireDirectMessageValue(currentAfterIdentifier===null||isDirectMessageIdentifier(currentAfterIdentifier));
    const currentBlockPage=await this.requestDirectMessageData('/blocks'+(currentAfterIdentifier?'?after='+encodeURIComponent(currentAfterIdentifier):''));
    requireDirectMessageValue(Array.isArray(currentBlockPage.entries)&&currentBlockPage.entries.length<=50&&(currentBlockPage.nextCursor===null||isDirectMessageIdentifier(currentBlockPage.nextCursor)));
    for(const currentBlockedEntry of currentBlockPage.entries)requireDirectMessageValue(isDirectMessageIdentifier(currentBlockedEntry.characterId)&&typeof currentBlockedEntry.name==='string');
    return currentBlockPage;
  }
}
