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

공개 API의 실제 스키마는 백엔드 `/openapi.json`에서 확인한다. 서버의 결과가 판정 원본이며 UI·그림 변경은 API 권한과 무관하다.

브라우저와 이미지 없이 접속하려면 [텍스트 클라이언트 및 API 사용 안내](CLIENT_API.md)를 따른다. `node scripts/text-client.mjs http://127.0.0.1:18080`으로 실행한다.
