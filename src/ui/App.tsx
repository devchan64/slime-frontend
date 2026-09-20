import {WorldMapPanel} from './WorldMapPanel';
import {MainEventJournal} from './MainEventJournal';
import { ActionCutinOverlay } from './ActionCutin';
import { ActionCutinTracker, appendActionCutinQueue, readActionCutinSetting, ACTION_CUTIN_SETTING_KEY, ACTION_CUTIN_DURATION_OPTIONS, parseActionCutinDuration, type ActionCutinDuration, type ActionCutinEvent } from './actionCutins';
import { FieldRestControls } from './FieldRestControls';
import { FieldFirstAid } from './FieldFirstAid';
import { BorrowedLoansPanel } from './BorrowedLoansPanel';
import { AccountRewardsPanel } from "./AccountRewardsPanel";
import { BagPanel } from "./BagPanel";
import { noticeText, LocalizedError, type Notice } from '../client/notice';
import { FieldInterruptionNotice } from './FieldInterruptionNotice';
import { fieldActionContext, canContinueFieldAction } from './fieldActionContext';
import { localizedMonsters } from '../client/monsterText';
import { BattleReport } from "./BattleReport";
import { SponsorGate } from "./SponsorGate";
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
import { FieldMapHelp } from "./FieldMapHelp";
import { CharacterSettings } from "./CharacterSettings";
import { CharacterSelectionCard } from "./CharacterSelectionCard";
import { WorldDrawer } from "./WorldDrawer";
import { BattlePanel } from "./BattlePanel";
import { Client } from "../client/api";
import { watchBrowserResume } from "../client/browserResume";
import { registrationIssue } from "../client/credentials";
import type { Position, State } from "../client/types";
import type { createGame } from "../game/createGame";
const WALK_STEP_DELAY_MS = 270;
const loginIllustration = new URL("../assets/login/slime-welcome-v4.png", import.meta.url).href;
const RESULT_NAMES: Record<string, string> = {
  WIN: "battle.resultWin",
  LOSE: "battle.resultLose",
  TIMEOUT: "battle.resultTimeout",
  SURRENDER: "battle.resultSurrender",
  PREPARATION_FAILED: "battle.resultPreparationFailed",
};
const MAP_ZOOM_STEP = 0.15;
const client = new Client();
export function App() {
  const { t, locale } = useTranslation();
  const [actionCutinDurationSeconds, setActionCutinDurationSeconds] = useState(() => readActionCutinSetting(localStorage));
  const actionCutinEnabledReference = useRef(actionCutinDurationSeconds > 0);
  actionCutinEnabledReference.current = actionCutinDurationSeconds > 0;
  const actionCutinEventTracker = useRef(new ActionCutinTracker());
  const [pendingActionCutinEvents, setPendingActionCutinEvents] = useState<ActionCutinEvent[]>([]);
  const updateActionCutinSetting = (nextDurationSeconds: ActionCutinDuration) => {
    localStorage.setItem(ACTION_CUTIN_SETTING_KEY, String(nextDurationSeconds));
    actionCutinEnabledReference.current = nextDurationSeconds > 0;
    setActionCutinDurationSeconds(nextDurationSeconds);
    if (!nextDurationSeconds) setPendingActionCutinEvents([]);
  };
  const [battleSelectionIntent, setBattleSelectionIntent] = useState(0);
  const battleReportSceneSnapshot = useRef<State | null>(null);
  const [battleReport, setBattleReport] = useState<NonNullable<State["me"]["lastResult"]> | null>(null);
  const [sponsorApproved, setSponsorApproved] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<State['messages']>([]);
  const [state, setState] = useState<State | null>(null),
    [connected, setConnected] = useState(false),
    [statusNotice, setStatus] = useState<Notice>(""),
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
          if (issue) throw new LocalizedError(issue);
          await client.request("/v1/auth/register", { user_id: user, password });
          navigateAuth("login");
          setStatus({key:"auth.registered"});
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
  const settingsAvailable = !battleReport && !!state && !state.battle && !state.me.battleId && state.me.mode !== "IN_BATTLE";
  const menuPage = settingsAvailable && characterRoute === "#/menu";
  const userTermsPage = settingsAvailable && characterRoute === "#/terms";
  const gameSettingsPage = settingsAvailable && characterRoute === "#/settings/game";
  const settingsPage = settingsAvailable && characterRoute === "#/characters/settings";
  const [drawer, setDrawer] = useState<"worldMap" | "nearby" | "party" | "chat" | "bag" | "rewards" | "loans" | "journal" | null>(null);
  useEffect(() => { setDrawer(null); }, [state?.location.id, state?.battle?.id]);
  useEffect(() => { if (state?.reservation) setDrawer("nearby"); }, [state?.reservation?.id]);
  const [renderedLocation, setRenderedLocation] = useState("");
  const [transferPending, setTransferPending] = useState(false);
  const [preparationNotice, setPreparationError] = useState<Notice>("");
  const [renderNotice, setRenderError] = useState<Notice>("");
  const status = noticeText(statusNotice, locale, t);
  const preparationError = noticeText(preparationNotice, locale, t);
  const renderError = noticeText(renderNotice, locale, t);
  const [walking, setWalking] = useState<Walking | null>(null);
  const stopWalking = useRef(false);
  const readyRequest = useRef<string | null>(null);
  const [clock, setClock] = useState(Date.now()),
    [renderFailed, setRenderFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    renderer = useRef<ReturnType<typeof createGame> | null>(null);
  const selectedFieldCommands = useRef<HTMLDivElement>(null);
  const serverOffset = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    client.onState = (s) => {
      serverOffset.current = s.serverTime * 1000 - Date.now();
      const previous = stateRef.current;
      let incomingActionCutinEvents: ReturnType<ActionCutinTracker['collectNewActionCutins']> = [];
      try {
        incomingActionCutinEvents = actionCutinEventTracker.current.collectNewActionCutins(s);
      } catch (currentCutinContractError) {
        // 연출 계약 오류는 표시하되 서버 상태·결과 리포트·스트림 처리를 계속한다.
        setStatus(currentCutinContractError as Error);
        setPendingActionCutinEvents([]);
      }
      if (previous?.me.id !== s.me.id || (s.battle && previous?.battle?.id !== s.battle.id)) setPendingActionCutinEvents([]);
      if (actionCutinEnabledReference.current && incomingActionCutinEvents.length) {
        setPendingActionCutinEvents(currentActionCutinQueue => appendActionCutinQueue(currentActionCutinQueue, incomingActionCutinEvents));
      }
      if (s.me.lastFieldInterruption?.battleId
          && s.me.lastFieldInterruption.battleId !== previous?.me.lastFieldInterruption?.battleId) {
        stopWalking.current = true;
        setWalking(null);
      }
      // 서버가 확정한 진행 전투는 로컬 캐릭터 선택 상태보다 우선한다.
      // 새 필드 입장 명령 없이 기존 전투의 렌더·READY·조작을 복구한다.
      if (s.battle && s.me.mode === "IN_BATTLE" && s.me.battleId === s.battle.id) {
        setWorldGeneration(s.generation);
        if (location.hash !== "#/world") navigateCharacterPage("#/world");
      }
      const result = s.me.lastResult;
      if (previous?.me.id === s.me.id && s.me.mode === "FIELD" && !s.me.battleId && result?.battleId
          && result.battleId !== previous.me.lastResult?.battleId) {
        battleReportSceneSnapshot.current = previous;
        setBattleReport(result);
      }
      stateRef.current = s;
      setState(s);
    };
    client.onStatus = (ready, msg) => {
      if (!ready) {
        actionCutinEventTracker.current = new ActionCutinTracker();
        setPendingActionCutinEvents([]);
      }
      setConnected(ready);
      setStatus(msg);
    };
    client.onChat = setChatMessages;
    client.onChatStatus = ready => { if (!ready) setSponsorApproved(null); };
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const stopResume = watchBrowserResume(document, window, () => {
      stopWalking.current = true;
      void client.resumeSession();
    });
    return () => {
      stopResume();
      clearInterval(timer);
      client.disconnect();
    };
  }, []);
  useEffect(() => {
    setSelected(null);
    renderer.current?.scene.selectCell(null);
  }, [state?.generation, state?.location.id, state?.map.id, state?.battle?.id, state?.battle?.turnId]);
  const battleReportIsReady = !!battleReport && pendingActionCutinEvents.length === 0;
  const inWorld = !battleReportIsReady && !menuPage && !userTermsPage && !settingsPage && !gameSettingsPage && !!state && worldGeneration === state.generation && state.me.mode !== "LOBBY" && state.me.mode !== "AWAY";
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
      setRenderError({key:"app.webglReconnect"});
      setStatus({key:"app.webglReconnect"});
    };
    void import("../game/createGame")
      .then(({ createGame }) => {
        if (disposed || !container.current) return;
        renderer.current = createGame(container.current, position => { setSelected(position); setBattleSelectionIntent(value => value + 1); }, setRenderedLocation, message => {
          setRenderFailed(true);
          setRenderError(message);
          setStatus(message);
        });
        const initialSceneSnapshot = (battleReport ? battleReportSceneSnapshot.current : null) ?? stateRef.current;
        if (initialSceneSnapshot) renderer.current.scene.setState(localizedMonsters({...initialSceneSnapshot,
          map: localizedFieldMap(initialSceneSnapshot.map, getLocale())}, getLocale()));
        canvas = renderer.current.game.canvas;
        canvas.addEventListener("webglcontextlost", lost);
      })
      .catch(() => {
        setRenderFailed(true);
        client.disconnect();
        setRenderError({key:"app.webglUnsupported"});
        setStatus({key:"app.webglUnsupported"});
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
    const currentSceneSnapshot = (battleReport ? battleReportSceneSnapshot.current : null) ?? state;
    if (currentSceneSnapshot) renderer.current?.scene.setState(localizedMonsters({...currentSceneSnapshot, map: localizedFieldMap(currentSceneSnapshot.map, locale)}, locale));
  }, [state, locale, battleReport]);
  useEffect(() => {
    if (inWorld && selected && !state?.battle) {
      selectedFieldCommands.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
  }, [selected, inWorld, state?.battle?.id]);
  const sponsorKey = state ? `${state.generation}:${state.epoch}:${state.location.id}` : '';
  const sponsorPending = inWorld && sponsorApproved !== sponsorKey;
  const loadingRequested = !battleReport && (transferPending || (inWorld &&
    (sponsorPending || renderedLocation !== state.location.id || !connected || state.battle?.status === "PREPARING")));
  const { loading, minimumElapsed } = useMinimumLoading(loadingRequested);
  useEffect(() => {
    const battle = state?.battle;
    if (!battle || battle.status !== "PREPARING" || sponsorPending || !minimumElapsed || !connected || renderFailed ||
        renderedLocation !== state.location.id || !state.location.roomReady ||
        state.me.requiresStartSpawn || battle.ready?.includes(state.me.id) || readyRequest.current) return;
    const id = battle.id;
    readyRequest.current = id;
    setPreparationError("");
    void client.command("/v1/game/battle/commands", { action: { type: "READY", battleId: id } })
      .catch(e => { if (stateRef.current?.battle?.id === id) setPreparationError(e as Error); })
      .finally(() => { if (readyRequest.current === id) readyRequest.current = null; });
  }, [state, connected, renderedLocation, renderFailed, clock, minimumElapsed, sponsorPending]);
  async function run(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setStatus(e as Error);
    } finally {
      setBusy(false);
    }
  }
  const command = (path: string, body: Record<string, unknown> = {}, currentResultHandler?: (currentCommandResult: any) => void) =>
    run(async () => {
      const transfer = ["/v1/world/enter", "/v1/maps/transitions", "/v1/game/encounters/reserve", "/v1/game/encounters/ready"].includes(path);
      if (transfer) setTransferPending(true);
      try {
        const result = await client.command(path, body);
        currentResultHandler?.(result);
        if (path === "/v1/characters/me") { setCharacterPage("select"); setName(""); }
        if (path === "/v1/world/enter") { setWorldGeneration(result.state.generation); navigateCharacterPage("#/world"); }
        if (path === "/v1/world/resume") navigateCharacterPage("#/menu");
        return result;
      }
      finally { if (transfer) setTransferPending(false); }
    });
  async function walk(requestedWalkingDestination: Position | null = selected) {
    if (!state || !requestedWalkingDestination) return;
    selectField(requestedWalkingDestination);
    const steps = fieldRoute(state.me.position, requestedWalkingDestination, state.map);
    if (!steps) throw new LocalizedError("app.noRouteError");
    const context = fieldActionContext(state);
    stopWalking.current = false;
    setWalking({ completed: 0, total: steps.length, stopping: false });
    try {
      for (let i = 0; i < steps.length; i++) {
        const current = client.state;
        if (stopWalking.current || !canContinueFieldAction(context, current)) break;
        if (current.me.healthRecoveryPending) throw new LocalizedError("field.recoveryPending");
        if (!current.map.safeTown && current.me.fp !== undefined && current.me.fp < 1) throw new LocalizedError("app.movementFpError");
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
  const disabled = !!battleReport || busy || !connected || renderFailed || loading || pendingActionCutinEvents.length > 0;
  const battle = (battleReport ? battleReportSceneSnapshot.current : state)?.battle,
    turn = battle?.units.find((u) => u.id === battle.order[battle.index]);
  const battleCommand = (type: string, targetId?: string, selectedActionIdentifier?: string) =>
    command("/v1/game/battle/commands", {
      action: {
        type,
        turnId: battle?.turnId,
        ...(targetId ? { targetId } : {}),
        ...(selectedActionIdentifier ? { actionId: selectedActionIdentifier } : {}),
        ...(type === "MOVE" ? { position: selected } : {}),
      },
    });
  return (
    <div class={`app-shell ${!state ? "login-shell" : inWorld ? "world-shell" : ""}`}>
      {loading && !battleReport && <div class="location-loading" role="dialog" aria-modal="true" aria-label={t('app.loadingRegion')}>
        <section class="loading-card" aria-live="polite">
          <h2>{renderFailed ? t('app.loadingFailed') : t('app.loading')}</h2>
          <FieldInterruptionNotice interruption={state?.me.lastFieldInterruption} battleId={battle?.id} />
          {preparationError && <p role="alert">{preparationError}</p>}
          {sponsorPending && state && <SponsorGate key={sponsorKey} client={client}
            generation={state.generation} epoch={state.epoch} room={state.location.chatRoomId}
            onReady={() => {
              const current = stateRef.current;
              if (current && `${current.generation}:${current.epoch}:${current.location.id}` === sponsorKey)
                setSponsorApproved(sponsorKey);
            }} onExit={() => void run(async () => {
              if (!await client.logout()) return; setBattleReport(null); setState(null); setWorldGeneration(null);
              setConnected(false); setPassword('');
            })} />}
          {renderFailed || !connected ? <><p>{renderError || status}</p><button onClick={() => location.reload()}>{t('app.reconnect')}</button></> : null}
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
                {key:"app.sessionRelogin"},
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
                if (!await client.logout()) return;
                setBattleReport(null);
                setState(null);
                setWorldGeneration(null);
                navigateCharacterPage("#/characters");
                setConnected(false);
                setStatus({key:"app.loggedOut"});
                setPassword("");
              })
            }
          >
            {t('common.logout')}</button>
        )}
      </header>
      {!loading && <FieldInterruptionNotice interruption={state?.me.lastFieldInterruption} battleId={battle?.id} />}
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
      ) : battleReportIsReady ? (
        <main aria-label={t('app.reportRegion')} />
      ) : state.me.mode === "AWAY" ? (
        <AchievementsPage client={client} disabled={busy || !connected} onReturn={() => command("/v1/world/resume")} />
      ) : menuPage ? (
        <main class="lobby field-menu-page">
          <section class="card">
            <div class="field-card-heading"><h1>{t('app.menu')}</h1><button class="secondary" onClick={() => navigateCharacterPage("#/world")}>{t('app.backToMap')}</button></div>
            <nav class="field-menu-actions" aria-label={t('app.gameMenu')}>
              <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("bag")}>{t("app.bag")}</button>
              <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("rewards")}>{t("rewards.title")}</button>
              <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("journal")}>{t("journal.title")}</button>
              <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("loans")}>{t("loans.title")}</button>
              <button class="secondary" onClick={() => navigateCharacterPage("#/settings/game")}>{t("cutins.settings")}</button>
              <button class="secondary" onClick={() => navigateCharacterPage("#/terms")}>{t("terms.title")}</button>
              <button class="secondary" onClick={() => navigateCharacterPage("#/characters/settings")}>{t('common.settings')}</button>
              <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("party")}>{t('common.party')}{state.invitations.length > 0 ? t('app.invitationCount',{count:state.invitations.length}) : ""}</button>
              <button class="secondary" disabled={disabled || state.me.mode !== "FIELD"} onClick={() => command("/v1/world/away")}>{t('common.achievements')}</button>
            </nav>
          </section>
        </main>
      ) : userTermsPage ? (
        <main class="lobby field-menu-page"><article class="card" aria-labelledby="user-terms-title">
          <div class="field-card-heading"><h1 id="user-terms-title">{t('terms.title')}</h1>
            <button class="secondary" onClick={() => navigateCharacterPage("#/menu")}>{t('terms.backToMenu')}</button></div>
          <h2>{t('terms.operationHeading')}</h2>
          <p>{t('terms.operationPolicy')}</p>
          <p>{t('terms.pendingNotice')}</p>
          <h2>{t('terms.reportHeading')}</h2>
          <p>{t('terms.reportPolicy')}</p>
          <p>{t('terms.reportDetails')}</p>
          <h2>{t('terms.retentionHeading')}</h2>
          <p>{t('terms.retentionPolicy')}</p>
          <p>{t('terms.supportLimits')}</p>
          <h2>{t('terms.dataLossHeading')}</h2>
          <p>{t('terms.dataLossPolicy')}</p>
        </article></main>
      ) : gameSettingsPage ? (
        <main class="lobby field-menu-page"><section class="card">
          <div class="field-card-heading"><h1>{t('cutins.settings')}</h1>
            <button class="secondary" onClick={() => navigateCharacterPage("#/menu")}>{t('app.menu')}</button></div>
          <label class="action-cutin-setting">{t('cutins.show')}
            <select value={actionCutinDurationSeconds}
              onChange={settingChangeEvent => updateActionCutinSetting(parseActionCutinDuration(settingChangeEvent.currentTarget.value))}>
              {ACTION_CUTIN_DURATION_OPTIONS.map(actionCutinOptionSeconds => <option key={actionCutinOptionSeconds} value={actionCutinOptionSeconds}>
                {actionCutinOptionSeconds === 0 ? t('cutins.off') : t('cutins.seconds', { seconds: actionCutinOptionSeconds })}
              </option>)}
            </select>
          </label>
          <p>{t('cutins.help')}</p>
        </section></main>
      ) : settingsPage ? (
        <main class="lobby character-lobby">
          <section class="card">
            <h1>{t('common.settings')}</h1>
            <nav class="character-settings-navigation" aria-label={t('app.characterNavigation')}>
            <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("rewards")}>{t("rewards.title")}</button>
            <button class="secondary" disabled={busy} onClick={() => {
              setCharacterPage("select");
              navigateCharacterPage(worldGeneration === state.generation && state.me.mode !== "LOBBY" ? "#/menu" : "#/characters");
            }}>{worldGeneration === state.generation && state.me.mode !== "LOBBY" ? t('app.back') : t('app.characterSelectLink')}</button>
            </nav>
            <CharacterSettings me={state.me} disabled={disabled} command={command} gameSessionClient={client} expanded />
          </section>
        </main>
      ) : !inWorld ? (
        <main class={`lobby ${state.me.name ? "character-lobby" : ""}`}>
          <section class="card">
            <h1>{characterPage === "select" ? t('app.characterSelect') : characterPage === "create" ? t('app.characterCreate') : t('common.settings')}</h1>
            {characterPage === "select" ? (
              state.me.name ? <>
                <CharacterSelectionCard currentPlayerState={state.me} actionsAreDisabled={disabled}
                  openCharacterSettings={() => navigateCharacterPage("#/characters/settings")}
                  openAccountRewards={() => setDrawer("rewards")}
                  enterCurrentWorld={() => command("/v1/world/enter")} />
                <p class="growth-help">{t('app.characterLimit')}</p>
              </> : <div class="character-select-empty">
                <p>{t('app.noCharacter')}</p>
                <button disabled={disabled} onClick={() => setCharacterPage("create")}>{t('app.characterCreate')}</button>
                <p class="growth-help">{t('app.createLimit')}</p>
              </div>
            ) : characterPage === "create" && !state.me.name ? (
              <form onSubmit={event => { event.preventDefault(); if (!disabled && name.trim()) void command("/v1/characters/me", { character_name: name.trim() }); }}>
                <label>{t('common.characterName')}<input aria-label={t('common.characterName')} maxLength={20} value={name}
                  disabled={busy} onInput={event => setName(event.currentTarget.value)} autoFocus /></label>
                <button type="submit" disabled={disabled || !name.trim()}>{busy ? t('app.creating') : t('app.characterCreate')}</button>
                <button type="button" class="secondary" disabled={busy} onClick={() => setCharacterPage("select")}>{t('app.characterSelectLink')}</button>
              </form>
            ) : <>
              <button class="secondary" disabled={busy} onClick={() => setCharacterPage("select")}>{t('app.characterSelectLink')}</button>
              <CharacterSettings me={state.me} disabled={disabled} command={command} gameSessionClient={client} expanded />
            </>}
            {state.me.lastResult && (
              <p class="result">
                {t('app.resultSummary',{result:RESULT_NAMES[state.me.lastResult.result] ? t(RESULT_NAMES[state.me.lastResult.result]) : state.me.lastResult.result,coins:state.me.lastResult.coins})}
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
                    ? t('app.battleHeading',{name:battle.field.name || t('app.battlefield'),round:battle.round})
                    : localizedMapName(state.map.name, state.map.nameTranslations, locale)}
                </h2>
              </div>
              <nav class="map-menu" aria-label={t('app.mapMenu')}>
                <span class="world-resources">{state.me.name} · CP {state.me.cp} · ◈ {state.me.coins}</span>
              </nav>
              {!battle && <FieldPoints fp={state.me.fp} max={state.me.fpMax} hp={state.me.hp} maxHp={state.me.maxHp} healthRecoveryPending={state.me.healthRecoveryPending} nextChargeAt={state.me.fpNextChargeAt} now={(clock + serverOffset.current) / 1000} />}
            </div>
            <div class={`map-stage card ${battle ? "battle-map-card" : "field-map-card"}`} role="region" aria-label={battle ? t('app.battleMap') : t('app.fieldMap')}>
              <nav class="map-camera-controls" aria-label={t('app.cameraControls')}>              <button class="secondary compact" aria-label={t('app.zoomOut')} onClick={() => renderer.current?.scene.adjustZoom(-MAP_ZOOM_STEP)}>−</button>
              <button class="secondary compact" aria-label={t('app.zoomIn')} onClick={() => renderer.current?.scene.adjustZoom(MAP_ZOOM_STEP)}>＋</button>
              <button class="secondary compact" aria-label={t('app.rotateLeft')} onClick={() => renderer.current?.scene.rotateMap(-1)}>↶</button>
              <button class="secondary compact" aria-label={t('app.rotateRight')} onClick={() => renderer.current?.scene.rotateMap(1)}>↷</button>
              <button
                class="secondary compact"
                aria-label={t('app.resetView')} title={t('app.resetView')}
                onClick={() => renderer.current?.scene.resetCameraView()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><circle cx="12" cy="12" r="1" /></svg>
              </button>
</nav>
              <div class="canvas-wrap" ref={container} tabIndex={0} role="region" aria-label={t('app.mapExplore')} />
      {actionCutinDurationSeconds !== 0 && pendingActionCutinEvents[0] && <ActionCutinOverlay key={pendingActionCutinEvents[0].actionId}
        actionCutinEventRecord={pendingActionCutinEvents[0]} actionCutinDurationSeconds={actionCutinDurationSeconds}
        finishActionCutinDisplay={() => {
          const displayedActionIdentity = pendingActionCutinEvents[0].actionId;
          setPendingActionCutinEvents(currentActionCutinQueue => currentActionCutinQueue[0]?.actionId === displayedActionIdentity
            ? currentActionCutinQueue.slice(1) : currentActionCutinQueue);
        }} />}
</div>
            {!battle && <section class="card field-command-dock field-control-card" aria-label={t('app.fieldControls')}>
              <div class="field-card-heading"><div class="field-control-actions">
              <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("chat")}>{t('common.channelChat')}</button>
                <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("nearby")}>{state.reservation ? t('common.encounter') : t('common.nearby')}</button>
                <button class="secondary" aria-haspopup="dialog" onClick={() => setDrawer("worldMap")}>{t('app.worldMap')}</button>
                <button class="secondary" disabled={loading} onClick={() => navigateCharacterPage("#/menu")}>{t('app.menu')}</button>
              <FieldRestControls currentPlayerState={state.me} currentServerTime={(clock + serverOffset.current) / 1000}
                actionsAreDisabled={disabled || !!walking} submitRestCommand={commandPathValue => command(commandPathValue)} />
              </div></div>
              <div class="field-support-actions"><FieldFirstAid currentGameState={state} actionsAreDisabled={disabled || !!walking}
                submitFirstAidCommand={() => command('/v1/game/skills/first-aid')} /></div>
              <div ref={selectedFieldCommands} class="field-selected-commands">
              <FieldSelection state={state} selected={selected} disabled={disabled} gameSessionClient={client} now={(clock + serverOffset.current) / 1000}
                disabledReason={renderFailed ? t('app.reconnectHelp') : !connected ? t('app.connectingHelp') : loading ? t('app.preparingMap') : t('app.processing')}
                select={selectField} command={command} walking={walking} walk={requestedWalkingDestination => void run(()=>walk(requestedWalkingDestination))} encounter={id => void run(() => approachEncounter(id))}
                stop={() => { stopWalking.current = true; setWalking(w => w && { ...w, stopping: true }); }} />
              </div>
              <FieldEventShortcuts state={state} selected={selected} select={selectField} disabled={loading || !!walking} />

</section>}
            {battle && <BattlePanel me={state.me} battle={battle} selectionIntent={battleSelectionIntent} actor={state.me.id} monsterLoreLevel={state.me.skillUseLocks?.monster_lore ? 0 : state.me.skills.monster_lore ?? 0} selected={selected}
              disabled={disabled || state.me.requiresStartSpawn} onMode={mode => renderer.current?.scene.setBattleMode(mode)}
              select={p => { renderer.current?.scene.selectCell(p); setSelected(p); }} execute={battleCommand} />}
            {!battle && <>
            <FieldMapHelp currentFieldState={state} selectedFieldPosition={selected} />
            </>}
            {state.me.requiresStartSpawn && <p class="result">{t('app.settlementHelp')}</p>}
          </section>
        </main>
      )}
          {state && drawer && (inWorld || menuPage || drawer === "rewards") && <WorldDrawer title={drawer === "worldMap" ? t("app.worldMap") : drawer === "journal" ? t("journal.title") : drawer === "loans" ? t("loans.title") : drawer === "rewards" ? t("rewards.title") : drawer === "bag" ? t("app.bag") : drawer === "nearby" ? t('app.nearbyHeading') : drawer === "party" ? t('app.partyHeading') : t('app.chat')} onClose={() => setDrawer(null)}>
            {drawer === "worldMap" && <WorldMapPanel key={`${state.me.id}:${state.generation}`} gameSessionClient={client} currentMapIdentifier={state.map.id} />}
            {drawer === "bag" && <BagPanel key={`${state.me.id}:${state.generation}`} me={state.me} gameSessionClient={client}
              actionsAreDisabled={disabled || !!walking} submitConsumableUse={currentItemIdentifier => command('/v1/game/consumables/use',{itemId:currentItemIdentifier})} />}
            {drawer === "journal" && <MainEventJournal key={`${client.tokens?.user_id}:${state.generation}:${state.me.id}`} gameSessionClient={client} actionsAreDisabled={busy || !connected} />}
            {drawer === "loans" && <BorrowedLoansPanel key={`${client.tokens?.user_id}:${state.generation}`} gameSessionClient={client} actionsAreDisabled={busy || !connected} />}
            {drawer === "rewards" && <AccountRewardsPanel key={`${client.tokens?.user_id}:${state.generation}`} gameSessionClient={client} actionsAreDisabled={busy || !connected} />}
            {drawer === "nearby" && !battle && <FieldPanel state={state} selected={selected} disabled={disabled} now={(clock + serverOffset.current) / 1000}
              select={p => { selectField(p); setDrawer(null); }} command={command} />}
            {drawer === "party" && !battle && (
              <section class="card">
                <h3>
                  {t('app.partyHeading')} <small>{state.members.length}/32</small>
                </h3>
                {state.party ? (
                  <>
                    <p>
                      {t('app.partySummary',{count:state.party.members.length,leader:state.party.leader})}
                    </p>
                    <button
                      class="secondary"
                      disabled={disabled}
                      onClick={() =>
                        command("/v1/game/party/commands", { action: "LEAVE" })
                      }
                    >
                      {t('app.leaveParty')}
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
                        {t('app.disbandParty')}
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
                    {t('app.createParty')}
                  </button>
                )}
                {state.members
                  .filter((m) => m.id !== state.me.id)
                  .map((m) => (
                    <div class="monster-row">
                      <span>{m.name}{state.party?.leader === state.me.id && !state.party.members.includes(m.id) && m.partyCpEligible === false && <small class="muted"> · {t('app.partyCpOutOfRange')}</small>}</span>
                      <button
                        class="compact secondary"
                        disabled={
                          disabled || state.party?.leader !== state.me.id
                          || (!state.party.members.includes(m.id) && m.partyCpEligible === false)
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
                        {state.party?.members.includes(m.id) ? t('app.kick') : t('app.invite')}
                      </button>
                    </div>
                  ))}
                {state.invitations.map((i) => (
                  <button
                    disabled={disabled || i.partyCpEligible === false}
                    onClick={() =>
                      command("/v1/game/party/commands", {
                        action: "ACCEPT",
                        invitationId: i.id,
                      })
                    }
                  >
                    {t('app.acceptInvitation',{name:i.from})}
                    {i.partyCpEligible === false && <small> · {t('app.partyCpOutOfRange')}</small>}
                  </button>
                ))}
              </section>
            )}
            {drawer === "chat" && <ChatPanel title={battle ? t('common.battleChat') : t('common.channelChat')}
              messages={chatMessages} value={chat} disabled={disabled || sponsorApproved !== sponsorKey} onChange={setChat}
              onSubmit={() => void run(async () => {
                await client.command("/v1/game/messages", { text: chat });
                setChat("");
              })} />}

            {!battle && state.me.lastResult && (
              <p class="result">
                {t('app.recentBattle')} {t('app.resultSummary',{result:RESULT_NAMES[state.me.lastResult.result] ? t(RESULT_NAMES[state.me.lastResult.result]) : state.me.lastResult.result,coins:state.me.lastResult.coins})}
              </p>
            )}
          </WorldDrawer>}
      {battleReportIsReady && battleReport && <BattleReport key={battleReport.battleId} result={battleReport} onReturn={() => {
        battleReportSceneSnapshot.current = null;
        setRenderedLocation("");
        setSponsorApproved(null);
        setBattleReport(null);
        navigateCharacterPage("#/world");
      }} />}
      <footer role="status">
        <span class={connected ? "status-light" : ""}>●</span>{" "}
        {busy ? t('app.commandBusy') : status}
      </footer>
    </div>
  );
}
