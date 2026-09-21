import type Phaser from 'phaser';
import {setLocale} from '../src/i18n';

const activeReviewGames: Phaser.Game[]=[];
export function registerReviewGame(currentReviewGame: Phaser.Game){activeReviewGames.push(currentReviewGame);}
export function installReviewRuntime(){
 const currentReviewParameters=new URLSearchParams(location.search);
 const selectedReviewLocale=currentReviewParameters.get('locale')??'ko';
 if(selectedReviewLocale!=='ko'&&selectedReviewLocale!=='en')throw new Error('지원하지 않는 검수 언어');
 setLocale(selectedReviewLocale);
 document.addEventListener('review-pane-hidden',()=>activeReviewGames.forEach(currentReviewGame=>currentReviewGame.loop.sleep()));
 document.addEventListener('review-pane-visible',()=>activeReviewGames.forEach(currentReviewGame=>currentReviewGame.loop.wake()));
 window.addEventListener('pagehide',()=>activeReviewGames.forEach(currentReviewGame=>currentReviewGame.destroy(true)));
 document.documentElement.dataset.reviewRuntime='1';
}
