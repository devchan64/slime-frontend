# 공용 필드 렌더러

`@slime/field-renderer` 1.0.5은 게임과 관리도구 필드 검수가 동일하게 실행하는 Phaser 3.90.0 렌더러다. `field-surface` 1.0.5의 고도·투영 계약을 사용한다. 타일·절벽·계단의 실제 그리기, 결계탑 앵커, 결계 외곽 판정·패널·UV·재생과 메시 경계 표시를 소유한다.

소비자는 준비된 Phaser Scene, 텍스처 키, 맵 표면, 투영 옵션, 깊이와 표시 옵션을 전달한다. 렌더러는 로그인·HTTP·파일 경로에 의존하지 않는다. 게임은 기존 뷰포트 캐시로 셀을 만들고 제거하며, 검수는 같은 함수를 호출하고 카메라·표시 옵션을 제어한다. 캐릭터 애니메이션·전투 표시와 마을 건물 렌더링은 이 패키지의 범위 밖이다.

`drawFieldCellObjects`가 반환한 객체는 호출자가 폐기한다. 오러는 객체 폐기 시 프레임 이벤트를 해제한다. 연결 텍스처는 Scene의 텍스처 관리자에 캐시한다. 메시 좌표는 화면 좌표로 입력하며 Phaser의 위쪽 Y축 변환은 패키지가 담당한다. 결계는 바닥 음영 없이 외곽 엣지 전체에 높이 25px의 패널을 세운다.

배포는 `npm run build:field-renderer`로 수행한다. `.tmp/field-renderer/1.0.5/`의 ES 모듈·Phaser 배포본·SHA-256 manifest를 관리도구 `ui/map/vendor/field-renderer/1.0.5/`에 명시적으로 전달한다. 라이브러리 변경을 정식 전달한 뒤에는 버전을 올리고 새 버전 디렉터리를 사용한다. 관리도구 실행·게시 단계에서 인접 게임 소스를 빌드하지 않는다. 게임 전체 빌드도 필요 없다.

회귀 확인: `node scripts/run-regression.mjs --with-checks tests/field-renderer.test.mjs tests/field-surface.test.mjs tests/elevation.test.mjs`. 메시 검사는 Phaser 실제 Vertex·Matrix 투영으로 엣지 너비·높이·Y 방향을 확인한다.
