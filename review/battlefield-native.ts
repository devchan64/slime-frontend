import {setLocale} from '../src/i18n';
import {mountBattlefieldReview,BATTLE_REVIEW_DEFAULT_FIELD} from './battlefield-runtime';
export function mountReviewPage(currentReviewHost:HTMLElement,currentReviewOptions:{locale:string;field?:string;overview?:boolean}){
 if(!(currentReviewHost instanceof HTMLElement)||!currentReviewHost.isConnected||currentReviewHost.shadowRoot)throw new Error('비어 있는 연결된 검수 호스트가 필요합니다.');
 if(currentReviewOptions.locale!=='ko'&&currentReviewOptions.locale!=='en')throw new Error('지원하지 않는 검수 언어');
 setLocale(currentReviewOptions.locale);
 const currentReviewShadow=currentReviewHost.attachShadow({mode:'open'});
 const currentReviewDocument=document.createElement('section');currentReviewDocument.setAttribute('data-review-document','');
 currentReviewShadow.append(currentReviewDocument);
 const currentReviewController=mountBattlefieldReview(currentReviewDocument,{field:currentReviewOptions.field??BATTLE_REVIEW_DEFAULT_FIELD,locale:currentReviewOptions.locale,overview:currentReviewOptions.overview??false,controls:false});
 return {...currentReviewController,dispose(){currentReviewController.dispose();currentReviewShadow.replaceChildren();}};
}
