import {installReviewRuntime} from './runtime';
import {mountDesignSystemCatalog} from './design-system';
import '../src/styles.css';
import './design-system.css';

installReviewRuntime();
const currentReviewRoot=document.querySelector<HTMLElement>('#review-root');
if(!currentReviewRoot)throw new Error('디자인 시스템 검수 영역이 없습니다.');
const disposeReviewCatalog=mountDesignSystemCatalog(currentReviewRoot,document.documentElement);
window.addEventListener('pagehide',disposeReviewCatalog,{once:true});
