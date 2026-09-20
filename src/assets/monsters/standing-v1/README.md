# 몹 스탠딩 시트 v1

10종의 스탠딩 시트다. 전체 ID와 파일 연결은 `catalog.yaml`에 있다. 덤불송곳니는 숲개형을 반영한 beast-idle-v2를 사용한다. 게임 런타임의 `standingActors.ts`에 등록되어 필드·전투에서 반복 재생한다. 종별 선택에는 API의 `monsterTypeId`를 사용한다.

각 PNG는 4열 × 4행이다. 위에서부터 down_left, down_right, up_left, up_right이고 왼쪽부터 반복 동작의 4프레임이다. 같은 이름의 `.animation.json`은 기존 CellAnimationData 계약이며 프레임당 250ms, 1초 반복이다. 분할 좌표는 PNG의 실제 크기로 계산했고 원본 픽셀·알파는 수정하지 않았다.

발 anchor는 슬라임·고목 거인 (50%, 88%), 나머지 (50%, 82%)이며 실측 보정값이 아니다. 프레임 경계의 좁은 여백, 발 위치 변화, 방향별 조명 차이와 반복 연결을 검수해야 한다. 이 파일들은 최종 전달 에셋의 관리 원본이다.
