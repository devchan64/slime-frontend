import {setLocale} from '../src/i18n';
import {mountBattlefieldReview} from './battlefield-runtime';
import currentGameStyles from '../src/styles.css?inline';
import currentBattleStyles from './battlefield-preview.css?inline';

const BATTLE_REVIEW_STYLES=(currentGameStyles+'\n'+currentBattleStyles).replace(/:root\b|(?<![\w.-])body\b/g,'[data-review-document]');
export function mountReviewPage(currentReviewHost:HTMLElement,currentReviewOptions:{locale:string;field?:string;overview?:boolean}){
 if(!(currentReviewHost instanceof HTMLElement)||!currentReviewHost.isConnected||currentReviewHost.shadowRoot)throw new Error('비어 있는 연결된 검수 호스트가 필요합니다.');
 if(currentReviewOptions.locale!=='ko'&&currentReviewOptions.locale!=='en')throw new Error('지원하지 않는 검수 언어');
 setLocale(currentReviewOptions.locale);
 const currentReviewShadow=currentReviewHost.attachShadow({mode:'open'});
 const currentReviewStyles=document.createElement('style');currentReviewStyles.textContent=BATTLE_REVIEW_STYLES;
 const currentReviewDocument=document.createElement('section');currentReviewDocument.setAttribute('data-review-document','');
 currentReviewShadow.append(currentReviewStyles,currentReviewDocument);
 const currentReviewController=mountBattlefieldReview(currentReviewDocument,{field:currentReviewOptions.field??'all',locale:currentReviewOptions.locale,overview:currentReviewOptions.overview??false,controls:false});
 return {...currentReviewController,dispose(){currentReviewController.dispose();currentReviewShadow.replaceChildren();}};
}
