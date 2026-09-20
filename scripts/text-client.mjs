import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { TextClient, formatState } from './text-client-core.mjs';

const HELP = `state                  최신 상태 조회
create 이름            캐릭터 생성
skill 스킬ID           스킬 성장 (SP 소비)
attribute 능력치ID     능력치 성장 (CP 소비)
enter / away / resume  월드 입장 / 자리비움 / 복귀
move 열 행             필드 또는 전투 이동 (0부터 시작)
gate [웨이포인트ID]    현재 위치의 웨이포인트로 맵 전환
encounter 몬스터ID     조우 예약
ready / cancel         조우·전투 준비 / 조우 예약 취소
attack 유닛ID          일반 공격
end / surrender        턴 종료 / 기권
rest start / rest stop 휴식 시작 / 중단
journal                메인 의뢰 기록 조회
loans [다음커서]        대여 파티원 목록
help / quit            도움말 / 로그아웃 후 종료`;

const args = process.argv.slice(2);
if (args.length !== 1 || args[0] === '--help') {
  console.log('사용법: node scripts/text-client.mjs http://127.0.0.1:18080\n아이디·비밀번호는 터미널에서 입력합니다.\n\n' + HELP);
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
    client = new TextClient(args[0]);
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
