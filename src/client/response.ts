export class ApiError extends Error {
  readonly messages?: Readonly<Record<ApiLocale, string>>;
  constructor(public code: string, message: string, public status: number, messages?: Record<ApiLocale, string>) {
    super(message);
    this.name = "ApiError";
    if (messages !== undefined) {
      readApiMessage({messages}, "ko");
      this.messages = Object.freeze({...messages});
    }
  }
}

export type ApiLocale = "ko" | "en";

/** 두 언어 계약을 검증한다. messages가 없는 직전 v1의 문자열만 명시적으로 호환한다. */
export function readApiMessage(data: Record<string, unknown>, locale: ApiLocale): string | undefined {
  if (locale !== "ko" && locale !== "en") throw new Error("지원하지 않는 API 메시지 언어입니다.");
  if (data.messages !== undefined) {
    const messages = data.messages;
    if (!messages || typeof messages !== "object" || Array.isArray(messages)
        || Object.keys(messages).sort().join() !== "en,ko") throw new Error("API 메시지 언어 계약이 올바르지 않습니다.");
    const pair = messages as Record<ApiLocale, unknown>;
    if (typeof pair.ko !== "string" || !pair.ko.trim() || typeof pair.en !== "string" || !pair.en.trim()) throw new Error("API 번역 메시지가 누락되었습니다.");
    return pair[locale] as string;
  }
  if (data.message === undefined) return undefined;
  if (typeof data.message !== "string" || !data.message.trim()) throw new Error("API 메시지 형식이 올바르지 않습니다.");
  return data.message;
}

export async function readApiResponse(response: Response, locale: ApiLocale = "ko", kind: "message" | "state" = "message"): Promise<any> {
  const body = await response.text();
  const invalidResponse = () => {
    const messages = {
      en: response.status >= 500
        ? `Server response error (HTTP ${response.status}). Check the API connection and try again.`
        : `The server did not return valid JSON (HTTP ${response.status}).`,
      ko: response.status >= 500
        ? `서버 응답 오류 (HTTP ${response.status}). API 서버 연결 상태를 확인한 뒤 다시 시도해 주세요.`
        : `서버가 올바른 JSON 응답을 보내지 않았습니다 (HTTP ${response.status}).`,
    };
    return new ApiError("INVALID_API_RESPONSE", messages[locale], response.status, messages);
  };
  if (!body.trim()) throw invalidResponse();
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json" && !mediaType?.endsWith("+json")) throw invalidResponse();
  let data: unknown;
  try { data = JSON.parse(body); }
  catch { throw invalidResponse(); }
  if (data === null || typeof data !== "object") throw invalidResponse();
  // 게임 상태의 messages는 채팅 목록이며 번역 안내 계약과 별개다.
  if (response.ok && kind === "state") {
    const state = data as Record<string, unknown>;
    if (state.protocolVersion !== 1 || !Array.isArray(state.messages)) throw invalidResponse();
    return state;
  }
  let message: string | undefined;
  try { message = readApiMessage(data as Record<string, unknown>, locale); }
  catch { throw invalidResponse(); }
  if (!response.ok) {
    const error = data as Record<string, unknown>;
    throw new ApiError(
      typeof error.code === "string" ? error.code : "REQUEST_FAILED",
      message ?? (locale === "en" ? `The request failed (HTTP ${response.status}).` : `요청을 처리하지 못했습니다 (HTTP ${response.status}).`),
      response.status,
      error.messages as Record<ApiLocale, string> | undefined,
    );
  }
  return message === undefined ? data : { ...data, message };
}
