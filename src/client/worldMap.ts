export type WorldMapNode={id:string;name:string;nameTranslations:Record<'ko'|'en',string>;safeTown:boolean;column:number;row:number;connections:{target:string;direction:'north'|'south'|'east'|'west'}[]};
const WORLD_MAP_DIRECTION_OFFSETS={north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]} as const;
export function parseWorldMapCatalog(receivedWorldCatalog:unknown):WorldMapNode[] {
  const requireWorldObject=(currentWorldValue:unknown,expectedWorldKeys:string[]):Record<string,any>=>{
    if(!currentWorldValue||typeof currentWorldValue!=='object'||Array.isArray(currentWorldValue)||Object.keys(currentWorldValue).sort().join()!==expectedWorldKeys.sort().join())throw new Error('월드맵 응답 필드가 올바르지 않습니다.');
    return currentWorldValue as Record<string,any>;
  };
  const parsedWorldCatalog=requireWorldObject(receivedWorldCatalog,['version','maps']);
  if(parsedWorldCatalog.version!==1||!Array.isArray(parsedWorldCatalog.maps)||!parsedWorldCatalog.maps.length)throw new Error('월드맵 버전 또는 맵 목록이 올바르지 않습니다.');
  const currentMapIdentifiers=new Set<string>(),occupiedMapPositions=new Set<string>();
  for(const currentWorldNode of parsedWorldCatalog.maps){
    requireWorldObject(currentWorldNode,['id','name','nameTranslations','safeTown','column','row','connections']);
    requireWorldObject(currentWorldNode.nameTranslations,['ko','en']);
    if([currentWorldNode.id,currentWorldNode.name,...Object.values(currentWorldNode.nameTranslations)].some(currentTextValue=>typeof currentTextValue!=='string'||!currentTextValue.trim())||typeof currentWorldNode.safeTown!=='boolean'||!Number.isSafeInteger(currentWorldNode.column)||!Number.isSafeInteger(currentWorldNode.row)||!Array.isArray(currentWorldNode.connections))throw new Error('월드맵 데이터 형식이 올바르지 않습니다.');
    const currentMapPosition=`${currentWorldNode.column},${currentWorldNode.row}`;
    if(currentMapIdentifiers.has(currentWorldNode.id)||occupiedMapPositions.has(currentMapPosition))throw new Error('월드맵 ID 또는 위치가 중복됩니다.');
    currentMapIdentifiers.add(currentWorldNode.id);occupiedMapPositions.add(currentMapPosition);
    const connectedMapIdentifiers=new Set<string>();
    for(const currentMapLink of currentWorldNode.connections){
      requireWorldObject(currentMapLink,['target','direction']);
      if(typeof currentMapLink.target!=='string'||!Object.hasOwn(WORLD_MAP_DIRECTION_OFFSETS,currentMapLink.direction)||connectedMapIdentifiers.has(currentMapLink.target))throw new Error('월드맵 연결 정의가 올바르지 않습니다.');
      connectedMapIdentifiers.add(currentMapLink.target);
    }
  }
  const parsedWorldNodes=parsedWorldCatalog.maps as WorldMapNode[];
  for(const currentWorldNode of parsedWorldNodes)for(const currentMapLink of currentWorldNode.connections){
    const targetWorldNode=parsedWorldNodes.find(currentTargetNode=>currentTargetNode.id===currentMapLink.target);
    const currentDirectionOffset=WORLD_MAP_DIRECTION_OFFSETS[currentMapLink.direction];
    if(!targetWorldNode||targetWorldNode.column!==currentWorldNode.column+currentDirectionOffset[0]||targetWorldNode.row!==currentWorldNode.row+currentDirectionOffset[1]||!targetWorldNode.connections.some(reverseMapLink=>reverseMapLink.target===currentWorldNode.id))throw new Error('월드맵 연결 대상 또는 방향이 올바르지 않습니다.');
  }
  return parsedWorldNodes;
}
