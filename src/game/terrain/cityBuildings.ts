import type {CityBuilding, Position} from '../../client/types';

export function findCityBuilding(currentCityBuildings: CityBuilding[] | undefined, selectedCityPosition: Position | null) {
  if (!selectedCityPosition) return undefined;
  return currentCityBuildings?.find(currentCityBuilding =>
    (selectedCityPosition.column >= currentCityBuilding.origin.column && selectedCityPosition.column < currentCityBuilding.origin.column+currentCityBuilding.width
      && selectedCityPosition.row >= currentCityBuilding.origin.row && selectedCityPosition.row < currentCityBuilding.origin.row+currentCityBuilding.height)
    || (selectedCityPosition.column === currentCityBuilding.entrance.column && selectedCityPosition.row === currentCityBuilding.entrance.row));
}

export function cityBuildingCells(currentCityBuilding: CityBuilding): Position[] {
  return Array.from({length:currentCityBuilding.width*currentCityBuilding.height},(_,currentCellIndex)=>({
    column:currentCityBuilding.origin.column+currentCellIndex%currentCityBuilding.width,
    row:currentCityBuilding.origin.row+Math.floor(currentCellIndex/currentCityBuilding.width),
  }));
}
