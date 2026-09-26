import Phaser from 'phaser';
import type {Position} from '../../client/types';
import {cliffFaces, elevationTileFaces, type ElevationTile, type Surface} from './elevation';
import {CLIFF_WALL_TEXTURE} from './textures';

const CLIFF = { light:0x8d7655, dark:0x675642, seam:0x4b4639, rim:0xb5bb79, strata:10 };
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

// 고도 차로 생기는 절벽 면에 128px 재질 타일을 반복 적용하고 면 밖은 마스크로 자른다.
export function addCliffWallPatterns(scene:Phaser.Scene,rememberTerrainObject:<T extends Phaser.GameObjects.GameObject>(object:T)=>T,cell:Position,map:Surface,currentDepth:number){
  for(const face of cliffFaces(cell,map)){
    const minimumX=Math.min(...face.map(point=>point.x)),maximumX=Math.max(...face.map(point=>point.x));
    const minimumY=Math.min(...face.map(point=>point.y)),maximumY=Math.max(...face.map(point=>point.y));
    const faceWidth=Math.max(1,Math.ceil(maximumX-minimumX)),faceHeight=Math.max(1,Math.ceil(maximumY-minimumY));
    const textureSprite=rememberTerrainObject(scene.add.tileSprite(minimumX,minimumY,faceWidth,faceHeight,CLIFF_WALL_TEXTURE).setOrigin(0).setDepth(currentDepth+.1));
    const maskGraphic=rememberTerrainObject(scene.add.graphics());
    maskGraphic.fillPoints(face.map(point=>new Phaser.Geom.Point(point.x,point.y)),true).setVisible(false);
    textureSprite.setMask(maskGraphic.createGeometryMask());
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
