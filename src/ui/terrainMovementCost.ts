import type {Position, State} from '../client/types';
import {canStep} from '../game/terrain/elevation';

const MOVEMENT_NEIGHBOR_OFFSETS = [[0,-1],[-1,0],[1,0],[0,1]] as const;
const PROBABILITY_UNIT_SCALE = 10000;
const FIELD_ROUTE_CACHE_LIMIT = 8;
const CITY_FREE_MOVEMENT_COST = {baseCost:0,extraChanceBasisPoints:0,extraCost:0};
const cachedFieldRouteResults = new Map<string, Position[] | null>();
type MovementQueueEntry = {cost:number;steps:number;column:number;row:number};
const compareMovementEntries = (firstQueueEntry:MovementQueueEntry, secondQueueEntry:MovementQueueEntry) =>
  firstQueueEntry.cost-secondQueueEntry.cost || firstQueueEntry.steps-secondQueueEntry.steps || firstQueueEntry.row-secondQueueEntry.row || firstQueueEntry.column-secondQueueEntry.column;
const movementCellKey = (cellPositionValue:Position) => `${cellPositionValue.column},${cellPositionValue.row}`;

export function fieldMovementEstimate(fieldMapDefinition:State['map'], selectedRouteCells:Position[]) {
  if(fieldMapDefinition.safeTown) return {base:0,expected:0,max:0};
  if(!fieldMapDefinition.movementCosts) return {base:selectedRouteCells.length,expected:selectedRouteCells.length,max:selectedRouteCells.length};
  let basicCostTotal=0,expectedCostTotal=0,maximumCostTotal=0;
  for(const targetCellPosition of selectedRouteCells){
    const targetCostDefinition = fieldTerrainCost(fieldMapDefinition,targetCellPosition);
    basicCostTotal+=targetCostDefinition.baseCost;
    expectedCostTotal+=targetCostDefinition.baseCost*PROBABILITY_UNIT_SCALE+targetCostDefinition.extraChanceBasisPoints*targetCostDefinition.extraCost;
    maximumCostTotal+=targetCostDefinition.baseCost+targetCostDefinition.extraCost;
  }
  return {base:basicCostTotal,expected:expectedCostTotal/PROBABILITY_UNIT_SCALE,max:maximumCostTotal};
}

function fieldTerrainCost(fieldMapDefinition:State['map'], targetCellPosition:Position) {
  const targetTerrainCode=fieldMapDefinition.terrainRows?.[targetCellPosition.row]?.[targetCellPosition.column];
  const targetTerrainName=targetTerrainCode && fieldMapDefinition.terrainCodes?.[targetTerrainCode];
  const targetCostDefinition=fieldMapDefinition.movementCosts?.rows.find(terrainCostDefinition=>terrainCostDefinition.tileId===targetTerrainName)?.fp;
  if(!targetCostDefinition) throw new Error('필드 지형의 FP 비용 정의가 없습니다.');
  return fieldMapDefinition.safeTown ? CITY_FREE_MOVEMENT_COST : targetCostDefinition;
}

export function findExpectedFieldRoute(startCellPosition:Position,targetCellPositions:Position[],fieldMapDefinition:State['map']):Position[]|null {
  const routeCacheSignature=JSON.stringify([startCellPosition,targetCellPositions,fieldMapDefinition.columns,fieldMapDefinition.rows,
    fieldMapDefinition.blocked,fieldMapDefinition.elevations,fieldMapDefinition.ramps,fieldMapDefinition.elevationTiles,
    fieldMapDefinition.terrainRows,fieldMapDefinition.terrainCodes,fieldMapDefinition.movementCosts,fieldMapDefinition.safeTown]);
  if(cachedFieldRouteResults.has(routeCacheSignature))return structuredClone(cachedFieldRouteResults.get(routeCacheSignature)!);
  const calculatedFieldRoute=computeExpectedFieldRoute(startCellPosition,targetCellPositions,fieldMapDefinition);
  if(cachedFieldRouteResults.size>=FIELD_ROUTE_CACHE_LIMIT)cachedFieldRouteResults.delete(cachedFieldRouteResults.keys().next().value!);
  cachedFieldRouteResults.set(routeCacheSignature,structuredClone(calculatedFieldRoute));
  return calculatedFieldRoute;
}

