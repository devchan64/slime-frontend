// 터미널 채널 명령의 입력·공개 목록 검증과 표시를 담당한다.
const CHANNEL_ADDRESS_INPUT_PATTERN = /^([A-Za-z]+)([0-9]+)$/;
const CHANNEL_IDENTIFIER_INPUT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const CHANNEL_TEXT_MAX_LENGTH = 100;
const CHANNEL_LIST_REQUIRED_FIELDS = ['id','address','mapDefinitionId','status'];
const CHANNEL_POPULATION_FIELD_NAMES = ['onlineUsers','reservedSeats','capacity'];

export function normalizeChannelAddressInput(currentAddressInput) {
  const currentAddressMatch=typeof currentAddressInput==='string' && CHANNEL_ADDRESS_INPUT_PATTERN.exec(currentAddressInput);
  if(!currentAddressMatch || currentAddressMatch[0]!==currentAddressInput || currentAddressInput.length>CHANNEL_TEXT_MAX_LENGTH)
    throw new Error('채널 주소는 a1, aa22처럼 영문 열과 양의 정수 행으로 입력하세요.');
  const currentRowDigits=currentAddressMatch[2].replace(/^0+/,'');
  if(!currentRowDigits)throw new Error('채널 주소의 행 번호는 1 이상이어야 합니다.');
  return currentAddressMatch[1].toLowerCase()+currentRowDigits;
}

export function validateChannelIdentifierInput(currentIdentifierInput) {
  if(typeof currentIdentifierInput!=='string' || !currentIdentifierInput || currentIdentifierInput.length>CHANNEL_TEXT_MAX_LENGTH
    || CHANNEL_IDENTIFIER_INPUT_PATTERN.exec(currentIdentifierInput)?.[0]!==currentIdentifierInput)
    throw new Error('채널 ID 형식이 올바르지 않습니다.');
  return currentIdentifierInput;
}

export function formatChannelListingOutput(currentListingResponse,currentMapIdentifier) {
  if(!Array.isArray(currentListingResponse))throw new Error('채널 목록 응답이 올바르지 않습니다.');
  const receivedChannelIdentifiers=new Set(),receivedChannelAddresses=new Set();
  const renderedChannelLines=[];
  for(const currentChannelEntry of currentListingResponse){
    if(!currentChannelEntry || typeof currentChannelEntry!=='object' || Array.isArray(currentChannelEntry)
      || Object.keys(currentChannelEntry).some(currentFieldName=>![...CHANNEL_LIST_REQUIRED_FIELDS,...CHANNEL_POPULATION_FIELD_NAMES].includes(currentFieldName))
      || CHANNEL_LIST_REQUIRED_FIELDS.some(currentFieldName=>typeof currentChannelEntry[currentFieldName]!=='string'))throw new Error('채널 목록 응답이 올바르지 않습니다.');
    validateChannelIdentifierInput(currentChannelEntry.id);validateChannelIdentifierInput(currentChannelEntry.mapDefinitionId);
    if(normalizeChannelAddressInput(currentChannelEntry.address)!==currentChannelEntry.address
      || !['OPEN','DRAINING','CLOSED'].includes(currentChannelEntry.status)
      || receivedChannelIdentifiers.has(currentChannelEntry.id) || receivedChannelAddresses.has(currentChannelEntry.address))throw new Error('채널 목록 응답이 올바르지 않습니다.');
    receivedChannelIdentifiers.add(currentChannelEntry.id);receivedChannelAddresses.add(currentChannelEntry.address);
    const receivedPopulationFields=CHANNEL_POPULATION_FIELD_NAMES.filter(currentFieldName=>currentFieldName in currentChannelEntry);
    if(receivedPopulationFields.length && (receivedPopulationFields.length!==3
      || receivedPopulationFields.some(currentFieldName=>!Number.isSafeInteger(currentChannelEntry[currentFieldName])||currentChannelEntry[currentFieldName]<0)
      || currentChannelEntry.capacity<2 || currentChannelEntry.onlineUsers>currentChannelEntry.reservedSeats))throw new Error('채널 인원 응답이 올바르지 않습니다.');
    if(currentChannelEntry.mapDefinitionId!==currentMapIdentifier)continue;
    const renderedPopulationText=receivedPopulationFields.length ? `예약 좌석 ${currentChannelEntry.reservedSeats}/${currentChannelEntry.capacity} · 접속 ${currentChannelEntry.onlineUsers}명` : '인원 정보 미제공';
    renderedChannelLines.push(`${currentChannelEntry.address} [${currentChannelEntry.id}] | ${currentChannelEntry.status} | ${renderedPopulationText}`);
  }
  return renderedChannelLines.join('\n') || '현재 맵의 채널이 없습니다.';
}
