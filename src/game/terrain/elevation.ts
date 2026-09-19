import type { Position } from '../../client/types';

export type Surface = { columns: number; rows: number; elevations?: number[][];
  ramps?: { start: Position; end: Position }[] };
export const ELEVATION_STEP = 24;
export const CELL_WIDTH = 64, CELL_HEIGHT = 32;
export const MAP_ORIGIN = { x: 1040, y: 80 };
export const TERRAIN_DEPTH = { stride: 100, base: 100, surface: 1, overlay: 10, actor: 20, annotation: 10000 };
export const BASE_THICKNESS = 12;
const same = (a: Position, b: Position) => a.column === b.column && a.row === b.row;
export const inBounds = (p: Position, map: Surface) => Number.isInteger(p.column) && Number.isInteger(p.row) && p.column >= 0 && p.row >= 0 && p.column < map.columns && p.row < map.rows;
export const heightAt = (p: Position, map: Surface) => map.elevations && inBounds(p,map) ? map.elevations[p.row][p.column] : 0;
export const cellDepth = (p: Position) => TERRAIN_DEPTH.base + (p.column + p.row) * TERRAIN_DEPTH.stride;
export const project = (p: Position, map: Surface) => ({
  x: MAP_ORIGIN.x + (p.column-p.row) * CELL_WIDTH/2,
  y: MAP_ORIGIN.y + (p.column+p.row) * CELL_HEIGHT/2 - heightAt(p,map)*ELEVATION_STEP,
});
export function canStep(start: Position, end: Position, map: Surface) {
  if (!inBounds(start,map) || !inBounds(end,map) || Math.abs(start.column-end.column)+Math.abs(start.row-end.row) !== 1) return false;
  return heightAt(start,map) === heightAt(end,map) || !!map.ramps?.some(e =>
    (same(e.start,start) && same(e.end,end)) || (same(e.start,end) && same(e.end,start)));
}
export function cliffFaces(p: Position, map: Surface) {
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
export function pickSurface(x:number,y:number,map:Surface):Position|null {
  for(let diagonal=map.columns+map.rows-2;diagonal>=0;diagonal--)
    for(let row=Math.min(map.rows-1,diagonal);row>=0;row--){
      const column=diagonal-row;
      if(column>=map.columns)continue;
      const cell={column,row},p=project(cell,map);
      if(Math.abs(x-p.x)/(CELL_WIDTH/2)+Math.abs(y-p.y)/(CELL_HEIGHT/2)<=1)return cell;
      if(cliffFaces(cell,map).some(face=>contains(x,y,face)))return null;
    }
  return null;
}