function computeExpectedFieldRoute(startCellPosition:Position,targetCellPositions:Position[],fieldMapDefinition:State['map']):Position[]|null {
  const blockedCellKeys=new Set(fieldMapDefinition.blocked.map(movementCellKey));
  const validCellPosition=(cellPositionValue:Position)=>Number.isInteger(cellPositionValue.column)&&Number.isInteger(cellPositionValue.row)&&cellPositionValue.column>=0&&cellPositionValue.row>=0&&cellPositionValue.column<fieldMapDefinition.columns&&cellPositionValue.row<fieldMapDefinition.rows&&!blockedCellKeys.has(movementCellKey(cellPositionValue));
  if(!validCellPosition(startCellPosition))return null;
  const targetCellKeys=new Set(targetCellPositions.filter(validCellPosition).map(movementCellKey));
  if(!targetCellKeys.size)return null;
  const pendingRouteHeap:MovementQueueEntry[]=[];
  const appendQueueEntry=(nextQueueEntry:MovementQueueEntry)=>{
    pendingRouteHeap.push(nextQueueEntry);
    let currentHeapIndex=pendingRouteHeap.length-1;
    while(currentHeapIndex>0){
      const parentHeapIndex=Math.floor((currentHeapIndex-1)/2);
      if(compareMovementEntries(pendingRouteHeap[parentHeapIndex],nextQueueEntry)<=0)break;
      pendingRouteHeap[currentHeapIndex]=pendingRouteHeap[parentHeapIndex];currentHeapIndex=parentHeapIndex;
    }
    pendingRouteHeap[currentHeapIndex]=nextQueueEntry;
  };
  const removeQueueEntry=()=>{
    const firstQueueEntry=pendingRouteHeap[0],lastQueueEntry=pendingRouteHeap.pop()!;
    if(pendingRouteHeap.length){
      let currentHeapIndex=0;
      while(currentHeapIndex*2+1<pendingRouteHeap.length){
        let childHeapIndex=currentHeapIndex*2+1;
        if(childHeapIndex+1<pendingRouteHeap.length&&compareMovementEntries(pendingRouteHeap[childHeapIndex+1],pendingRouteHeap[childHeapIndex])<0)childHeapIndex++;
        if(compareMovementEntries(lastQueueEntry,pendingRouteHeap[childHeapIndex])<=0)break;
        pendingRouteHeap[currentHeapIndex]=pendingRouteHeap[childHeapIndex];currentHeapIndex=childHeapIndex;
      }
      pendingRouteHeap[currentHeapIndex]=lastQueueEntry;
    }
    return firstQueueEntry;
  };
  const bestRouteLabels=new Map<string,{cost:number;steps:number;parent:Position|null}>([[movementCellKey(startCellPosition),{cost:0,steps:0,parent:null}]]);
  appendQueueEntry({...startCellPosition,cost:0,steps:0});
  while(pendingRouteHeap.length){
    const currentQueueEntry=removeQueueEntry(),currentCellKey=movementCellKey(currentQueueEntry);
    const currentBestLabel=bestRouteLabels.get(currentCellKey)!;
    if(currentQueueEntry.cost!==currentBestLabel.cost||currentQueueEntry.steps!==currentBestLabel.steps)continue;
    if(targetCellKeys.has(currentCellKey)){
      const selectedRouteCells:Position[]=[];
      let previousCellPosition:Position|null={column:currentQueueEntry.column,row:currentQueueEntry.row};
      while(previousCellPosition&&movementCellKey(previousCellPosition)!==movementCellKey(startCellPosition)){
        selectedRouteCells.push(previousCellPosition);previousCellPosition=bestRouteLabels.get(movementCellKey(previousCellPosition))!.parent;
      }
      return selectedRouteCells.reverse();
    }
    for(const [neighborColumnOffset,neighborRowOffset] of MOVEMENT_NEIGHBOR_OFFSETS){
      const nextCellPosition={column:currentQueueEntry.column+neighborColumnOffset,row:currentQueueEntry.row+neighborRowOffset};
      if(!validCellPosition(nextCellPosition)||!canStep(currentQueueEntry,nextCellPosition,fieldMapDefinition))continue;
      const nextCostDefinition=fieldTerrainCost(fieldMapDefinition,nextCellPosition);
      const nextRouteCost=currentQueueEntry.cost+nextCostDefinition.baseCost*PROBABILITY_UNIT_SCALE+nextCostDefinition.extraChanceBasisPoints*nextCostDefinition.extraCost;
      const nextRouteSteps=currentQueueEntry.steps+1,previousRouteLabel=bestRouteLabels.get(movementCellKey(nextCellPosition));
      if(previousRouteLabel&&(previousRouteLabel.cost<nextRouteCost||previousRouteLabel.cost===nextRouteCost&&previousRouteLabel.steps<=nextRouteSteps))continue;
      bestRouteLabels.set(movementCellKey(nextCellPosition),{cost:nextRouteCost,steps:nextRouteSteps,parent:{column:currentQueueEntry.column,row:currentQueueEntry.row}});
      appendQueueEntry({...nextCellPosition,cost:nextRouteCost,steps:nextRouteSteps});
    }
  }
  return null;
}
