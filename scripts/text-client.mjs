import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { TextClient, formatState } from './text-client-core.mjs';

const HELP = `state                  최신 상태 조회
guards                 현재 필드 경비센터 ID·좌표 조회
parcels notice 어디서나 소포 도착 여부 확인
parcels list 길드ID [다음커서] 소포 목록 조회
parcels claim 길드ID 소포ID 소포 수령 (결과 불명 시 retry)
permit quote 경비센터ID 5P 여행자증명서 견적 조회
permit barter 경비센터ID 폰P 재료ID=수량 ... 혼합 납부 견적
permit buy 경비센터ID   확인한 견적으로 발급 확정
materials list 길드ID  보유 원물·가공재 매입 목록
materials quote 길드ID 재료ID 수량 판매 견적
materials sell 길드ID  확인한 견적으로 판매 확정
citizenship list        보유 시민권·상태·기간 최신 조회
citizenship guilds      현재 맵 길드 ID·입구 조회
citizenship quote 길드ID 시민권 발급 견적
citizenship buy 길드ID  확인한 견적으로 시민권 발급
equipment history 개체ID [이전버전] 장비 변경 이력 조회
equipment list [다음커서] / equip 개체ID / unequip 슬롯 장비 조회·장착·해제
workshop craft|repair|consumable catalog 시설ID [다음커서] 품목·수리 대상 조회
workshop craft|repair|consumable quote 시설ID 품목ID [소모품 수량] 견적
workshop craft|repair|consumable create 시설ID / contracts 시설ID [다음커서] / claim 시설ID 계약ID
consumables catalog 시설ID / quote 시설ID 품목ID 수량 소모품 제작 목록·견적
consumables create 시설ID / contracts 시설ID [다음커서] / claim 시설ID 계약ID 제작·조회·수령
processing facilities  현재 맵 작업장 ID·입구 조회
processing catalog 시설ID 가공 목록 조회
processing quote 시설ID 재료ID 등급 수량 가공 견적 (low/medium/high)
processing create 시설ID 확인한 견적으로 계약
processing contracts 시설ID [다음커서] 계약 조회
processing claim 시설ID 계약ID 완성 가공재 수령
channels               현재 맵의 채널 목록·접속 인원 조회
channel address 주소   주소로 같은 맵 채널 이동 (예: AA22)
channel id 채널ID      ID로 같은 맵 채널 이동
create 이름            캐릭터 생성
skill 스킬ID           스킬 성장 (SP 소비)
skills                 보유 스킬·전투 슬롯 조회
loadout 스킬ID ...     전투 슬롯 전체 교체 (clear: 모두 해제)
attribute 능력치ID     능력치 성장 (CP 소비)
enter / away / resume  월드 입장 / 자리비움 / 복귀
move 열 행             필드 또는 전투 이동 (0부터 시작)
gate [웨이포인트ID]    현재 위치의 웨이포인트로 맵 전환
encounter 몬스터ID     조우 예약
scout 몬스터ID         개인 정찰 (서버 FP 비용 적용)
ready / cancel         조우·전투 준비 / 조우 예약 취소
attack 유닛ID          일반 공격
use-skill 액션ID 유닛ID 전투 스킬 실행
end / surrender        턴 종료 / 기권
rest start / rest stop 휴식 시작 / 중단
bag                    최신 가방 목록
first-aid              응급처치 (붕대 소비)
use-item 소모품ID      회복·개인 표식 소모품 사용
books list             보유 스킬북·열람 상태 조회
books shop 서점ID      서점 최종 가격·소유 여부 확인
books buy 스킬북ID     확인한 서점 가격으로 구매
books read 스킬북ID    보유 스킬북 열람
costumes               전체 디자인 코스튬 카탈로그·설명 조회
costumes owned         본인 보유 코스튬·획득 출처 조회 (교체는 게임 메뉴)
npc list               현재 맵 NPC ID·입구 조회
npc talk NPC_ID        현장 NPC 대화·의뢰 조건 조회
quest accept NPC_ID 의뢰ID 확인한 의뢰 수령
quest complete NPC_ID 의뢰ID 확인한 재료 전달·완료
journal                메인 의뢰 기록 조회
rewards [다음커서]      계정 보관함 조회 (claim-all: 전체 수령)
substitute list        대체 사냥 대상·비용 조회
substitute run 조우ID   대체 사냥 실행
hunts [다음커서]        본인 사냥 기록·종류별 누적 수량
party list              온라인 파티·초대·주변 캐릭터 조회
party create            길드 출입구에서 온라인 파티 생성
party invite 캐릭터ID    초대
party accept 초대ID      초대 수락
party leave             탈퇴
party kick 캐릭터ID      파티원 추방
party disband           해산
recruitment list         본인 모집 등록 도시 조회
recruitment register 길드ID  현지 모집 등록
recruitment unregister 도시ID 길드ID  모집 해제
loans [다음커서]        대여 파티원 목록
loans participation     대여 전투 참가 예상·제외 사유
loans remove 대여ID      편성 해제(계약 유지)
loans candidates 길드ID [다음커서]  모집 후보 조회
loans add 길드ID 캐릭터ID  조회한 후보를 대여 편성
retry                  결과 불명 명령을 같은 요청 ID로 재확인
help / quit            도움말 / 로그아웃 후 종료`;

