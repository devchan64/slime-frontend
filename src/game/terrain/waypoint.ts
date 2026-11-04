import currentWaypointMetadata from '../../../../slime-assets/assets/sprites/effects/waypoint/waypoint-guide-v4.animation.json';
import {GAME_INTERNAL_RESOLUTION_SCALE} from '../renderQuality';
import Phaser from 'phaser';
import type {Waypoint} from './meadow';
import {MAP_LABEL_FONT_SIZE} from './mapLabelStyle';

const WAYPOINT_GUIDE_SOURCE = 'assets/sprites/effects/waypoint/waypoint-guide-v4.png';
const WAYPOINT_GUIDE_TEXTURE = 'waypoint-guide-v1';
const WAYPOINT_GUIDE_ANIMATION = 'waypoint-guide-loop-v1';
const WAYPOINT_GUIDE_STYLE = {size:90,lift:0,labelY:-50,labelSize:MAP_LABEL_FONT_SIZE,labelPadding:4,depth:100,frameRate:6};
const WAYPOINT_DESTINATION_NAMES: Record<string,string> = {meadow:'이슬 초원',grove:'푸른 숲','mist-lake':'안개 호수','wind-hills':'바람 구릉'};

/** 맵 이동 표시는 빌보드와 별도의 이펙트 원본으로 불러온다. */
export function preloadWaypointGuide(currentGameScene:Phaser.Scene) {
 currentGameScene.load.image(WAYPOINT_GUIDE_TEXTURE,WAYPOINT_GUIDE_SOURCE);
}

export function waypointMarkerScale(currentCameraZoom:number):number {
 if(!Number.isFinite(currentCameraZoom)||currentCameraZoom<=0)throw Error('웨이포인트 줌 배율이 유효하지 않습니다.');
 return 1/currentCameraZoom;
}

/** 마커는 화면 크기를 유지하고 라벨은 건물 라벨과 같은 배율로 표시한다. */
export function setWaypointMarkerZoom(currentWaypointMarker:Phaser.GameObjects.Container,currentCameraZoom:number):void {
 const currentMarkerScale=waypointMarkerScale(currentCameraZoom);
 currentWaypointMarker.setScale(currentMarkerScale);
 const currentWaypointLabel=currentWaypointMarker.getData('waypointLabel') as Phaser.GameObjects.Text|undefined;
 if(!currentWaypointLabel)throw Error('웨이포인트 라벨이 없습니다.');
 currentWaypointLabel.setScale(currentCameraZoom).setY(WAYPOINT_GUIDE_STYLE.labelY*currentCameraZoom);
}

/** 게임과 검수에서 같은 4×2 8프레임 시트를 재생한다. */
export function prepareWaypointGuideAnimation(currentGameScene:Phaser.Scene){
 if(!currentGameScene.textures.exists(WAYPOINT_GUIDE_TEXTURE))throw Error('웨이포인트 안내 스프라이트가 없습니다.');
 const currentGuideTexture=currentGameScene.textures.get(WAYPOINT_GUIDE_TEXTURE);
 const currentSourceImage=currentGuideTexture.getSourceImage() as HTMLImageElement;
 if(currentSourceImage.width!==currentWaypointMetadata.sheet.width||currentSourceImage.height!==currentWaypointMetadata.sheet.height||currentWaypointMetadata.frames.length!==8)throw Error('웨이포인트 8프레임 시트 규격이 올바르지 않습니다.');
 for(const [currentFrameIndex,currentFrameRecord] of currentWaypointMetadata.frames.entries()){
  const currentFrameName='guide-'+currentFrameIndex;
  const currentFrameRect=currentFrameRecord.rect;
  if(!currentGuideTexture.has(currentFrameName))currentGuideTexture.add(currentFrameName,0,currentFrameRect.x,currentFrameRect.y,currentFrameRect.width,currentFrameRect.height);
 }
 if(!currentGameScene.anims.exists(WAYPOINT_GUIDE_ANIMATION))currentGameScene.anims.create({key:WAYPOINT_GUIDE_ANIMATION,frames:currentWaypointMetadata.frames.map((_,currentFrameIndex)=>({key:WAYPOINT_GUIDE_TEXTURE,frame:'guide-'+currentFrameIndex})),frameRate:WAYPOINT_GUIDE_STYLE.frameRate,repeat:-1});
}

export function drawWaypoint(currentGameScene:Phaser.Scene,currentWaypointRecord:Waypoint,currentScreenColumn:number,currentScreenRow:number){
 const currentDestinationName=currentWaypointRecord.targetName??WAYPOINT_DESTINATION_NAMES[currentWaypointRecord.target];
 if(!currentDestinationName)throw Error('웨이포인트 목적지 이름이 없습니다: '+currentWaypointRecord.target);
 prepareWaypointGuideAnimation(currentGameScene);
 const currentGuideSprite=currentGameScene.add.sprite(0,-WAYPOINT_GUIDE_STYLE.lift,WAYPOINT_GUIDE_TEXTURE,'guide-0').setOrigin(currentWaypointMetadata.frames[0].anchor.x/currentWaypointMetadata.frames[0].rect.width,currentWaypointMetadata.frames[0].anchor.y/currentWaypointMetadata.frames[0].rect.height).setDisplaySize(WAYPOINT_GUIDE_STYLE.size,WAYPOINT_GUIDE_STYLE.size);
 currentGuideSprite.on('animationupdate',(_currentAnimationValue:Phaser.Animations.Animation,currentAnimationFrame:Phaser.Animations.AnimationFrame)=>{
  const currentFrameIndex=Number(String(currentAnimationFrame.textureFrame).replace('guide-',''));
  const currentAnchorFrame=currentWaypointMetadata.frames[currentFrameIndex];
  if(!currentAnchorFrame)throw Error('웨이포인트 앵커 프레임이 없습니다.');
  currentGuideSprite.setOrigin(currentAnchorFrame.anchor.x/currentAnchorFrame.rect.width,currentAnchorFrame.anchor.y/currentAnchorFrame.rect.height);
 });
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)currentGuideSprite.play(WAYPOINT_GUIDE_ANIMATION);
 const currentGuideLabel=currentGameScene.add.text(0,WAYPOINT_GUIDE_STYLE.labelY,currentDestinationName,{fontFamily:'sans-serif',fontSize:WAYPOINT_GUIDE_STYLE.labelSize,color:'#fff3d6',backgroundColor:'#49331fee',padding:{x:WAYPOINT_GUIDE_STYLE.labelPadding,y:WAYPOINT_GUIDE_STYLE.labelPadding}}).setOrigin(.5,1);
 const currentWaypointMarker=currentGameScene.add.container(currentScreenColumn,currentScreenRow,[currentGuideSprite,currentGuideLabel]).setData('fieldOcclusionBaseAlpha',1).setData('fieldOcclusionChildren',[currentGuideSprite]).setData('waypointLabel',currentGuideLabel).setDepth(WAYPOINT_GUIDE_STYLE.depth);
 setWaypointMarkerZoom(currentWaypointMarker,currentGameScene.cameras.main.zoom/GAME_INTERNAL_RESOLUTION_SCALE);
 return currentWaypointMarker;
}
