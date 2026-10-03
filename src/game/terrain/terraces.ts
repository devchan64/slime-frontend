import {resolveCliffTextureScale} from "../../../packages/field-surface/field-surface.mjs";
import {resolveMapTileSize, MAP_ELEVATION_HEIGHT} from "./renderMetrics";
import Phaser from 'phaser';
import type {Position} from '../../client/types';
import {cliffFaces, elevationTileFaces, type ElevationTile, type Surface} from './elevation';
import {CLIFF_WALL_TEXTURE,RAMP_TREAD_TEXTURE} from './textures';

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

// 벽 한 칸 너비·한 단계 층고에 맞춘 재질을 반복하고 면 밖은 마스크로 자른다.
export function addCliffWallPatterns(scene:Phaser.Scene,rememberTerrainObject:<T extends Phaser.GameObjects.GameObject>(object:T)=>T,cell:Position,map:Surface,currentDepth:number,currentTextureKey:string=CLIFF_WALL_TEXTURE,currentFacePoints=cliffFaces(cell,map)){
  for(const face of currentFacePoints){
    const selectedWallTexture=currentTextureKey;
    const currentTextureImage=scene.textures.get(selectedWallTexture).getSourceImage();
    const currentTextureScale=resolveCliffTextureScale({tileWidth:resolveMapTileSize(map).width,tileHeight:resolveMapTileSize(map).height,elevationHeight:MAP_ELEVATION_HEIGHT,baseThickness:0},currentTextureImage.width,currentTextureImage.height);
    const minimumX=Math.min(...face.map(point=>point.x)),maximumX=Math.max(...face.map(point=>point.x));
    const minimumY=Math.min(...face.map(point=>point.y)),maximumY=Math.max(...face.map(point=>point.y));
    const faceWidth=Math.max(1,Math.ceil(maximumX-minimumX)),faceHeight=Math.max(1,Math.ceil(maximumY-minimumY));
    const textureSprite=rememberTerrainObject(scene.add.tileSprite(minimumX,minimumY,faceWidth,faceHeight,selectedWallTexture).setOrigin(0).setDepth(currentDepth+.1));
    textureSprite.setTileScale(currentTextureScale.scaleX,currentTextureScale.scaleY);
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

// 공통 면 순서대로 수직 암벽과 수평 디딤면을 그린다.
export function addRampWallPatterns(currentSceneValue:Phaser.Scene,rememberTerrainObject:<T extends Phaser.GameObjects.GameObject>(object:T)=>T,currentElevationTile:ElevationTile,currentMapSurface:Surface,currentRenderDepth:number){
  const currentSurfaceFaces=elevationTileFaces(currentElevationTile,currentMapSurface);
  const currentTreadCount=currentSurfaceFaces.filter(currentFaceRecord=>currentFaceRecord.top).length;
  const currentSourceImage=currentSceneValue.textures.get(RAMP_TREAD_TEXTURE).getSourceImage() as HTMLImageElement;
  for(const [currentFaceIndex,currentFaceRecord] of currentSurfaceFaces.entries()){
    const currentFaceDepth=currentRenderDepth+currentFaceIndex/currentSurfaceFaces.length;
    if(!currentFaceRecord.top){
      addCliffWallPatterns(currentSceneValue,rememberTerrainObject,currentElevationTile.cell,currentMapSurface,currentFaceDepth,CLIFF_WALL_TEXTURE,[currentFaceRecord.points]);
      continue;
    }
    const currentFacePoints=currentFaceRecord.points;
    const currentMinimumX=Math.floor(Math.min(...currentFacePoints.map(currentPointValue=>currentPointValue.x)));
    const currentMinimumY=Math.floor(Math.min(...currentFacePoints.map(currentPointValue=>currentPointValue.y)));
    const currentCanvasWidth=Math.ceil(Math.max(...currentFacePoints.map(currentPointValue=>currentPointValue.x)))-currentMinimumX;
    const currentCanvasHeight=Math.ceil(Math.max(...currentFacePoints.map(currentPointValue=>currentPointValue.y)))-currentMinimumY;
    const currentTextureIdentifier=Phaser.Utils.String.UUID();
    const currentCanvasTexture=currentSceneValue.textures.createCanvas(currentTextureIdentifier,currentCanvasWidth,currentCanvasHeight);
    if(!currentCanvasTexture)throw new Error('경사로 수평면 캔버스 생성 실패');
    const currentDrawingContext=currentCanvasTexture.getContext();
    const [currentFirstPoint,currentSecondPoint,,currentFourthPoint]=currentFacePoints;
    const currentStripWidth=currentSourceImage.width/currentTreadCount;
    currentDrawingContext.setTransform((currentSecondPoint.x-currentFirstPoint.x)/currentStripWidth,(currentSecondPoint.y-currentFirstPoint.y)/currentStripWidth,(currentFourthPoint.x-currentFirstPoint.x)/currentSourceImage.height,(currentFourthPoint.y-currentFirstPoint.y)/currentSourceImage.height,currentFirstPoint.x-currentMinimumX,currentFirstPoint.y-currentMinimumY);
    currentDrawingContext.drawImage(currentSourceImage,0,0,currentStripWidth,currentSourceImage.height,0,0,currentStripWidth,currentSourceImage.height);
    currentCanvasTexture.refresh();
    rememberTerrainObject(currentSceneValue.add.image(currentMinimumX,currentMinimumY,currentTextureIdentifier).setOrigin(0).setDepth(currentFaceDepth+.1)).once('destroy',()=>currentSceneValue.textures.remove(currentTextureIdentifier));
  }
}
