# 셀 애니메이션 소비 코드

`readCellAsset()`은 공개 v2 `SPRITE_SHEET` manifest 항목을 검증하고 `CellAnimation`을 만든다. 단일 항목을 받으며 다중 팩의 경우 호출자가 `assets`에서 관리 ID·버전을 명시적으로 선택한다. v1 정적 이미지나 미지원 형식을 애니메이션으로 추정하지 않는다.

1. 신뢰된 배포 manifest를 `readCellAsset()`으로 검사한다.
2. 선택한 PNG 바이트를 `verifyCellSheet(asset, arrayBuffer)`에 전달한다. 내용 SHA-256이 일치할 때만 원본 버퍼와 독립된 Blob을 반환한다.
3. 해당 Blob을 Phaser 텍스처 로더로 디코딩한다. 호출자가 로딩 실패 처리와 object URL 해제를 담당한다.
4. 로딩이 완료된 텍스처 키와 `asset.animation`으로 `CellActor`를 생성한다. 실제 이미지 크기도 메타데이터와 비교한다.

```ts
const actor = new CellActor(scene, loadedTextureKey, asset.animation, {
  x: footX, y: footY, scale: pixelsToWorld,
  action: 'idle', direction: 'down_left',
});
actor.image.setDepth(depth);
actor.play('walk', 'down_right');
// 같은 행동을 새로 시작하는 별도 이벤트에는 restart를 명시한다.
actor.play('attack', 'down_right', true);
```

동작·방향은 등록된 클립만 사용할 수 있다. 이미지의 발 기준점을 `x/y`에 맞추고 모든 프레임에 같은 배율을 사용한다. 위치·깊이는 호출자가 관리한다. 장면의 update 시각으로 프레임을 계산하며 자체 타이머·네트워크 요청·게임 명령을 만들지 않는다. 반복·후속 클립 순환은 긴 경과 시간에도 루프 횟수만큼 반복 계산하지 않는다. 비반복 클립의 후속이 null이면 마지막 프레임을 유지한다.

같은 동작/방향의 반복 `play()`는 시작 시각을 유지하며 `restart: true`일 때만 재시작한다. 이미지 제거 또는 장면 종료 시 이벤트 구독을 해제한다. `destroy()`는 중복 호출할 수 있다. 메타데이터는 복사·동결해 원본 객체 변경이 재생에 영향을 주지 않게 한다.

이 모듈은 현재 정적 이미지 카탈로그를 교체하지 않는다. 실제 에셋을 등록하는 호출 코드에서 manifest 신뢰 경계, 서버 이벤트와 action 연결, 회전에 따른 방향 변환을 명시해야 한다. 이름으로 방향을 추측하거나 없는 클립을 다른 동작으로 대체하지 않는다.

## 검증

```bash
node --test tests/cell-animation.test.mjs
node scripts/verify-cell-animation-browser.mjs /usr/bin/google-chrome
```

브라우저 검사는 임시 HTML·합성 Canvas 시트와 격리된 Chrome 프로필을 만들고 실제 Phaser/WebGL 프레임·기준점·개체 정리를 확인한다. SwiftShader를 사용하며 하드웨어 성능 검사가 아니다. 결과는 `.local/logs/cell-animation-browser.log`에 기록한다. 종료 시 생성한 임시 디렉터리를 제거한다.

`tests/fixtures/cell-animation-v2.json`은 워크플로우 `68c687b`의 검증·검수·export 경로로 만든 합성 출력이다. 게임 에셋이나 실제 저작물의 공개 승인을 의미하지 않는다. 브라우저의 색상 시트는 어댑터 검사에만 사용하며 원본 PNG의 해시 검증을 통과했다고 간주하지 않는다. 해시 경계는 별도 단위 검사에서 확인한다.

## 전투 논리 방향

새 전투의 `visualVersion: 1`은 유닛 `facing`과 MOVE/ATTACK 로그의 방향을 제공한다. MOVE의 `pathFacings`는 확정 `path`의 각 구간에 대응한다. `screenFacing(worldFacing, mapRotation)`으로 현재 화면 방향을 얻고 해당 클립을 선택한다. 저장 방향을 회전값으로 덮어쓰거나 표시 대상의 방향을 좌표에서 다시 추측하지 않는다. 이전 전투에는 이 필드가 없으므로 애니메이션 소비 여부를 명시적으로 구분한다.
