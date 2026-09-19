import { LanguageSelect } from './LanguageSelect';
import { useTranslation, getLocale } from '../i18n';
import { localizedFieldMap, localizedMapName } from '../client/mapText';
import { FieldPoints } from "./FieldPoints";
import { AchievementsPage } from "./AchievementsPage";
import { approachMonster } from "./encounterNavigation";
import { ChatPanel } from "./ChatPanel";
import { useEffect, useRef, useState } from "preact/hooks";
import { useMinimumLoading } from "./useMinimumLoading";
import { FieldPanel, FieldSelection, FieldEventShortcuts, type Walking } from "./FieldPanel";
import { fieldRoute, sameCell as same } from "./fieldNavigation";
import { TerrainLegend } from "./TerrainLegend";
import { CharacterPortrait } from "./CharacterPortrait";
import { CharacterSettings } from "./CharacterSettings";
import { CharacterDeparture } from "./CharacterDeparture";
import { WorldDrawer } from "./WorldDrawer";
import { BattlePanel } from "./BattlePanel";
import { Client } from "../client/api";
import { registrationIssue } from "../client/credentials";
import type { Position, State } from "../client/types";
import type { createGame } from "../game/createGame";
const WALK_STEP_DELAY_MS = 270;
const loginIllustration = new URL("../assets/login/slime-welcome-v4.png", import.meta.url).href;
const RESULT_NAMES: Record<string, string> = {
  WIN: "승리",
  LOSE: "패배",
  TIMEOUT: "시간 초과",
  SURRENDER: "기권",
  PREPARATION_FAILED: "전투 준비 시간 초과 · 필드 복귀",
};
const MAP_ZOOM_STEP = 0.15;
const client = new Client();
export function App() {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<State | null>(null),
    [connected, setConnected] = useState(false),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const [user, setUser] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [selected, setSelected] = useState<Position | null>(null),
    [chat, setChat] = useState("");
  const [authPage, setAuthPage] = useState<"login" | "register">(() => location.hash === "#/register" ? "register" : "login");
  const registering = authPage === "register";
  function navigateAuth(page: "login" | "register") {
    history.pushState(null, "", page === "register" ? "#/register" : "#/login");
    setAuthPage(page);
    setPassword("");
    setPasswordVisible(false);
  }
  useEffect(() => {
    const syncAuthPage = () => {
      setAuthPage(location.hash === "#/register" ? "register" : "login");
      setPassword("");
      setPasswordVisible(false);
      setStatus("");
    };
    window.addEventListener("popstate", syncAuthPage);
    window.addEventListener("hashchange", syncAuthPage);
    return () => {
      window.removeEventListener("popstate", syncAuthPage);
      window.removeEventListener("hashchange", syncAuthPage);
    };
  }, []);
  useEffect(() => { document.getElementById("login-title")?.focus(); }, [authPage]);
  const [authAction, setAuthAction] = useState<"login" | "register" | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const authPending = useRef(false);
  async function authenticate(action: "login" | "register") {
    if (busy || authPending.current) return;
    authPending.current = true;
    setAuthAction(action);
    setStatus("");
    try {
      await run(async () => {
        if (action === "login") {
          setCharacterPage("select");
          setWorldGeneration(null);
          navigateCharacterPage("#/characters");
          await client.login(user, password);
        } else {
          const issue = registrationIssue(user, password);
          if (issue) throw new Error(issue);
          await client.request("/v1/auth/register", { user_id: user, password });
          navigateAuth("login");
          setStatus(t("auth.registered"));
        }
      });
    } finally {
      authPending.current = false;
      setAuthAction(null);
      setPasswordVisible(false);
    }
  }
  const [characterPage, setCharacterPage] = useState<"select" | "create" | "settings">("select");
  const [worldGeneration, setWorldGeneration] = useState<number | null>(null);
  const [characterRoute, setCharacterRoute] = useState(location.hash);
  function navigateCharacterPage(route: string) {
    history.pushState(null, "", route);
    setCharacterRoute(route);
  }
  useEffect(() => {
    const sync = () => setCharacterRoute(location.hash);
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  const settingsAvailable = !!state && !state.battle && !state.me.battleId && state.me.mode !== "IN_BATTLE";
  const menuPage = settingsAvailable && characterRoute === "#/menu";
  const settingsPage = settingsAvailable && characterRoute === "#/characters/settings";
  const [drawer, setDrawer] = useState<"nearby" | "party" | "chat" | null>(null);
  useEffect(() => { setDrawer(null); }, [state?.location.id, state?.battle?.id]);
  useEffect(() => { if (state?.reservation) setDrawer("nearby"); }, [state?.reservation?.id]);
  const [renderedLocation, setRenderedLocation] = useState("");
  const [transferPending, setTransferPending] = useState(false);
  const [preparationError, setPreparationError] = useState("");
  const [renderError, setRenderError] = useState("");
  const [walking, setWalking] = useState<Walking | null>(null);
  const stopWalking = useRef(false);
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
  }, [state?.generation, state?.location.id, state?.map.id, state?.battle?.id, state?.battle?.turnId]);
  const inWorld = !menuPage && !settingsPage && !!state && worldGeneration === state.generation && state.me.mode !== "LOBBY" && state.me.mode !== "AWAY";
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
        if (stateRef.current) renderer.current.scene.setState({...stateRef.current,
          map: localizedFieldMap(stateRef.current.map, getLocale())});
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
    if (state) renderer.current?.scene.setState({...state, map: localizedFieldMap(state.map, locale)});
  }, [state, locale]);
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
        if (path === "/v1/characters/me") { setCharacterPage("select"); setName(""); }
        if (path === "/v1/world/enter") { setWorldGeneration(result.state.generation); navigateCharacterPage("#/world"); }
        return result;
      }
      finally { if (transfer) setTransferPending(false); }
    });
  async function walk() {
    if (!state || !selected) return;
    const steps = fieldRoute(state.me.position, selected, state.map);
    if (!steps) throw new Error("현재 위치에서 갈 수 있는 경로가 없습니다.");
    const locationId = state.location.id, generation = state.generation;
    stopWalking.current = false;
    setWalking({ completed: 0, total: steps.length, stopping: false });
    try {
      for (let i = 0; i < steps.length; i++) {
        const current = client.state;
        if (stopWalking.current || current?.me.mode !== "FIELD" || current.location.id !== locationId || current.generation !== generation) break;
        if (current.me.fp !== undefined && current.me.fp < 1) throw new Error("이동에 필요한 FP가 부족합니다. 1칸당 1 FP가 필요합니다.");
        await client.command("/v1/game/moves", { position: steps[i] });
        setWalking({ completed: i + 1, total: steps.length, stopping: stopWalking.current });
        if (i + 1 < steps.length) await new Promise(resolve => setTimeout(resolve, WALK_STEP_DELAY_MS));
      }
    } finally { setWalking(null); }
  }
  async function approachEncounter(monsterId: string) {
    stopWalking.current = false;
    try {
      await approachMonster(monsterId, {
        state: () => client.state, stopped: () => stopWalking.current,
        move: position => client.command("/v1/game/moves", {position}),
        reserve: async id => {
          setTransferPending(true);
          try { await client.command("/v1/game/encounters/reserve", {monsterId:id}); }
          finally { setTransferPending(false); }
        },
        progress: (completed,total) => setWalking({completed,total,stopping:false}),
        pause: () => new Promise(resolve => setTimeout(resolve,WALK_STEP_DELAY_MS)),
      });
    } finally { setWalking(null); }
  }
  const selectField = (position: Position | null) => {
    setSelected(position);
    renderer.current?.scene.selectCell(position, true);
  };
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
    <div class={`app-shell ${!state ? "login-shell" : inWorld ? "world-shell" : ""}`}>
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
        <LanguageSelect />
        <a class="brand" href="/">
          SLIME<span>{t('common.brand')}</span>
        </a>
        <div class="connection">
          <i class={connected ? "online" : ""} />
          {state ? (connected ? t('common.connected') : t('common.connecting')) : t('common.start')}
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
            {t('common.relogin')}</button>
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
                navigateCharacterPage("#/characters");
                setConnected(false);
                setStatus("로그아웃했습니다.");
                setPassword("");
              })
            }
          >
            {t('common.logout')}</button>
        )}
      </header>
      {!state ? (
        <main class="welcome">
          <section class="intro" aria-labelledby="welcome-title">
            <img class="login-illustration" src={loginIllustration}
              alt={t('auth.illustration')} width="1536" height="1024" />
            <div class="intro-copy">
              <div class="eyebrow">{t('auth.eyebrow')}</div>
              <h1 id="welcome-title">{t('auth.headline')}<br /><em>{t('auth.emphasis')}</em></h1>
              <p>{t('auth.intro')}<br />{t('auth.pace')}</p>
              <a class="login-jump" href={registering ? "#/register" : "#/login"} onClick={event => { event.preventDefault(); document.getElementById("login-title")?.focus(); }}>{t(registering ? 'auth.register' : 'auth.jump')}<span aria-hidden="true">↓</span></a>
            </div>
            <div class="intro-grid">
              <span>{t('auth.steps')}</span>
              <span>{t('auth.together')}</span>
              <span>{t('auth.daily')}</span>
            </div>
          </section>
          <section class="card auth" aria-labelledby="login-title">
            <div class="eyebrow">{t('common.start')}</div>
            <h2 id="login-title" tabIndex={-1}>{t(registering ? 'auth.register' : 'auth.welcome')}</h2>
            <p class="auth-intro">{t(registering ? 'auth.registerSubtitle' : 'auth.subtitle')}</p>
            <form
              aria-busy={busy}
              onSubmit={(e) => {
                e.preventDefault();
                void authenticate(authPage);
              }}
            >
              <label>
                {t('auth.username')}<input
                  aria-label={t('auth.username')}
                  aria-describedby="auth-feedback"
                  autoComplete="username"
                  enterKeyHint="next"
                  autoCapitalize="none"
                  spellcheck={false}
                  maxLength={40}
                  value={user}
                  onInput={(e) => setUser(e.currentTarget.value)}
                  required
                />
              </label>
              <label for="auth-password">{t('auth.password')}</label>
              <div class="password-field">
                <input id="auth-password"
                  ref={passwordInput}
                  aria-label={t('auth.password')}
                  aria-describedby="auth-feedback"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete={registering ? "new-password" : "current-password"}
                  enterKeyHint="go"
                  maxLength={128}
                  value={password}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  required
                />
              <button type="button" class="password-toggle secondary" aria-pressed={passwordVisible}
                aria-label={t("auth.showPassword")} title={passwordVisible ? t("auth.hidePassword") : t("auth.showPassword")} aria-controls="auth-password"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  const input = passwordInput.current;
                  const start = input?.selectionStart, end = input?.selectionEnd;
                  setPasswordVisible(visible => !visible);
                  requestAnimationFrame(() => {
                    input?.focus();
                    if (start != null && end != null) input?.setSelectionRange(start, end);
                  });
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {passwordVisible && <path d="m3 3 18 18" />}
                </svg>
              </button>
              </div>
              <button
                disabled={busy || !user.trim() || !password}
                type="submit"
              >
                {t(registering ? (authAction ? 'auth.registering' : 'auth.register') : (authAction ? 'auth.signingIn' : 'auth.login'))}<span>→</span>
              </button>
              <div id="auth-feedback" class="auth-status" role="status" aria-live="polite" aria-atomic="true">{authAction ? t(authAction === "login" ? "auth.signingIn" : "auth.registering") : status || t("auth.inputHint")}</div>
              {!registering && <p class="signup-hint">{t('auth.signupHint')}</p>}
              <button type="button" class="secondary" disabled={busy}
                onClick={() => { setStatus(""); navigateAuth(registering ? "login" : "register"); }}>
                {t(registering ? 'auth.backToLogin' : 'auth.register')}
              </button>
              {registering && <details class="signup-rules" open>
                <summary>{t('auth.rules')}</summary>
                <small>{t('auth.usernameRule')}<br />{t('auth.passwordRule')}</small>
              </details>}
            </form>
          </section>
        </main>
      ) : state.me.mode === "AWAY" ? (
        <AchievementsPage client={client} disabled={busy || !connected} onReturn={() => command("/v1/world/resume")} />
      ) : menuPage ? (
        <main class="lobby field-menu-page">
          <section class="card">
            <div class="field-card-heading"><h1>메뉴</h1><button class="secondary" onClick={() => navigateCharacterPage("#/world")}>맵으로 돌아가기</button></div>
            <nav class="field-menu-actions" aria-label="게임 메뉴">
              <button class="secondary" onClick={() => navigateCharacterPage("#/characters/settings")}>{t('common.settings')}</button>
              <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("party")}>{t('common.party')}{state.invitations.length > 0 ? ` · 초대 ${state.invitations.length}` : ""}</button>
              <button class="secondary" disabled={disabled || state.me.mode !== "FIELD"} onClick={() => command("/v1/world/away")}>{t('common.achievements')}</button>
            </nav>
          </section>
        </main>
      ) : settingsPage ? (
        <main class="lobby character-lobby">
          <section class="card">
            <h1>{t('common.settings')}</h1>
            <nav class="character-settings-navigation" aria-label="캐릭터 설정 페이지 이동">
            <button class="secondary" disabled={busy} onClick={() => {
              setCharacterPage("select");
              navigateCharacterPage(worldGeneration === state.generation && state.me.mode !== "LOBBY" ? "#/menu" : "#/characters");
            }}>{worldGeneration === state.generation && state.me.mode !== "LOBBY" ? "돌아가기" : "캐릭터 선택으로"}</button>
            </nav>
            <CharacterSettings me={state.me} disabled={disabled} command={command} expanded />
          </section>
        </main>
      ) : !inWorld ? (
        <main class={`lobby ${state.me.name ? "character-lobby" : ""}`}>
          <section class="card">
            <div class="eyebrow">{characterPage === "select" ? "CHARACTER SELECT" : characterPage === "create" ? "NEW EXPLORER" : "CHARACTER SETTINGS"}</div>
            <h1>{characterPage === "select" ? "캐릭터 선택" : characterPage === "create" ? "캐릭터 생성" : t('common.settings')}</h1>
            {state.me.name && <CharacterDeparture me={state.me} disabled={disabled} onEnter={() => command("/v1/world/enter")} />}
            {characterPage === "select" ? (
              state.me.name ? <>
                <article class="character-select-card" aria-label="내 캐릭터">
                  <CharacterPortrait />
                  <div><h2>{state.me.name}</h2><p>이 캐릭터로 모험을 이어가세요.</p>
                    <button class="secondary" disabled={disabled} onClick={() => navigateCharacterPage("#/characters/settings")}>캐릭터 설정</button>
                  </div>
                </article>
                <p class="growth-help">캐릭터 1 / 1 · 계정당 한 명의 캐릭터를 사용할 수 있습니다.</p>
              </> : <div class="character-select-empty">
                <p>아직 캐릭터가 없습니다. 첫 모험가를 만들어 주세요.</p>
                <button disabled={disabled} onClick={() => setCharacterPage("create")}>캐릭터 생성</button>
                <p class="growth-help">계정당 한 명의 캐릭터를 생성할 수 있습니다.</p>
              </div>
            ) : characterPage === "create" && !state.me.name ? (
              <form onSubmit={event => { event.preventDefault(); if (!disabled && name.trim()) void command("/v1/characters/me", { character_name: name.trim() }); }}>
                <label>{t('common.characterName')}<input aria-label={t('common.characterName')} maxLength={20} value={name}
                  disabled={busy} onInput={event => setName(event.currentTarget.value)} autoFocus /></label>
                <button type="submit" disabled={disabled || !name.trim()}>{busy ? "생성 중…" : "캐릭터 생성"}</button>
                <button type="button" class="secondary" disabled={busy} onClick={() => setCharacterPage("select")}>캐릭터 선택으로</button>
              </form>
            ) : <>
              <button class="secondary" disabled={busy} onClick={() => setCharacterPage("select")}>캐릭터 선택으로</button>
              <CharacterSettings me={state.me} disabled={disabled} command={command} expanded />
            </>}
            {state.me.lastResult && (
              <p class="result">
                {RESULT_NAMES[state.me.lastResult.result]} · 재화 +
                {state.me.lastResult.coins}
              </p>
            )}
          </section>
        </main>
      ) : (
        <main class="world-layout world-layout--immersive">
          <section class={`world ${battle ? "is-battle" : "is-field"}`}>
            <div class="world-title">
              <div>
                <div class="eyebrow">
                  {battle ? "ENCOUNTER / BATTLE" : "EXPLORE / CHANNEL"}
                </div>
                <h2>
                  {battle
                    ? `${battle.field.name || "전술 전장"} · 라운드 ${battle.round}`
                    : localizedMapName(state.map.name, state.map.nameTranslations, locale)}
                </h2>
              </div>
              <nav class="map-menu" aria-label="맵 메뉴">
                <span class="world-resources">{state.me.name} · CP {state.me.cp} · ◈ {state.me.coins}</span>
              </nav>
              {!battle && <FieldPoints fp={state.me.fp} max={state.me.fpMax} nextChargeAt={state.me.fpNextChargeAt} now={(clock + serverOffset.current) / 1000} />}
            </div>
            <div class={`map-stage card ${battle ? "battle-map-card" : "field-map-card"}`} role="region" aria-label={battle ? "전투 맵 카드" : "필드 맵 카드"}>
              <nav class="map-camera-controls" aria-label="맵 화면 조정">              <button class="secondary compact" aria-label="맵 축소" onClick={() => renderer.current?.scene.adjustZoom(-MAP_ZOOM_STEP)}>−</button>
              <button class="secondary compact" aria-label="맵 확대" onClick={() => renderer.current?.scene.adjustZoom(MAP_ZOOM_STEP)}>＋</button>
              <button class="secondary compact" aria-label="맵 왼쪽으로 90도 회전" onClick={() => renderer.current?.scene.rotateMap(-1)}>↶</button>
              <button class="secondary compact" aria-label="맵 오른쪽으로 90도 회전" onClick={() => renderer.current?.scene.rotateMap(1)}>↷</button>
              <button
                class="secondary compact"
                onClick={() => renderer.current?.scene.focus()}
              >
                시점 복귀
              </button>
</nav>
              <div class="canvas-wrap" ref={container} tabIndex={0} role="region" aria-label="맵 탐색 · 방향키로 위치 선택" />
</div>
            {!battle && <section class="card field-command-dock field-control-card" aria-label="필드 조작 카드">
              <div class="field-card-heading"><h3>조작</h3><div class="field-control-actions">
              <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("chat")}>{t('common.channelChat')}</button>
                <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("nearby")}>{state.reservation ? t('common.encounter') : t('common.nearby')}</button>
                <button class="secondary" disabled={loading} onClick={() => navigateCharacterPage("#/menu")}>메뉴</button>
              </div></div>
              <FieldEventShortcuts state={state} selected={selected} select={selectField} disabled={loading || !!walking} />
              <FieldSelection state={state} selected={selected} disabled={disabled} now={(clock + serverOffset.current) / 1000}
                disabledReason={renderFailed ? "화면을 복구하려면 다시 접속하세요." : !connected ? "서버에 연결 중입니다. 연결 후 행동할 수 있어요." : loading ? "맵을 준비하고 있습니다." : "요청을 처리하고 있습니다."}
                select={selectField} command={command} walking={walking} walk={() => void run(walk)} encounter={id => void run(() => approachEncounter(id))}
                stop={() => { stopWalking.current = true; setWalking(w => w && { ...w, stopping: true }); }} />
