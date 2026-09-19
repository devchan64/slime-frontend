import Phaser from 'phaser';
import type {Position} from '../../client/types';
import {cliffFaces,project,heightAt,canStep, type Surface} from './elevation';

const CLIFF = { light:0x8d7655, dark:0x675642, seam:0x4b4639, rim:0xb5bb79, strata:8 };
const ROAD = { shoulder:0x8a795a, top:0xd4be8f, outer:14, inner:10 };
const STAIR = {width:18,steps:5,base:0x726c54,tread:0xe0c994};
const NEIGHBORS=[[0,-1],[-1,0],[1,0],[0,1]] as const;
export function drawCliffs(g:Phaser.GameObjects.Graphics,cell:Position,map:Surface){
  for(const [index,face] of cliffFaces(cell,map).entries()){
    const points=face.map(p=>new Phaser.Geom.Point(p.x,p.y));
    g.fillStyle(index===0?CLIFF.light:CLIFF.dark);g.fillPoints(points,true);
    g.lineStyle(1,CLIFF.seam,.7);g.strokePoints(points,true);
    const drop=face[3].y-face[0].y;
    for(let y=CLIFF.strata;y<drop;y+=CLIFF.strata){
      g.lineStyle(1,CLIFF.seam,.28);g.lineBetween(face[0].x,face[0].y+y,face[1].x,face[1].y+y);
    }
    g.lineStyle(2,CLIFF.rim,.9);g.lineBetween(face[0].x,face[0].y,face[1].x,face[1].y);
  }
}
export function drawCellRoad(g:Phaser.GameObjects.Graphics,cell:Position,map:Surface,road:Set<string>){
  if(!road.has(`${cell.column},${cell.row}`))return;
  const p=project(cell,map);
  for(const [width,color] of [[ROAD.outer,ROAD.shoulder],[ROAD.inner,ROAD.top]]){
    g.lineStyle(width,color,1);g.fillStyle(color);g.fillCircle(p.x,p.y,width/2);
    for(const [dc,dr] of NEIGHBORS){
      const q={column:cell.column+dc,row:cell.row+dr};
      if(!road.has(`${q.column},${q.row}`)||!canStep(cell,q,map)||heightAt(cell,map)!==heightAt(q,map))continue;
      const end=project(q,map);g.lineBetween(p.x,p.y,(p.x+end.x)/2,(p.y+end.y)/2);
    }
  }
}
export function drawStair(g:Phaser.GameObjects.Graphics,start:Position,end:Position,map:Surface){
  const a=project(start,map),b=project(end,map);
  // 가로 폭이 있는 계단의 디딤판은 월드 지면과 함께 확대·축소된다.
  g.lineStyle(STAIR.width,STAIR.base);g.lineBetween(a.x,a.y,b.x,b.y);
  for(let i=0;i<=STAIR.steps;i++){
    const t=i/STAIR.steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
    g.lineStyle(3,STAIR.tread);g.lineBetween(x-STAIR.width/2,y,x+STAIR.width/2,y);
  }
}
