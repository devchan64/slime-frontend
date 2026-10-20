import type Phaser from 'phaser';
import type {Position} from '../../client/types';
export type GroundDecalRecord={id:string;textureKey:string;position:Position;offsetX:number;offsetY:number;scale:number;rotation:number;opacity:number;order:number};
const GROUND_DECAL_CANVAS_SIZE=256;
/** 지면과 같은 UV 면에 합성하고 깊이·통행·지형 경계 판정은 유지한다. */
export function composeGroundDecalTexture(currentGameScene:Phaser.Scene,currentGroundKey:string,currentCellPosition:Position,currentDecalRecords:readonly GroundDecalRecord[]):string{
 const currentSelectedDecals=currentDecalRecords.filter(currentDecalRecord=>currentDecalRecord.position.column===currentCellPosition.column&&currentDecalRecord.position.row===currentCellPosition.row).sort((currentFirstRecord,currentSecondRecord)=>currentFirstRecord.order-currentSecondRecord.order||currentFirstRecord.id.localeCompare(currentSecondRecord.id));
 if(!currentSelectedDecals.length)return currentGroundKey;
 const currentCompositeKey='ground-decal:'+currentGroundKey+':'+JSON.stringify(currentSelectedDecals);
 if(currentGameScene.textures.exists(currentCompositeKey))return currentCompositeKey;
 const currentCanvasTexture=currentGameScene.textures.createCanvas(currentCompositeKey,GROUND_DECAL_CANVAS_SIZE,GROUND_DECAL_CANVAS_SIZE);
 if(!currentCanvasTexture)throw Error('데칼 합성 캔버스 생성 실패');
 const currentCanvasContext=currentCanvasTexture.context;
 currentCanvasContext.drawImage(currentGameScene.textures.get(currentGroundKey).getSourceImage() as HTMLImageElement,0,0,GROUND_DECAL_CANVAS_SIZE,GROUND_DECAL_CANVAS_SIZE);
 for(const currentDecalRecord of currentSelectedDecals){
  if(!currentGameScene.textures.exists(currentDecalRecord.textureKey))throw Error('데칼 텍스처 누락: '+currentDecalRecord.textureKey);
  const currentRotationAngle=currentDecalRecord.rotation*Math.PI/180;
  const currentHalfExtent=currentDecalRecord.scale*(Math.abs(Math.sin(currentRotationAngle))+Math.abs(Math.cos(currentRotationAngle)))/2;
  if(![currentDecalRecord.offsetX,currentDecalRecord.offsetY,currentDecalRecord.scale,currentDecalRecord.rotation,currentDecalRecord.opacity,currentDecalRecord.order].every(Number.isFinite)||currentDecalRecord.scale<=0||currentDecalRecord.opacity<0||currentDecalRecord.opacity>1||Math.min(currentDecalRecord.offsetX,currentDecalRecord.offsetY,1-currentDecalRecord.offsetX,1-currentDecalRecord.offsetY)<currentHalfExtent)throw Error('데칼 타일 범위·속성 오류: '+currentDecalRecord.id);
  const currentStampSize=currentDecalRecord.scale*GROUND_DECAL_CANVAS_SIZE;
  currentCanvasContext.save();
  currentCanvasContext.translate(currentDecalRecord.offsetX*GROUND_DECAL_CANVAS_SIZE,currentDecalRecord.offsetY*GROUND_DECAL_CANVAS_SIZE);
  currentCanvasContext.rotate(currentRotationAngle);
  currentCanvasContext.globalAlpha=currentDecalRecord.opacity;
  currentCanvasContext.drawImage(currentGameScene.textures.get(currentDecalRecord.textureKey).getSourceImage() as HTMLImageElement,-currentStampSize/2,-currentStampSize/2,currentStampSize,currentStampSize);
  currentCanvasContext.restore();
 }
 currentCanvasTexture.refresh();
 return currentCompositeKey;
}
