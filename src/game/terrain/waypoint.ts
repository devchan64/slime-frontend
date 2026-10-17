import {GAME_INTERNAL_RESOLUTION_SCALE} from '../renderQuality';
import Phaser from 'phaser';
import type {Waypoint} from './meadow';

const WAYPOINT_GUIDE_TEXTURE = 'waypoint-guide-v1';
const WAYPOINT_GUIDE_ANIMATION = 'waypoint-guide-loop-v1';
const WAYPOINT_GUIDE_STYLE = {size:80,lift:0,labelY:-82,labelSize:'12px',labelPadding:4,depth:100,frameRate:4};
const WAYPOINT_DESTINATION_NAMES: Record<string,string> = {meadow:'이슬 초원',grove:'푸른 숲','mist-lake':'안개 호수','wind-hills':'바람 구릉'};

export function waypointMarkerScale(currentCameraZoom:number):number {
 if(!Number.isFinite(currentCameraZoom)||currentCameraZoom<=0)throw Error('웨이포인트 줌 배율이 유효하지 않습니다.');
 return 1/currentCameraZoom;
}

/** 게임과 검수에서 같은 2×2 시트를 재생한다. */
export function prepareWaypointGuideAnimation(currentGameScene:Phaser.Scene){
 if(!currentGameScene.textures.exists(WAYPOINT_GUIDE_TEXTURE))throw Error('웨이포인트 안내 스프라이트가 없습니다.');
 const currentGuideTexture=currentGameScene.textures.get(WAYPOINT_GUIDE_TEXTURE);
 const currentSourceImage=currentGuideTexture.getSourceImage() as HTMLImageElement;
 if(currentSourceImage.width!==currentSourceImage.height||currentSourceImage.width%2!==0)throw Error('웨이포인트 시트는 짝수 크기의 정사각형 2×2 프레임이어야 합니다.');
 const currentFrameSize=currentSourceImage.width/2;
 for(let currentFrameIndex=0;currentFrameIndex<4;currentFrameIndex++){
  const currentFrameName='guide-'+currentFrameIndex;
  if(!currentGuideTexture.has(currentFrameName))currentGuideTexture.add(currentFrameName,0,(currentFrameIndex%2)*currentFrameSize,Math.floor(currentFrameIndex/2)*currentFrameSize,currentFrameSize,currentFrameSize);
 }
 if(!currentGameScene.anims.exists(WAYPOINT_GUIDE_ANIMATION))currentGameScene.anims.create({key:WAYPOINT_GUIDE_ANIMATION,frames:Array.from({length:4},(_,currentFrameIndex)=>({key:WAYPOINT_GUIDE_TEXTURE,frame:'guide-'+currentFrameIndex})),frameRate:WAYPOINT_GUIDE_STYLE.frameRate,repeat:-1});
}

export function drawWaypoint(currentGameScene:Phaser.Scene,currentWaypointRecord:Waypoint,currentScreenColumn:number,currentScreenRow:number){
 const currentDestinationName=currentWaypointRecord.targetName??WAYPOINT_DESTINATION_NAMES[currentWaypointRecord.target];
 if(!currentDestinationName)throw Error('웨이포인트 목적지 이름이 없습니다: '+currentWaypointRecord.target);
 prepareWaypointGuideAnimation(currentGameScene);
 const currentGuideSprite=currentGameScene.add.sprite(0,-WAYPOINT_GUIDE_STYLE.lift,WAYPOINT_GUIDE_TEXTURE,'guide-0').setOrigin(.5,.94).setDisplaySize(WAYPOINT_GUIDE_STYLE.size,WAYPOINT_GUIDE_STYLE.size);
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)currentGuideSprite.play(WAYPOINT_GUIDE_ANIMATION);
 const currentGuideLabel=currentGameScene.add.text(0,WAYPOINT_GUIDE_STYLE.labelY,currentDestinationName,{fontFamily:'sans-serif',fontSize:WAYPOINT_GUIDE_STYLE.labelSize,color:'#fff3d6',backgroundColor:'#49331fee',padding:{x:WAYPOINT_GUIDE_STYLE.labelPadding,y:WAYPOINT_GUIDE_STYLE.labelPadding}}).setOrigin(.5,1);
 return currentGameScene.add.container(currentScreenColumn,currentScreenRow,[currentGuideSprite,currentGuideLabel]).setData('fieldOcclusionBaseAlpha',1).setData('fieldOcclusionChildren',[currentGuideSprite]).setDepth(WAYPOINT_GUIDE_STYLE.depth).setScale(waypointMarkerScale(currentGameScene.cameras.main.zoom/GAME_INTERNAL_RESOLUTION_SCALE));
}