</section>}
            {battle && <BattlePanel battle={battle} actor={state.me.id} monsterLoreLevel={state.me.skills.monster_lore ?? 0} selected={selected}
              disabled={disabled || state.me.requiresStartSpawn} remaining={remaining} onMode={mode => renderer.current?.scene.setBattleMode(mode)}
              select={p => { renderer.current?.scene.selectCell(p); setSelected(p); }} execute={battleCommand} />}
            {!battle && <>
            <section class="card field-help-card" aria-label="필드 도움말 카드"><h3>도움말</h3><TerrainLegend /><p>맵을 클릭하거나 맵에 초점을 맞춘 뒤 방향키로 선택하세요. 맵을 끌어 시점을 이동하고 휠이나 확대·축소 버튼을 사용하세요. ↶·↷ 버튼으로 90도씩 회전하여 높은 지형 뒤를 확인하세요.</p>
            <div class="map-caption">
              <span>
                {battle
                  ? "파랑: 이동 · 번호선: 경로 · 주황: 도착 후 공격 범위"
                  : `내 위치 ${state.me.position.column}, ${state.me.position.row} · ${state.me.mode === "RESERVED" ? "조우 준비 중" : "탐색 중"}`}
              </span>
              <span>
                {selected
                  ? `선택 ${selected.column}, ${selected.row}${state.map.blocked.some(p => same(p, selected)) ? " · 이동 불가" : ""}`
                  : "셀을 선택하세요"}{" "}
                · 방향키 선택 / 휠 확대
              </span>
            </div>
            </section>
            </>}
            {state.me.requiresStartSpawn && <p class="result">정산을 기다린 뒤 시작점에서 입장할 수 있습니다.</p>}
          </section>
        </main>
      )}
          {state && drawer && (inWorld || menuPage) && <WorldDrawer title={drawer === "nearby" ? "주변 탐색과 웨이포인트" : drawer === "party" ? "함께 탐색하기" : "대화"} onClose={() => setDrawer(null)}>
            {drawer === "nearby" && !battle && <FieldPanel state={state} selected={selected} disabled={disabled} now={(clock + serverOffset.current) / 1000}
              select={p => { selectField(p); setDrawer(null); }} command={command} />}
            {drawer === "party" && !battle && (
              <section class="card">
                <h3>
                  함께 탐색하기 <small>{state.members.length}/32</small>
                </h3>
                {state.party ? (
                  <>
                    <p>
                      {t('common.party')}{state.party.members.length}/4 · 파티장{" "}
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
            {drawer === "chat" && <ChatPanel title={battle ? t('common.battleChat') : t('common.channelChat')}
              messages={state.messages} value={chat} disabled={disabled} onChange={setChat}
              onSubmit={() => void run(async () => {
                await client.command("/v1/game/messages", { text: chat });
                setChat("");
              })} />}

            {!battle && state.me.lastResult && (
              <p class="result">
                최근 전투 {RESULT_NAMES[state.me.lastResult.result]} · 재화 +
                {state.me.lastResult.coins}
              </p>
            )}
          </WorldDrawer>}
      <footer role="status">
        <span class={connected ? "status-light" : ""}>●</span>{" "}
        {busy ? "명령 처리 중…" : status}
      </footer>
    </div>
  );
}
