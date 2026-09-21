import {render} from 'preact';
import {useState} from 'preact/hooks';
import {WorldDrawer} from '../src/ui/WorldDrawer';
import {FieldPoints} from '../src/ui/FieldPoints';
import {installReviewRuntime} from './runtime';
import '../src/styles.css';
import './design-system.css';

const reviewTokenNames=['--page-bg','--brand-primary','--brand-light','--brand-ink','--panel','--border','--muted'];
installReviewRuntime();
function DesignSystemCatalog(){
 const [selectedReviewPanel,setSelectedReviewPanel]=useState(false);
 const [currentActionRecord,setCurrentActionRecord]=useState('아직 동작 없음');
 return <div class="design-review-catalog"><h1>디자인 시스템</h1><p>게임과 동일한 스타일·컴포넌트를 사용합니다. 초기 상태 복원은 관리도구에서 실행하세요.</p>
 <section><h2>색상 토큰</h2><div class="review-token-grid">{reviewTokenNames.map(currentTokenName=><div><div class="review-color-swatch" style={{background:`var(${currentTokenName})`}}/><code>{currentTokenName}</code><p>{getComputedStyle(document.documentElement).getPropertyValue(currentTokenName)}</p></div>)}</div></section>
 <section><h2>버튼 상태</h2>{['','secondary','danger','compact'].map(currentButtonClass=><div class="review-button-row"><button class={currentButtonClass} onClick={()=>setCurrentActionRecord(`${currentButtonClass||'기본'} 버튼 선택`)}>{currentButtonClass||'기본'} 버튼</button><button class={currentButtonClass} disabled>비활성</button><button class={currentButtonClass}>긴 이름을 가진 캐릭터의 행동을 확인합니다</button></div>)}<p role="status">{currentActionRecord}</p></section>
 <section><h2>입력과 선택</h2><label>캐릭터 이름<input placeholder="이름 입력"/></label><label>상태<select><option>기본</option><option>선택됨</option></select></label></section>
 <section><h2>자원과 패널</h2><FieldPoints fp={200} max={1000} nextChargeAt={60} now={0}/><button onClick={()=>setSelectedReviewPanel(true)}>공통 패널 열기</button></section>
 {selectedReviewPanel&&<WorldDrawer title="공통 패널 검수" onClose={()=>setSelectedReviewPanel(false)}><p>긴 문구의 줄바꿈과 닫기 버튼, 키보드 포커스를 확인합니다.</p><button onClick={()=>setSelectedReviewPanel(false)}>확인</button></WorldDrawer>}
 </div>;
}
render(<DesignSystemCatalog/>,document.querySelector('#review-root')!);