const args = process.argv.slice(2);
if ((args.length !== 1 && args.length !== 2) || args[0] === '--help') {
  console.log('사용법: node scripts/text-client.mjs 게임API주소 [인증API주소]\n아이디·비밀번호는 터미널에서 입력합니다.\n\n' + HELP);
  process.exitCode = args[0] === '--help' ? 0 : 1;
} else if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('비밀번호를 숨길 수 있는 대화형 터미널에서 실행하세요.');
  process.exitCode = 1;
} else {
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, done) { if (!hidden) process.stdout.write(chunk); done(); } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  const inputClosed = new AbortController();
  let client;
  let timer;
  let queue = Promise.resolve();
  let stopped = false;
  let logoutOnExit = true;
  let lastRefresh = Date.now();
  // 토큰 갱신·명령·종료를 직렬화해 사용 중인 세션 토큰이 교체되는 경합을 막는다.
  const serialize = task => { const result = queue.then(task); queue = result.catch(() => {}); return result; };
  terminal.on('SIGINT', () => { stopped = true; terminal.close(); });
  terminal.on('close', () => { stopped = true; inputClosed.abort(); });
  try {
    client = new TextClient(args[0],{identityBaseUrl:args[1]});
    const user = await terminal.question('아이디: ', { signal: inputClosed.signal });
    process.stdout.write('비밀번호: ');
    hidden = true;
    let password;
    try { password = await terminal.question('', { signal: inputClosed.signal }); }
    finally { terminal.history = []; hidden = false; process.stdout.write('\n'); }
    try { await client.login(user, password); }
    finally { password = undefined; }
    console.log(formatState(client.state));
    console.log(HELP);
    let maintenancePending = false;
    timer = setInterval(() => {
      if (stopped || maintenancePending) return;
      maintenancePending = true;
      void serialize(async () => {
        if (stopped) return;
        if (Date.now() - lastRefresh >= 12 * 60 * 1000) {
          await client.refresh();
          lastRefresh = Date.now();
        }
        await client.heartbeat();
      }).catch(error => {
        console.error(`\n연결 유지 실패: ${error.message}`);
        if (error.code === 'IDLE_DISCONNECTED') logoutOnExit = false;
        stopped = true;
        terminal.close();
      }).finally(() => { maintenancePending = false; });
    }, 10000);
    while (!stopped) {
      const line = (await terminal.question('slime> ', { signal: inputClosed.signal })).trim();
      if (!line) continue;
      if (line === 'quit') break;
      try {
        const result = await serialize(() => client.interact(line));
        console.log(typeof result === 'string' ? result : result ? formatState(result) : HELP);
      } catch (error) {
        console.error(`명령 실패: ${error.message}`);
        if (error.code === 'IDLE_DISCONNECTED') {
          logoutOnExit = false; stopped = true; terminal.close();
        }
      }
    }
  } catch (error) {
    if (!stopped) { console.error(`실행 실패: ${error.message}`); process.exitCode = 1; }
  } finally {
    stopped = true;
    clearInterval(timer);
    terminal.close();
    if (client?.tokens && logoutOnExit) {
      try { await serialize(() => client.logout()); }
      catch { console.error('로그아웃을 확인하지 못했습니다. 세션 만료 또는 다음 로그인 전환으로 정리됩니다.'); }
    }
  }
}
