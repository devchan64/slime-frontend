# SLIME 프론트엔드

Preact·TypeScript·Phaser WebGL 클라이언트다. 코드 MIT, 프로젝트 에셋 CC BY 4.0이며 자세한 고지는 `LICENSE`와 `ASSET_LICENSE.md`를 확인한다.

## 개발 실행

```bash
# 최초 1회 및 package-lock.json 변경 때만
bash scripts/local_frontend_setup.sh
# 매일 실행: 배포 빌드 없이 Vite HMR
bash scripts/local_frontend_run.sh
```

http://localhost:8080 으로 접속한다. 소스 저장 시 Vite가 즉시 반영하며 `npm run build`나 Docker 이미지 빌드는 필요 없다. `npm run dev`로 직접 실행해도 같다. Ctrl+C로 종료한다. 포트가 사용 중이면 다른 포트로 자동 변경하지 않고 오류를 낸다. Docker 웹이 실행 중이면 `docker compose -f docker-compose.local.yml stop web`으로 먼저 종료한다. 기본 `/v1` HTTP·WebSocket 프록시는 http://127.0.0.1:18080 의 별도 백엔드를 사용한다. 다른 API를 쓸 때는 비밀이 아닌 빌드 설정 `VITE_API_BASE_URL`을 지정하고 서버에 해당 웹 origin을 등록한다.

Linux 개발 서버는 시스템 inotify 한도(`ENOSPC: System limit for number of file watchers reached`)의 영향을 받지 않도록 폴링 감시를 사용한다. 소스는 500ms, 바이너리 에셋은 1초 간격으로 변경을 확인하며 `.local/`, `.tmp/`, `report/`는 감시하지 않는다. HMR은 유지되며 폴링에 따른 소량의 CPU·파일 조회 비용이 발생한다.

## Docker

백엔드의 로컬 서비스가 실행 중일 때 다음 명령으로 정적 빌드를 제공한다. Vite와 같은 8080 포트를 쓰므로 둘을 동시에 실행하지 않는다.

```bash
docker compose -f docker-compose.local.yml up -d --build
```

기본 외부 Docker 네트워크는 `slime_default`, API 서비스 이름은 `api`다. 네트워크 이름은 `SLIME_NETWORK`로 지정한다. 다른 저장소의 소스나 파일 경로를 사용하지 않는다. `nginx.conf`의 업스트림을 배포 환경에 맞게 지정할 수 있다. 운영 TLS는 배포 진입점에서 구성한다.

## 사용과 검증

- 아이디는 영문 소문자·숫자만, 비밀번호는 공백 없는 ASCII 문자로 가입한다. 기존 계정 로그인은 유지한다.
- 캐릭터 이름만 입력하고 입장한다. 고정 역할·성별 선택은 없다.
- 맵에서 셀을 선택하고 이동 버튼을 누른다. 방향키로 셀 선택, 휠로 확대·축소, 시점 복귀로 캐릭터를 찾을 수 있다.
- 연결점 위에서 다른 맵으로 이동한다. 조우 가능한 몹 옆에서는 조우 버튼을 사용한다.
- 전투는 선택 셀 이동·대상 공격·턴 종료 버튼으로 조작한다. 행동하지 않고 턴을 마치면 자동 방어한다.
- 파티 생성·초대·수락·준비·취소·탈퇴와 채널/전투 채팅을 지원한다.
- 통신이 끊기면 입력을 잠그고 재연결한다. 토큰은 메모리에만 보관하므로 페이지를 새로 고치면 다시 로그인한다.

`npm run build`로 이미지 관리 ID·언어팩·TypeScript 검사와 배포 빌드를 수행한다. 웹은 저장소의 이미지 자산을 사용하며 자산 고지는 `ASSET_LICENSE.md`를 따른다. 비공개 설계 문서는 실행 의존성이 아니다.

## UI 디자인 시스템 검수 빌드

게임 UI 검수는 운영 웹에 포함하지 않는 독립 정적 빌드다. 공통 토큰·기본 컴포넌트, 탐색 메뉴·패널, 캐릭터 설정 대화상자, 전투 패널을 같은 게임 컴포넌트로 묶는다.

```bash
npm run build:review
```

