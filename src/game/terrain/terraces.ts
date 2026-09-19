import Phaser from 'phaser';
import type {Position} from '../../client/types';
import {cliffFaces, elevationTileFaces, type ElevationTile, type Surface} from './elevation';

const CLIFF = { light:0x8d7655, dark:0x675642, seam:0x4b4639, rim:0xb5bb79, strata:8 };
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

// 일반 타일을 대체하는 전체 폭의 돌 디딤면. 별도 계단 오브젝트를 올리지 않는다.
export function drawElevationTile(g:Phaser.GameObjects.Graphics,tile:ElevationTile,map:Surface){
  for(const face of elevationTileFaces(tile,map)){
    const points=face.points.map(p=>new Phaser.Geom.Point(p.x,p.y));
    g.fillStyle(face.top?0xbeb694:0x81785e);g.fillPoints(points,true);
    g.lineStyle(.7,face.top?0xe0d7b8:0x615a48,.85);g.strokePoints(points,true);
  }
}
