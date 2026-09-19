import { useEffect, useRef, useState } from "preact/hooks";
import { useMinimumLoading } from "./useMinimumLoading";
import { CharacterSettingsDialog } from "./CharacterSettingsDialog";
import { CharacterSettings } from "./CharacterSettings";
import { BattlePanel } from "./BattlePanel";
import { Client } from "../client/api";
import { registrationIssue } from "../client/credentials";
import type { Position, State } from "../client/types";
import type { createGame } from "../game/createGame";
const loginIllustration = new URL("../assets/login/slime-welcome-v2.png", import.meta.url).href;
const RESULT_NAMES: Record<string, string> = {
  WIN: "승리",
  LOSE: "패배",
  TIMEOUT: "시간 초과",
  SURRENDER: "기권",
  PREPARATION_FAILED: "전투 준비 시간 초과 · 필드 복귀",
};
const client = new Client();
const same = (a: Position, b: Position) =>
  a.column === b.column && a.row === b.row;
const DISTANCE = (a: Position, b: Position) =>
  Math.abs(a.column - b.column) + Math.abs(a.row - b.row);
function route(start: Position, end: Position, s: State): Position[] {
  const queue: { pos: Position; path: Position[] }[] = [
      { pos: start, path: [] },
    ],
    seen = new Set([`${start.column},${start.row}`]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (same(current.pos, end)) return current.path;
    for (const [dc, dr] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ]) {
      const p = { column: current.pos.column + dc, row: current.pos.row + dr },
        key = `${p.column},${p.row}`;
      if (
        !seen.has(key) &&
        p.column >= 0 &&
        p.row >= 0 &&
        p.column < s.map.columns &&
        p.row < s.map.rows &&
        !s.map.blocked.some((b) => same(b, p))
      ) {
        seen.add(key);
        queue.push({ pos: p, path: [...current.path, p] });
      }
    }
  }
  throw new Error("도달할 수 없는 셀입니다.");
}
export function App() {
  const [state, setState] = useState<State | null>(null),
    [connected, setConnected] = useState(false),
    [status, setStatus] = useState("계정을 만들고 슬라임의 일상에 함께하세요."),
    [busy, setBusy] = useState(false);
  const [user, setUser] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [selected, setSelected] = useState<Position | null>(null),
    [chat, setChat] = useState("");
  const [worldGeneration, setWorldGeneration] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renderedLocation, setRenderedLocation] = useState("");
  const [transferPending, setTransferPending] = useState(false);
  const [preparationError, setPreparationError] = useState("");
  const [renderError, setRenderError] = useState("");
  const readyRequest = useRef<string | null>(null);
  const [clock, setClock] = useState(Date.now()),
    [renderFailed, setRenderFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    renderer = useRef<ReturnType<typeof createGame> | null>(null);
  const serverOffset = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    client.onState = (s) => {
      serverOffset.current = s.serverTime * 1000 - Date.now();
      setState(s);
    };
    client.onStatus = (ready, msg) => {
      setConnected(ready);
      setStatus(msg);
    };
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      client.disconnect();
    };
  }, []);
  useEffect(() => {
    setSelected(null);
    renderer.current?.scene.selectCell(null);
  }, [state?.battle?.id, state?.battle?.turnId]);
  const inWorld = !!state && worldGeneration === state.generation && state.me.mode !== "LOBBY";
  useEffect(() => {
    if (!inWorld || !container.current) return;
    setRenderFailed(false);
    setRenderError("");
    setRenderedLocation("");
    let disposed = false;
    let canvas: HTMLCanvasElement | null = null;
    const lost = (e: Event) => {
      e.preventDefault();
      setRenderFailed(true);
      client.disconnect();
      setConnected(false);
      setRenderError("WebGL 화면을 복구하려면 다시 접속하세요.");
      setStatus("WebGL 화면을 복구하려면 다시 접속하세요.");
    };
    void import("../game/createGame")
      .then(({ createGame }) => {
        if (disposed || !container.current) return;
        renderer.current = createGame(container.current, setSelected, setRenderedLocation, message => {
          setRenderFailed(true);
          setRenderError(message);
          setStatus(message);
        });
        if (stateRef.current) renderer.current.scene.setState(stateRef.current);
        canvas = renderer.current.game.canvas;
        canvas.addEventListener("webglcontextlost", lost);
      })
      .catch(() => {
        setRenderFailed(true);
        client.disconnect();
        setRenderError("이 브라우저에서 WebGL을 실행할 수 없습니다.");
        setStatus("이 브라우저에서 WebGL을 실행할 수 없습니다.");
        setConnected(false);
      });
    return () => {
      disposed = true;
      canvas?.removeEventListener("webglcontextlost", lost);
      renderer.current?.game.destroy(true);
      renderer.current = null;
    };
  }, [inWorld]);
  useEffect(() => {
    if (state) renderer.current?.scene.setState(state);
  }, [state]);
  const loadingRequested = transferPending || (inWorld &&
    (renderedLocation !== state.location.id || !connected || state.battle?.status === "PREPARING"));
  const { loading, minimumElapsed } = useMinimumLoading(loadingRequested);
  useEffect(() => {
    const battle = state?.battle;
    if (!battle || battle.status !== "PREPARING" || !minimumElapsed || !connected || renderFailed ||
        renderedLocation !== state.location.id || !state.location.roomReady ||
        state.me.requiresStartSpawn || battle.ready?.includes(state.me.id) || readyRequest.current) return;
    const id = battle.id;
    readyRequest.current = id;
    setPreparationError("");
    void client.command("/v1/game/battle/commands", { action: { type: "READY", battleId: id } })
      .catch(e => { if (stateRef.current?.battle?.id === id) setPreparationError((e as Error).message); })
      .finally(() => { if (readyRequest.current === id) readyRequest.current = null; });
  }, [state, connected, renderedLocation, renderFailed, clock, minimumElapsed]);
  async function run(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const command = (path: string, body: Record<string, unknown> = {}) =>
    run(async () => {
      const transfer = ["/v1/world/enter", "/v1/maps/transitions", "/v1/game/encounters/reserve", "/v1/game/encounters/ready"].includes(path);
      if (transfer) setTransferPending(true);
      try {
        const result = await client.command(path, body);
        if (path === "/v1/world/enter") setWorldGeneration(result.state.generation);
        return result;
      }
      finally { if (transfer) setTransferPending(false); }
    });
  async function walk() {
    if (!state || !selected) return;
    const steps = route(state.me.position, selected, state),
      mapId = state.map.id;
    for (const position of steps) {
      if (client.state?.me.mode !== "FIELD" || client.state?.map.id !== mapId)
        break;
      await client.command("/v1/game/moves", { position });
      await new Promise((resolve) => setTimeout(resolve, 270));
    }
  }
  const disabled = busy || !connected || renderFailed || loading;
  const battle = state?.battle,
    turn = battle?.units.find((u) => u.id === battle.order[battle.index]);
  const remaining = battle
    ? Math.max(
        0,
        Math.min(
          45,
          Math.ceil(battle.deadline - (clock + serverOffset.current) / 1000),
        ),
      )
    : 0;
  const battleCommand = (type: string, targetId?: string) =>
    command("/v1/game/battle/commands", {
      action: {
        type,
        turnId: battle?.turnId,
        ...(targetId ? { targetId } : {}),
        ...(type === "MOVE" ? { position: selected } : {}),
      },
    });
  return (
    <div class={`app-shell ${!state ? "login-shell" : ""}`}>
      {loading && <div class="location-loading" role="dialog" aria-modal="true" aria-label="공간 이동 로딩">
        <section class="loading-card" aria-live="polite">
          <div class="eyebrow">SLIME · LOADING</div>
          <h2>{renderFailed ? "화면 준비에 실패했습니다" : state?.battle ? "전투 맵으로 이동 중" : "맵으로 이동 중"}</h2>
          <p>맵과 참가자, 채팅룸을 준비하고 있습니다.</p>
          <ol>
            <li>{transferPending ? "서버 공간 생성·이동 확인 중" : "서버 공간 확인 완료"}</li>
            <li>{state && renderedLocation === state.location.id ? "맵 자원·화면 준비 완료" : "맵 자원·화면 준비 중"}</li>
            <li>{connected && state?.location.roomReady ? "전용 채팅룸·실시간 연결 준비 완료" : "채팅룸·실시간 연결 확인 중"}</li>
            {state?.battle?.status === "PREPARING" && <li>참가자 준비 {state.battle.ready?.length || 0}/{state.battle.participants.length} · 준비 완료 후 첫 턴 시작</li>}
          </ol>
          {preparationError && <p role="alert">{preparationError}</p>}
          {renderFailed || !connected ? <><p>{renderError || status}</p><button onClick={() => location.reload()}>다시 접속</button></> : <p>최소 1.5초 대기와 모든 준비가 완료되면 자동으로 입장합니다.</p>}
        </section>
      </div>}
      <header>
        <a class="brand" href="/">
          SLIME<span>새로운 시간</span>
        </a>
        <div class="connection">
          <i class={connected ? "online" : ""} />
          {state ? (connected ? "연결됨" : "연결 확인 중") : "일상의 시작"}
        </div>
        {state && !connected && (
          <button
            class="subtle"
            onClick={() => {
              client.disconnect();
              client.tokens = null;
              client.state = null;
              setState(null);
              setStatus(
                "다시 로그인해 주세요. 서버의 기존 전투는 계속 진행됩니다.",
              );
            }}
          >
            다시 로그인
          </button>
        )}
        {state && (
          <button
            class="subtle"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await client.logout();
                setState(null);
                setWorldGeneration(null);
                setSettingsOpen(false);
                setConnected(false);
                setStatus("로그아웃했습니다.");
                setPassword("");
              })
            }
          >
            로그아웃
          </button>
        )}
      </header>
      {!state ? (
        <main class="welcome">
          <section class="intro" aria-labelledby="welcome-title">
            <img class="login-illustration" src={loginIllustration}
              alt="숲속 꽃밭의 감각기관 없는 반투명 청록색 슬라임" width="1536" height="1024" />
            <div class="intro-copy">
              <div class="eyebrow">나만의 속도로, 새로운 시간</div>
              <h1 id="welcome-title">천천히 머물고,<br /><em>함께 일상을 쌓아요.</em></h1>
              <p>느긋하게 거닐고, 서로의 하루를 나누세요.<br />이곳에서는 당신의 속도로 지내면 돼요.</p>
              <a class="login-jump" href="#login-title" onClick={() => document.getElementById("login-title")?.focus()}>로그인으로 이동 <span aria-hidden="true">↓</span></a>
            </div>
            <div class="intro-grid">
              <span>◇ 느긋한 발걸음</span>
              <span>◎ 함께하는 시간</span>
              <span>◌ 나만의 일상</span>
            </div>
          </section>
          <section class="card auth" aria-labelledby="login-title">
            <div class="eyebrow">일상의 시작</div>
            <h2 id="login-title" tabIndex={-1}>어서 오세요.</h2>
            <p class="auth-intro">오늘도 나만의 속도로 시작해요.</p>
            <form
              aria-busy={busy}
              onSubmit={(e) => {
                e.preventDefault();
                setWorldGeneration(null);
                setSettingsOpen(false);
                void run(() => client.login(user, password));
              }}
            >
              <label>
                아이디
                <input
                  aria-label="아이디"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellcheck={false}
                  maxLength={40}
                  value={user}
                  onInput={(e) => setUser(e.currentTarget.value)}
                  required
                />
              </label>
              <label>
                비밀번호
                <input
                  aria-label="비밀번호"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  value={password}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  required
                />
              </label>
              <button
                disabled={busy || !user.trim() || !password}
                type="submit"
              >
                접속하기 <span>→</span>
              </button>
              <p class="signup-hint">처음 오셨나요? 위에 입력한 아이디와 비밀번호로 가입할 수 있어요.</p>
              <button
                type="button"
                class="secondary"
                disabled={busy || !user.trim() || !password}
                onClick={() =>
                  run(async () => {
                    const issue = registrationIssue(user, password);
                    if (issue) throw new Error(issue);
                    await client.request("/v1/auth/register", {
                      user_id: user,
                      password,
                    });
                    setStatus("가입되었습니다. 접속하기를 눌러 주세요.");
                  })
                }
              >
                새 계정 만들기
              </button>
            </form>
            <div class="auth-status" role="status" aria-live="polite" aria-atomic="true">{busy ? "처리 중이에요. 잠시만 기다려 주세요." : status}</div>
            <details class="signup-rules">
              <summary>가입 조건 확인하기</summary>
              <small>
              가입 아이디: 영문 소문자·숫자만 허용합니다.
              <br />
              비밀번호: 영문 대문자·소문자·숫자·특수문자를 각각 하나 이상
              포함하세요. 공백 없이 ASCII 문자만 사용할 수 있습니다.
              </small>
            </details>
          </section>
        </main>
      ) : !inWorld ? (
        <main class="lobby">
          <section class="card">
            <div class="eyebrow">{state.me.name ? "CHARACTER SETTINGS" : "NEW EXPLORER"}</div>
            <h1>{state.me.name ? "캐릭터 설정" : "새로운 모험가"}</h1>
            {!state.me.name ? (
              <>
                <label>
                  캐릭터 이름
                  <input
                    aria-label="캐릭터 이름"
                    maxLength={20}
                    value={name}
                    onInput={(e) => setName(e.currentTarget.value)}
                  />
                </label>
                <button
                  disabled={disabled || !name.trim()}
                  onClick={() =>
                    command("/v1/characters/me", { character_name: name })
                  }
                >
                  캐릭터 생성
                </button>
              </>
            ) : (
              <>
                <p>
                  {state.me.name} · 경험치 {state.me.xp} · 재화 {state.me.coins}
                </p>
                <CharacterSettings me={state.me} disabled={disabled} command={command} expanded />
                <p>마지막 맵의 시작점에서 모험을 이어갑니다.</p>
                <button
                  disabled={disabled || !!state.me.battleId}
                  onClick={() => command("/v1/world/enter")}
                >
                  {state.me.battleId
                    ? "진행 중 전투 정산 대기"
                    : "게임으로 가기 →"}
                </button>
              </>
            )}
            {state.me.lastResult && (
              <p class="result">
                {RESULT_NAMES[state.me.lastResult.result]} · 경험치 +
                {state.me.lastResult.xp}
              </p>
            )}
          </section>
        </main>
      ) : (
        <main class="world-layout">
          <section class="world">
            <div class="world-title">
              <div>
                <div class="eyebrow">
                  {battle ? "ENCOUNTER / BATTLE" : "EXPLORE / CHANNEL"}
                </div>
                <h2>
                  {battle
                    ? `전술 전장 · 라운드 ${battle.round}`
                    : state.map.name}
                </h2>
              </div>
              <nav class="map-menu" aria-label="맵 메뉴">
                <button class="secondary compact" aria-haspopup="dialog"
                  disabled={loading} onClick={() => setSettingsOpen(true)}>캐릭터 설정</button>
              <button
                class="secondary compact"
                onClick={() => renderer.current?.scene.focus()}
              >
                시점 복귀
              </button>
              </nav>
            </div>
            <div class="canvas-wrap" ref={container} />
            <div class="map-caption">
              <span>
                {battle
                  ? "파랑: 이동 · 번호선: 경로 · 주황: 도착 후 공격 범위"
                  : "바위·빽빽한 수풀은 이동 불가 · 화살표 표식은 웨이포인트 · 맵 밖은 배경"}
              </span>
              <span>
                {selected
                  ? `선택 ${selected.column}, ${selected.row}${(battle?.blocked ?? state.map.blocked).some(p => same(p, selected)) ? " · 이동 불가" : ""}`
                  : "셀을 선택하세요"}{" "}
                · 방향키 선택 / 휠 확대
              </span>
            </div>
          </section>
          <aside class="sidebar">
            <section class="card profile">
              <div class="eyebrow">EXPLORER</div>
              <h2>{state.me.name}</h2>
              <p>
                XP {state.me.xp} · ◈ {state.me.coins}
                <br />
                위치 {state.me.position.column}, {state.me.position.row}
              </p>
              <span class="badge">
                {battle
                  ? "전투 중"
                  : state.me.mode === "RESERVED"
                    ? "조우 준비"
                    : "탐색 중"}
              </span>
              {state.me.requiresStartSpawn && (
                <p>정산을 기다린 뒤 시작점에서 입장할 수 있습니다.</p>
              )}
            </section>
            {battle ? (
              <BattlePanel battle={battle} actor={state.me.id} selected={selected}
                disabled={disabled || state.me.requiresStartSpawn} remaining={remaining}
                select={p => { renderer.current?.scene.selectCell(p); setSelected(p); }} execute={battleCommand} />
            ) : (
              <section class="card">
                <h3>다음 행동</h3>
                <button
                  disabled={disabled || !selected || state.me.mode !== "FIELD" || state.map.blocked.some(p => same(p, selected))}
                  onClick={() => run(walk)}
                >
                  선택 셀까지 이동
                </button>
                {state.map.connections
                  .filter((g) => same(g, state.me.position))
                  .map((g) => (
                    <button
                      class="secondary"
                      disabled={disabled}
                      onClick={() =>
                        command("/v1/maps/transitions", { connectionId: g.id })
                      }
                    >
                      {g.targetName ?? (g.target === "grove" ? "푸른 숲" : "이슬 초원")}으로 이동
                      ↗
                    </button>
                  ))}
                <h4>주변의 몬스터</h4>
                {state.monsters.map((m) => (
                  <div class="monster-row">
                    <span>
                      {m.disposition === "AGGRESSIVE" ? "● 선공" : "○ 비선공"}{" "}
                      <small>
                        {m.movement?.mode === "ROAM" ? `${m.movement.interval}초 주기 이동 · ` : "고정 · "}
                        거리 {DISTANCE(state.me.position, m.position)}
                      </small>
                    </span>
                    <button
                      class="compact secondary"
                      disabled={
                        disabled ||
                        m.state !== "AVAILABLE" ||
                        DISTANCE(state.me.position, m.position) > 1 ||
                        state.me.mode !== "FIELD"
                      }
                      onClick={() =>
                        command("/v1/game/encounters/reserve", {
                          monsterId: m.id,
                        })
                      }
                    >
                      조우
                    </button>
                  </div>
                ))}
                {state.reservation && (
                  <div class="reservation">
                    <p>
                      준비 {state.reservation.ready.length}/
                      {state.reservation.members.length}
                    </p>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        command("/v1/game/encounters/ready", {
                          reservationId: state.reservation!.id,
                        })
                      }
                    >
                      준비 완료
                    </button>
                    <button
                      class="secondary"
                      disabled={disabled}
                      onClick={() =>
                        command("/v1/game/encounters/cancel", {
                          reservationId: state.reservation!.id,
                        })
                      }
                    >
                      예약 취소
                    </button>
                  </div>
                )}
              </section>
            )}
            {!battle && (
              <section class="card">
                <h3>
                  함께 탐색하기 <small>{state.members.length}/32</small>
                </h3>
                {state.party ? (
                  <>
                    <p>
                      파티 {state.party.members.length}/4 · 파티장{" "}
                      {state.party.leader}
                    </p>
                    <button
                      class="secondary"
                      disabled={disabled}
                      onClick={() =>
                        command("/v1/game/party/commands", { action: "LEAVE" })
                      }
                    >
                      파티 탈퇴
                    </button>
                    {state.party.leader === state.me.id && (
                      <button
                        class="secondary"
                        disabled={disabled}
                        onClick={() =>
                          command("/v1/game/party/commands", {
                            action: "DISBAND",
                          })
                        }
                      >
                        파티 해산
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    class="secondary"
                    disabled={disabled || state.me.mode !== "FIELD"}
                    onClick={() =>
                      command("/v1/game/party/commands", { action: "CREATE" })
                    }
                  >
                    파티 만들기
                  </button>
                )}
                {state.members
                  .filter((m) => m.id !== state.me.id)
                  .map((m) => (
                    <div class="monster-row">
                      <span>{m.name}</span>
                      <button
                        class="compact secondary"
                        disabled={
                          disabled || state.party?.leader !== state.me.id
                        }
                        onClick={() =>
                          command("/v1/game/party/commands", {
                            action: state.party?.members.includes(m.id)
                              ? "KICK"
                              : "INVITE",
                            targetId: m.id,
                          })
                        }
                      >
                        {state.party?.members.includes(m.id) ? "추방" : "초대"}
                      </button>
                    </div>
                  ))}
                {state.invitations.map((i) => (
                  <button
                    disabled={disabled}
                    onClick={() =>
                      command("/v1/game/party/commands", {
                        action: "ACCEPT",
                        invitationId: i.id,
                      })
                    }
                  >
                    {i.from}님의 초대 수락
                  </button>
                ))}
              </section>
            )}
            <section class="card chat">
              <h3>{battle ? "전투" : "채널"} 대화</h3>
              <div class="chat-lines" aria-live="polite">
                {state.messages.map((m) => (
                  <p key={m.id}>
                    <b>{m.name}</b> {m.text}
                  </p>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await client.command("/v1/game/messages", { text: chat });
                    setChat("");
                  });
                }}
              >
                <input
                  aria-label="채팅 메시지"
                  maxLength={200}
                  value={chat}
                  onInput={(e) => setChat(e.currentTarget.value)}
                  placeholder="함께하는 모험가에게"
                />
                <button disabled={disabled || !chat.trim()}>전송</button>
              </form>
            </section>
            {!battle && state.me.lastResult && (
              <p class="result">
                최근 전투 {RESULT_NAMES[state.me.lastResult.result]} · XP +
                {state.me.lastResult.xp}
              </p>
            )}
          </aside>
        </main>
      )}
      {state && inWorld && !loading && settingsOpen && <CharacterSettingsDialog
        me={state.me} disabled={disabled} command={command} onClose={() => setSettingsOpen(false)} />}
      <footer role="status">
        <span class={connected ? "status-light" : ""}>●</span>{" "}
        {busy ? "명령 처리 중…" : status}
      </footer>
    </div>
  );
}
