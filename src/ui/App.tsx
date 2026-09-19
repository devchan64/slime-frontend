import { useEffect, useRef, useState } from "preact/hooks";
import { createGame } from "../game/createGame";

type RegisterForm = {
  userId: string;
  password: string;
  email: string;
  phone: string;
};

type LoginForm = {
  userId: string;
  password: string;
};

type ResetPasswordForm = {
  userId: string;
  emailOrPhone: string;
  newPassword: string;
};

type CharacterForm = {
  characterName: string;
};

type ApiResponse = {
  ok: boolean;
  message: string;
  user_id?: string;
  email?: string;
  phone?: string;
};

type TokenResponse = {
  ok: boolean;
  message: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

type CharacterResponse = {
  ok: boolean;
  message: string;
  user_id?: string;
  character_name?: string;
  saved_at?: string;
};

type ViewMode = "landing" | "start" | "webgl";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:18080";
const DEFAULT_LOCAL_USER_ID = "test";
const DEFAULT_LOCAL_PASSWORD = "Qwer!234";
const DEFAULT_LOCAL_CHARACTER_NAME = "준우";

function isLocalRuntime(): boolean {
  if (typeof window === "undefined") {
    return API_BASE_URL.includes("127.0.0.1") || API_BASE_URL.includes("localhost");
  }

  return (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost" ||
    API_BASE_URL.includes("127.0.0.1") ||
    API_BASE_URL.includes("localhost")
  );
}

function toDetailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return "요청 실패";

  const lines = detail
    .map((item) => {
      const loc = Array.isArray(item?.loc)
        ? item.loc.filter((x: string) => x !== "body").join(".")
        : "";
      const msg = item?.msg || "검증 실패";
      return loc ? `${loc}: ${msg}` : msg;
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join(" | ") : "요청 실패";
}

function toCharacterForm(data?: CharacterResponse | null): CharacterForm {
  return {
    characterName:
      data?.character_name || (isLocalRuntime() ? DEFAULT_LOCAL_CHARACTER_NAME : ""),
  };
}

function WebGLPage({
  onBack,
  characterName,
}: {
  onBack: () => void;
  characterName: string;
}) {
  const gameHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameHostRef.current) return;
    const game = createGame(gameHostRef.current);
    return () => game.destroy(true);
  }, [characterName]);

  return (
    <section class="webgl-page">
      <header class="webgl-header">
        <div>
          <h2>게임 플레이</h2>
          <p>{characterName} 캐릭터의 모험을 준비 중입니다.</p>
        </div>
        <button class="secondary" onClick={onBack}>
          시작 화면으로 돌아가기
        </button>
      </header>
      <div class="webgl-stage">
        <div ref={gameHostRef} class="game-host" />
        <aside class="minimap">
          <h3>MMO SRPG 준비 중</h3>
          <p>채널 탐색과 분리된 조우 전투를 준비하고 있습니다.</p>
          <p>현재는 플레이할 수 없습니다.</p>
        </aside>
      </div>
    </section>
  );
}

