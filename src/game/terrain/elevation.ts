import type { Position } from '../../client/types';

export type TerrainLink = { start: Position; end: Position; id?: string;
  kind?: 'stairs' | 'ladder'; asset?: 'stone-stairs' | 'timber-ladder' };
export type ElevationTile = {id:string;kind:'stairs';asset:'stone-step-tile';cell:Position;lower:Position};
export type Surface = { columns: number; rows: number; elevations?: number[][];
  heightSource?: { surface: Surface; position: (p: Position) => Position };
  ramps?: TerrainLink[]; elevationTiles?: ElevationTile[];
  elevationTileIndex?: ReadonlyMap<string, ElevationTile> };
export const ELEVATION_STEP = 24;
export const CELL_WIDTH = 64, CELL_HEIGHT = 32;
export const MAP_ORIGIN = { x: 1040, y: 80 };
export const TERRAIN_DEPTH = { stride: 100, base: 100, surface: 1, overlay: 10, actor: 20, annotation: 10000 };
export const BASE_THICKNESS = 12;
const same = (a: Position, b: Position) => a.column === b.column && a.row === b.row;
export const inBounds = (p: Position, map: Surface) => Number.isInteger(p.column) && Number.isInteger(p.row) && p.column >= 0 && p.row >= 0 && p.column < map.columns && p.row < map.rows;
export const heightAt = (p: Position, map: Surface): number => {
  if (!inBounds(p,map)) return 0;
  if (map.heightSource) return heightAt(map.heightSource.position(p), map.heightSource.surface);
  return map.elevations ? map.elevations[p.row][p.column] : 0;
};
export const cellDepth = (p: Position) => TERRAIN_DEPTH.base + (p.column + p.row) * TERRAIN_DEPTH.stride;
/** 안내 표시는 가장 앞쪽 셀의 지형·개체보다 위에 둔다. */
export const mapAnnotationDepth = (map: Surface) => Math.max(TERRAIN_DEPTH.annotation,
  cellDepth({column:map.columns-1,row:map.rows-1}) + TERRAIN_DEPTH.stride);
/** 준비된 표시 지형은 좌표 색인으로, 원본 API 지형은 목록으로 조회한다. */
export const elevationTileAt = (p: Position, map: Surface): ElevationTile | undefined =>
  map.elevationTileIndex ? map.elevationTileIndex.get(`${p.column},${p.row}`)
    : map.elevationTiles?.find(tile => same(tile.cell,p));
