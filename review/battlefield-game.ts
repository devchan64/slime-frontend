import Phaser from 'phaser';

/** 같은 문서에서 반복 연결하는 검수용 게임 수명. Phaser 3.90 start 계약을 유지한다. */
export class BattlefieldReviewGame extends Phaser.Game {
 // Phaser의 protected start가 갱신하는 내부 상태를 이 하위 클래스에서만 쓰기 가능하게 선언한다.
 declare isRunning:boolean;
 protected start(){
  this.isRunning=true;
  this.config.postBoot(this);
  this.loop.start(this.renderer?this.step.bind(this):this.headlessStep.bind(this));
  const currentGameEvents=this.events;
  const updateReviewVisibility=()=>currentGameEvents.emit(document.hidden?Phaser.Core.Events.HIDDEN:Phaser.Core.Events.VISIBLE);
  const reportReviewBlur=()=>currentGameEvents.emit(Phaser.Core.Events.BLUR);
  const reportReviewFocus=()=>currentGameEvents.emit(Phaser.Core.Events.FOCUS);
  // Phaser 기본 VisibilityHandler는 익명 document 리스너를 남기고 window.onfocus를 교체한다.
  // 검수에서는 각 인스턴스가 소유한 리스너만 추가·제거하며 부모 Gradio의 핸들러를 보존한다.
  document.addEventListener('visibilitychange',updateReviewVisibility);
  window.addEventListener('blur',reportReviewBlur);
  window.addEventListener('focus',reportReviewFocus);
  currentGameEvents.on(Phaser.Core.Events.HIDDEN,this.onHidden,this);
  currentGameEvents.on(Phaser.Core.Events.VISIBLE,this.onVisible,this);
  currentGameEvents.on(Phaser.Core.Events.BLUR,this.onBlur,this);
  currentGameEvents.on(Phaser.Core.Events.FOCUS,this.onFocus,this);
  currentGameEvents.once(Phaser.Core.Events.DESTROY,()=>{
   document.removeEventListener('visibilitychange',updateReviewVisibility);
   window.removeEventListener('blur',reportReviewBlur);
   window.removeEventListener('focus',reportReviewFocus);
  });
 }
}
