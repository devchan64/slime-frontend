# 공개 클라이언트 접속 안내

이 문서는 현재 v1 HTTP API를 사용하는 클라이언트의 실행 안내다. 서버 판정·피해·보상은 서버 응답을 따른다. 요청 스키마는 연결한 서버의 `/openapi.json`, 웹 구현은 `src/client/api.ts`, 터미널 구현은 `scripts/text-client-core.mjs`에서 확인한다. 비공개 저장소나 이미지 파일 없이 터미널 클라이언트를 실행할 수 있다.

## 터미널 실행

Node.js 22 이상과 실행 중인 API, 기존 계정이 필요하다. 추가 패키지 설치나 프론트엔드 빌드는 필요 없다.

```bash
node scripts/text-client.mjs http://127.0.0.1:18080
```

아이디·비밀번호를 대화형 터미널에서 입력한다. 비밀번호는 숨기며 명령행 인수·환경 파일에 넣지 않는다. 토큰은 메모리에만 유지한다. 원격 접속은 HTTPS 주소를 사용한다. 주소에 인증 정보·쿼리·프래그먼트를 포함할 수 없다. `quit` 또는 Ctrl+C에서 로그아웃을 시도한다. 강제 종료·네트워크 단절은 서버의 세션 만료 또는 다음 로그인 전환으로 처리한다. 동일 계정으로 다른 클라이언트에 로그인하면 기존 세션이 전환될 수 있다.

`help`로 전체 명령을 확인한다. 예:

```text
state
create 모험가
enter
move 1 2
encounter 표시된몬스터ID
ready
state
ready
attack 표시된적유닛ID
end
quit
```

위 예시의 좌표·ID·순서는 실제 상태에 맞춰 바꾼다. `skill physical_activity` 등 스킬 성장 명령은 SP가 충분할 때 사용할 수 있다. 조우 예약 준비와 전투 공간 준비는 각각 `ready`로 명시하며, 솔로 조우가 바로 전투 준비로 전환되면 한 번만 입력한다. 이동은 `move 열 행`이며 좌표는 0부터 시작한다. 필드에서는 필드 이동, 전투에서는 전투 이동 요청으로 변환한다. `state`는 서버의 최신 상태·현재 턴·이동 가능한 좌표·공격 대상 ID를 표시한다. 몬스터 체력은 서버가 공개한 정보 범위만 표시한다. 공격 후 서버가 다음 턴으로 전환한 경우 `end`를 다시 보내지 않는다.

텍스트 클라이언트는 10초마다 세션을 유지하고 토큰을 갱신하지만 상태는 `state` 또는 명령 결과로 갱신한다. 실시간 WebSocket 구독·파티 관리·채팅·회원가입 UI는 포함하지 않는다. 웹과 같은 서버 명령 검증을 적용받으므로 이동 불가·턴 변경·자원 부족은 API 오류로 표시된다.

## 인증과 상태 계약

- `POST /v1/auth/login`: `{user_id, password}`. 완료 응답의 `access_token`, `refresh_token`은 출력하거나 저장하지 않는다.
- `pending: true`이면 `operationId`, `receipt`로 `POST /v1/auth/operations/{operationId}/resolve`에 `{receipt}`를 보내 완료를 확인한다. 로그아웃도 같은 전환 계약을 사용한다.
- 인증 요청은 `Authorization: Bearer <access_token>`을 사용한다. `POST /v1/auth/refresh`에는 `{refresh_token}`을 보낸다.
- `GET /v1/game/state`의 `protocolVersion`은 현재 1이다. `generation → epoch → cursor` 순서로 이전 스냅샷을 버린다.
- HTTP 세션 유지는 `POST /v1/sessions/heartbeat`에 빈 객체를 보낸다. 웹은 `/v1/realtime/tickets`로 일회용 티켓을 받아 WebSocket에 `{ticket, protocolVersion: 1}`을 보내며 토큰을 URL에 넣지 않는다.
- 오류는 HTTP 상태·`code`와 `messages.ko/en`을 확인한다. 이전 응답의 문자열 `message`도 표시할 수 있다. 상태 API가 HTML 또는 빈 응답을 반환하면 프록시·API 주소를 확인한다.

## 명령 전송

상태 변경 요청에는 새 UUID `requestId`와 `expectedVersion`이 필요하다. 필드·캐릭터 명령은 `state.me.version`, 전투 명령은 `state.battle.version`을 사용한다. 결과의 `state`를 수락한 후 다음 명령을 만든다.

| 요청 경로 | 추가 본문 |
|---|---|
| `/v1/world/enter`, `/away`, `/resume` | 없음 (각 경로는 `/v1/world` 하위) |
| `/v1/characters/me` | `character_name` |
| `/v1/characters/me/skills` | 보유한 `skill` ID |
| `/v1/characters/me/attributes` | `attribute`: body/intellect/spirit |
| `/v1/game/moves` | `position: {column, row}` |
| `/v1/maps/transitions` | `connectionId: "gate"` |
| `/v1/game/encounters/reserve` | `monsterId` |
| `/v1/game/encounters/ready`, `/cancel` | `reservationId` (각 경로는 `/v1/game/encounters` 하위) |
| `/v1/game/battle/commands` | `action: {type, battleId, turnId, ...}` |

전투 action은 MOVE의 `position`, ATTACK의 `targetId`, READY, END_TURN, SURRENDER를 사용한다. 일반 공격은 ATTACK 명령이며 피해량을 직접 보내지 않는다. 전송 결과를 알 수 없을 때만 **같은 requestId·본문**으로 재시도한다. `VERSION_CONFLICT`이면 상태를 다시 읽고 사용자에게 알린다. 변경된 턴에 같은 의도를 자동 재실행하지 않는다.

## 검증

```bash
node --test tests/text-client.test.mjs
node scripts/text-client.mjs --help
```

테스트는 모의 HTTP 응답으로 세션 전환·명령 버전/턴·중복 재시도·정보 표시를 검증한다. 실제 서버의 조우부터 승패 정산까지 완료했다는 의미는 아니다.
