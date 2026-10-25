# 맵 에셋 전달 계약

`assets/terrain/`과 `assets/world/`의 관리 원본은 slime-assets의 `assets/tiles/terrain/<지형 종류>/`, `assets/tiles/buildings/<roof|wall|door>/<지역>/`로 이관했다. 기존 이미지 ID와 파일명, 버전별 파일을 유지한다. 프론트엔드의 같은 경로는 게임 빌드에 포함하는 전달 사본이다.

변경은 slime-assets에서 새 버전으로 등록한 뒤 선택한 파일을 프론트엔드에 명시적으로 전달하고 `map-assets.lock.yaml`의 원본 경로·SHA-256을 갱신한다. `npm run check:map-assets`와 `npm run build`에서 사본 해시를 확인한다. 개발·빌드 준비 단계는 `slime-assets` 원본을 직접 참조한다. 배포된 브라우저는 빌드에 포함된 정적 사본만 사용하며 CDN 배포 방식과 비용은 바뀌지 않는다.

프론트엔드에는 독립된 런타임 맵 배치 파일이 없다. 맵 배치·통행·건물 데이터는 백엔드 API에서 수신하고, TypeScript의 맵 렌더링·API 타입 코드는 프론트엔드에 남긴다. 백엔드 맵 원본은 이번 이관 대상이 아니다.

타일 출처 sidecar는 원본과 함께 이관했다. 기존 출처에 없는 제작 도구나 라이선스를 추정해서 추가하지 않으며, 공개된 파일의 재사용 허가를 의미하지 않는다.

관리 원본은 지형 종류(풀밭·흙·자갈·대리석 등)와 건물 부위(지붕·벽·문)로 분리한다. 지역별 전용 타일은 종류 아래 지역 폴더에 둔다. 프론트엔드 전달 사본 경로는 기존 import 호환성을 유지하며 잠금 파일로 원본 경로를 연결한다. 캐릭터 스프라이트는 이관 대기 상태다. 서버는 맵 정보 YAML을 제공하며 타일 스프라이트를 관리하지 않는다.

## 원본 준비

`slime-assets`를 이 저장소와 같은 상위 폴더에 체크아웃하거나 `SLIME_ASSETS_ROOT`로 원본 저장소 경로를 지정한다. CI도 잠금 파일의 해시와 일치하는 에셋 저장소 버전을 준비해야 한다. `npm run dev`와 `npm run build`는 시작 전에 `prepare:map-assets`를 실행하여 원본 등록부·잠금 해시·실제 원본 해시를 검증하고 사본을 갱신한다. 원본 누락·미등록·해시 불일치는 즉시 실패하며 기존 사본으로 대신 실행하지 않는다. `npm run check:map-assets`는 복사 없이 원본과 전달 사본을 검사한다.

관리도구도 에셋 저장소에서 직접 타일을 읽어 게시한다. 프론트엔드 사본을 관리도구 원본으로 사용하지 않는다. 건물별 타일 변경은 게임 선택 코드와 검수 카탈로그·건물별 매핑에 함께 반영한다.

## 전달 사본의 Git 제외

에셋 저장소로 이관된 파일은 프론트엔드 Git에서 삭제하고 `.gitignore`에 경로별로 등록한다. 잠금 파일과 import 경로는 유지하며 개발·빌드 준비 명령이 필요한 사본을 다시 만든다. 신규 전달 경로 추가 시 잠금 목록과 `.gitignore`를 함께 갱신한다. 이미지 목록은 생성된 전달 사본의 검증 용도로 유지한다.

에셋 직접 참조: 인접 `slime-assets/assets/`를 사용하며 프론트엔드 사본은 생성하지 않습니다. 현재 경로와 배포 방식은 [에셋 참조 가이드](ASSET-CATALOG.md)를 따릅니다.

## DB 콘텐츠 이미지 게시

Vite 개발 서버는 기본적으로 형제 저장소 `slime-assets/snapshots/content`를 사용합니다. `SLIME_CONTENT_SNAPSHOT_ROOT`로 다른 절대 경로를 지정할 수 있으며 배포 빌드에는 이 값을 명시해야 합니다. 해당 경로를 사용하는 개발 서버와 배포 빌드는 `current.yaml`의 세대·파일 해시 및 이미지 원본 해시를 검증합니다. 원본은 `slime-assets`에 유지하며 빌드에는 DB의 `publishedPath`와 같은 경로로 이미지를 포함합니다. 현재 게시 접두사는 `/registered-assets/`입니다.

```bash
SLIME_CONTENT_SNAPSHOT_ROOT=/absolute/slime-assets/snapshots/content npm run dev
SLIME_CONTENT_SNAPSHOT_ROOT=/absolute/slime-assets/snapshots/content npm run build
```

개발 서버는 `/registered-assets/assets/billboards/versions/<sha256>.png`의 새 이미지도 해시를 검사해 제공하므로 편집 직후 다음 스냅샷을 기다리지 않습니다. 기존 이름의 이미지 응답은 `no-cache`, SHA-256 파일명은 1년 불변 캐시를 사용합니다. 배포 CDN에도 이 경로별 정책을 적용해야 합니다. 배포 환경에서 DB 이미지 버전을 바꾸기 전 해당 해시 파일을 정적 저장소에 게시해야 하며, 개발 서버의 즉시 파일 조회를 배포 서버 기능으로 간주하지 않습니다.