export function App() {
  const localRuntime = isLocalRuntime();
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    userId: "",
    password: "",
    email: "",
    phone: "",
  });
  const [loginForm, setLoginForm] = useState<LoginForm>({
    userId: localRuntime ? DEFAULT_LOCAL_USER_ID : "",
    password: localRuntime ? DEFAULT_LOCAL_PASSWORD : "",
  });
  const [resetForm, setResetForm] = useState<ResetPasswordForm>({
    userId: "",
    emailOrPhone: "",
    newPassword: "",
  });
  const [characterForm, setCharacterForm] = useState<CharacterForm>(toCharacterForm());
  const [savedCharacter, setSavedCharacter] = useState<CharacterResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState("로그인을 진행해 주세요.");
  const [isLoading, setIsLoading] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<ApiResponse | null>(null);
  const [tokens, setTokens] = useState<TokenResponse | null>(null);

  const passwordGuide = "비밀번호는 대문자/소문자/숫자/특수문자를 각각 1개 이상 포함해야 합니다.";

  async function register() {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: registerForm.userId,
          password: registerForm.password,
          email: registerForm.email,
          phone: registerForm.phone,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatusMessage(`회원가입 실패: ${toDetailMessage(data?.detail)}`);
        return;
      }
      setStatusMessage(`회원가입 성공: ${data.message}`);
      setLoginForm((prev) => ({ ...prev, userId: registerForm.userId }));
      setIsSignupOpen(false);
    } catch (error) {
      setStatusMessage(`회원가입 실패: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMe(accessToken: string) {
    const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(`인증 조회 실패: ${data?.detail || "요청 실패"}`);
      return;
    }
    setLoggedInUser(data);
  }

  async function loadCharacter(accessToken: string) {
    const response = await fetch(`${API_BASE_URL}/v1/characters/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(`캐릭터 조회 실패: ${data?.detail || "요청 실패"}`);
      return;
    }

    if (data?.character_name) {
      setSavedCharacter(data);
      setCharacterForm(toCharacterForm(data));
      setStatusMessage("저장된 캐릭터를 불러왔습니다. 바로 시작하거나 수정 후 다시 저장할 수 있습니다.");
      return;
    }

    setSavedCharacter(null);
    setCharacterForm(toCharacterForm(null));
    setStatusMessage(
      localRuntime
        ? "로그인 성공: 로컬 기본 캐릭터 이름이 미리 입력되어 있습니다. 저장 후 바로 시작할 수 있습니다."
        : "로그인 성공: 캐릭터를 생성하고 저장한 뒤 시작할 수 있습니다.",
    );
  }

  async function login() {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: loginForm.userId,
          password: loginForm.password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatusMessage(`로그인 실패: ${toDetailMessage(data?.detail)}`);
        setLoggedInUser(null);
        setSavedCharacter(null);
        return;
      }

      setTokens(data);
      await loadMe(data.access_token);
      await loadCharacter(data.access_token);
      setViewMode("start");
    } catch (error) {
      setStatusMessage(`로그인 실패: ${(error as Error).message}`);
      setLoggedInUser(null);
      setSavedCharacter(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPassword() {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: resetForm.userId,
          email_or_phone: resetForm.emailOrPhone,
          new_password: resetForm.newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatusMessage(`비밀번호 재설정 실패: ${data?.detail || "요청 실패"}`);
        return;
      }
      setStatusMessage(`비밀번호 재설정 성공: ${data.message}`);
      setLoginForm((prev) => ({ ...prev, userId: resetForm.userId, password: "" }));
      setIsResetOpen(false);
    } catch (error) {
      setStatusMessage(`비밀번호 재설정 실패: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveCharacter() {
    if (!tokens?.access_token) {
      setStatusMessage("캐릭터 저장 실패: 로그인 토큰이 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/characters/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({
          character_name: characterForm.characterName,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatusMessage(`캐릭터 저장 실패: ${toDetailMessage(data?.detail)}`);
        return;
      }

      setSavedCharacter(data);
      setCharacterForm(toCharacterForm(data));
      setStatusMessage(`캐릭터 저장 완료: ${data.character_name} 정보가 백엔드에 기록되었습니다.`);
    } catch (error) {
      setStatusMessage(`캐릭터 저장 실패: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function enterWebGL() {
    if (!tokens?.access_token) {
      setStatusMessage("접속 실패: 로그인 토큰이 없습니다.");
      return;
    }
    if (!savedCharacter?.character_name) {
      setStatusMessage("접속 실패: 캐릭터를 먼저 저장해 주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/access/enter`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setStatusMessage(`접속 실패: ${data?.detail || "요청 실패"}`);
        return;
      }
      setStatusMessage(`접속 성공: ${data.message}`);
      setViewMode("webgl");
    } catch (error) {
      setStatusMessage(`접속 실패: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function exitWebGL() {
    if (!tokens?.access_token) {
      setViewMode("start");
      return;
    }
    try {
      await fetch(`${API_BASE_URL}/v1/access/exit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
    } finally {
      setStatusMessage("게임 화면에서 시작 화면으로 돌아왔습니다.");
      setViewMode("start");
    }
  }

  async function logout() {
    if (tokens?.access_token) {
      try {
        await fetch(`${API_BASE_URL}/v1/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
      } catch {
        // 로그 전송 실패 시에도 로컬 로그아웃은 진행한다.
      }
    }

    setTokens(null);
    setSavedCharacter(null);
    setLoggedInUser(null);
    setLoginForm({
      userId: localRuntime ? DEFAULT_LOCAL_USER_ID : "",
      password: localRuntime ? DEFAULT_LOCAL_PASSWORD : "",
    });
    setCharacterForm(toCharacterForm(null));
    setStatusMessage(
      localRuntime
        ? "로그아웃이 완료되었습니다. 로컬 기본 계정과 캐릭터 이름이 다시 입력되었습니다."
        : "로그아웃이 완료되었습니다.",
    );
    setViewMode("landing");
  }

  if (viewMode === "webgl") {
    return (
      <WebGLPage
        onBack={exitWebGL}
        characterName={savedCharacter?.character_name || characterForm.characterName || "새 모험가"}
      />
    );
  }

  if (viewMode === "start") {
    return (
      <div class="landing-page">
        <div class="start-layout">
          <section class="hero">
            <h1>캐릭터 생성</h1>
            <p>로그인 이후 캐릭터를 만들고 저장하면 시작 버튼으로 게임 플레이 화면에 진입할 수 있습니다.</p>
            {localRuntime && (
              <p>로컬 실행에서는 기본 캐릭터 이름이 미리 입력되며, 기본 계정에 저장된 캐릭터를 바로 불러옵니다.</p>
            )}
            <div class="hero-steps">
              <span>1. 캐릭터 작성</span>
              <span>2. 백엔드 저장</span>
              <span>3. 시작 버튼으로 입장</span>
            </div>
            <div class="hero-actions">
              <button disabled={isLoading || !savedCharacter?.character_name} onClick={enterWebGL}>
                시작
              </button>
              <button class="secondary" disabled={isLoading} onClick={logout}>
                로그아웃
              </button>
            </div>
          </section>

          <section class="character-card">
            <h2>캐릭터 정보</h2>
            {localRuntime && <p>로컬 기본값으로 캐릭터 이름이 채워져 있습니다.</p>}
            <label>
              캐릭터 이름
              <input
                value={characterForm.characterName}
                onInput={(event) =>
                  setCharacterForm((prev) => ({
                    ...prev,
                    characterName: (event.currentTarget as HTMLInputElement).value,
                  }))
                }
                placeholder="준우"
              />
            </label>
            <div class="signup-actions">
              <button disabled={isLoading} onClick={saveCharacter}>
                캐릭터 저장
              </button>
              <button class="secondary" disabled={isLoading || !savedCharacter?.character_name} onClick={enterWebGL}>
                저장 후 시작
              </button>
            </div>
          </section>

          <section class="status-panel">
            <h2>상태</h2>
            <p>{statusMessage}</p>
            {loggedInUser && (
              <ul>
                <li>유저 ID: {loggedInUser.user_id}</li>
                <li>이메일: {loggedInUser.email}</li>
                <li>전화번호: {loggedInUser.phone}</li>
              </ul>
            )}
            {savedCharacter?.character_name && (
              <div class="character-summary">
                <strong>{savedCharacter.character_name}</strong>
                <span>
                  {localRuntime
                    ? "로컬 실행에서는 기본 계정에 연결된 캐릭터가 미리 준비되어 있습니다."
                    : "이름만 입력받고 나머지 정보는 기본값으로 저장합니다."}
                </span>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div class="landing-page">
      <div class="landing-main">
        <section class="hero">
          <h1>SLIME</h1>
          <p>로그인 후 캐릭터를 생성하고, 저장된 캐릭터로 게임 플레이 화면에 진입합니다.</p>
          {localRuntime && (
            <p>로컬 실행 기본값: ID test / PW Qwer!234 / 캐릭터 이름 준우</p>
          )}
        </section>

        <section class="login-card">
          <h2>로그인</h2>
          <label>
            유저 ID
            <input
              value={loginForm.userId}
              onInput={(event) =>
                setLoginForm((prev) => ({
                  ...prev,
                  userId: (event.currentTarget as HTMLInputElement).value,
                }))
              }
              placeholder="user_01"
            />
          </label>
          <label>
            비밀번호
            <input
              type={showLoginPassword ? "text" : "password"}
              value={loginForm.password}
              onInput={(event) =>
                setLoginForm((prev) => ({
                  ...prev,
                  password: (event.currentTarget as HTMLInputElement).value,
                }))
              }
              placeholder="비밀번호 입력"
            />
          </label>
          <label class="inline-check">
            <input
              type="checkbox"
              checked={showLoginPassword}
              onInput={(event) =>
                setShowLoginPassword((event.currentTarget as HTMLInputElement).checked)
              }
            />
            비밀번호 표시
          </label>
          <button disabled={isLoading} onClick={login}>
            로그인
          </button>
          <button class="secondary" disabled={isLoading} onClick={() => setIsSignupOpen(true)}>
            회원가입
          </button>
          <button class="secondary" disabled={isLoading} onClick={() => setIsResetOpen(true)}>
            비밀번호 찾기
          </button>
        </section>
      </div>

      {isSignupOpen && (
        <section class="signup-modal">
          <div class="signup-panel">
            <h2>회원가입</h2>
            <label>
              유저 ID
              <input
                value={registerForm.userId}
                onInput={(event) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    userId: (event.currentTarget as HTMLInputElement).value,
                  }))
                }
                placeholder="user_01"
              />
            </label>
            <label>
              비밀번호
              <input
                type={showSignupPassword ? "text" : "password"}
                value={registerForm.password}
                onInput={(event) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    password: (event.currentTarget as HTMLInputElement).value,
                  }))
                }
                placeholder="비밀번호 입력"
              />
            </label>
            <label class="inline-check">
              <input
                type="checkbox"
                checked={showSignupPassword}
                onInput={(event) =>
                  setShowSignupPassword((event.currentTarget as HTMLInputElement).checked)
                }
              />
              비밀번호 표시
            </label>
            <small>{passwordGuide}</small>
            <label>
              이메일
              <input
                value={registerForm.email}
                onInput={(event) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    email: (event.currentTarget as HTMLInputElement).value,
                  }))
                }
                placeholder="user@example.com"
              />
            </label>
            <label>
              전화번호
              <input
                value={registerForm.phone}
                onInput={(event) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    phone: (event.currentTarget as HTMLInputElement).value,
                  }))
                }
                placeholder="010-0000-0000"
              />
            </label>
            <div class="signup-actions">
              <button disabled={isLoading} onClick={register}>
                회원가입 진행
              </button>
              <button class="secondary" disabled={isLoading} onClick={() => setIsSignupOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </section>
      )}

      {isResetOpen && (
        <section class="signup-modal">
          <div class="signup-panel">
            <h2>비밀번호 찾기</h2>
            <label>
              유저 ID
              <input
                value={resetForm.userId}
                onInput={(event) =>
                  setResetForm((prev) => ({
                    ...prev,
                    userId: (event.currentTarget as HTMLInputElement).value,
                  }))
                }
                placeholder="user_01"
              />
            </label>
            <label>
              이메일 또는 전화번호
              <input
                value={resetForm.emailOrPhone}
                onInput={(event) =>
                  setResetForm((prev) => ({
                    ...prev,
                    emailOrPhone: (event.currentTarget as HTMLInputElement).value,
                  }))
                }
                placeholder="user@example.com 또는 010-0000-0000"
              />
            </label>
            <label>
              새 비밀번호
              <input
                type="password"
                value={resetForm.newPassword}
                onInput={(event) =>
                  setResetForm((prev) => ({
                    ...prev,
                    newPassword: (event.currentTarget as HTMLInputElement).value,
                  }))
                }
                placeholder="새 비밀번호 입력"
              />
            </label>
            <small>{passwordGuide}</small>
            <div class="signup-actions">
              <button disabled={isLoading} onClick={resetPassword}>
                비밀번호 재설정
              </button>
              <button class="secondary" disabled={isLoading} onClick={() => setIsResetOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </section>
      )}

      <section class="status-panel">
        <h2>상태</h2>
        <p>{statusMessage}</p>
        {tokens && <p>토큰 발급됨: access/refresh</p>}
      </section>
    </div>
  );
}
