import { BASE_THICKNESS, CELL_HEIGHT, CELL_WIDTH, ELEVATION_STEP, MAP_ORIGIN, type Surface } from './elevation';

export type ViewBounds = {left:number;top:number;right:number;bottom:number};
export type TileWindow = {firstColumn:number;lastColumn:number;firstRow:number;lastRow:number};
// 장식과 선 두께, 카메라 이동 직전의 경계를 포함한다.
const OVERSCAN = CELL_WIDTH * 2;

export function elevationRange(surface: Surface): {min:number;max:number} {
  if (surface.heightSource) return elevationRange(surface.heightSource.surface);
  let min=0,max=0;
  for(const row of surface.elevations ?? [])for(const height of row){min=Math.min(min,height);max=Math.max(max,height);}
  return {min,max};
}

/** 회전된 표시 좌표에서 지면·절벽·승강 타일 전체를 포함하는 보수적 범위. */
export function terrainWindow(surface: Surface, heights: {min:number;max:number}, bounds: ViewBounds): TileWindow {
  const differenceMin=(bounds.left-OVERSCAN-MAP_ORIGIN.x)/(CELL_WIDTH/2);
  const differenceMax=(bounds.right+OVERSCAN-MAP_ORIGIN.x)/(CELL_WIDTH/2);
  const sumMin=(bounds.top-OVERSCAN-BASE_THICKNESS-MAP_ORIGIN.y+heights.min*ELEVATION_STEP)/(CELL_HEIGHT/2);
  const sumMax=(bounds.bottom+OVERSCAN-MAP_ORIGIN.y+heights.max*ELEVATION_STEP)/(CELL_HEIGHT/2);
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
  sync(window:TileWindow) {
    const signature=JSON.stringify(window);
    if(signature===this.previous)return;
    const wanted=new Set<string>();
    for(let row=window.firstRow;row<=window.lastRow;row++)for(let column=window.firstColumn;column<=window.lastColumn;column++) {
      const key=`${column},${row}`;wanted.add(key);
      if(!this.entries.has(key))this.entries.set(key,this.create(column,row));
    }
    for(const [key,value] of this.entries)if(!wanted.has(key)){this.dispose(value);this.entries.delete(key);}
    this.previous=signature;
  }
  clear(){for(const value of this.entries.values())this.dispose(value);this.entries.clear();this.previous='';}
}
