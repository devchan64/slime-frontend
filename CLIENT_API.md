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

위 예시의 좌표·ID·순서는 실제 상태에 맞춰 바꾼다. `skill physical_activity` 등 스킬 성장 명령은 SP가 충분할 때 사용할 수 있다. 조우 예약 준비와 전투 공간 준비는 각각 `ready`로 명시하며, 솔로 조우가 바로 전투 준비로 전환되면 한 번만 입력한다. 이동은 `move 열 행`이며 좌표는 0부터 시작한다. 필드에서는 필드 이동, 전투에서는 전투 이동 요청으로 변환한다. `state`는 서버의 최신 상태·현재 턴·이동 가능한 좌표·공격 대상 ID를 표시한다. 몬스터 체력은 서버가 공개한 정보 범위만 표시한다. 일반 공격은 3 AP, 이동은 경로 1칸당 1 AP를 소비한다. 현재 AP와 이동·공격 가능 목록은 서버 응답을 따른다. AP가 남으면 추가 행동이 가능하고, AP가 0이어도 `end`로 명시적으로 턴을 종료한다. 공격만으로 자동 턴 종료를 가정하지 않는다.

`gate`는 현재 좌표의 유일한 웨이포인트를 사용한다. `gate gate-east`처럼 상태에 표시된 ID를 지정할 수도 있다. 다른 좌표의 웨이포인트로 순간이동하지 않으며 전투 중에는 맵 전환을 요청하지 않는다.

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
| `/v1/characters/me/skill-loadout` | `skills`: 보유 스킬 ID 배열 (서버의 `battleSkillSlotLimit` 이하, 중복 없음) |
| `/v1/characters/me/skills` | 보유한 `skill` ID |
| `/v1/characters/me/attributes` | `attribute`: body/intellect/spirit |
| `/v1/game/moves` | `position: {column, row}` |
| `/v1/maps/transitions` | `connectionId`: 현재 좌표에 등록된 웨이포인트 ID |
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

## 광고 확인과 채팅 연결

맵 입장 후 `POST /v1/sponsorship/attempts`에 빈 객체를 전송한다. 응답의 `displayUrl`에 `attemptId` 쿼리를 붙여 표시하며 같은 API를 2초 간격으로 조회한다. 현재 상태의 `generation`, `epoch`, `location.chatRoomId`와 응답이 일치해야 한다. 클라이언트가 완료를 신고하는 API는 없다.

`verified: true` 후 `POST /v1/chat/tickets`로 일회용 티켓을 받고 `/v1/chat/realtime` 첫 프레임으로 `{ticket, protocolVersion: 1}`을 보낸다. `type: chat` 프레임의 `messages`만 대화 목록으로 사용한다. `{type: "heartbeat"}`를 10초 간격으로 보낸다. 일반 게임 상태의 `messages`는 빈 배열이며 게임 연결과 채팅 연결은 별개다. 채팅 송신은 기존 `POST /v1/game/messages`를 사용하며 서버가 현재 광고 승인을 검사한다.

공급사 미설정은 `SPONSOR_UNAVAILABLE`, 승인 누락·만료는 `SPONSOR_REQUIRED`다. 실패·연결 종료·공간 변경 시 대화 목록과 입장 상태를 초기화하고 광고 확인 화면을 표시한다. 로컬 타이머·영상 종료 이벤트로 성공 처리하지 않는다.

광고 시도 응답의 `displayUrl`은 null일 수 있다. 이 경우 `text`를 기본 광고 영역에 표시한다. `verification: unavailable`이면 검증 연동 대기 안내를 표시하고 채팅을 허용하지 않는다. 광고 선택의 시간·맵 조건은 서버에서 평가하며 클라이언트가 광고 ID를 지정하지 않는다. 조건에 맞는 광고가 없으면 서버의 기본 광고가 반환된다.

## 전투 재접속과 유휴 연결

진행 중 전투가 있는 계정으로 다시 로그인하면 서버가 참가 권한을 검증하고 기존 자기 캐릭터의 조작을 복구한다. AP·HP·턴을 초기화하지 않는다. 자기 턴인지 `battle.tactics.canAct`를 확인하며 정산 완료 상태에서는 반환된 필드/로비 흐름을 따른다. 이전 로그인 세대의 상태·명령은 사용하지 않는다.

서버는 마지막 실제 입력으로부터 5분이 지나면 `IDLE_DISCONNECTED`를 반환한다. 자동 heartbeat·상태 조회·토큰 갱신은 입력이 아니다. 웹은 실제 입력을 `{type: "activity"}` 프레임으로 게임 WebSocket에 전송한다. 프레임에 클라이언트 시각을 추가하지 않는다. 같은 오류를 받은 클라이언트는 자동 재연결·생존 타이머를 중지하고 명시적인 재로그인으로 복귀한다. 텍스트 클라이언트는 연결 유지 실패 시 종료하며 다시 실행해 로그인한다. 텍스트의 직접 입력은 `POST /v1/sessions/activity`에 빈 객체 `{}`를 보내 활동을 알린다. `state`·`help` 입력도 포함하며, 자동 조회·heartbeat에서는 보내지 않는다. 임의 시각이나 추가 필드를 보내면 거절된다. 유휴 종료로 터미널이 종료될 때는 명시적 로그아웃을 자동 요청하지 않는다.