명령은 `.tmp/한국시간/ui-review/`에 HTML·번들·에셋과 `manifest.json`을 만든다. manifest에는 소스 커밋, 로컬 수정 포함 여부, 검수 페이지와 모든 파일 해시가 기록된다. 이 폴더를 `slime-workflow` 관리도구에 명시적으로 전달한다. 검수 중 UI는 실제 API 요청을 보내지 않는다.

공개 API의 실제 스키마는 백엔드 `/openapi.json`에서 확인한다. 서버의 결과가 판정 원본이며 UI·그림 변경은 API 권한과 무관하다.

브라우저와 이미지 없이 접속하려면 [텍스트 클라이언트 및 API 사용 안내](CLIENT_API.md)를 따른다. `node scripts/text-client.mjs http://127.0.0.1:18080`으로 실행한다.

### 게임 맵의 배율 기준

필드·마을·전투는 `MainScene`과 `src/game/terrain/renderMetrics.ts`의 월드 크기 기준을 공유한다.
기본 카메라 줌은 1이며, 필드·전투 타일은 80×40, 마을(`safeTown`) 타일은 160×80 월드 단위이며 사람의 기준 몸체 높이는 모두 80이다.
고도 한 단계는 32, 지형 바닥 두께는 16이며 길이 기준값은 정수로 관리한다. 비율·투명도·카메라 배율과 보간 중 좌표는 소수를 허용한다.
전투는 화면 크기와 살아 있는 유닛의 범위에 따라 1 이하로 자동 맞춤할 수 있다.
원본 이미지의 픽셀 크기·시트 프레임·논리 셀·화면 고정 UI는 월드 단위와 구분한다.
관리도구 마을 검수의 128×64 프로필은 별도 설정이며 게임의 마을 크기 160×80과 구분한다.

에셋 직접 참조: 인접 `slime-assets/assets/`를 사용하며 프론트엔드 사본은 생성하지 않습니다. 현재 경로와 배포 방식은 [에셋 참조 가이드](ASSET-CATALOG.md)를 따릅니다.

## 서명된 코스튬 광고 SDK 설정

`VITE_SPONSOR_PUBLIC_KEY`는 서버 서명 키와 대응하는 Ed25519 raw 공개키 32바이트의 표준 Base64 빌드 설정이다. 배포 관리자가 별도로 확인한 공개키만 주입한다. API 응답의 공개키를 설정에 복사하거나 개인키를 프론트에 넣지 않는다. 공개키 변경 시 정적 클라이언트를 다시 빌드·배포한다. 미설정 상태에서도 광고가 없는 코스튬 설명은 표시되며, 광고가 있으면 검증 실패 안내를 표시한다.

SDK의 `/v1/sponsorship/sdk/…/costume.js` 경로는 페이지와 같은 origin에서 제공해야 한다. 개발 Vite 및 배포 프록시/CDN 라우팅에서 해당 경로를 API 서버로 연결하고 JS 바이트를 변경하지 않는다. SDK는 검증된 SHA-256 SRI로 로드한다. 별도 API origin을 사용하더라도 SDK 경로의 동일 origin 라우팅은 필요하다. 운영 CSP는 해당 스크립트 로드를 허용해야 한다. 설정 변경은 기존 설명 조회 API나 DB 마이그레이션을 요구하지 않는다.

## 배포 빌드 검증

`npm run build:verified`는 에셋 원본·해시·이미지·번역·TypeScript 검사 후 Vite 배포 번들을 생성한다. 기존 `npm run build`를 공용 실행 로그로 감싸며 `.local/logs/verify_production_build-*.log`에 단계 출력·5초 heartbeat·최종 종료 코드를 저장하고 실패 시 마지막 로그를 출력한다.

산출물은 Git 제외 대상인 `dist/`에 생성한다. 이 명령은 S3 업로드·CDN 무효화·운영 배포를 실행하지 않는다. 배포용 공개키 등 설정은 별도로 준비해야 하며, 빌드 성공과 실제 환경 수용 검증은 구분한다.

`npm run check:production-browser`는 먼저 생성한 `dist/`만 임시 로컬 HTTP 서버로 제공하고 실제 Chrome에서 로그인 폼·로그인 이미지·스타일과 해시 JS 로딩을 검사한다. 개발 서버나 백엔드는 사용하지 않으며, 인증·게임 플레이 검사는 별도다. Chrome 기본 경로는 `/usr/bin/google-chrome`이고 `CHROME_BIN`으로 지정할 수 있다. `.tmp/test/production-build-browser/<한국 시각>/`에 스크린샷·DOM·Chrome/단계 로그·결과 및 검사한 index SHA-256을 보존한다.

