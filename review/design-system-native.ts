import {setLocale} from '../src/i18n';
import {mountDesignSystemCatalog} from './design-system';
import currentGameStyles from '../src/styles.css?inline';
import currentCatalogStyles from './design-system.css?inline';

// 검수 대상 게임 CSS의 문서 루트만 Shadow DOM 호스트에 대응시킨다.
const NATIVE_REVIEW_STYLES=':host{all:initial;display:block;}'+currentGameStyles.replace(/:root\b|(?<![\w.-])body\b/g,':host')+currentCatalogStyles;

export function mountReviewPage(currentReviewHost: HTMLElement, currentReviewOptions: {locale: string}){
 if(!(currentReviewHost instanceof HTMLElement)||!currentReviewHost.isConnected||currentReviewHost.shadowRoot)throw new Error('비어 있는 연결된 검수 호스트가 필요합니다.');
 if(currentReviewOptions.locale!=='ko'&&currentReviewOptions.locale!=='en')throw new Error('지원하지 않는 검수 언어');
 setLocale(currentReviewOptions.locale);
 const currentReviewShadow=currentReviewHost.attachShadow({mode:'open'});
 const currentReviewStyles=document.createElement('style');
 currentReviewStyles.textContent=NATIVE_REVIEW_STYLES;
 const currentReviewContent=document.createElement('main');
 currentReviewShadow.append(currentReviewStyles,currentReviewContent);
 const disposeReviewCatalog=mountDesignSystemCatalog(currentReviewContent,currentReviewHost);
 let currentReviewDisposed=false;
 return {dispose(){
  if(currentReviewDisposed)return;
  currentReviewDisposed=true;
  disposeReviewCatalog();
  currentReviewShadow.replaceChildren();
 }};
}
