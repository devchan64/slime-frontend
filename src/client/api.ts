import { watchUserActivity } from "./userActivity";
import { LocalizedError, type Notice } from './notice';
import { getLocale } from "../i18n";
import { ApiError, readApiResponse, readApiMessage } from "./response";
export { ApiError } from "./response";
import type { State, Tokens } from "./types";
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";
const HEARTBEAT_MS = 10000;
const SOCKET_RESPONSE_TIMEOUT_MS = 30000;
const RECONNECT_MAX_MS = 5000;
const STREAM_PROGRESS_WAIT_MS = 5000;
const ACK_BATCH_MS = 250;
const REQUEST_TIMEOUT_MS = 30000;
type StreamMark = Pick<State, "generation" | "epoch" | "cursor">;
export class Client {
  tokens: Tokens | null = null;
  state: State | null = null;
  private socket: WebSocket | null = null;
  private connectionAttempt = 0;
  private sessionRevision = 0;
  private stopActivity: (() => void) | null = null;
  private stopped = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private ackTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAck: Pick<State, "epoch" | "cursor"> | null = null;
  private progressTimer: ReturnType<typeof setTimeout> | null = null;
  private progressHead: StreamMark | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshRequest: Promise<boolean> | null = null;
  private resumeRequest: Promise<void> | null = null;
  private attempts = 0;
  private chatSocket: WebSocket | null = null;
  private chatHeartbeat: ReturnType<typeof setInterval> | null = null;
  onChat: (messages: State['messages']) => void = () => {};
  onChatStatus: (ready: boolean) => void = () => {};
  onState: (state: State) => void = () => {};
  onStatus: (ready: boolean, message: Notice) => void = () => {};
  async request(path: string, body?: unknown): Promise<any> {
    const sessionRevision=this.sessionRevision;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
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
        signal: controller.signal,
      });
      return await readApiResponse(response, getLocale(), path === "/v1/game/state" ? "state" : "message");
    } catch (error) {
      // 전송 취소는 서버의 명령 취소·실패 확정을 뜻하지 않는다.
      if (controller.signal.aborted) throw new LocalizedError('network.requestTimeout');
      if (sessionRevision===this.sessionRevision && error instanceof ApiError && error.code === "IDLE_DISCONNECTED") {
        this.disconnect(); this.onStatus(false, error);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async login(user_id: string, password: string): Promise<boolean> {
    this.disconnect();
    const revision=this.sessionRevision;
    try {
      const response=await this.request("/v1/auth/login", {user_id,password});
      if (revision!==this.sessionRevision) return false;
      const tokens=await this.resolve(response,revision);
      if (revision!==this.sessionRevision) return false;
      this.tokens=tokens;
      const state=await this.request("/v1/game/state");
      if (revision!==this.sessionRevision) return false;
      this.state=state;
      this.onState(state);
      this.stopped=false;
      this.scheduleRefresh();
      await this.connect();
      return revision===this.sessionRevision;
    } catch (error) {
      if (revision!==this.sessionRevision) return false;
      throw error;
    }
  }
  private scheduleRefresh() {
    const sessionRevision=this.sessionRevision;
    if (this.refreshTimer !== null) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(
      async () => {
        if (this.stopped || sessionRevision!==this.sessionRevision) return;
        this.refreshTimer=null;
        await this.refreshTokens();
      },
      12 * 60 * 1000,
    );
  }
  private refreshTokens(): Promise<boolean> {
    if (this.refreshRequest) return this.refreshRequest;
    const sessionRevision=this.sessionRevision;
    const request=(async () => {
      if (this.stopped || !this.tokens) return false;
      try {
        const tokens = await this.request("/v1/auth/refresh", {
          refresh_token: this.tokens.refresh_token,
        });
        if (this.stopped || sessionRevision!==this.sessionRevision) return false;
        this.tokens=tokens;
        this.scheduleRefresh();
        return true;
      } catch (e) {
        if (this.stopped || sessionRevision!==this.sessionRevision) return false;
        this.disconnect();
        this.onStatus(false, e as Error);
        return false;
      }
    })();
    this.refreshRequest=request;
    void request.finally(() => { if (this.refreshRequest===request) this.refreshRequest=null; });
    return request;
  }
  resumeSession(): Promise<void> {
    if (this.stopped || !this.tokens) return Promise.resolve();
    if (this.resumeRequest) return this.resumeRequest;
    const revision=this.sessionRevision;
    // 절전 중 살아 있는 것처럼 보이는 소켓도 폐기하고 서버 승인 뒤 조작을 연다.
    this.connectionAttempt++;
    const previous=this.socket;this.socket=null;
    this.clearHeartbeat();previous?.close();
    if (this.reconnectTimer!==null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer=null;
    this.stopActivity?.();this.stopActivity=null;
    this.disconnectChat();
    this.onStatus(false,{key:'network.reconnecting'});
    const request=(async () => {
      if (!await this.refreshTokens() || this.stopped || revision!==this.sessionRevision) return;
      await this.connect();
    })();
    this.resumeRequest=request;
    void request.finally(() => { if (this.resumeRequest===request) this.resumeRequest=null; });
    return request;
  }
  accept(state: State) {
    if (state.protocolVersion !== 1)
      throw new LocalizedError("network.protocol");
    if (this.state && state.generation < this.state.generation) return;
    if (
      this.state &&
      state.generation === this.state.generation &&
      (state.epoch < this.state.epoch ||
        (state.epoch === this.state.epoch && state.cursor < this.state.cursor))
    )
      return;
    if (this.state && (state.generation !== this.state.generation || state.epoch !== this.state.epoch
        || state.location.id !== this.state.location.id)) this.disconnectChat();
    this.state = state;
    if (!this.isBehindHead()) this.clearProgress();
    this.onState(state);
  }
  async command(path: string, body: Record<string, unknown> = {}) {
    if (!this.state) throw new LocalizedError("network.stateRequired");
    const revision=this.sessionRevision;
    const assertCurrent=()=>{
      if (revision!==this.sessionRevision) throw new LocalizedError('network.sessionChanged');
    };
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
      assertCurrent();
      if (e instanceof ApiError) {
        if (e.code === "VERSION_CONFLICT") {
          const state=await this.request("/v1/game/state");
          assertCurrent();
          this.accept(state);
        }
        throw e;
      }
      result = await this.request(path, payload);
    }
    assertCurrent();
    this.accept(result.state);
    return result;
  }
  async connect() {
    if (this.stopped) return;
    const attempt=++this.connectionAttempt;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer=null;
    try {
      const { ticket, resumeSupported, ackSupported } = await this.request("/v1/realtime/tickets", {});
      if (this.stopped || attempt!==this.connectionAttempt) return;
      const previous=this.socket;this.socket=null;
      this.clearHeartbeat();previous?.close();
      const url = new URL(`${API_BASE}/v1/realtime`, location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url);
      this.socket = ws;
      let lastResponseAt = performance.now();
      let verified = false;
      // close 이벤트가 오지 않는 연결·초기 승인 대기도 제한한다.
      this.heartbeatTimer = setInterval(() => {
        if (this.socket !== ws || this.stopped) return;
        if (performance.now() - lastResponseAt >= SOCKET_RESPONSE_TIMEOUT_MS) {
          this.reconnectSocket(ws, {key: 'network.reconnecting'});
          return;
        }
        if (verified && ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({type: 'heartbeat'}));
      }, HEARTBEAT_MS);
      let resume: Pick<State, 'generation' | 'epoch' | 'cursor'> | undefined;
      ws.onopen = () => {
        if (this.socket !== ws || this.stopped) return;
        if (resumeSupported === true && this.state) {
          const {generation, epoch, cursor} = this.state;
          resume = {generation, epoch, cursor};
        }
        ws.send(JSON.stringify({ticket, protocolVersion: 1, ...(resume ? {resume} : {})}));
      };
      ws.onmessage = (e) => {
        if (this.socket !== ws) return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "snapshot" || msg.type === "state" || msg.type === "resumed") {
            if (msg.type === 'resumed') {
              if (!resume || !this.state || msg.generation !== resume.generation
                  || msg.epoch !== resume.epoch || msg.cursor !== resume.cursor)
                throw new Error('복구 승인 순번이 요청과 다릅니다.');
            } else {
              if (msg.type === 'state' && this.state && msg.state.generation === this.state.generation
                  && msg.state.epoch === this.state.epoch && msg.state.cursor > this.state.cursor + 1)
                throw new Error('실시간 상태 순번이 누락되었습니다.');
              this.accept(msg.state);
            }
            if (ackSupported === true) this.queueAcknowledgement(msg.type === 'resumed' ? msg : msg.state, ws);
            this.attempts = 0;
            this.onStatus(true, {key: "network.connected"});
            if (!this.stopActivity) this.stopActivity = watchUserActivity(document, () => {
              if (this.socket?.readyState === WebSocket.OPEN)
                this.socket.send(JSON.stringify({type: "activity"}));
            });
            lastResponseAt = performance.now();
            verified = true;
          } else if (msg.type === 'heartbeat') {
            this.observeHead(msg.epoch, msg.cursor, ws);
            if (verified) lastResponseAt = performance.now();
          } else if (msg.type === "error") {
            const message = readApiMessage(msg, getLocale());
            if (message === undefined) throw new Error("API 오류 안내가 누락되었습니다.");
            this.onStatus(false, new ApiError(msg.code ?? "REQUEST_FAILED", message, 0, msg.messages));
            if (msg.code === "SESSION_EXPIRED" || msg.code === "IDLE_DISCONNECTED") this.disconnect();
          }
        } catch {
          this.reconnectSocket(ws, {key: "network.invalidMessage"});
        }
      };
      ws.onclose = () => {
        this.reconnectSocket(ws, {key: "network.reconnecting"});
      };
      ws.onerror = () => this.reconnectSocket(ws, {key: "network.reconnecting"});
    } catch (e) {
      if (this.stopped || attempt!==this.connectionAttempt) return;
      this.onStatus(false, e as Error);
      if (e instanceof ApiError && (e.status === 401 || e.code === "IDLE_DISCONNECTED")) this.disconnect();
      else this.retry();
    }
  }
  private reconnectSocket(socket: WebSocket, notice: Notice) {
    if (this.socket !== socket || this.stopped) return;
    this.socket = null;
    this.clearHeartbeat();
    this.onStatus(false, notice);
    // 이전 연결의 close 응답을 기다리지 않고 현재 cursor로 복구한다.
    socket.close();
    this.retry();
  }
  private retry() {
    if (this.stopped) return;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(
      () => void this.connect(),
      Math.min(RECONNECT_MAX_MS, 500 * 2 ** this.attempts++) +
        Math.random() * 300,
    );
  }
  async connectChat() {
    this.disconnectChat();
    const state = this.state;
    if (!state || this.stopped) throw new Error('세션이 없습니다.');
    const { ticket } = await this.request('/v1/chat/tickets', {});
    if (this.stopped || this.state?.generation !== state.generation || this.state?.epoch !== state.epoch
        || this.state?.location.id !== state.location.id) throw new Error('광고 확인 중 맵이 변경되었습니다.');
    const url = new URL(`${API_BASE}/v1/chat/realtime`, location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.chatSocket = socket;
    await new Promise<void>((resolve, reject) => {
      let ready = false;
      const timeout = setTimeout(() => socket.close(), 10000);
      socket.onopen = () => socket.send(JSON.stringify({ ticket, protocolVersion: 1 }));
      socket.onmessage = event => {
        if (this.chatSocket !== socket) return;
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === 'error' && frame.code === 'IDLE_DISCONNECTED') {
            const error = new ApiError(frame.code, readApiMessage(frame, getLocale()) ?? frame.code, 409, frame.messages);
            this.disconnect(); this.onStatus(false, error); reject(error); return;
          }
          if (frame.type !== 'chat' || frame.generation !== state.generation || frame.epoch !== state.epoch
              || frame.room !== state.location.chatRoomId || !Array.isArray(frame.messages)) throw new Error('채팅 입장 검증에 실패했습니다.');
          this.onChat(frame.messages);
          if (!ready) {
            ready = true; clearTimeout(timeout);
            this.chatHeartbeat = setInterval(() => {
              if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:'heartbeat'}));
            }, HEARTBEAT_MS);
            this.onChatStatus(true); resolve();
          }
        } catch (error) { reject(error); socket.close(); }
      };
      socket.onclose = () => {
        clearTimeout(timeout);
        if (this.chatSocket === socket) this.disconnectChat();
        if (!ready) reject(new LocalizedError('network.chatVerificationExpired'));
      };
      socket.onerror = () => socket.close();
    });
  }
  private disconnectChat() {
    if (this.chatHeartbeat) clearInterval(this.chatHeartbeat);
    this.chatHeartbeat = null;
    const socket = this.chatSocket; this.chatSocket = null;
    socket?.close();
    this.onChat([]); this.onChatStatus(false);
  }
  private queueAcknowledgement(mark: Pick<State, 'epoch' | 'cursor'>, socket: WebSocket) {
    const pending=this.pendingAck;
    if (!pending || mark.epoch>pending.epoch || mark.epoch===pending.epoch && mark.cursor>pending.cursor)
      this.pendingAck={epoch:mark.epoch,cursor:mark.cursor};
    if (this.ackTimer !== null) return;
    this.ackTimer=setTimeout(()=>{
      if (this.socket!==socket || this.stopped) return;
      const applied=this.pendingAck;
      this.ackTimer=null;this.pendingAck=null;
      if (applied && this.socket===socket && socket.readyState===WebSocket.OPEN && !this.stopped)
        socket.send(JSON.stringify({type:'ack',...applied}));
    },ACK_BATCH_MS);
  }
  private isBehindHead() {
    const head=this.progressHead,state=this.state;
    return !!head && !!state && head.generation===state.generation &&
      (head.epoch>state.epoch || head.epoch===state.epoch && head.cursor>state.cursor);
  }
  private clearProgress() {
    if (this.progressTimer !== null) clearTimeout(this.progressTimer);
    this.progressTimer=null;this.progressHead=null;
  }
  private observeHead(epoch: number, cursor: number, socket: WebSocket) {
    if (!Number.isSafeInteger(epoch) || !Number.isSafeInteger(cursor) || epoch<0 || cursor<0)
      throw new Error('생존 응답의 스트림 순번이 올바르지 않습니다.');
    if (!this.state) return;
    const head=this.progressHead;
    if (!head || head.generation!==this.state.generation || epoch>head.epoch || epoch===head.epoch && cursor>head.cursor)
      this.progressHead={generation:this.state.generation,epoch,cursor};
    if (!this.isBehindHead()) {this.clearProgress();return;}
    if (this.progressTimer !== null) return;
    // 생존 응답 바로 뒤에 오는 정상 이벤트를 기다린 뒤 누락이 남으면 복구한다.
    this.progressTimer=setTimeout(()=>{
      if (this.socket!==socket || this.stopped) return;
      const missing=this.isBehindHead();
      this.clearProgress();
      if (missing) this.reconnectSocket(socket, {key: 'network.reconnecting'});
    },STREAM_PROGRESS_WAIT_MS);
  }
  private clearHeartbeat() {
    if (this.ackTimer !== null) clearTimeout(this.ackTimer);
    this.ackTimer=null;this.pendingAck=null;
    this.clearProgress();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
  disconnect() {
    this.connectionAttempt++;this.sessionRevision++;
    this.refreshRequest=null;this.resumeRequest=null;
    this.stopActivity?.(); this.stopActivity = null;
    this.disconnectChat();
    this.stopped = true;
    this.clearHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const ws = this.socket;
    this.socket = null;
    ws?.close();
  }
  private async resolve(result: any, revision: number): Promise<any> {
    if (revision!==this.sessionRevision) return null;
    for (let attempt = 0; result.pending && attempt < 60; attempt++) {
      this.onStatus(false, {key: "network.transitioning"});
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (revision!==this.sessionRevision) return null;
      result = await this.request(
        `/v1/auth/operations/${result.operationId}/resolve`,
        { receipt: result.receipt },
      );
      if (revision!==this.sessionRevision) return null;
    }
    if (result.pending)
      throw new LocalizedError("network.transitionDelayed");
    return result;
  }
  async logout(): Promise<boolean> {
    // 이 로그아웃이 발생시킨 소켓 만료가 HTTP 전환 완료를 무효화하지 않게 한다.
    this.disconnect();
    const revision=this.sessionRevision;
    try {
      const response=await this.request("/v1/auth/logout", {});
      if (revision!==this.sessionRevision) return false;
      await this.resolve(response,revision);
      if (revision!==this.sessionRevision) return false;
      this.disconnect();
      this.tokens=null;
      this.state=null;
      return true;
    } catch (error) {
      if (revision!==this.sessionRevision) return false;
      throw error;
    }
  }
}