export const project = (p: Position, map: Surface) => ({
  x: MAP_ORIGIN.x + (p.column-p.row) * CELL_WIDTH/2,
  y: MAP_ORIGIN.y + (p.column+p.row) * CELL_HEIGHT/2 - (heightAt(p,map) - (elevationTileAt(p,map) ? 0.5 : 0))*ELEVATION_STEP,
});
// 이전 저장 전투의 연결 데이터도 별도 오브젝트 없이 높이 전환 타일로 읽는다.
export function surfaceElevationTiles(map: Surface): ElevationTile[] {
  const tiles=map.elevationTiles ?? [];
  const defined=new Set(tiles.map(tile=>tile.id));
  return [...tiles, ...(map.ramps ?? []).filter(link=>!link.id || !defined.has(link.id)).map((link,index)=>{
    const [lower,cell]=heightAt(link.start,map)<heightAt(link.end,map)?[link.start,link.end]:[link.end,link.start];
    return {id:link.id ?? `legacy-link-${index}`,kind:'stairs' as const,asset:'stone-step-tile' as const,cell,lower};
  })];
}
const STEP_COUNT = 6;
export type TileFace = { points:{x:number;y:number}[]; top:boolean };
export function elevationTileFaces(tile: ElevationTile, map: Surface): TileFace[] {
  const dc=tile.cell.column-tile.lower.column,dr=tile.cell.row-tile.lower.row;
  const low=heightAt(tile.cell,map)-1;
  const point=(u:number,v:number,z:number)=>{
    const c=tile.cell.column+dc*u-dr*v,r=tile.cell.row+dr*u+dc*v;
    return {x:MAP_ORIGIN.x+(c-r)*CELL_WIDTH/2,y:MAP_ORIGIN.y+(c+r)*CELL_HEIGHT/2-z*ELEVATION_STEP};
  };
  const blocks=Array.from({length:STEP_COUNT},(_,i)=>{
    const u=i/STEP_COUNT-.5,w=(i+1)/STEP_COUNT-.5,z=low+(i+1)/STEP_COUNT;
    const top=[point(u,-.5,z),point(w,-.5,z),point(w,.5,z),point(u,.5,z)];
    const sides=top.map((a,j)=>{
      const b=top[(j+1)%4];
      return {points:[a,b,{x:b.x,y:b.y+(z-low)*ELEVATION_STEP+BASE_THICKNESS},{x:a.x,y:a.y+(z-low)*ELEVATION_STEP+BASE_THICKNESS}],top:false};
    });
    return {order:(dc+dr)*(u+w)/2,faces:[...sides,{points:top,top:true}]};
  }).sort((a,b)=>a.order-b.order);
  return blocks.flatMap(b=>b.faces);
}
export function canStep(start: Position, end: Position, map: Surface) {
  if (!inBounds(start,map) || !inBounds(end,map) || Math.abs(start.column-end.column)+Math.abs(start.row-end.row) !== 1) return false;
  return heightAt(start,map) === heightAt(end,map) || !!map.ramps?.some(e =>
    (same(e.start,start) && same(e.end,end)) || (same(e.start,end) && same(e.end,start)));
}
export function cliffFaces(p: Position, map: Surface) {
  if (!map.elevations && !map.heightSource) return [];
  const center=project(p,map), h=heightAt(p,map);
  return [{ neighbor:{column:p.column+1,row:p.row}, edge:[[0,CELL_HEIGHT/2],[CELL_WIDTH/2,0]] },
    { neighbor:{column:p.column,row:p.row+1}, edge:[[-CELL_WIDTH/2,0],[0,CELL_HEIGHT/2]] }]
    .flatMap(({neighbor,edge}) => {
      const drop=inBounds(neighbor,map) ? (h-heightAt(neighbor,map))*ELEVATION_STEP : h*ELEVATION_STEP+BASE_THICKNESS;
      if (drop<=0) return [];
      const [a,b]=edge.map(([x,y])=>({x:center.x+x,y:center.y+y}));
      return [[a,b,{x:b.x,y:b.y+drop},{x:a.x,y:a.y+drop}]];
    });
}
const contains = (x:number,y:number,polygon:{x:number;y:number}[]) => {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
};
// 앞쪽 지면/절벽부터 검사하므로 가려진 뒤쪽 타일을 선택하지 않는다.
const PICK_VERTICAL_PADDING = CELL_HEIGHT + BASE_THICKNESS + ELEVATION_STEP;
export function pickSurface(x:number,y:number,map:Surface,heights:{min:number;max:number}):Position|null {
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  // 지면·계단·절벽은 셀 중심에서 가로 반 셀 범위를 넘지 않는다.
  // column-row 후보를 먼저 좁혀 전체 면적 대신 대각선 수에 비례해 검사한다.
  const difference=(x-MAP_ORIGIN.x)/(CELL_WIDTH/2);
  const first=Math.max(1-map.rows,Math.floor(difference)-1);
  const last=Math.min(map.columns-1,Math.ceil(difference)+1);
  if(first>last)return null;
  // 준비된 고도 범위를 쓰면 멀리 있는 대각선도 검사하지 않는다.
  // 수직 여유는 계단 측면·절벽 바닥까지 포함하며 앞→뒤 순서는 유지한다.
  const firstDiagonal=Math.max(0,Math.ceil((y-MAP_ORIGIN.y-PICK_VERTICAL_PADDING+heights.min*ELEVATION_STEP)/(CELL_HEIGHT/2)));
  const lastDiagonal=Math.min(map.columns+map.rows-2,Math.floor((y-MAP_ORIGIN.y+PICK_VERTICAL_PADDING+heights.max*ELEVATION_STEP)/(CELL_HEIGHT/2)));
  for(let diagonal=lastDiagonal;diagonal>=firstDiagonal;diagonal--)
    for(let delta=first;delta<=last;delta++){
      const row=(diagonal-delta)/2,column=diagonal-row;
      if(!Number.isInteger(row)||row<0||row>=map.rows||column<0||column>=map.columns)continue;
      const cell={column,row},p=project(cell,map);
      const tile=elevationTileAt(cell,map);
      if(tile){
        for(const face of elevationTileFaces(tile,map).reverse())
          if(contains(x,y,face.points))return face.top?cell:null;
        continue;
      }
      if(Math.abs(x-p.x)/(CELL_WIDTH/2)+Math.abs(y-p.y)/(CELL_HEIGHT/2)<=1)return cell;
      if(cliffFaces(cell,map).some(face=>contains(x,y,face)))return null;
    }
  return null;
}
