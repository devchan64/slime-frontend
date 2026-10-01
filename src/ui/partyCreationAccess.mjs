// 현재 공개 상태를 이용한 생성 메뉴 안내다. 최종 권한은 서버가 다시 검사한다.
export function readPartyCreationIssue(currentGameState) {
  if (!currentGameState || currentGameState.me.mode !== 'FIELD' || currentGameState.battle || currentGameState.reservation)
    return 'app.partyCreationFieldRequired';
  if (currentGameState.me.borrowedPartyLoanIds?.length) return 'app.partyCreationFormationRequired';
  const currentGuildBuilding = currentGameState.map?.buildings?.find(currentBuildingRecord =>
    currentBuildingRecord.facilityKind === 'guild'
    && currentBuildingRecord.entrance.column === currentGameState.me.position?.column
    && currentBuildingRecord.entrance.row === currentGameState.me.position?.row);
  if (!currentGuildBuilding) return 'app.partyCreationGuildRequired';
  if (!currentGameState.me.citizenshipSummary?.records.some(currentCitizenshipRecord =>
    currentCitizenshipRecord.cityId === currentGameState.map.id && currentCitizenshipRecord.status === 'VALID'))
    return 'app.partyCreationCitizenshipRequired';
  return null;
}
