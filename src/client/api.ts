import { getLocale, t } from "../i18n";
import { ApiError, readApiResponse, readApiMessage } from "./response";
export { ApiError } from "./response";
import type { State, Tokens } from "./types";
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";
const HEARTBEAT_MS = 10000;
const RECONNECT_MAX_MS = 5000;
export class Client {
  tokens: Tokens | null = null;
  state: State | null = null;
  private socket: WebSocket | null = null;
  private stopped = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  onState: (state: State) => void = () => {};
  onStatus: (ready: boolean, message: string) => void = () => {};
  async request(path: string, body?: unknown): Promise<any> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.tokens
          ? { Authorization: `Bearer ${this.tokens.access_token}` }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    return readApiResponse(response, getLocale());
  }

  async login(user_id: string, password: string) {
    this.disconnect();
    this.tokens = await this.resolve(
      await this.request("/v1/auth/login", { user_id, password }),
    );
    this.state = await this.request("/v1/game/state");
    this.onState(this.state!);
    this.stopped = false;
    this.scheduleRefresh();
    await this.connect();
  }
  private scheduleRefresh() {
    this.refreshTimer = setTimeout(
      async () => {
        try {
          this.tokens = await this.request("/v1/auth/refresh", {
            refresh_token: this.tokens!.refresh_token,
          });
          this.scheduleRefresh();
        } catch (e) {
          this.disconnect();
          this.onStatus(false, (e as Error).message);
        }
      },
      12 * 60 * 1000,
    );
  }
  accept(state: State) {
    if (state.protocolVersion !== 1)
      throw new Error(t("network.protocol"));
    if (this.state && state.generation < this.state.generation) return;
    if (
      this.state &&
      state.generation === this.state.generation &&
      (state.epoch < this.state.epoch ||
        (state.epoch === this.state.epoch && state.cursor < this.state.cursor))
    )
      return;
    this.state = state;
    this.onState(state);
  }
  async command(path: string, body: Record<string, unknown> = {}) {
    if (!this.state) throw new Error(t("network.stateRequired"));
    const payload = {
      ...body,
      requestId: crypto.randomUUID(),
      expectedVersion: path.includes("/battle/")
        ? this.state.battle?.version
        : this.state.me.version,
    };
    // 전송 결과를 알 수 없을 때 동일한 명령 ID로 한 번만 재시도한다.
    let result;
    try {
      result = await this.request(path, payload);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "VERSION_CONFLICT")
          this.accept(await this.request("/v1/game/state"));
        throw e;
      }
      result = await this.request(path, payload);
    }
    this.accept(result.state);
    return result;
  }
  async connect() {
    if (this.stopped) return;
    try {
      const { ticket } = await this.request("/v1/realtime/tickets", {});
      if (this.stopped) return;
      const url = new URL(`${API_BASE}/v1/realtime`, location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url);
      this.socket = ws;
      ws.onopen = () => ws.send(JSON.stringify({ ticket, protocolVersion: 1 }));
      ws.onmessage = (e) => {
        if (this.socket !== ws) return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "snapshot" || msg.type === "state") {
            this.accept(msg.state);
            this.attempts = 0;
            this.onStatus(true, t("network.connected"));
            if (!this.heartbeatTimer)
              this.heartbeatTimer = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN)
                  ws.send(JSON.stringify({ type: "heartbeat" }));
              }, HEARTBEAT_MS);
          } else if (msg.type === "error") {
            const message = readApiMessage(msg, getLocale());
            if (message === undefined) throw new Error("API 오류 안내가 누락되었습니다.");
            this.onStatus(false, message);
            if (msg.code === "SESSION_EXPIRED") this.disconnect();
          }
        } catch {
          this.onStatus(false, t("network.invalidMessage"));
          ws.close();
        }
      };
      ws.onclose = () => {
        if (this.socket !== ws) return;
        this.clearHeartbeat();
        this.onStatus(false, t("network.reconnecting"));
        this.retry();
      };
      ws.onerror = () => ws.close();
    } catch (e) {
      this.onStatus(false, (e as Error).message);
      if (e instanceof ApiError && e.status === 401) this.disconnect();
      else this.retry();
    }
  }
  private retry() {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(
      () => void this.connect(),
      Math.min(RECONNECT_MAX_MS, 500 * 2 ** this.attempts++) +
        Math.random() * 300,
    );
  }
  private clearHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
  disconnect() {
    this.stopped = true;
    this.clearHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const ws = this.socket;
    this.socket = null;
    ws?.close();
  }
  async resolve(result: any): Promise<any> {
    for (let attempt = 0; result.pending && attempt < 60; attempt++) {
      this.onStatus(false, t("network.transitioning"));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await this.request(
        `/v1/auth/operations/${result.operationId}/resolve`,
        { receipt: result.receipt },
      );
    }
    if (result.pending)
      throw new Error(
        t("network.transitionDelayed"),
      );
    return result;
  }
  async logout() {
    await this.resolve(await this.request("/v1/auth/logout", {}));
    this.disconnect();
    this.tokens = null;
    this.state = null;
  }
}