## 게임 소켓의 짧은 재연결

`POST /v1/realtime/tickets` 응답에 `resumeSupported: true`가 있으면, 이미 설치한 상태의 순번을 첫 프레임에 포함할 수 있다.

```json
{"ticket":"일회용 티켓","protocolVersion":1,"resume":{"generation":3,"epoch":4,"cursor":8}}
```

복구 marker는 추가 필드 없이 비음수 정수만 받는다. 서버가 `{type:"resumed", generation:3, epoch:4, cursor:8}`로 승인하면 기존 상태를 유지하고 이어지는 `state` 프레임을 적용한다. 승인 값은 요청과 일치해야 한다. 현재 권한·보존 범위가 달라졌으면 `snapshot`으로 현재 상태를 설치한다. 최초 접속이나 지원 표시가 없는 서버에는 `resume`을 보내지 않는다.

같은 세대·epoch의 이벤트는 마지막 적용 cursor 다음 순번만 적용한다. 중간 누락이면 연결을 닫고 마지막 설치 순번으로 재연결한다. 새 전체 스냅샷과 HTTP 명령의 전체 상태 응답은 순번을 건너뛸 수 있다. 이 복구는 채팅 소켓에 적용하지 않으며 유휴 종료 후 자동 재로그인을 허용하지 않는다.

게임 `heartbeat` 응답의 `epoch`·`cursor`가 현재 설치한 상태보다 앞서면 후속 이벤트를 5초간 기다린다. 그 안에 따라잡으면 복구 타이머를 취소하고, 여전히 누락되어 있으면 소켓을 닫고 마지막 설치 순번으로 재연결한다. 오래된 응답은 상태를 뒤로 돌리지 않는다. 이 대기는 네트워크 복구용이며 게임 턴·AP·FP를 진행시키지 않는다.

티켓 응답에 `ackSupported: true`가 있으면 서버 스냅샷·복구 승인·상태 이벤트를 적용한 뒤 `{type:"ack", epoch, cursor}`를 보낼 수 있다. 웹 클라이언트는 250ms 동안의 확인을 가장 높은 순번 하나로 합친다. HTTP 응답의 더 큰 cursor를 소켓 ACK에 대신 사용하지 않는다. 서버는 그 소켓에서 전송한 순번까지만 허용하며 ACK 자체에 응답 프레임을 보내지 않는다. 중복·낮은 ACK는 저장 값을 뒤로 돌리지 않는다. ACK는 생존 신호나 실제 사용자 입력을 대신하지 않으며 이벤트 보존 기간을 줄이지 않는다.

### 휴식과 대여 목록

텍스트 클라이언트에서 `rest start`로 필드 휴식을 시작하고 `rest stop`으로 중단한다. 기존 캐릭터 상태 버전과 요청 ID를 포함하여 `POST /v1/game/rest/start`, `POST /v1/game/rest/stop`을 호출한다. HP 0도 요청할 수 있고 최종 허용 여부·회복은 서버가 판정한다. `state`는 현재 HP와 휴식 상태를 표시한다.

`loans`는 `GET /v1/game/loans`로 대여 목록을 조회한다. 이름·HP·전투 참가 여부·응답 서버 시각 기준 남은 기간을 표시하고 다음 페이지가 있으면 `loans 다음커서`를 안내한다. 조회 결과는 캐릭터 상태를 덮어쓰지 않는다. 이 명령으로 대여를 생성하거나 파티를 편성하지 않는다.

### 전투불능 회복 대기 표시

`me.healthRecoveryPending`은 HP 0 이후 실제 회복이 최대 HP의 절반에 도달하기 전까지 `true`다. 단순히 HP가 절반 미만이라고 클라이언트에서 상태를 추정하지 않는다. `true`이면 필드 이동·웨이포인트 이동·접근 이동을 비활성화하고 휴식 안내를 표시한다. 휴식·메뉴·HP 양수 인접 조우를 이 플래그로 차단하지 않는다. 서버 거절 코드는 `CHARACTER_RECOVERY_PENDING`이며 `messages.ko/en`을 제공한다.

새 전투의 아군 유닛에도 같은 선택 필드를 제공한다. 이동 가능 여부는 서버 `battle.tactics.moves`를 따르며 제자리 공격·턴 종료는 각자의 기존 조건을 따른다. 이전 진행 중 전투처럼 필드가 누락되면 과거 이력을 추정하지 않는다. 텍스트 `state`도 필드와 전투의 이동 제한 사유를 출력한다. 최대 HP 변화·재로그인 자체로 클라이언트가 플래그를 해제하지 않는다.

대여 목록 항목의 `healthRecoveryPending`은 복사본의 전투불능 회복 대기 여부다. 참이면 최대 HP의 50% 이상을 실제 회복할 때까지 이동할 수 없다. HP 비율만으로 이력을 추정하지 않는다. 이전 API 응답의 필드 누락은 허용하며, 필드가 있으면 boolean이어야 한다.

