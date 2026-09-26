import {resolveMapTileSize} from "./renderMetrics";
import { BASE_THICKNESS, ELEVATION_STEP, MAP_ORIGIN, type Surface } from './elevation';

export type ViewBounds = {left:number;top:number;right:number;bottom:number};
export type TileWindow = {firstColumn:number;lastColumn:number;firstRow:number;lastRow:number};
// 장식과 선 두께, 카메라 이동 직전의 경계를 포함한다.


export function elevationRange(surface: Surface): {min:number;max:number} {
  if (surface.heightSource) return elevationRange(surface.heightSource.surface);
  let min=0,max=0;
  for(const row of surface.elevations ?? [])for(const height of row){min=Math.min(min,height);max=Math.max(max,height);}
  return {min,max};
}

/** 회전된 표시 좌표에서 지면·절벽·승강 타일 전체를 포함하는 보수적 범위. */
export function terrainWindow(surface: Surface, heights: {min:number;max:number}, bounds: ViewBounds): TileWindow {
  const currentTileDimensions = resolveMapTileSize(surface);
  const currentOverscanDistance = currentTileDimensions.width * 2;
  const differenceMin=(bounds.left-currentOverscanDistance-MAP_ORIGIN.x)/(currentTileDimensions.width/2);
  const differenceMax=(bounds.right+currentOverscanDistance-MAP_ORIGIN.x)/(currentTileDimensions.width/2);
  const sumMin=(bounds.top-currentOverscanDistance-BASE_THICKNESS-MAP_ORIGIN.y+heights.min*ELEVATION_STEP)/(currentTileDimensions.height/2);
  const sumMax=(bounds.bottom+currentOverscanDistance-MAP_ORIGIN.y+heights.max*ELEVATION_STEP)/(currentTileDimensions.height/2);
  return {
    firstColumn:Math.max(0,Math.floor((sumMin+differenceMin)/2)),
    lastColumn:Math.min(surface.columns-1,Math.ceil((sumMax+differenceMax)/2)),
    firstRow:Math.max(0,Math.floor((sumMin-differenceMax)/2)),
    lastRow:Math.min(surface.rows-1,Math.ceil((sumMax-differenceMin)/2)),
  };
}

/** 화면 밖 자원은 폐기하고 겹치는 타일은 같은 객체를 유지한다. */
export class TerrainWindowCache<T> {
  private entries=new Map<string,T>();
  private previous='';
  constructor(private create:(column:number,row:number)=>T,private dispose:(value:T)=>void) {}
  sync(currentTileWindow:TileWindow) {
    const currentWindowSignature=JSON.stringify(currentTileWindow);
    if(currentWindowSignature===this.previous)return;
    const currentWantedKeys=new Set<string>();
    for(let currentRowIndex=currentTileWindow.firstRow;currentRowIndex<=currentTileWindow.lastRow;currentRowIndex++)
      for(let currentColumnIndex=currentTileWindow.firstColumn;currentColumnIndex<=currentTileWindow.lastColumn;currentColumnIndex++)
        currentWantedKeys.add(`${currentColumnIndex},${currentRowIndex}`);
    // 카메라가 멀리 이동해도 이전 화면과 새 화면의 자원을 동시에 유지하지 않는다.
    for(const [currentTileKey,currentTileValue] of this.entries)if(!currentWantedKeys.has(currentTileKey)){
      this.dispose(currentTileValue);this.entries.delete(currentTileKey);
    }
    for(let currentRowIndex=currentTileWindow.firstRow;currentRowIndex<=currentTileWindow.lastRow;currentRowIndex++)
      for(let currentColumnIndex=currentTileWindow.firstColumn;currentColumnIndex<=currentTileWindow.lastColumn;currentColumnIndex++){
        const currentTileKey=`${currentColumnIndex},${currentRowIndex}`;
        if(!this.entries.has(currentTileKey))this.entries.set(currentTileKey,this.create(currentColumnIndex,currentRowIndex));
      }
    this.previous=currentWindowSignature;
  }

  clear(){for(const value of this.entries.values())this.dispose(value);this.entries.clear();this.previous='';}
}
