# 스프라이트 원본과 전달 사본

캐릭터 애니메이션 시트와 몬스터·구조물 스프라이트의 원본은 `slime-assets/assets/sprites/`다. 재생 JSON·앵커·카탈로그·출처 메타데이터를 함께 관리하며, 기존 관리 ID와 이관 당시 프론트 커밋·SHA-256을 에셋 등록부에 기록한다.

`sprite-assets.lock.yaml`은 전달 파일별 원본 경로와 SHA-256을 고정한다. `src/assets/characters/`·`src/assets/monsters/`·`src/assets/structures/`의 등록된 파일은 기존 import 경로를 유지하는 빌드용 사본이다. 게임 브라우저는 빌드된 정적 파일만 읽는다.

- `npm run prepare:sprite-assets`: 모든 원본·등록·잠금 해시를 먼저 검증하고 전달 사본을 준비한다.
- `npm run check:sprite-assets`: 원본과 전달 사본 해시를 검증한다.
- `npm run dev`, `npm run build`, `npm run build:review`: 준비 단계에서 스프라이트도 함께 가져온다.

기본 원본 위치는 형제 저장소 `../slime-assets`이며 빌드 환경에서는 `SLIME_ASSETS_ROOT`로 지정할 수 있다. 소스만 체크아웃한 환경은 에셋 저장소도 준비해야 한다. 원본 부재나 해시 불일치는 즉시 실패한다.

신규 에셋은 원본을 먼저 등록하고 잠금 목록·재생 데이터·소비 코드를 함께 갱신한다. 사본만 바꾸지 않는다. 기존 시트의 프레임 좌표와 앵커는 이관 중 변경하지 않았다. 개별 승인 프레임·기준 외형·제작 프롬프트는 이관 범위에 포함하지 않는다. 채택된 캐릭터 컷인은 `assets/sprites/characters/<캐릭터>/cutins/`에서 관리하며 같은 준비·검증 명령을 사용한다.

## 전달 사본의 Git 제외

에셋 저장소로 이관된 파일은 프론트엔드 Git에서 삭제하고 `.gitignore`에 경로별로 등록한다. 잠금 파일과 import 경로는 유지하며 개발·빌드 준비 명령이 필요한 사본을 다시 만든다. 신규 전달 경로 추가 시 잠금 목록과 `.gitignore`를 함께 갱신한다. 이미지 목록은 생성된 전달 사본의 검증 용도로 유지한다.