```sh
npm run build:verified
npm run check:production-browser
```

## 자동 회귀검사

전체 검사 파일을 명시하여 실행한다. 실행기는 번역 검사, TypeScript 검사, 테스트를 순서대로 실행하고 로그·heartbeat·종료 코드·최종 결과를 `.tmp/test/frontend-regression/<실행 시각>/`에 보존한다.

```sh
node scripts/run-regression.mjs tests/*.test.mjs
```

실제 코스튬 SDK Chrome 검사에는 서버가 배포하는 SDK 원본 파일을 절대 경로로 지정한다. 이 파일을 지정하지 않으면 해당 검사는 건너뛰며, 전체 테스트 성공을 SDK 검증 성공으로 해석하면 안 된다. 테스트는 지정 파일의 SHA-256/SRI와 임시 서명 키를 사용한다. 운영 개인키는 필요하지 않다.

```sh
SLIME_SPONSOR_SDK_FILE=/absolute/path/to/costume.js \
  node scripts/run-regression.mjs tests/costume-sponsor-browser.test.mjs
```

전체 검사에도 같은 환경 변수를 지정할 수 있다. SDK 소스를 프론트에 복제하거나 형제 저장소 경로를 실행 기본값으로 고정하지 않는다. 테스트 결과와 운영 광고 소재·계약·측정 검증은 구분한다.


### 별도 인증 API 주소

게임과 인증 API를 서로 다른 주소로 제공할 때 브라우저 빌드 설정에 `VITE_API_BASE_URL`(게임)과 `VITE_IDENTITY_API_BASE_URL`(인증)을 지정한다. 인증 주소는 인증 정보·쿼리·프래그먼트 없는 절대 HTTP(S) 주소이며 원격 배포에서는 HTTPS를 사용한다. 이 설정은 공개 서비스 주소이고 비밀값을 포함하지 않는다. 각 서버에 웹 origin의 CORS 허용이 필요하다.

`/v1/auth/*` 요청은 인증 주소로, 게임 HTTP·heartbeat·게임/채팅 WebSocket은 게임 주소로 보낸다. 인증 주소를 생략하면 기존 단일 API 주소를 사용한다. 잘못된 명시 주소는 즉시 거절하며 인증 서버 오류 시 게임 서버로 재전송하지 않는다. 브라우저 HTTP 리다이렉트도 거절한다. 변경한 주소는 새 프론트 빌드에 반영해야 하며 서버 서비스 분리·TLS·라우팅 배포를 자동 수행하지 않는다.


### Docker 빌드의 공용 에셋과 API 주소

Compose는 `slime-assets`를 별도 BuildKit context로 전달한다. 빌드 단계에서만 `/slime-assets`에 읽기 전용으로 연결해 등록부·잠금 해시를 검사하고 Vite로 번들링한다. 최종 nginx 이미지에는 `dist`만 전달하며 에셋 저장소·제작 산출물을 런타임에 참조하지 않는다. 인접 `../slime-assets` 원본이 없으면 빌드는 실패한다.

`VITE_API_BASE_URL`·`VITE_IDENTITY_API_BASE_URL`은 Compose 빌드 인수로 전달한다. 인증 주소가 비어 있으면 기존 단일 API 설정을 유지한다. 컨테이너 실행 후 환경변수만 바꿔서는 이미 생성된 정적 번들의 주소가 바뀌지 않는다. Docker build를 직접 사용할 경우 `--build-context slime-assets=../slime-assets`와 필요한 `--build-arg`를 지정한다.

`npm run build:docker:verified`는 Compose 설정 검사·별도 검증 이미지 빌드·네트워크 없는 일회 컨테이너의 `nginx -t`와 최종 이미지의 공용 원본 부재·지정 API 주소의 JS 포함 여부를 검사한다. 실행 로그는 `.local/logs/`, 이미지 ID와 성공 표식은 `.tmp/test/frontend-docker-build/<한국 시각>/`에 저장한다. 기존 웹 컨테이너를 재시작하거나 운영 이미지를 배포하지 않는다. 검증 이미지는 `slime-frontend-validation:<한국 시각>`으로 보존하며 삭제는 별도 수동 작업이다. 이는 브라우저 기능·CORS·실제 API 연결 검사를 대신하지 않는다.
