import type Phaser from 'phaser';
import type { PersonalFieldMarker } from '../../client/types';

const PERSONAL_MARKER_STYLE = {routeColor:0x8ee4cf,lightColor:0xffd77b,lineWidth:2.6,radius:9.1,glowRadius:19.5,glowAlpha:0.16};

export function drawPersonalMarker(currentRenderScene: Phaser.Scene,currentMarkerRecord: PersonalFieldMarker,currentProjectedPosition: {x:number;y:number}) {
  const currentMarkerGraphic = currentRenderScene.add.graphics({x:currentProjectedPosition.x,y:currentProjectedPosition.y});
  const currentMarkerColor = currentMarkerRecord.kind === 'LIGHT' ? PERSONAL_MARKER_STYLE.lightColor : PERSONAL_MARKER_STYLE.routeColor;
  currentMarkerGraphic.lineStyle(PERSONAL_MARKER_STYLE.lineWidth,currentMarkerColor,1);
  if (currentMarkerRecord.kind === 'LIGHT') {
    currentMarkerGraphic.fillStyle(currentMarkerColor,PERSONAL_MARKER_STYLE.glowAlpha);
    currentMarkerGraphic.fillCircle(0,0,PERSONAL_MARKER_STYLE.glowRadius);
    currentMarkerGraphic.strokeCircle(0,0,PERSONAL_MARKER_STYLE.radius);
  } else {
    currentMarkerGraphic.strokeTriangle(0,-PERSONAL_MARKER_STYLE.radius,PERSONAL_MARKER_STYLE.radius,PERSONAL_MARKER_STYLE.radius,
      -PERSONAL_MARKER_STYLE.radius,PERSONAL_MARKER_STYLE.radius);
  }
  return currentMarkerGraphic;
}
