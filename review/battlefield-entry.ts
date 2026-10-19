import {setLocale} from '../src/i18n';
import {mountBattlefieldReview,BATTLE_REVIEW_DEFAULT_FIELD} from './battlefield-runtime';

const currentReviewParameters=new URLSearchParams(location.search);
const currentReviewLocale=currentReviewParameters.get('locale')??'ko';
if(currentReviewLocale!=='ko'&&currentReviewLocale!=='en')throw new Error('지원하지 않는 검수 언어');
setLocale(currentReviewLocale);
const currentReviewController=mountBattlefieldReview(document.body,{field:currentReviewParameters.get('field')??BATTLE_REVIEW_DEFAULT_FIELD,locale:currentReviewLocale,overview:currentReviewParameters.has('overview'),controls:true});
window.addEventListener('pagehide',()=>currentReviewController.dispose(),{once:true});
