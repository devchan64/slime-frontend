# 스프라이트 원본 직접 참조

기본 캐릭터 원본은 `slime-assets/assets/characters/default/`에서 관리한다.

- `animations/`: 대기·휴식·걷기 시트와 버전별 재생·앵커·출처 메타데이터.
- `battle-cutins/`: 전투 컷인.
- `emotion-cutins/`: 감정 컷인. 현재 등록 이미지가 없어 `.gitkeep`으로 유지한다.

몬스터·구조물 원본은 기존 `assets/sprites/monsters/`·`assets/sprites/structures/`에 둔다. 모든 원본은 에셋 등록부의 관리 ID·불변 버전·SHA-256으로 확인한다.

`sprite-assets.lock.yaml`의 `path`는 논리 식별자이고 `source_path`가 실제 원본 위치다. `npm run prepare:sprite-assets`와 `npm run check:sprite-assets`는 원본·등록부·잠금 해시를 검증하며 사본을 만들지 않는다. Vite는 개발 중 원본을 제공하고 배포 빌드에서는 해시 파일명으로 번들링한다. 에셋 저장소가 인접 경로에 필요하며 누락·해시 불일치는 즉시 실패한다.

좌하 걷기 `down-left-8frames-v1`은 384×384 셀 8개를 4열×2행으로 구성한 1536×768 시트다. 125ms 간격으로 1초 반복하며 관리도구도 같은 등록 원본과 잠금 해시를 검증하여 게시한다. 이전 버전은 보존한다.