필드 `members[].fieldRestActive`는 해당 캐릭터의 휴식 여부(boolean)다. 필드에서 참일 때 현재 위치에 앉은 자세로 표시한다. 이전 API 응답에서는 생략될 수 있다. 본인은 `me.fieldRest.active`를 사용한다.

### 캐릭터 장비 화면

캐릭터 설정의 장비 탭은 `GET /v1/game/equipment`를 사용한다. 응답은 `serverTime`, `characterVersion`, `items`, `slots`, `knownEquipmentWeightG`, `nextCursor`를 포함한다. `?after=<개체 UUID>`로 다음 페이지를 요청한다. `slots`는 페이지 밖의 장착물도 포함하며 전체 장비 무게는 장착물과 가방 목록을 중복 합산하지 않은 서버 값이다.

개체의 ID·품목/개체 버전·한영 이름·설명·슬롯·예약 여부·현재/최대 내구도·무게·공격/방어 보정을 표시한다. 목록 로딩 실패를 빈 가방으로 바꾸지 않고 오류를 표시한다. 서버의 `SCHEMA_REQUIRED`는 장비 스키마 갱신이 필요하다는 뜻이며 자동 마이그레이션하지 않는다. 인증 클라이언트가 없는 정적 미리보기에는 장비 탭을 제공하지 않는다.

장착·해제는 `POST /v1/game/equipment/loadout`에 `requestId`, `expectedVersion`, `slot`, `instanceId`, `expectedInstanceVersion`을 보낸다. 해제는 마지막 두 값을 null로 설정한다. 이 API는 일반 명령의 `result.state` 대신 거래 증명을 반환하므로 `Client.command`로 호출하지 않는다. 성공 후 장비 목록과 게임 상태를 다시 조회한다. 응답 유실·서버 오류로 결과가 불명확하면 같은 본문·요청 ID로 결과를 재확인하며 다른 변경 버튼을 잠근다. 확정된 규칙 거절은 서버 메시지를 표시하고 목록을 갱신한다.

가방 화면도 장비 목록 API를 사용하며 추가 `bag` 필드가 필요하다. `bag.items`는 재료 목록, `bag.knownWeightG`는 재료+장비 전체의 확인된 무게, `unknownWeightQuantity`는 미정 무게 재료 수량, `capacityG`는 신체 기반 소지 기준이다. 기존 `me.bag` 상태 필드는 재료 조회 표현을 유지한다. 장비 페이지를 합칠 때 `characterVersion` 일치와 개체 중복을 검사하며 불일치하면 새로고침한다. 조회 실패를 장비 0개로 대체하지 않는다. 서버의 추가 필드 배포 후 프론트엔드를 배포한다.

개인 장비 변경 이력은 `GET /v1/game/equipment/{instanceId}/history`로 조회한다. 항목의 `kind`, `createdAt`, 전후 내구도를 표시하며 `nextBefore`가 있으면 `?before=<버전>`으로 과거 기록을 요청한다. 현재 소유자의 권한은 서버가 검사한다. 과거 기록이 없으면 추정 이력을 만들지 않는다. 이력 API와 DB 마이그레이션을 프론트엔드보다 먼저 배포한다.

캐릭터 `me.skillUseLocks`는 선택 필드이며 스킬 ID별 `{reason: "book_sold", bookId, sourceId}` 기록을 제공한다. 없으면 판매 잠금 기록이 없는 기존 상태다. 스킬 목록은 저장 레벨을 유지하고 사용 잠금 사유를 표시한다. 몬스터 공개 정보는 서버가 제한하므로 UI에서 높은 저장 레벨만 보고 공개 단계를 복원하지 않는다. 현재 판매/재소지 명령이나 잠금 중 성장 정책을 새로 제공하는 필드는 아니다.

응급처치 보유자는 선택 필드 `me.firstAid`로 서버 실행 조건을 받는다. 필드 버튼은 `POST /v1/game/skills/first-aid`에 일반 명령 ID·캐릭터 버전만 전달한다. 가방 `items.kind`에는 `consumable`이 추가되며 붕대 수량과 미정 무게를 합계에 포함한다. 소모품 이해가 가능한 프론트를 먼저 배포하고 서버 기능을 활성화한다. 최종 행동 가능 여부·붕대 차감·HP 회복·재시도는 서버가 검증한다.

가방 소모품의 선택 필드 `useAction: {type: "RESTORE_HP", restorationHp, consumedOnSuccess}`는 직접 회복 사용 버튼을 제공한다. `/v1/game/consumables/use`에 일반 명령 ID·캐릭터 버전·`itemId`를 보내며 회복량은 보내지 않는다. 성공 상태의 캐릭터 버전 변경으로 가방을 새로 조회한다. 상태 오류와 재시도는 기존 명령 처리 계약을 따른다. `useAction` 없는 붕대·재료에 직접 사용 버튼을 만들지 않는다.
